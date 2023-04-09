const createBlakeHash = require("blake-hash");
const { buildEddsa } = require("circomlibjs");
import { uint8Array2Bigint, prepareJson } from "../src/utils";
import { JoinSplitCircuit } from "../src/join_split";
import { UpdateStatusCircuit } from "../src/update_state";
import { Prover } from "../src/prover";
import { Note } from "../src/note";
import { Transaction } from "../src/transaction";
import { NoteState } from "../src/note";
import { AccountCircuit, compress as accountCompress, EigenAddress, SigningKey } from "../src/account";
import { RollupSC } from "../src/rollup.sc";
import { poseidonSponge } from "../src/sponge_poseidon";
const axios = require("axios").default;
import { assert } from "chai";

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
        acStateKey: bigint
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
        // // console.log(response);
        return response.data.data;
    }
}

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

export class TransactionClient {
    serverAddr: any;

    constructor(serverAddr: string) {
        this.serverAddr = serverAddr;
    }

    async createTx(context: any, txdata: any, input: any, proofAndPublicSignals: any) {
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
        console.log(response);
        return response.data.data;
    }
}


export class SecretSDK {
    alias: string;
    accountKey: SigningKey;
    signingKey: SigningKey;
    state: StateTreeClient;
    note: NoteClient;
    trans: TransactionClient;
    circuitPath: string;
    rollupSC: RollupSC;
    keysFound:any;
    valuesFound:any;
    siblings:any;

    constructor(
        alias: string,
        accountKey: SigningKey,
        signingKey: SigningKey,
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
        testTokenAddress: string = ""
    ) {
        console.log("testTokenAddress", testTokenAddress);
        this.alias = alias;
        this.signingKey = signingKey;
        this.accountKey = accountKey;
        this.state = new StateTreeClient(serverAddr);
        this.note = new NoteClient(serverAddr);
        this.trans = new TransactionClient(serverAddr);
        this.circuitPath = circuitPath;
        this.rollupSC = new RollupSC(eddsa, alias, userAccount, spongePoseidonAddress, tokenRegistryAddress,
            poseidon2Address, poseidon3Address, poseidon6Address, rollupAddress, testTokenAddress);
        this.keysFound = [];
        this.valuesFound = [];
        this.siblings = [];
    }

    async initialize() {
        await this.rollupSC.initialize();
    }

    /*
    static async newSigningKey() {
        let eddsa = await buildEddsa();
        return new SigningKey(eddsa)
    }
    */

    async getNotesValue(ctx: any, assetId: number) {
        let notes: Array<Note> = [];
        let noteState = [NoteState.PROVED]
        let encryptedNotes = await this.note.getNote(ctx, noteState);
        if (encryptedNotes) {
            encryptedNotes.forEach((item: any) => {
                let sharedKey = ctx.signingKey.makeSharedKey(new EigenAddress(item.pubKey));
                notes.push(Note.decrypt(item.content, sharedKey));
            });
        }
        let balance = 0n;
        let _notes:Array<Note> = [];
        for (let i = 0; i < notes.length; i ++) {
            if (notes[i].assetId == assetId) {
                _notes.push(notes[i]);
            }
        }
        for (let i = 0; i < 2; i ++) {
            if (_notes[i]._owner.pubKey == ctx.accountKey.pubKey.pubKey) {
                let tmpValue = _notes[i].val;
                balance = balance + tmpValue;
            }
        }
        return balance;
    }

    // create proof for general transaction
    async deposit(ctx: any, receiver: string, value: string, assetId: number, nonce: number) {
        let eddsa = await buildEddsa();
        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_DEPOSIT;
        let tmpP = ctx.accountKey.pubKey.unpack(eddsa.babyJub);
        let tmpPub = [eddsa.F.toObject(tmpP[0]), eddsa.F.toObject(tmpP[1])];

        await this.rollupSC.deposit(tmpPub, assetId, Number(value), nonce);

        let accountRequired = false;
        console.log("alias: ", ctx.alias, this.alias);
        const aliasHashBuffer = eddsa.pruneBuffer(createBlakeHash("blake512").update(ctx.alias).digest().slice(0, 32));
        const aliasHash = await uint8Array2Bigint(aliasHashBuffer);

        const signer = accountRequired? ctx.signingKey: ctx.accountKey;
        const acStateKey = await accountCompress(ctx.accountKey, signer, aliasHash);
        let notes: Array<Note> = [];
        let noteState = [NoteState.CREATING, NoteState.PROVED]
        let encryptedNotes = await this.note.getNote(ctx, noteState);
        if (encryptedNotes) {
            encryptedNotes.forEach((item: any) => {
                let sharedKey = ctx.signingKey.makeSharedKey(new EigenAddress(item.pubKey));
                notes.push(Note.decrypt(item.content, sharedKey));
            });
        }
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
            ctx.accountKey,
            ctx.signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            assetId,
            BigInt(value),
            ctx.signingKey.pubKey,
            BigInt(value),
            new EigenAddress(receiver),
            notes,
            accountRequired
        );

