const createBlakeHash = require("blake-hash");
const { buildEddsa } = require("circomlibjs");
import { prepareJson, uint8Array2Bigint } from "./utils";
import { JoinSplitCircuit } from "./join_split";
import { UpdateStatusCircuit } from "./update_state";
import { Prover } from "./prover";

import { Note, NoteState } from "./note";
import { Transaction } from "./transaction";
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
 * Update the status of the user account and transaction
 */
export class StateTreeClient {
    serverAddr: any;

    constructor(serverAddr: string) {
        this.serverAddr = serverAddr;
    }

    async updateStateTree(
        context: any,
        outputNc1: bigint,
        nullifier1: bigint,
        outputNc2: bigint,
        nullifier2: bigint,
        acStateKey: bigint,
        padding: boolean = true
    ) {
        const {
            alias,
            ethAddress,
            rawMessage,
            timestamp,
            signature
        } = context;
        let tmpInput = prepareJson({
            alias: alias,
            timestamp: timestamp,
            message: rawMessage,
            hexSignature: signature,
            ethAddress: ethAddress,
            padding: padding, // NOTE: DO NOT pad because we need call smtVerifier smartcontract
            newStates: {
                outputNc1: outputNc1,
                nullifier1: nullifier1,
                outputNc2: outputNc2,
                nullifier2: nullifier2,
                acStateKey: acStateKey
            }
        });

        let options = {
            method: "POST",
            url: this.serverAddr + "/statetree",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            data: tmpInput
        };
        let response = await axios.request(options);
        // console.log(response);
        return response.data.data;
    }
}

/**
 * Get or update the user's Note information
 */
export class NoteClient {
    serverAddr: any;

    constructor(serverAddr: string) {
        this.serverAddr = serverAddr;
    }

    async getNote(context: any, noteState: any) {
        const {
            alias,
            ethAddress,
            rawMessage,
            timestamp,
            signature
        } = context;

        let options = {
            method: "POST",
            url: this.serverAddr + "/notes/get",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            data: prepareJson({
                alias: alias,
                timestamp: timestamp,
                message: rawMessage,
                hexSignature: signature,
                ethAddress: ethAddress,
                noteState: noteState
            })
        };
        let response = await axios.request(options);
        // console.log(response);
        return response.data.data;
    }

    async updateNote(context: any, notes: any) {
        const {
            alias,
            ethAddress,
            rawMessage,
            timestamp,
            signature
        } = context;
        let options = {
            method: "POST",
            url: this.serverAddr + "/notes/update",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            data: prepareJson({
                alias: alias,
                timestamp: timestamp,
                message: rawMessage,
                hexSignature: signature,
                ethAddress: ethAddress,
                notes
            })
        };
        let response = await axios.request(options);
        // console.log(response);
        return response.data.data;
    }
}

/**
 * Create a new transaction
 */
export class TransactionClient {
    serverAddr: any;

    constructor(serverAddr: string) {
        this.serverAddr = serverAddr;
    }

    async createTx(context: any, receiver_alias: any, txdata: any, input: any, proofAndPublicSignals: any) {
        const {
            alias,
            ethAddress,
            rawMessage,
            timestamp,
            signature
        } = context;
        let options = {
            method: "POST",
            url: this.serverAddr + "/transactions",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            data: prepareJson({
                alias: alias,
                timestamp: timestamp,
                message: rawMessage,
                hexSignature: signature,
                ethAddress: ethAddress,
                receiver_alias: receiver_alias,
                pubKey: txdata[0].pubKey.pubKey,
                pubKey2: txdata[1].pubKey.pubKey,
                content: txdata[0].content,
                content2: txdata[1].content,
                noteIndex: input.outputNotes[0].index.toString(),
                note2Index: input.outputNotes[1].index.toString(),
                proof: Prover.serialize(proofAndPublicSignals.proof),
                publicInput: Prover.serialize(proofAndPublicSignals.publicSignals)
            })
        };
        let response = await axios.request(options);
        // console.log(response);
        return response.data.data;
    }
}

/**
 * SecretSDK interface
 */
