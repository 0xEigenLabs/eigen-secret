const createBlakeHash = require("blake-hash");
const { buildEddsa } = require("circomlibjs");
import { prepareJson, uint8Array2Bigint } from "./utils";
import { JoinSplitCircuit } from "./join_split";
import { UpdateStatusCircuit } from "./update_state";
import { Prover } from "./prover";
import { Note, NoteState } from "./note";
import { Transaction, TransactionModelStatus } from "./transaction";
import { Context } from "./context";
import { AppError, ErrCode, errResp, succResp } from "./error";
import {
    AccountCircuit,
    compress as accountCompress,
    EigenAddress,
    SecretAccount,
    decryptNotes,
    SigningKey
} from "./account";
import { RollupSC } from "./rollup.sc";
import { pad } from "./state_tree";
import { poseidonSponge } from "./sponge_poseidon";
import { assert } from "chai";

const axios = require("axios").default;

/**
 * SecretSDK interface
 */
export class SecretSDK {
    alias: string;
    account: SecretAccount;
    circuitPath: string;
    rollupSC: RollupSC;
    serverAddr: any;
    eddsa: any;

    private txBuff: Array<any> = new Array(0);
    private noteBuff: Array<any> = new Array(0);

    constructor(
        account: SecretAccount,
        serverAddr: string,
        circuitPath: string,
        eddsa: any,
        userAccount: any,
        spongePoseidonAddress: string,
        tokenRegistryAddress: string,
        poseidon2Address: string,
        poseidon3Address: string,
        poseidon6Address: string,
        rollupAddress: string,
        smtVerifierAddress: string = ""
    ) {
        this.alias = account.alias;
        this.account = account;
        Prover.serverAddr = serverAddr; // init Prover client with serverAddr
        if (typeof window !== "undefined") {
            Prover.init()
        }
        this.serverAddr = serverAddr;
        this.circuitPath = circuitPath;
        this.eddsa = eddsa;
        this.rollupSC = new RollupSC(this.eddsa, account.alias, userAccount, spongePoseidonAddress, tokenRegistryAddress,
            poseidon2Address, poseidon3Address, poseidon6Address, rollupAddress, smtVerifierAddress);
    }

    private async curl(resource: string, params: any) {
        return SecretSDK.curlEx(this.serverAddr, resource, params);
    }

    static async curlEx(serverAddr: string, resource: string, params: any) {
        if (!resource.startsWith("/")) {
            resource = `/${resource}`;
        }
        if (serverAddr.endsWith("/")) {
            serverAddr = serverAddr.slice(0, serverAddr.length - 1)
        }
        let options = {
            method: "POST",
            url: serverAddr + resource,
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            data: prepareJson(params)
        };
        let response = await axios.request(options);
        if (response.status != 200) {
            return errResp(ErrCode.Unknown, "Server Internal Error")
        }
        return new AppError({
            errno: response.data.errno,
            message: response.data.message,
            data: response.data.data
        });
    }

    private async createServerAccount(
        ctx: Context,
        password: string
    ) {
        let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
        let secretAccount = this.account.serialize(key);
        let input = {
            context: ctx.serialize(),
            secretAccount: secretAccount
        };
        return this.curl("accounts/create", input)
    }

    private async updateServerAccount(
        ctx: Context,
        password: string
    ) {
        let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
        let secretAccount = this.account.serialize(key);
        let input = {
            context: ctx.serialize(),
            secretAccount: secretAccount
        };
        return this.curl("accounts/update", input)
    }

    /**
     * Initializes the SDK from either an existing account or no account.
     * @param {Context} ctx
     * @param {string} serverAddr The address of the server to connect to.
     * @param {string} password The password used to encrypt the SecretAccount for secure storage.
     * @param {any} user The Ethereum address of the user.
     * @param {any} contractJson The JSON object for the contract.
     * @param {string} circuitPath The path to the circuit file.
     * @param {any} contractABI The ABI of the contract.
     * @param {boolean} [isCreate=false] Flag indicating whether to create a new account. Optional.
     * @return {Promise<AppError>} An `AppError` object with `data` property of type 'class' that contains the initialized `SecretSDK` instance.
    */
    static async initSDKFromAccount(
        ctx: Context,
        serverAddr: string,
        password: string,
        user: any,
        contractJson: any,
        circuitPath: string,
        contractABI: any,
        isCreate: boolean = false
    ) {
        let eddsa = await buildEddsa();
        let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();

        let sa: any;
        if (isCreate) {
            let signingKey = new SigningKey(eddsa);
            let accountKey = new SigningKey(eddsa);
            let newSigningKey1 = new SigningKey(eddsa);
            let newSigningKey2 = new SigningKey(eddsa);
            sa = new SecretAccount(
                ctx.alias, accountKey, signingKey, accountKey, newSigningKey1, newSigningKey2
            );
        } else {
            // NOTICE: login, alias should be filled with utils.__DEFAULT_ALIAS__
            let input = {
                context: ctx.serialize()
            };
            let resp = await SecretSDK.curlEx(serverAddr, "accounts/get", input);
            if (!resp.ok) {
                if (resp.errno == ErrCode.RecordNotExist) {
                    return errResp(resp.errno, "Please register your Eigen Address")
                }
                return resp;
            }
            let accountData = resp.data;
            if (
                accountData.ethAddress !== ctx.ethAddress
            ) {
                return errResp(ErrCode.InvalidAuth, "Invalid ETH Address");
            }
            sa = SecretAccount.deserialize(eddsa, key, accountData.secretAccount)
            // IMPORTANT: override the ctx.alias
            ctx.alias = sa.alias;
        }

        let secretSDK = new SecretSDK(
            sa,
            serverAddr,
            circuitPath,
            eddsa,
            user,
            contractJson.spongePoseidon,
            contractJson.tokenRegistry,
            contractJson.poseidon2,
            contractJson.poseidon3,
            contractJson.poseidon6,
            contractJson.rollup,
            contractJson.smtVerifier
        );
        await secretSDK.initialize(contractABI);
        return succResp(secretSDK)
    }