        let _proof: string[] = [];
        for (const input of inputs) {
            const proof = await this.state.updateStateTree(
                ctx,
                input.outputNCs[0],
                input.outputNotes[0].inputNullifier,
                input.outputNCs[1],
                input.outputNotes[1].inputNullifier,
                acStateKey
            );
            console.log(proof);
            let circuitInput = input.toCircuitInput(eddsa.babyJub, proof);
            let proofAndPublicSignals = await Prover.updateState(this.circuitPath, circuitInput);
            _proof.push(Prover.serialize(proofAndPublicSignals));

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

            let transaction = new Transaction(input.outputNotes, ctx.signingKey);
            let txdata = await transaction.encrypt();

            let txInput = new Transaction(input.inputNotes, ctx.signingKey);
            let txInputData = await txInput.encrypt();
            await this.trans.createTx(ctx, txdata, input, proofAndPublicSignals);

            await this.rollupSC.update(proofAndPublicSignals);

            let _notes = [
                {
                    index: input.inputNotes[0].index,
                    // it's the first depositing, so the init public key is a random
                    pubKey: txInputData[0].pubKey.pubKey,
                    content: txInputData[0].content,
                    state: NoteState.SPENT
                },
                {
                    index: input.inputNotes[1].index,
                    pubKey: txInputData[1].pubKey.pubKey, // same as above
                    content: txInputData[1].content,
                    state: NoteState.SPENT
                },
                {
                    index: input.outputNotes[0].index,
                    pubKey: txdata[0].pubKey.pubKey,
                    content: txdata[0].content,
                    state: NoteState.PROVED
                },
                {
                    index: input.outputNotes[1].index,
                    pubKey: txdata[1].pubKey.pubKey,
                    content: txdata[1].content,
                    state: NoteState.PROVED
                }
            ]
            await this.note.updateNote(ctx, _notes);
        }
        await this.rollupSC.processDeposits(this.rollupSC.userAccount, this.keysFound, this.valuesFound, this.siblings);
        return _proof;
    }

    async send(ctx: any, receiver: string, value: string, assetId: number) {
        let eddsa = await buildEddsa();
        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_SEND;
        let accountRequired = false;
        const aliasHashBuffer = eddsa.pruneBuffer(createBlakeHash("blake512").update(ctx.alias).digest().slice(0, 32));
        const aliasHash = await uint8Array2Bigint(aliasHashBuffer);
        const signer = accountRequired? ctx.signingKey: ctx.accountKey;
        const acStateKey = await accountCompress(ctx.accountKey, signer, aliasHash);
        let notes: Array<Note> = [];
        let noteState = [NoteState.CREATING, NoteState.PROVED];
        let encryptedNotes = await this.note.getNote(ctx, noteState);
        if (encryptedNotes) {
            encryptedNotes.forEach((item: any) => {
                let sharedKey = ctx.signingKey.makeSharedKey(new EigenAddress(item.pubKey));
                notes.push(Note.decrypt(item.content, sharedKey));
            });
        }
        let _receiver = new EigenAddress(receiver);
        let receiverPubKey = _receiver.pubKey;
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
            ctx.accountKey,
            ctx.signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            0,
            0n,
            undefined,
            BigInt(value),
            _receiver,
            notes,
            accountRequired
        );

        let _proof: string[] = [];
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
            let proofAndPublicSignals = await Prover.updateState(this.circuitPath, circuitInput);
            _proof.push(Prover.serialize(proofAndPublicSignals));
            let transaction = new Transaction(input.outputNotes, ctx.signingKey);
            let txdata = await transaction.encrypt();

            // let txInput = new Transaction(input.inputNotes, ctx.signingKey);
            // let _txInputData = await txInput.encrypt();
            await this.rollupSC.update(proofAndPublicSignals);

            await this.trans.createTx(ctx, txdata, input, proofAndPublicSignals);
            let _notes = [
                {
                    index: encryptedNotes[0].index,
                    pubKey: receiverPubKey,
                    content: encryptedNotes[0].content,
                    state: NoteState.SPENT
                },
                {
                    index: encryptedNotes[1].index,
                    pubKey: receiverPubKey,
                    content: encryptedNotes[1].content,
                    state: NoteState.SPENT
                },
                {
                    index: input.outputNotes[0].index,
                    pubKey: receiverPubKey,
                    content: txdata[0].content,
                    state: NoteState.PROVED
                },
                {
                    index: input.outputNotes[1].index,
                    pubKey: receiverPubKey,
                    content: txdata[1].content,
                    state: NoteState.PROVED
                }
            ]
            await this.note.updateNote(ctx, _notes);
        }
        return _proof;
    }

    async withdraw(ctx: any, receiver: string, value: string, assetId: number) {
        let eddsa = await buildEddsa();
        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_WITHDRAW;
        let accountRequired = false;
        const aliasHashBuffer = eddsa.pruneBuffer(createBlakeHash("blake512").update(ctx.alias).digest().slice(0, 32));
        const aliasHash = await uint8Array2Bigint(aliasHashBuffer);
        const signer = accountRequired? ctx.signingKey: ctx.accountKey;
        const acStateKey = await accountCompress(ctx.accountKey, signer, aliasHash);
        let notes: Array<Note> = [];
        let noteState = [NoteState.CREATING, NoteState.PROVED];
        let encryptedNotes = await this.note.getNote(ctx, noteState);
        if (encryptedNotes) {
            encryptedNotes.forEach((item: any) => {
                let sharedKey = ctx.signingKey.makeSharedKey(new EigenAddress(item.pubKey));
                notes.push(Note.decrypt(item.content, sharedKey));
            });
        }
        assert(notes.length > 0, "Invalid notes");
        let _receiver = new EigenAddress(receiver);
        let receiverPubKey = _receiver.pubKey;
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
            ctx.accountKey,
            ctx.signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            assetId,
            BigInt(value),
            ctx.signingKey.pubKey,
            0n,
            ctx.signingKey.pubKey,
            notes,
            accountRequired
        );

        let _proof: string[] = [];
        let lastProof: any;
        // let lastSiblings: any;
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
            _proof.push(Prover.serialize(proofAndPublicSignals));
            let transaction = new Transaction(input.outputNotes, ctx.signingKey);
            let txdata = await transaction.encrypt();

            // let txInput = new Transaction(input.inputNotes, ctx.signingKey);
            // let txInputData = await txInput.encrypt();
            await this.trans.createTx(ctx, txdata, input, proofAndPublicSignals);
            // call contract and deposit
            await this.rollupSC.update(proofAndPublicSignals);
            lastProof = proofAndPublicSignals;
            // lastSiblings = proof.siblings;
            let _notes = [
                {
                    index: encryptedNotes[0].index,
                    pubKey: receiverPubKey,
                    content: encryptedNotes[0].content,
                    state: NoteState.SPENT
                },
                {
                    index: encryptedNotes[1].index,
                    pubKey: receiverPubKey,
                    content: encryptedNotes[1].content,
                    state: NoteState.SPENT
                },
                {
                    index: input.outputNotes[0].index,
                    pubKey: receiverPubKey,
                    content: txdata[0].content,
                    state: NoteState.PROVED
                },
                {
                    index: input.outputNotes[1].index,
                    pubKey: receiverPubKey,
                    content: txdata[1].content,
                    state: NoteState.PROVED
                }
            ]
            await this.note.updateNote(ctx, _notes);
        }
        let tmpP = ctx.signingKey.pubKey.unpack(eddsa.babyJub);
        let xy = [eddsa.F.toObject(tmpP[0]), eddsa.F.toObject(tmpP[1])];
        const txInfo = {
            publicValue: value, // lastProof.publicSignals[1]
            publicOwner: xy, // lastProof.publicSignals[2]
            outputNc1: lastProof.publicSignals[4],
            outputNc2: lastProof.publicSignals[5],
            dataTreeRoot: lastProof.publicSignals[6],
            publicAssetId: assetId // lastProof.publicSignals[7]
        }

        let msg = await poseidonSponge(
            [
                txInfo.publicValue,
                txInfo.publicOwner[0],
                txInfo.publicOwner[1],
                txInfo.outputNc1,
                txInfo.outputNc2,
                txInfo.dataTreeRoot,
                txInfo.publicAssetId
            ]
        );

        let sig = await ctx.signingKey.sign(eddsa.F.e(msg));
        let input = {
            enabled: 1,
            Ax: xy[0],
            Ay: xy[1],
            M: msg,
            R8x: eddsa.F.toObject(sig.R8[0]),
            R8y: eddsa.F.toObject(sig.R8[1]),
            S: sig.S
        }
        let proofAndPublicSignals = await Prover.withdraw(this.circuitPath, input);
        await this.rollupSC.withdraw(
            this.rollupSC.userAccount,
            txInfo,
            proofAndPublicSignals
        );
        return _proof;
    }

    // create proof for account operation, create, migrate or update
    async createAccount(ctx: any, newSigningKey: SigningKey, newSigningKey2: SigningKey) {
        let eddsa = await buildEddsa();
        const F = eddsa.F;
        let proofId = AccountCircuit.PROOF_ID_TYPE_CREATE;
        let newAccountPubKey = this.accountKey.pubKey.unpack(eddsa.babyJub);
        newAccountPubKey = [F.toObject(newAccountPubKey[0]), F.toObject(newAccountPubKey[1])];
        let newSigningPubKey1 = newSigningKey.pubKey.unpack(eddsa.babyJub);
        newSigningPubKey1 = [F.toObject(newSigningPubKey1[0]), F.toObject(newSigningPubKey1[1])];
        let newSigningPubKey2 = newSigningKey2.pubKey.unpack(eddsa.babyJub);
        newSigningPubKey2 = [F.toObject(newSigningPubKey2[0]), F.toObject(newSigningPubKey2[1])];
        const aliasHashBuffer = eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        let aliasHash = uint8Array2Bigint(aliasHashBuffer);
        let input = await UpdateStatusCircuit.createAccountInput(
            proofId,
            this.accountKey,
            this.signingKey,
            newAccountPubKey,
            newSigningPubKey1,
            newSigningPubKey2,
            aliasHash
        );
        // let smtProof = await this.state.updateStateTree(ctx, input.newAccountNC, 1n, 0n, 0n, input.accountNC);
        let accountRequired = false;
        let signer = accountRequired? this.signingKey: this.accountKey;
        let acStateKey = await accountCompress(this.accountKey, signer, aliasHash);
        let smtProof = await this.state.updateStateTree(ctx, acStateKey, 1n, 0n, 0n, acStateKey);
        let circuitInput = input.toCircuitInput(eddsa.babyJub, smtProof);
        // create final proof
        let proofAndPublicSignals = await Prover.updateState(this.circuitPath, circuitInput);
        if (!Prover.verifyState(proofAndPublicSignals)) {
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

    async updateAccount(ctx: any, newSigningKey: SigningKey, newSigningKey2: SigningKey) {
        let eddsa = await buildEddsa();
        let proofId = AccountCircuit.PROOF_ID_TYPE_UPDATE;
        let newAccountPubKey = this.accountKey.toCircuitInput();
        let newSigningPubKey1 = newSigningKey.toCircuitInput();
        let newSigningPubKey2 = newSigningKey2.toCircuitInput();
        const aliasHashBuffer = eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        let aliasHash = uint8Array2Bigint(aliasHashBuffer);
        let input = await AccountCircuit.createProofInput(
            proofId,
            this.accountKey,
            this.signingKey,
            newAccountPubKey[0],
            newSigningPubKey1[0],
            newSigningPubKey2[0],
            aliasHash
        );
        let smtProof = await this.state.updateStateTree(ctx, input.newAccountNC, 1n, 0n, 0n, input.accountNC);
        let inputJson = input.toCircuitInput(smtProof);

        // create final proof
        let proofAndPublicSignals = await Prover.updateState(this.circuitPath, inputJson);

        if (!Prover.verifyState(proofAndPublicSignals)) {
            throw new Error("Invalid proof")
        }
        return Prover.serialize(proofAndPublicSignals);
    }

    async migrateAccount(ctx: any, newAccountKey: SigningKey, oldSigningKey: SigningKey, oldSigningKey2: SigningKey) {
        let eddsa = await buildEddsa();
        let proofId = AccountCircuit.PROOF_ID_TYPE_MIGRATE;
        let newAccountPubKey = this.accountKey.toCircuitInput();
        let newSigningPubKey1 = oldSigningKey.toCircuitInput();
        let newSigningPubKey2 = oldSigningKey2.toCircuitInput();
        const aliasHashBuffer = eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        let aliasHash = uint8Array2Bigint(aliasHashBuffer);
        let input = await AccountCircuit.createProofInput(
            proofId,
            this.accountKey,
            this.signingKey,
            newAccountPubKey[0],
            newSigningPubKey1[0],
            newSigningPubKey2[0],
            aliasHash
        );
        let smtProof = await this.state.updateStateTree(ctx, input.newAccountNC, 1n, 0n, 0n, input.accountNC);
        let inputJson = input.toCircuitInput(smtProof);

        // create final proof
        let proofAndPublicSignals = await Prover.updateState(this.circuitPath, inputJson);

        if (!Prover.verifyState(proofAndPublicSignals)) {
            throw new Error("Invalid proof")
        }
        return Prover.serialize(proofAndPublicSignals);
    }
}