export class SecretSDK {
    alias: string;
    account: SecretAccount;
    state: StateTreeClient;
    note: NoteClient;
    trans: TransactionClient;
    circuitPath: string;
    rollupSC: RollupSC;
    keysFound: any;
    valuesFound: any;
    siblings: any;

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
        this.state = new StateTreeClient(serverAddr);
        this.note = new NoteClient(serverAddr);
        this.trans = new TransactionClient(serverAddr);
        Prover.serverAddr = serverAddr; // init Prover client with serverAddr
        this.circuitPath = circuitPath;
        this.rollupSC = new RollupSC(eddsa, account.alias, userAccount, spongePoseidonAddress, tokenRegistryAddress,
            poseidon2Address, poseidon3Address, poseidon6Address, rollupAddress, smtVerifierAddress);
        this.keysFound = [];
        this.valuesFound = [];
        this.siblings = [];
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
     * obtain the Notes value
     * @param {Object} ctx
     * @param {number} assetId the token to be calculated
     * @return {bigint} the notes value
     */
    async getNotesValue(ctx: any, assetId: number) {
        let notes: Array<Note> = [];
        let noteState = [NoteState.PROVED]
        let encryptedNotes = await this.note.getNote(ctx, noteState);
        if (encryptedNotes) {
            encryptedNotes.forEach((item: any) => {
                let sharedKey = this.account.signingKey.makeSharedKey(new EigenAddress(item.pubKey));
                notes.push(Note.decrypt(item.content, sharedKey));
            });
        }
        console.log("notes", notes)
        let balance = 0n;
        let _notes: Array<Note> = [];
        for (let i = 0; i < notes.length; i++) {
            if (notes[i].assetId == assetId) {
                _notes.push(notes[i]);
            }
        }
        for (let i = 0; i < _notes.length; i++) {
            if (_notes[i]._owner.pubKey == this.account.accountKey.pubKey.pubKey) {
                let tmpValue = _notes[i].val;
                balance = balance + tmpValue;
            }
        }
        return balance;
    }