    async updateStateTree(
        ctx: Context,
        outputNc1: bigint,
        nullifier1: bigint,
        outputNc2: bigint,
        nullifier2: bigint,
        acStateKey: bigint,
        padding: boolean = true
    ) {
        let input = {
            context: ctx.serialize(),
            padding: padding, // NOTE: DO NOT pad because we need call smtVerifier smartcontract
            newStates: {
                outputNc1: outputNc1,
                nullifier1: nullifier1,
                outputNc2: outputNc2,
                nullifier2: nullifier2,
                acStateKey: acStateKey
            }
        };

        return this.curl("statetree", input)
    }

    async getNotes(ctx: Context, noteState: Array<NoteState>, indices: Array<string> = []) {
        let input = {
            context: ctx.serialize(),
            noteState: noteState,
            indices: indices
        };
        return this.curl("notes/get", input);
    }

    private async addNotes(encryptedNotes: any) {
        this.noteBuff = this.noteBuff.concat(encryptedNotes);
    }

    private async createTx(input: any, proofAndPublicSignals: any, operation: string) {
        // let transaction = new Transaction(input.outputNotes, this.account.accountKey);
        // let txDataList = await transaction.encrypt(this.eddsa, false);
        // let txData = txDataList.map((x: any) => x.toString()).join("|");
        let inputData = {
            operation: operation,
            // txData: txData,
            noteIndex: input.inputNotes[0].index.toString(),
            note2Index: input.inputNotes[1].index.toString(),
            proof: Prover.serialize(proofAndPublicSignals.proof),
            publicInput: Prover.serialize(proofAndPublicSignals.publicSignals)
        };
        this.txBuff.push(inputData);
    }

    private async commit(ctx: Context) {
        let response = succResp("");
        if (this.txBuff.length > 0 || this.noteBuff.length > 0) {
            response = await this.curl(
                "transactions/create",
                {
                    context: ctx.serialize(),
                    notes: this.noteBuff,
                    inputs: this.txBuff
                }
            );
        }
        return response;
    }

    // rollback db
    async fallback(_ctx: Context) {

    }


    /**
     *
     * @param {Context} ctx
     * @param {Object} options, dictionary
     * @return {Object} transactions, e.g. [
     *  {
     *    operation: 'deposit',
     *    balance: '0',
     *    assetId: 2,
     *    to: '',
     *    txhash: '',
     *    timestamp: '2023-05-14 13:52:12.546 +00:00'
     *  }
     *]
     */
    async getTransactions(ctx: Context, options: any) {
        let data = {
            context: ctx.serialize(),
            page: options.page,
            pageSize: options.pageSize
        };
        let txListResult = await this.curl("transactions/get", data);
        if (!txListResult.ok) {
            return txListResult;
        }
        let txList = txListResult.data.transactions || [];
        // console.log("txList :", txList);
        let inputNotesIndices: Array<string> = [];
        txList.forEach((row: any) => {
            inputNotesIndices.push(row.noteIndex);
            inputNotesIndices.push(row.note2Index);
        });

        let noteState = [NoteState.PROVED, NoteState.SPENT]
        let notesResult = await this.getAndDecryptNote(ctx, noteState, inputNotesIndices, false);
        if (!notesResult.ok) {
            return notesResult;
        }
        let notes = notesResult.data;

        // reconstruct transaction
        let resp = []
        for (let tx of txList) {
            let note = notes.filter((row: any) => row.index.toString() === tx.noteIndex)
            let note2 = notes.filter((row: any) => row.index.toString() === tx.note2Index)

            resp.push({
                operation: tx.operation,
                balance: note[0].val + note2[0].val,
                assetId: note[0].assetId,
                to: "", // TODO
                status: TransactionModelStatus[tx.status],
                txhash: createBlakeHash("blake256").update(tx.proof).update(tx.publicInput).digest().toString("hex").slice(12),
                timestamp: tx.updatedAt
            });
        }
        return succResp(resp, true);
    }

    async submitProofs(ctx: Context, proofs: any) {
        let data = {
            context: ctx.serialize(),
            proofs: proofs
        };
        return this.curl("proof/create", data);
    }

    async getProofs(ctx: Context) {
        let data = {
            context: ctx.serialize()
        };
        return this.curl("proof/get", data);
    }

