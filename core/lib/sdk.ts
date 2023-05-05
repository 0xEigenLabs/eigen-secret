const createBlakeHash = require("blake-hash");
const { buildEddsa } = require("circomlibjs");
import { prepareJson, uint8Array2Bigint } from "./utils";
import { JoinSplitCircuit } from "./join_split";
import { UpdateStatusCircuit } from "./update_state";
import { Prover } from "./prover";
// const consola = require("consola");
import { Note, NoteState } from "./note";
import { Transaction } from "./transaction";
import { Context } from "./context";
import {
    AccountCircuit,
    compress as accountCompress,
    EigenAddress,
    SecretAccount,
    SigningKey
} from "./account";
import { RollupSC } from "./rollup.sc";
import { pad } from "./state_tree";
import { poseidonSponge } from "./sponge_poseidon";
import { expect, assert } from "chai";

const axios = require("axios").default;

/**
 * SecretSDK interface
 */
export class SecretSDK {
    alias: string;
    account: SecretAccount;
    circuitPath: string;
    rollupSC: RollupSC;
    keysFound: any;
    valuesFound: any;
    siblings: any;
    serverAddr: any;
    eddsa: any;

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
        this.serverAddr = serverAddr;
        this.circuitPath = circuitPath;
        this.eddsa = eddsa;
        this.rollupSC = new RollupSC(this.eddsa, account.alias, userAccount, spongePoseidonAddress, tokenRegistryAddress,
            poseidon2Address, poseidon3Address, poseidon6Address, rollupAddress, smtVerifierAddress);
        this.keysFound = [];
        this.valuesFound = [];
        this.siblings = [];
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
        if (response.status != 200 || response.data.errno != 0) {
            throw new Error(response.data.message);
        }
        return response.data.data;
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