    /**
     * create proof for the deposit of the asset from L1 to L2
     *
     * @param {Object} ctx
     * @param {string} receiver
     * @param {bigint} value the amount to be deposited
     * @param {number} assetId the token to be deposited
     * @param {number} nonce the nonce of current transaction, usually obtained from Wallet like Metamask
     * @return {Object} a batch of proof
     */
    async deposit(ctx: any, receiver: string, value: bigint, assetId: number, nonce: number) {
        let eddsa = await buildEddsa();
        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_DEPOSIT;
        let tmpP = this.account.accountKey.pubKey.unpack(eddsa.babyJub);
        let tmpPub = [eddsa.F.toObject(tmpP[0]), eddsa.F.toObject(tmpP[1])];

        await this.rollupSC.deposit(tmpPub, assetId, value, nonce);

        let accountRequired = false;
        const aliasHashBuffer = eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        const aliasHash = await uint8Array2Bigint(aliasHashBuffer);

        const signer = accountRequired ? this.account.signingKey : this.account.accountKey;
        const acStateKey = await accountCompress(this.account.accountKey, signer, aliasHash);
        let notes: Array<Note> = [];
        let noteState = [NoteState.CREATING, NoteState.PROVED]
        let encryptedNotes = await this.note.getNote(ctx, noteState);
        if (encryptedNotes) {
            encryptedNotes.forEach((item: any) => {
                let sharedKey = this.account.signingKey.makeSharedKey(new EigenAddress(item.pubKey));
                notes.push(Note.decrypt(item.content, sharedKey));
            });
        }
        const util = require("util");
        console.log("notes", notes);
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
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
        console.log("inputs", util.inspect(inputs, 1, 100));

        let batchProof: string[] = [];
        for (const input of inputs) {
            const proof = await this.state.updateStateTree(
                ctx,
                input.outputNCs[0],
                input.outputNotes[0].inputNullifier,
                input.outputNCs[1],
                input.outputNotes[1].inputNullifier,
                acStateKey
            );
            // console.log(proof);
            let circuitInput = input.toCircuitInput(eddsa.babyJub, proof);
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
            let txdata = await transaction.encrypt();

            let txInput = new Transaction(input.inputNotes, this.account.signingKey);
            let txInputData = await txInput.encrypt();
            await this.trans.createTx(ctx, this.alias, txdata, input, proofAndPublicSignals);

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
                    pubKey: txInputData[1].pubKey.pubKey, // same as above
                    content: txInputData[1].content,
                    state: NoteState.SPENT
                },
                {
                    alias: this.alias,
                    index: input.outputNotes[0].index,
                    pubKey: txdata[0].pubKey.pubKey,
                    content: txdata[0].content,
                    state: NoteState.PROVED
                },
                {
                    alias: this.alias,
                    index: input.outputNotes[1].index,
                    pubKey: txdata[1].pubKey.pubKey,
                    content: txdata[1].content,
                    state: NoteState.PROVED
                }
            ]
            await this.note.updateNote(ctx, _notes);
        }
        await this.rollupSC.processDeposits(this.rollupSC.userAccount, this.keysFound, this.valuesFound, this.siblings);
        return batchProof;
    }

    /**
     * create proof for sending the asset to the receiver in L2
     *
     * @param {Object} ctx
     * @param {string} receiver
     * @param {string} receiver_alias use for test
     * @param {bigint} value the amount to be sent
     * @param {number} assetId the token to be sent
     * @return {Object} a batch of proof
     */
    async send(ctx: any, receiver: string, receiver_alias: string, value: bigint, assetId: number) {
        let eddsa = await buildEddsa();
        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_SEND;
        let accountRequired = false;
        const aliasHashBuffer = eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        const aliasHash = await uint8Array2Bigint(aliasHashBuffer);
        const signer = accountRequired ? this.account.signingKey : this.account.accountKey;
        const acStateKey = await accountCompress(this.account.accountKey, signer, aliasHash);
        let notes: Array<Note> = [];
        let noteState = [NoteState.PROVED];
        let encryptedNotes = await this.note.getNote(ctx, noteState);
        if (encryptedNotes) {
            encryptedNotes.forEach((item: any) => {
                let sharedKey = this.account.signingKey.makeSharedKey(new EigenAddress(item.pubKey));
                notes.push(Note.decrypt(item.content, sharedKey));
            });
        }
        let _receiver = new EigenAddress(receiver);
        let receiverPubKey = _receiver.pubKey;
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
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
            const proof = await this.state.updateStateTree(
                ctx,
                input.outputNCs[0],
                input.outputNotes[0].inputNullifier,
                input.outputNCs[1],
                input.outputNotes[1].inputNullifier,
                acStateKey
            );
            let circuitInput = input.toCircuitInput(eddsa.babyJub, proof);
            console.log("update: ", circuitInput);
            let proofAndPublicSignals = await Prover.updateState(this.circuitPath, circuitInput);
            batchProof.push(Prover.serialize(proofAndPublicSignals));
            let transaction = new Transaction(input.outputNotes, this.account.signingKey);
            let txdata = await transaction.encrypt();

            let txInput = new Transaction(input.inputNotes, this.account.signingKey);
            let txInputData = await txInput.encrypt();
            assert(txInputData[0].content, encryptedNotes[0].content);

            await this.trans.createTx(ctx, receiver_alias, txdata, input, proofAndPublicSignals);

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
                    alias: receiver_alias,
                    index: input.outputNotes[0].index,
                    pubKey: receiverPubKey,
                    content: txdata[0].content,
                    state: NoteState.PROVED
                },
                {
                    alias: this.alias,
                    index: input.outputNotes[1].index,
                    pubKey: this.account.signingKey.pubKey.pubKey,
                    content: txdata[1].content,
                    state: NoteState.PROVED
                }
            ];
            console.log(_notes);
            await this.note.updateNote(ctx, _notes);
        }
        return batchProof;
    }

    /**
     * create proof for withdrawing asset from L2 to L1
     *
     * @param {Object} ctx
     * @param {string} receiver
     * @param {bigint} value the amount to be withdrawn
     * @param {number} assetId the token to be withdrawn
     * @return {Object} a batch of proof
     */
    async withdraw(ctx: any, receiver: string, value: bigint, assetId: number) {
        let eddsa = await buildEddsa();
        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_WITHDRAW;
        let accountRequired = false;
        const aliasHashBuffer = eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        const aliasHash = await uint8Array2Bigint(aliasHashBuffer);
        const signer = accountRequired ? this.account.signingKey : this.account.accountKey;
        const acStateKey = await accountCompress(this.account.accountKey, signer, aliasHash);
        let notes: Array<Note> = [];
        let noteState = [NoteState.PROVED];
        let encryptedNotes = await this.note.getNote(ctx, noteState);
        if (encryptedNotes) {
            encryptedNotes.forEach((item: any) => {
                let sharedKey = this.account.signingKey.makeSharedKey(new EigenAddress(item.pubKey));
                notes.push(Note.decrypt(item.content, sharedKey));
            });
        }
        const util = require("util");
        console.log("notes: ", util.inspect(notes, 1, 100));
        assert(notes.length > 0, "Invalid notes");
        let _receiver = new EigenAddress(receiver);
        let receiverPubKey = _receiver.pubKey;
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
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
        console.log("inputs", util.inspect(inputs, 1, 100));

        let batchProof: string[] = [];
        let lastKeys: Array<bigint> = [];
        let keysFound = [];
        let valuesFound = [];
        let dataTreeRootsFound: Array<bigint> = [];
        let lastDataTreeRoot: bigint = 0n;
        let siblings = [];

        for (const input of inputs) {
            const proof = await this.state.updateStateTree(
                ctx,
                input.outputNCs[0],
                input.outputNotes[0].inputNullifier,
                input.outputNCs[1],
                input.outputNotes[1].inputNullifier,
                acStateKey,
                false
            );
            // console.log(proof);
            let rawSiblings = proof.siblings;
            // console.log("rawSiblings", rawSiblings);
            let paddedSiblings = [
                pad(rawSiblings[0]),
                pad(rawSiblings[1])
            ];
            // console.log("paddedSiblings", paddedSiblings, rawSiblings);
            proof.siblings = paddedSiblings;
            proof.siblingsAC = pad(proof.siblingsAC);
            let circuitInput = input.toCircuitInput(eddsa.babyJub, proof);
            // console.log(circuitInput);
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
            let txdata = await transaction.encrypt();

            let txInput = new Transaction(input.inputNotes, this.account.signingKey);
            let txInputData = await txInput.encrypt();
            assert(txInputData[0].content, encryptedNotes[0].content);

            await this.trans.createTx(ctx, this.alias, txdata, input, proofAndPublicSignals);
            // call contract and deposit
            await this.rollupSC.update(proofAndPublicSignals);
            // settle down the spent notes
            let _notes: Array<any> = [
                {
                    alias: this.alias,
                    index: input.inputNotes[0].index,
                    pubKey: receiverPubKey,
                    content: txInputData[0].content,
                    state: NoteState.SPENT
                },
                {
                    alias: this.alias,
                    index: input.inputNotes[1].index,
                    pubKey: receiverPubKey,
                    content: txInputData[1].content,
                    state: NoteState.SPENT
                },
                {
                    alias: this.alias,
                    index: input.outputNotes[0].index,
                    pubKey: receiverPubKey,
                    content: txdata[0].content,
                    state: NoteState.SPENT
                },
                {
                    alias: this.alias,
                    index: input.outputNotes[1].index,
                    pubKey: this.account.signingKey.pubKey.pubKey,
                    content: txdata[1].content,
                    state: NoteState.PROVED
                }
            ];
            await this.note.updateNote(ctx, _notes);
        }

        let tmpP = this.account.signingKey.pubKey.unpack(eddsa.babyJub);
        let xy = [eddsa.F.toObject(tmpP[0]), eddsa.F.toObject(tmpP[1])];
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
        console.log("txInfo", txInfo);
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
        console.log("check tmpRoot done");

        let sig = await this.account.signingKey.sign(eddsa.F.e(msg));
        let input = {
            enabled: 1,
            Ax: xy[0],
            Ay: xy[1],
            M: msg,
            R8x: eddsa.F.toObject(sig.R8[0]),
            R8y: eddsa.F.toObject(sig.R8[1]),
            S: sig.S
        }
        console.log("withdraw, input", input);
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

    // create proof for account operation, create, migrate or update
    /**
     * create proof for the secret account created
     *
     * @param {Object} ctx
     * @param {SigningKey} newSigningKey
     * @param {SigningKey} newSigningKey2
     * @return {Object} a batch of proof
     */
    async createAccount(ctx: any, newSigningKey: SigningKey, newSigningKey2: SigningKey) {
        let eddsa = await buildEddsa();
        const F = eddsa.F;
        let proofId = AccountCircuit.PROOF_ID_TYPE_CREATE;
        let newAccountPubKey = this.account.accountKey.pubKey.unpack(eddsa.babyJub);
        newAccountPubKey = [F.toObject(newAccountPubKey[0]), F.toObject(newAccountPubKey[1])];
        let newSigningPubKey1 = newSigningKey.pubKey.unpack(eddsa.babyJub);
        newSigningPubKey1 = [F.toObject(newSigningPubKey1[0]), F.toObject(newSigningPubKey1[1])];
        let newSigningPubKey2 = newSigningKey2.pubKey.unpack(eddsa.babyJub);
        newSigningPubKey2 = [F.toObject(newSigningPubKey2[0]), F.toObject(newSigningPubKey2[1])];
        const aliasHashBuffer = eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        let aliasHash = uint8Array2Bigint(aliasHashBuffer);
        let input = await UpdateStatusCircuit.createAccountInput(
            proofId,
            this.account.accountKey,
            this.account.signingKey,
            newAccountPubKey,
            newSigningPubKey1,
            newSigningPubKey2,
            aliasHash
        );
        let accountRequired = false;
        let signer = accountRequired ? this.account.signingKey : this.account.accountKey;
        let acStateKey = await accountCompress(this.account.accountKey, signer, aliasHash);
        let smtProof = await this.state.updateStateTree(ctx, acStateKey, 1n, 0n, 0n, acStateKey);
        let circuitInput = input.toCircuitInput(eddsa.babyJub, smtProof);
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

        return Prover.serialize(proofAndPublicSignals);
    }

    /**
     * create proof for the user updating their signing key
     *
     * @param {Object} ctx
     * @param {SigningKey} newSigningKey
     * @param {SigningKey} newSigningKey2
     * @return {Object} a batch of proof
     */
    async updateAccount(ctx: any, newSigningKey: SigningKey, newSigningKey2: SigningKey) {
        let eddsa = await buildEddsa();
        let proofId = AccountCircuit.PROOF_ID_TYPE_UPDATE;
        let newAccountPubKey = this.account.accountKey.toCircuitInput();
        let newSigningPubKey1 = newSigningKey.toCircuitInput();
        let newSigningPubKey2 = newSigningKey2.toCircuitInput();
        const aliasHashBuffer = eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        let aliasHash = uint8Array2Bigint(aliasHashBuffer);
        let input = await UpdateStatusCircuit.createAccountInput(
            proofId,
            this.account.accountKey,
            this.account.signingKey,
            newAccountPubKey[0],
            newSigningPubKey1[0],
            newSigningPubKey2[0],
            aliasHash
        );
        let smtProof = await this.state.updateStateTree(ctx, input.newAccountNC, 1n, 0n, 0n, input.accountNC);
        let inputJson = input.toCircuitInput(eddsa.babyJub, smtProof);

        // create final proof
        let proofAndPublicSignals = await Prover.updateState(this.circuitPath, inputJson);

        if (!Prover.verifyState(this.circuitPath, proofAndPublicSignals)) {
            throw new Error("Invalid proof")
        }
        return Prover.serialize(proofAndPublicSignals);
    }

    /**
     * create proof for migrating the account to another ETH address
     *
     * @param {Object} ctx
     * @param {SigningKey} newAccountKey the account key that which user renews
     * @return {Object} a batch of proof
     */
    async migrateAccount(ctx: any, newAccountKey: SigningKey) {
        let eddsa = await buildEddsa();
        let proofId = AccountCircuit.PROOF_ID_TYPE_MIGRATE;
        let newAccountPubKey = newAccountKey.toCircuitInput();
        let newSigningPubKey1 = this.account.newSigningKey1.toCircuitInput();
        let newSigningPubKey2 = this.account.newSigningKey2.toCircuitInput();
        const aliasHashBuffer = eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        let aliasHash = uint8Array2Bigint(aliasHashBuffer);
        let input = await UpdateStatusCircuit.createAccountInput(
            proofId,
            this.account.accountKey,
            this.account.signingKey,
            newAccountPubKey[0],
            newSigningPubKey1[0],
            newSigningPubKey2[0],
            aliasHash
        );
        let smtProof = await this.state.updateStateTree(ctx, input.newAccountNC, 1n, 0n, 0n, input.accountNC);
        let inputJson = input.toCircuitInput(eddsa.babyJub, smtProof);

        // create final proof
        let proofAndPublicSignals = await Prover.updateState(this.circuitPath, inputJson);

        if (!Prover.verifyState(this.circuitPath, proofAndPublicSignals)) {
            throw new Error("Invalid proof")
        }
        return Prover.serialize(proofAndPublicSignals);
    }
}