    /**
     * Connect the rollup contracts.
     * @param {Object} contractABI the contracts ABI directory
     */
    async initialize(
        contractABI: any
    ) {
        await this.rollupSC.initialize(
            contractABI.spongePoseidonContractABI,
            contractABI.tokenRegistryContractABI,
            contractABI.rollupContractABI,
            contractABI.testTokenContractABI,
            contractABI.smtVerifierContractABI
        );
    }

    /**
     * Fetch registered token list from server
     * @param {Context} ctx
     * @param {Object} assetInfo
     * @return {Map<string, Map>} token symbol to token asset id and it's contract address, e.g.
     * {
     *   message: 'Success',
     *   errno: 0,
     *   data: [
     *     {
     *       assetId: '2',
     *       token_symbol: 'TT',
     *       token_address: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
     *       latest_price: 1,
     *       latest_24h_price: 1
     *     }
     *   ]
     * }
     */
    async getAssetInfo(ctx: Context) {
        let data = {
            context: ctx.serialize()
        };
        return this.curl("assets/price", data);
    }

    /**
     * Obtain user balance.
     * @param {Context} ctx
     * @return {Promise<AppError>} An `AppError` object with `data` property of type 'Map' which contains user balance.
     * e.g. {"assetInfo":[{"assetId":2,"balance":"30","balanceUSD":30,"profit24Hour":0,"return":0}],"totalBalanceUSD":30}
     */
    async getAllBalance(ctx: Context) {
        let noteState = [NoteState.PROVED]
        let notes = await this.getAndDecryptNote(ctx, noteState);
        if (!notes.ok) {
            return notes;
        }
        let notesByAssetId: Map<number, bigint> = new Map();
        for (const note of notes.data) {
            if (!notesByAssetId.has(note.assetId)) {
                notesByAssetId.set(note.assetId, note.val);
            } else {
                notesByAssetId.set(note.assetId, (notesByAssetId.get(note.assetId) || 0n) + note.val);
            }
        }
        // console.log("notesByAssetId", notesByAssetId);
        let totalBalanceUSD = 0;
        let totalReturn = 0;
        let totalProfit24Hour = 0;
        let assetInfo = await this.getAssetInfo(ctx);
        if (!assetInfo.ok) {
            return assetInfo;
        }
        // console.log("assetInfo", assetInfo);
        let priceInfo = assetInfo.data;
        let prices: Map<number, number> = new Map();
        let last_24h_prices: Map<number, number> = new Map();

        priceInfo.forEach((row: any) => {
            if (row.assetId) {
                prices.set(Number(row.assetId), row.latest_price);
                last_24h_prices.set(Number(row.assetId), row.last_24h_prices);
            }
        });

        // get token price
        let resp = [];
        for (let [aid, val] of notesByAssetId) {
            let curPrice = prices.get(aid) || 1;
            let p24hPrice = last_24h_prices.get(aid) || 1;
            let profit = Number(val) * (curPrice - p24hPrice);

            resp.push({
                assetId: aid,
                balance: val,
                balanceUSD: Number(val) * curPrice,
                profit24Hour: profit,
                return: profit / (Number(val) * p24hPrice)
            });
            totalBalanceUSD += Number(val) * (prices.get(aid) || 1);
            totalProfit24Hour += profit;
            totalReturn += profit / (Number(val) * p24hPrice);
        }
        totalReturn /= notesByAssetId.size;
        return succResp({ assetInfo: resp, totalBalanceUSD, totalProfit24Hour, totalReturn }, true);
    }

    /**
     * Retrieve all current user's unspent notes.
     * @param {Context} ctx
     * @param {Array<NoteState>} noteState: Get current user's adopted notes and wild notes. A wild note's alias is ‘__DEFAULT_ALIAS__’.
     * @param {Array<string>} indices
     * @param {boolean} skipZeroNote is false if all notes(with val 0) are required to return
     * @return {Promise<AppError>} An `AppError` object with `data` property of type `Array<Note>` if notes are successfully retrieved.
     */
    private async getAndDecryptNote(ctx: Context, noteState: Array<NoteState>, indices: Array<string> = [], skipZeroNote: boolean = true) {
        let encryptedNotes = await this.getNotes(ctx, noteState, indices);
        if (!encryptedNotes.ok) {
            return encryptedNotes;
        }
        let allNotes = decryptNotes(this.account.accountKey, encryptedNotes.data, skipZeroNote);
        let resp = await this.adoptNotes(ctx, allNotes, encryptedNotes.data);
        if (!resp.ok) {
            return resp;
        }
        return succResp(allNotes);
    }

    private async adoptNotes(ctx: Context, notes: Array<Note>, encryptedNotes: Array<any>) {
        const wildNotes = notes.filter((n) => n.adopted === false);
        // encrypt wild notes, namely NoteModel
        let wildNoteModels: Array<any> = [];
        wildNotes.forEach((n: Note) => {
            // find the encrypted note for current decrypted note
            for (const en of encryptedNotes) {
                if (en.index.toString() === n.index.toString()) {
                    wildNoteModels.push({
                        alias: ctx.alias, // the only updated field
                        index: en.index,
                        pubKey: en.pubKey,
                        content: en.content,
                        state: en.state
                    });
                }
            }
        });
        // updates notes
        if (wildNoteModels.length > 0) {
            this.txBuff = [];
            this.noteBuff = [];
            this.addNotes(wildNoteModels);
            let res = await this.commit(ctx);
            if (!res.ok) {
                return res;
            }
        }
        return succResp(wildNoteModels);
    }