    static async initSDKFromAccount(
        ctx: Context,
        serverAddr: string,
        password: string,
        user: any,
        contractJson: any,
        circuitPath: string,
        contractABI: any,
        sa: SecretAccount | undefined = undefined
    ) {
        let input = {
            context: ctx.serialize()
        };
        let eddsa = await buildEddsa();
        let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();

        if (sa === undefined) {
            let accountData = await SecretSDK.curlEx(serverAddr, "accounts/get", input);
            if (
                accountData.alias !== ctx.alias ||
                accountData.ethAddress !== ctx.ethAddress
            ) {
                throw new Error("Invalid alias");
            }
            sa = SecretAccount.deserialize(eddsa, key, accountData.secretAccount)
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
        return secretSDK;
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

    async getNote(ctx: Context, noteState: any) {
        let input = {
            context: ctx.serialize(),
            noteState: noteState
        };
        return this.curl("notes/get", input);
    }

    async updateNote(ctx: Context, notes: any) {
        let input = {
            context: ctx.serialize(),
            notes
        };
        return this.curl("notes/update", input);
    }

    async createTx(ctx: Context, receiverAlias: any, txdata: any, input: any, proofAndPublicSignals: any) {
        let inputData = {
            context: ctx.serialize(),
            receiverAlias: receiverAlias,
            pubKey: txdata[0].pubKey.pubKey,
            pubKey2: txdata[1].pubKey.pubKey,
            content: txdata[0].content,
                content2: txdata[1].content,
                noteIndex: input.outputNotes[0].index.toString(),
                note2Index: input.outputNotes[1].index.toString(),
                proof: Prover.serialize(proofAndPublicSignals.proof),
                publicInput: Prover.serialize(proofAndPublicSignals.publicSignals)
        };
        return this.curl("transactions/create", inputData);
    }

    async getTransactions(ctx: Context, option: any) {
        let data = {
            context: ctx.serialize(),
            page: option.page,
            pageSize: option.pageSize
        };
        return this.curl("transactions/get", data);
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
        return this.curl("proof/create", data);
    }

    /**
     * connect the rollup contracts
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
     * obtain user balance
     * @param {Context} ctx
     * @return {Map} user balance
     */
    async getAllBalance(ctx: Context) {
        let noteState = [NoteState.PROVED]
        let notes: Array<Note> = await this.getAndDecryptNote(ctx, noteState);
        let notesByAssetId: Map<number, bigint> = new Map();
        for (const note of notes) {
            if (!notesByAssetId.has(note.assetId)) {
                notesByAssetId.set(note.assetId, note.val);
            } else {
                notesByAssetId.set(note.assetId, (notesByAssetId.get(note.assetId) || 0n) + note.val);
            }
        }
        return notesByAssetId;
    }

    async getAndDecryptNote(ctx: Context, noteState: Array<NoteState>) {
        let notes: Array<Note> = [];
        let encryptedNotes = await this.getNote(ctx, noteState);
        if (encryptedNotes) {
            encryptedNotes.forEach((item: any) => {
                let sharedKey = this.account.signingKey.makeSharedKey(new EigenAddress(item.pubKey));
                let tmpNote = Note.decrypt(item.content, sharedKey);
                if (tmpNote.val > 0) {
                    notes.push(tmpNote);
                }
            });
        }
        return notes;
    }

    /**
     * create proof for the deposit of the asset from L1 to L2
     *
     * @param {Context} ctx
     * @param {string} receiver
     * @param {bigint} value the amount to be deposited
     * @param {number} assetId the token to be deposited
     * @param {number} nonce the nonce of current transaction, usually obtained from Wallet like Metamask
     * @return {Object} a batch of proof
     */
    async deposit(ctx: Context, receiver: string, value: bigint, assetId: number, nonce: number) {
        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_DEPOSIT;
        let tmpP = this.account.accountKey.pubKey.unpack(this.eddsa.babyJub);
        let tmpPub = [this.eddsa.F.toObject(tmpP[0]), this.eddsa.F.toObject(tmpP[1])];

        await this.rollupSC.deposit(tmpPub, assetId, value, nonce);

        let accountRequired = false;
        const aliasHashBuffer = this.eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        const aliasHash = await uint8Array2Bigint(aliasHashBuffer);

        const signer = accountRequired ? this.account.accountKey: this.account.signingKey;
        const acStateKey = await accountCompress(this.account.accountKey, signer, aliasHash);
        let noteState = [NoteState.CREATING, NoteState.PROVED]
        let notes: Array<Note> = await this.getAndDecryptNote(ctx, noteState);
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
            notes,
            accountRequired
        );
        let batchProof: string[] = [];
        for (const input of inputs) {
            const proof = await this.updateStateTree(
                ctx,
                input.outputNCs[0],
                input.outputNotes[0].inputNullifier,
                input.outputNCs[1],
                input.outputNotes[1].inputNullifier,
                acStateKey
            );
            let circuitInput = input.toCircuitInput(this.eddsa.babyJub, proof);
            let proofAndPublicSignals = await Prover.updateState(this.circuitPath, circuitInput);
            batchProof.push(Prover.serialize(proofAndPublicSignals));

            this.keysFound.push(input.outputNCs[0]);
            this.valuesFound.push(input.outputNotes[0].inputNullifier);
            this.keysFound.push(input.outputNCs[1]);
            this.valuesFound.push(input.outputNotes[1].inputNullifier);
            for (const item of proof.siblings) {
                let tmpSiblings = [];
                for (const sib of item) {
                    tmpSiblings.push(BigInt(sib));
                }
                this.siblings.push(tmpSiblings);
            }

            let transaction = new Transaction(input.outputNotes, this.account.signingKey);
            let txdata = await transaction.encrypt(this.eddsa);

            let txInput = new Transaction(input.inputNotes, this.account.signingKey);
            let txInputData = await txInput.encrypt(this.eddsa);
            await this.createTx(ctx, this.alias, txdata, input, proofAndPublicSignals);

            await this.rollupSC.update(proofAndPublicSignals);

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
            await this.updateNote(ctx, _notes);
        }
        await this.rollupSC.processDeposits(this.rollupSC.userAccount, this.keysFound, this.valuesFound, this.siblings);
        return batchProof;
    }

    /**
     * create proof for sending the asset to the receiver in L2
     *
     * @param {Context} ctx
     * @param {string} receiver
     * @param {string} receiverAlias use for test
     * @param {bigint} value the amount to be sent
     * @param {number} assetId the token to be sent
     * @param {boolean} accountRequired enables signing with account key only
     * @return {Object} a batch of proof
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
        let notes: Array<Note> = await this.getAndDecryptNote(ctx, noteState);
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
            notes,
            accountRequired
        );

        let batchProof: string[] = [];
        for (const input of inputs) {
            const proof = await this.updateStateTree(
                ctx,
                input.outputNCs[0],
                input.outputNotes[0].inputNullifier,
                input.outputNCs[1],
                input.outputNotes[1].inputNullifier,
                acStateKey
            );
            let circuitInput = input.toCircuitInput(this.eddsa.babyJub, proof);
            let proofAndPublicSignals = await Prover.updateState(this.circuitPath, circuitInput);
            batchProof.push(Prover.serialize(proofAndPublicSignals));
            let transaction = new Transaction(input.outputNotes, this.account.signingKey);
            let txdata = await transaction.encrypt(this.eddsa);

            let txInput = new Transaction(input.inputNotes, this.account.signingKey);
            let txInputData = await txInput.encrypt(this.eddsa);
            // assert(txInputData[0].content, encryptedNotes[0].content);

            await this.createTx(ctx, receiverAlias, txdata, input, proofAndPublicSignals);
            await this.rollupSC.update(proofAndPublicSignals);

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
            await this.updateNote(ctx, _notes);
        }
        return batchProof;
    }

    /**
     * create proof for withdrawing asset from L2 to L1
     *
     * @param {Context} ctx
     * @param {string} receiver
     * @param {bigint} value the amount to be withdrawn
     * @param {number} assetId the token to be withdrawn
     * @return {Object} a batch of proof
     */
    async withdraw(ctx: Context, receiver: string, value: bigint, assetId: number) {
        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_WITHDRAW;
        let accountRequired = false;
        const aliasHashBuffer = this.eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        const aliasHash = await uint8Array2Bigint(aliasHashBuffer);
        const signer = accountRequired ? this.account.accountKey : this.account.signingKey;
        const acStateKey = await accountCompress(this.account.accountKey, signer, aliasHash);
        let noteState = [NoteState.PROVED];
        let notes: Array<Note> = await this.getAndDecryptNote(ctx, noteState);
        assert(notes.length > 0, "Invalid notes");
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
            0n,
            this.account.accountKey.pubKey,
            notes,
            accountRequired
        );

        let batchProof: string[] = [];
        let lastKeys: Array<bigint> = [];
        let keysFound = [];
        let valuesFound = [];
        let dataTreeRootsFound: Array<bigint> = [];
        let lastDataTreeRoot: bigint = 0n;
        let siblings = [];

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
            let rawSiblings = proof.siblings;
            let paddedSiblings = [
                pad(rawSiblings[0]),
                pad(rawSiblings[1])
            ];
            proof.siblings = paddedSiblings;
            proof.siblingsAC = pad(proof.siblingsAC);
            let circuitInput = input.toCircuitInput(this.eddsa.babyJub, proof);
            let proofAndPublicSignals = await Prover.updateState(this.circuitPath, circuitInput);
            batchProof.push(Prover.serialize(proofAndPublicSignals));

            keysFound.push(input.outputNCs[0]);
            valuesFound.push(input.outputNotes[0].inputNullifier);
            keysFound.push(input.outputNCs[1]);
            valuesFound.push(input.outputNotes[1].inputNullifier);
            dataTreeRootsFound.push(BigInt(proof.dataTreeRoot));
            lastDataTreeRoot = BigInt(proof.dataTreeRoot);
            lastKeys = input.outputNCs;

            for (const item of rawSiblings) {
                let tmpSiblings = [];
                for (const sib of item) {
                    tmpSiblings.push(sib);
                }
                siblings.push(tmpSiblings);
            }

            let transaction = new Transaction(input.outputNotes, this.account.signingKey);
            let txdata = await transaction.encrypt(this.eddsa);

            let txInput = new Transaction(input.inputNotes, this.account.signingKey);
            let txInputData = await txInput.encrypt(this.eddsa);
            // assert(txInputData[0].content, encryptedNotes[0].content);

            await this.createTx(ctx, this.alias, txdata, input, proofAndPublicSignals);
            // call contract and deposit
            await this.rollupSC.update(proofAndPublicSignals);
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
            await this.updateNote(ctx, _notes);
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
        await this.rollupSC.withdraw(
            this.rollupSC.userAccount,
            txInfo,
            proofAndPublicSignals
        );
        return batchProof;
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

    async approve(token: string, value: bigint) {
        return await this.rollupSC.approve(token, value);
    }

    async getRegisteredToken(id: bigint) {
        return await this.rollupSC.getRegisteredToken(id);
    }

    /**
     * create proof for the secret account created
     *
     * @param {Context} ctx
     * @param {string} password used to decrypto the siging key
     * @return {Object} a batch of proof
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
        let accountRequired = false;
        const signer = accountRequired ? this.account.accountKey : this.account.signingKey;
        let acStateKey = await accountCompress(this.account.accountKey, signer, aliasHash);
        let smtProof = await this.updateStateTree(ctx, acStateKey, 1n, 0n, 0n, acStateKey);
        let circuitInput = input.toCircuitInput(this.eddsa.babyJub, smtProof);
        // create final proof
        let proofAndPublicSignals = await Prover.updateState(this.circuitPath, circuitInput);
        if (!Prover.verifyState(this.circuitPath, proofAndPublicSignals)) {
            throw new Error("Invalid proof")
        }

        this.keysFound.push(acStateKey);
        this.valuesFound.push(1n);
        let tmpSiblings = [];
        for (const sib of smtProof.siblings[0]) {
            tmpSiblings.push(BigInt(sib));
        }
        this.siblings.push(tmpSiblings);
        await this.rollupSC.update(proofAndPublicSignals);
        await this.createServerAccount(ctx, password);
        return Prover.serialize(proofAndPublicSignals)
    }

    /**
     * create proof for the user updating their signing key
     *
     * @param {Context} ctx
     * @param {SigningKey} newSigningKey
     * @param {string} password used to decrypto the siging key
     * @return {Object} a batch of proof
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
        let inputJson = input.toCircuitInput(this.eddsa.babyJub, smtProof);

        // create final proof
        let proofAndPublicSignals = await Prover.updateState(this.circuitPath, inputJson);

        if (!Prover.verifyState(this.circuitPath, proofAndPublicSignals)) {
            throw new Error("Invalid proof")
        }

        let proofs = new Array<string>(0);
        proofs.push(Prover.serialize(proofAndPublicSignals));
        let noteState = [NoteState.PROVED]
        let notes: Array<Note> = await this.getAndDecryptNote(ctx, noteState);
        let notesByAssetId: Map<number, bigint> = new Map();
        for (const note of notes) {
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
                proofs.concat(prf);
            }
        }

        await this.updateServerAccount(ctx, password);
        return proofs;
    }

    /**
     * create proof for migrating the account to another ETH address
     *
     * @param {Object} ctx
     * @param {SigningKey} newAccountKey the account key that which user renews
     * @param {string} password used to decrypto the siging key
     * @return {Object} a batch of proof
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
        let inputJson = input.toCircuitInput(this.eddsa.babyJub, smtProof);

        // create final proof
        let proofAndPublicSignals = await Prover.updateState(this.circuitPath, inputJson);

        if (!Prover.verifyState(this.circuitPath, proofAndPublicSignals)) {
            throw new Error("Invalid proof")
        }
        let proofs = new Array<string>(0);
        proofs.push(Prover.serialize(proofAndPublicSignals));

        let noteState = [NoteState.PROVED]
        let notes: Array<Note> = await this.getAndDecryptNote(ctx, noteState);
        let notesByAssetId: Map<number, bigint> = new Map();
        for (const note of notes) {
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
                proofs.concat(prf);
            }
        }
        this.account.accountKey = newAccountKey;
        this.account.newAccountKey = newAccountKey;
        await this.updateServerAccount(ctx, password)
        return proofs;
    }
}