    /**
     * Create proof for the deposit of the asset from L1 to L2.
     * @param {Context} ctx
     * @param {string} receiver The receiver account address for the deposit.
     * @param {bigint} value The amount of asset to be deposited.
     * @param {number} assetId The token to be deposited.
     * @param {number} nonce The nonce of the current transaction, usually obtained from a wallet like Metamask.
     * @return {Promise<AppError>} An `AppError` object with `data` property of type 'string[]' which contains a batch of proof for the deposit.
     */
    async deposit(ctx: Context, receiver: string, value: bigint, assetId: number, nonce: number) {
        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_DEPOSIT;
        let tmpP = this.account.accountKey.pubKey.unpack(this.eddsa.babyJub);
        let tmpPub = [this.eddsa.F.toObject(tmpP[0]), this.eddsa.F.toObject(tmpP[1])];
        let keysFound = [];
        let valuesFound = [];
        let siblings = [];

        let accountRequired = false;
        const aliasHashBuffer = this.eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        const aliasHash = await uint8Array2Bigint(aliasHashBuffer);

        const signer = accountRequired ? this.account.accountKey: this.account.signingKey;
        const acStateKey = await accountCompress(this.account.accountKey, signer, aliasHash);
        let noteState = [NoteState.PROVED];
        let resp = await this.getAndDecryptNote(ctx, noteState);
        if (!resp.ok) {
            return resp;
        }
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
            this.eddsa,
            this.account.accountKey,
            this.account.signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            assetId,
            value,
            this.account.accountKey.pubKey,
            value,
            new EigenAddress(receiver),
            resp.data,
            accountRequired
        );
        let batchProof: string[] = [];
        this.txBuff = [];
        this.noteBuff = [];
        for (const input of inputs) {
            const proof = await this.updateStateTree(
                ctx,
                input.outputNCs[0],
                input.outputNotes[0].inputNullifier,
                input.outputNCs[1],
                input.outputNotes[1].inputNullifier,
                acStateKey
            );
            if (!proof.ok) {
                return proof;
            }
            let circuitInput = input.toCircuitInput(this.eddsa.babyJub, proof.data);
            let proofAndPublicSignals = await Prover.updateState(this.circuitPath, circuitInput);
            batchProof.push(Prover.serialize(proofAndPublicSignals));

            keysFound.push(input.outputNCs[0]);
            valuesFound.push(input.outputNotes[0].inputNullifier);
            keysFound.push(input.outputNCs[1]);
            valuesFound.push(input.outputNotes[1].inputNullifier);
            for (const item of proof.data.siblings) {
                let tmpSiblings = [];
                for (const sib of item) {
                    tmpSiblings.push(BigInt(sib));
                }
                siblings.push(tmpSiblings);
            }

            let transaction = new Transaction(input.outputNotes, this.account.accountKey);
            let txdata = await transaction.encrypt(this.eddsa);

            let txInput = new Transaction(input.inputNotes, this.account.accountKey);
            let txInputData = await txInput.encrypt(this.eddsa);
            // batch create tx
            this.createTx(input, proofAndPublicSignals, "deposit");
            let receipt = await this.rollupSC.update(proofAndPublicSignals);
            if (!receipt.ok) {
                return receipt
            }
            let _notes = [
                {
                    alias: this.alias,
                    index: input.inputNotes[0].index,
                    // it's the first depositing, so the init public key is a random
                    pubKey: txInputData[0].pubKey.pubKey,
                    content: txInputData[0].content,
                    state: NoteState.SPENT
                },
                {
                    alias: this.alias,
                    index: input.inputNotes[1].index,
                    pubKey: txInputData[1].pubKey.pubKey,
                    content: txInputData[1].content,
                    state: NoteState.SPENT
                },
                {
                    alias: this.alias,
                    index: input.outputNotes[0].index,
                    pubKey: txdata[0].pubKey.pubKey,
                    content: txdata[0].content,
                    state: NoteState.PROVED
                }
            ];
            if (input.outputNotes[1].val > 0) {
            _notes.push({
                    alias: this.alias,
                    index: input.outputNotes[1].index,
                    pubKey: txdata[1].pubKey.pubKey,
                    content: txdata[1].content,
                    state: NoteState.PROVED
                });
            }
            this.addNotes(_notes);
        }
        let receipt = await this.rollupSC.deposit(tmpPub, assetId, value, nonce);
        if (!receipt.ok) {
            return receipt
        }
        receipt = await this.rollupSC.processDeposits(this.rollupSC.userAccount, keysFound, valuesFound, siblings);
        if (!receipt.ok) {
            return receipt
        }
        let res = await this.commit(ctx);
        if (!res.ok) {
            return res;
        }
        return succResp(batchProof);
    }

    /**
     * Creates proof for sending an asset from the sender to the receiver in L2.
     * @param {Context} ctx
     * @param {string} receiver The receiver account address for the send.
     * @param {string} receiverAlias The receiver's alias or ‘__DEFAULT_ALIAS__’.
     * @param {bigint} value The amount of asset to be sent.
     * @param {number} assetId The token to be sent.
     * @param {boolean} accountRequired Enables signing with account key only.
     * @return {Promise<AppError>} An `AppError` object with `data` property of type 'string[]' which contains a batch of proof for the send.
     */
    async send(
        ctx: Context,
        receiver: string,
        receiverAlias: string,
        value: bigint,
        assetId: number
    ) {
        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_SEND;
        const aliasHashBuffer = this.eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        const aliasHash = await uint8Array2Bigint(aliasHashBuffer);
        const accountRequired = false;
        const signer = accountRequired ? this.account.accountKey : this.account.signingKey;
        const acStateKey = await accountCompress(this.account.accountKey, signer, aliasHash);
        let noteState = [NoteState.PROVED];
        let notes = await this.getAndDecryptNote(ctx, noteState);
        if (!notes.ok) {
            return notes;
        }
        let _receiver = new EigenAddress(receiver);
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
            this.eddsa,
            this.account.accountKey,
            this.account.signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            0,
            0n,
            undefined,
            value,
            _receiver,
            notes.data,
            accountRequired
        );

        let batchProof: string[] = [];
        this.noteBuff = [];
        this.txBuff = [];
        for (const input of inputs) {
            const proof = await this.updateStateTree(
                ctx,
                input.outputNCs[0],
                input.outputNotes[0].inputNullifier,
                input.outputNCs[1],
                input.outputNotes[1].inputNullifier,
                acStateKey
            );
            if (!proof.ok) {
                return proof;
            }
            let circuitInput = input.toCircuitInput(this.eddsa.babyJub, proof.data);
            let proofAndPublicSignals = await Prover.updateState(this.circuitPath, circuitInput);
            batchProof.push(Prover.serialize(proofAndPublicSignals));
            let transaction = new Transaction(input.outputNotes, this.account.accountKey);
            let txdata = await transaction.encrypt(this.eddsa);

            let txInput = new Transaction(input.inputNotes, this.account.accountKey);
            let txInputData = await txInput.encrypt(this.eddsa);
            // assert(txInputData[0].content, encryptedNotes[0].content);

            this.createTx(input, proofAndPublicSignals, "send");
            let receipt = await this.rollupSC.update(proofAndPublicSignals);
            if (!receipt.ok) {
                return receipt
            }

            let _notes: Array<any> = [
                {
                    alias: this.alias,
                    index: input.inputNotes[0].index,
                    pubKey: txInputData[0].pubKey.pubKey,
                    content: txInputData[0].content,
                    state: NoteState.SPENT
                },
                {
                    alias: this.alias,
                    index: input.inputNotes[1].index,
                    pubKey: txInputData[1].pubKey.pubKey,
                    content: txInputData[1].content,
                    state: NoteState.SPENT
                },
                {
                    alias: receiverAlias,
                    index: input.outputNotes[0].index,
                    pubKey: txdata[0].pubKey.pubKey,
                    content: txdata[0].content,
                    state: NoteState.PROVED
                }
            ];
            if (input.outputNotes[1].val > 0n) {
                _notes.push({
                    alias: this.alias,
                    index: input.outputNotes[1].index,
                    pubKey: txdata[1].pubKey.pubKey,
                    content: txdata[1].content,
                    state: NoteState.PROVED
                });
            }
            this.addNotes(_notes);
        }
        let res = await this.commit(ctx)
        if (!res.ok) {
            return res;
        }
        return succResp(batchProof);
    }

    /**
     * Creates a proof for withdrawing an asset from L2 to L1.
     * @param {Context} ctx
     * @param {string} receiver
     * @param {bigint} value The amount to be withdrawn.
     * @param {number} assetId The token to be withdrawn.
     * @return {Promise<AppError>} An `AppError` object with `data` property of type 'string[]' which contains a batch of proof for the withdraw.
     */
    async withdraw(ctx: Context, receiver: string, value: bigint, assetId: number) {
        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_WITHDRAW;
        let accountRequired = false;
        const aliasHashBuffer = this.eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        const aliasHash = await uint8Array2Bigint(aliasHashBuffer);
        const signer = accountRequired ? this.account.accountKey : this.account.signingKey;
        const acStateKey = await accountCompress(this.account.accountKey, signer, aliasHash);
        let noteState = [NoteState.PROVED];
        let notes = await this.getAndDecryptNote(ctx, noteState);
        if (!notes.ok) {
            return notes;
        }
        assert(notes.data.length > 0, "Invalid notes");
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
            this.eddsa,
            this.account.accountKey,
            this.account.signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            assetId,
            value,
            new EigenAddress(receiver),
            0n,
            this.account.accountKey.pubKey,
            notes.data,
            accountRequired
        );

        let batchProof: string[] = [];
        let lastKeys: Array<bigint> = [];
        let keysFound = [];
        let valuesFound = [];
        let dataTreeRootsFound: Array<bigint> = [];
        let lastDataTreeRoot: bigint = 0n;
        let siblings = [];
        this.noteBuff = [];
        this.txBuff = [];
        for (const input of inputs) {
            const proof = await this.updateStateTree(
                ctx,
                input.outputNCs[0],
                input.outputNotes[0].inputNullifier,
                input.outputNCs[1],
                input.outputNotes[1].inputNullifier,
                acStateKey,
                false
            );
            if (!proof.ok) {
                return proof;
            }
            let rawSiblings = proof.data.siblings;
            let paddedSiblings = [
                pad(rawSiblings[0]),
                pad(rawSiblings[1])
            ];
            proof.data.siblings = paddedSiblings;
            proof.data.siblingsAC = pad(proof.data.siblingsAC);
            let circuitInput = input.toCircuitInput(this.eddsa.babyJub, proof.data);
            let proofAndPublicSignals = await Prover.updateState(this.circuitPath, circuitInput);
            batchProof.push(Prover.serialize(proofAndPublicSignals));

            keysFound.push(input.outputNCs[0]);
            valuesFound.push(input.outputNotes[0].inputNullifier);
            keysFound.push(input.outputNCs[1]);
            valuesFound.push(input.outputNotes[1].inputNullifier);
            dataTreeRootsFound.push(BigInt(proof.data.dataTreeRoot));
            lastDataTreeRoot = BigInt(proof.data.dataTreeRoot);
            lastKeys = input.outputNCs;

            for (const item of rawSiblings) {
                let tmpSiblings = [];
                for (const sib of item) {
                    tmpSiblings.push(sib);
                }
                siblings.push(tmpSiblings);
            }

            let transaction = new Transaction(input.outputNotes, this.account.accountKey);
            let txdata = await transaction.encrypt(this.eddsa);

            let txInput = new Transaction(input.inputNotes, this.account.accountKey);
            let txInputData = await txInput.encrypt(this.eddsa);
            // assert(txInputData[0].content, encryptedNotes[0].content);

            this.createTx(input, proofAndPublicSignals, "withdraw");
            // call contract and deposit
            let receipt = await this.rollupSC.update(proofAndPublicSignals);
            // console.log(`receipt: ${JSON.stringify(receipt)}`)
            if (!receipt.ok) {
                return receipt
            }
            // settle down the spent notes
            let _notes: Array<any> = [
                {
                    alias: this.alias,
                    index: input.inputNotes[0].index,
                    pubKey: txInputData[0].pubKey.pubKey,
                    content: txInputData[0].content,
                    state: NoteState.SPENT
                },
                {
                    alias: this.alias,
                    index: input.inputNotes[1].index,
                    pubKey: txInputData[1].pubKey.pubKey,
                    content: txInputData[1].content,
                    state: NoteState.SPENT
                },
                {
                    alias: this.alias,
                    index: input.outputNotes[0].index,
                    pubKey: txdata[0].pubKey.pubKey,
                    content: txdata[0].content,
                    state: NoteState.SPENT
                }
            ];
            if (input.outputNotes[1].val > 0n) {
                _notes.push({
                    alias: this.alias,
                    index: input.outputNotes[1].index,
                    pubKey: txdata[1].pubKey.pubKey,
                    content: txdata[1].content,
                    state: NoteState.PROVED
                });
            }
            this.addNotes(_notes);
        }

        let tmpP = this.account.signingKey.pubKey.unpack(this.eddsa.babyJub);
        let xy = [this.eddsa.F.toObject(tmpP[0]), this.eddsa.F.toObject(tmpP[1])];
        // last tx
        const txInfo = {
            publicValue: value, // lastProof.publicSignals[1]
            publicOwner: xy, // lastProof.publicSignals[2]
            outputNc1: lastKeys[0], // lastProof.publicSignals[4]
            outputNc2: lastKeys[1], // lastProof.publicSignals[5]
            publicAssetId: assetId, // lastProof.publicSignals[7]
            dataTreeRoot: lastDataTreeRoot,
            roots: dataTreeRootsFound,
            keys: keysFound,
            values: valuesFound,
            siblings: siblings
        }

        // FIXME hash sibings and tree
        let hashInput = [
            BigInt(txInfo.publicValue),
            txInfo.publicOwner[0],
            txInfo.publicOwner[1],
            txInfo.outputNc1,
            txInfo.outputNc2,
            BigInt(txInfo.publicAssetId)
        ];
        for (let i = 0; i < txInfo.roots.length; i ++) {
            hashInput.push(txInfo.roots[i])
        }
        let msg = await poseidonSponge(
            hashInput
        );

        // DEBUG: check by smt verifier
        /*
        let tmpRoot = await this.rollupSC.SMT.smtVerifier(
            txInfo.siblings[0], txInfo.keys[0],
            txInfo.values[0], 0, 0, false, false, 20
        )
        expect(tmpRoot.toString()).to.eq(txInfo.roots[0].toString());

        tmpRoot = await this.rollupSC.SMT.smtVerifier(
            txInfo.siblings[1], txInfo.keys[1],
            txInfo.values[1], 0, 0, false, false, 20
        )
        expect(tmpRoot.toString()).to.eq(txInfo.roots[0].toString());
        */

        let sig = await this.account.signingKey.sign(this.eddsa.F.e(msg));
        let input = {
            enabled: 1,
            Ax: xy[0],
            Ay: xy[1],
            M: msg,
            R8x: this.eddsa.F.toObject(sig.R8[0]),
            R8y: this.eddsa.F.toObject(sig.R8[1]),
            S: sig.S
        }
        let proofAndPublicSignals = await Prover.withdraw(this.circuitPath, input);
        let receipt = await this.rollupSC.withdraw(
            this.rollupSC.userAccount,
            txInfo,
            proofAndPublicSignals
        );
        if (!receipt.ok) {
            return receipt
        }
        let res = await this.commit(ctx);
        if (!res.ok) {
            return res;
        }
        return succResp(batchProof);
    }

    /**
     * register testToken to rollup contract
     */
    async setRollupNC() {
        await this.rollupSC.setRollupNC();
    }

    /**
     * register testToken to rollup contract
     * @param {string} token
     */
    async registerToken(token: string) {
        await this.rollupSC.registerToken(token);
    }

    /**
     * register testToken to rollup contract
     * @param {string} token
     */
    async approveToken(token: string) {
        return await this.rollupSC.approveToken(token);
    }

    async createAsset(ctx: Context, token: string, assetId: any) {
        let data = {
            context: ctx.serialize(),
            assetId: assetId,
            contractAddress: token
        };
        return this.curl("assets/create", data);
    }

    async approve(token: string, value: bigint) {
        return await this.rollupSC.approve(token, value);
    }

    async getRegisteredToken(id: bigint) {
        return await this.rollupSC.getRegisteredToken(id);
    }

    /**
     * Create proof for the secret account created.
     * @param {Context} ctx
     * @param {string} password The password used to decrypt the SecretAccount.
     * @return {Promise<AppError>} An `AppError` object with `data` property of type 'string[]' which contains a batch of proof for the createAccount.
     */
    async createAccount(ctx: Context, password: string) {
        const F = this.eddsa.F;
        let proofId = AccountCircuit.PROOF_ID_TYPE_CREATE;
        let newAccountPubKey = this.account.accountKey.pubKey.unpack(this.eddsa.babyJub);
        newAccountPubKey = [F.toObject(newAccountPubKey[0]), F.toObject(newAccountPubKey[1])];
        let newSigningPubKey1 = this.account.newSigningKey1.pubKey.unpack(this.eddsa.babyJub);
        newSigningPubKey1 = [F.toObject(newSigningPubKey1[0]), F.toObject(newSigningPubKey1[1])];
        let newSigningPubKey2 = this.account.newSigningKey2.pubKey.unpack(this.eddsa.babyJub);
        newSigningPubKey2 = [F.toObject(newSigningPubKey2[0]), F.toObject(newSigningPubKey2[1])];
        const aliasHashBuffer = this.eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        let aliasHash = uint8Array2Bigint(aliasHashBuffer);
        let input = await UpdateStatusCircuit.createAccountInput(
            this.eddsa,
            proofId,
            this.account.accountKey,
            this.account.signingKey,
            newAccountPubKey,
            newSigningPubKey1,
            newSigningPubKey2,
            aliasHash
        );
        let keysFound = [];
        let valuesFound = [];
        let siblings = [];
        let accountRequired = false;
        const signer = accountRequired ? this.account.accountKey : this.account.signingKey;
        let acStateKey = await accountCompress(this.account.accountKey, signer, aliasHash);
        let smtProof = await this.updateStateTree(ctx, acStateKey, 1n, 0n, 0n, acStateKey);
        if (!smtProof.ok) {
            return smtProof;
        }
        let circuitInput = input.toCircuitInput(this.eddsa.babyJub, smtProof.data);
        // create final proof
        let proofAndPublicSignals = await Prover.updateState(this.circuitPath, circuitInput);
        if (!Prover.verifyState(this.circuitPath, proofAndPublicSignals)) {
            throw new Error("Invalid proof")
        }

        keysFound.push(acStateKey);
        valuesFound.push(1n);
        let tmpSiblings = [];
        for (const sib of smtProof.data.siblings[0]) {
            tmpSiblings.push(BigInt(sib));
        }
        siblings.push(tmpSiblings);
        let receipt = await this.rollupSC.update(proofAndPublicSignals);
        if (!receipt.ok) {
            return receipt
        }
        let resp = await this.createServerAccount(ctx, password);
        if (!resp.ok) {
            return resp;
        }
        return succResp(proofAndPublicSignals);
    }

    /**
     * Create a proof for updating the user's signing key.
     * @param {Context} ctx
     * @param {SigningKey} newSigningKey The new signing key to be updated to.
     * @param {string} password The password used to decrypt the SecretAccount.
     * @return {Promise<AppError>} An `AppError` object with `data` property of type 'string[]' which contains a batch of proof for the updateAccount.
     */
    async updateAccount(ctx: Context, newSigningKey: SigningKey, password: string) {
        let proofId = AccountCircuit.PROOF_ID_TYPE_UPDATE;
        let newAccountPubKey = this.account.accountKey.toCircuitInput();
        // let newSigningPubKey1 = this.account.newSigningKey1.toCircuitInput();
        let newSigningPubKey2 = this.account.newSigningKey2.toCircuitInput();
        let newSigningPubKey = newSigningKey.toCircuitInput();
        const aliasHashBuffer = this.eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        let aliasHash = uint8Array2Bigint(aliasHashBuffer);
        let input = await UpdateStatusCircuit.createAccountInput(
            this.eddsa,
            proofId,
            this.account.accountKey,
            this.account.newSigningKey1, // update signing key
            newAccountPubKey[0],
            newSigningPubKey2[0],
            newSigningPubKey[0],
            aliasHash
        );
        let smtProof = await this.updateStateTree(ctx, input.newAccountNC, 1n, 0n, 0n, input.newAccountNC);
        if (!smtProof.ok) {
            return smtProof;
        }
        let inputJson = input.toCircuitInput(this.eddsa.babyJub, smtProof.data);

        // create final proof
        let proofAndPublicSignals = await Prover.updateState(this.circuitPath, inputJson);

        if (!Prover.verifyState(this.circuitPath, proofAndPublicSignals)) {
            throw new Error("Invalid proof")
        }

        let proofs = new Array<string>(0);
        proofs.push(Prover.serialize(proofAndPublicSignals));
        let noteState = [NoteState.PROVED]
        let notes = await this.getAndDecryptNote(ctx, noteState);
        if (!notes.ok) {
            return notes;
        }
        let notesByAssetId: Map<number, bigint> = new Map();
        for (const note of notes.data) {
            if (!notesByAssetId.has(note.assetId)) {
                notesByAssetId.set(note.assetId, note.val);
            } else {
                notesByAssetId.set(note.assetId, (notesByAssetId.get(note.assetId) || 0n) + note.val);
            }
        }
        // To re-encrypt the output notes with new signingKey, update signingKey immediately.
        this.account.signingKey = this.account.newSigningKey1;
        this.account.newSigningKey1 = this.account.newSigningKey2;
        this.account.newSigningKey2 = newSigningKey;

        for (let aid of notesByAssetId.keys()) {
            let val = notesByAssetId.get(aid);
            if (val !== undefined && BigInt(val) > 0n) {
                let prf = await this.send(
                    ctx,
                    this.account.accountKey.pubKey.pubKey,
                    this.alias,
                    val,
                    Number(aid)
                );
                if (!prf.ok) {
                    return prf;
                }
                proofs.concat(prf.data);
            }
        }
        let resp = await this.updateServerAccount(ctx, password);
        if (!resp.ok) {
            return resp;
        }
        return succResp(proofs);
    }

    /**
     * Create proof for migrating the account to another ETH address.
     * @param {Object} ctx
     * @param {SigningKey} newAccountKey The account key that which user renews.
     * @param {string} password The password used to decrypt the SecretAccount.
     * @return {Promise<AppError>} An `AppError` object with `data` property of type 'string[]' which contains a batch of proof for the migrateAccount.
     */
    async migrateAccount(ctx: Context, newAccountKey: SigningKey, password: string) {
        let proofId = AccountCircuit.PROOF_ID_TYPE_MIGRATE;
        let newAccountPubKey = newAccountKey.toCircuitInput();
        let newSigningPubKey1 = this.account.newSigningKey1.toCircuitInput();
        let newSigningPubKey2 = this.account.newSigningKey2.toCircuitInput();
        const aliasHashBuffer = this.eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        let aliasHash = uint8Array2Bigint(aliasHashBuffer);
        let input = await UpdateStatusCircuit.createAccountInput(
            this.eddsa,
            proofId,
            this.account.accountKey,
            this.account.signingKey,
            newAccountPubKey[0],
            newSigningPubKey1[0],
            newSigningPubKey2[0],
            aliasHash
        );
        // insert the new account key
        let smtProof = await this.updateStateTree(ctx, input.newAccountNC, 1n, 0n, 0n, input.newAccountNC);
        if (!smtProof.ok) {
            return smtProof;
        }
        let inputJson = input.toCircuitInput(this.eddsa.babyJub, smtProof.data);

        // create final proof
        let proofAndPublicSignals = await Prover.updateState(this.circuitPath, inputJson);

        if (!Prover.verifyState(this.circuitPath, proofAndPublicSignals)) {
            return errResp(ErrCode.InvalidProof, ErrCode[ErrCode.InvalidProof])
        }
        let proofs = new Array<string>(0);
        proofs.push(Prover.serialize(proofAndPublicSignals));

        let noteState = [NoteState.PROVED, NoteState.PROVED]
        let notes = await this.getAndDecryptNote(ctx, noteState);
        if (!notes.ok) {
            return notes;
        }
        let res = await this.commit(ctx);
        if (!res.ok) {
            return res;
        }

        let notesByAssetId: Map<number, bigint> = new Map();
        for (const note of notes.data) {
            if (!notesByAssetId.has(note.assetId)) {
                notesByAssetId.set(note.assetId, note.val);
            } else {
                notesByAssetId.set(note.assetId, (notesByAssetId.get(note.assetId) || 0n) + note.val);
            }
        }
        // send to user itself
        for (let aid of notesByAssetId.keys()) {
            let val = notesByAssetId.get(aid);
            if (val !== undefined && BigInt(val) > 0n) {
                let prf = await this.send(
                    ctx,
                    newAccountKey.pubKey.pubKey,
                    this.alias,
                    val,
                    Number(aid)
                );
                if (!prf.ok) {
                    return prf;
                }
                proofs.concat(prf.data);
            }
        }
        this.account.accountKey = newAccountKey;
        this.account.newAccountKey = newAccountKey;
        let resp = await this.updateServerAccount(ctx, password);
        if (!resp.ok) {
            return resp;
        }
        return succResp(proofs);
    }
}
