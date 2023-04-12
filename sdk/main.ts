const createBlakeHash = require("blake-hash");
const { buildEddsa } = require("circomlibjs");
import { ethers } from "ethers"
import { uint8Array2Bigint, prepareJson } from "../src/utils";
import { JoinSplitCircuit } from "../src/join_split";
import { UpdateStatusCircuit } from "../src/update_state";
import { Prover } from "../src/prover";
import { Note } from "../src/note";
import { Transaction } from "../src/transaction";
import { NoteState } from "../src/note";
import { SecretAccount, AccountCircuit, compress as accountCompress, EigenAddress, SigningKey } from "../src/account";
import { RollupSC } from "../src/rollup.sc";
import { pad } from "../src/state_tree";
import { poseidonSponge } from "../src/sponge_poseidon";
const axios = require("axios").default;
import { assert } from "chai";
import _smtVerifierContract from "../artifacts/contracts/SMT.sol/SMT.json";
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
        // console.log(response);
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
        // console.log(response);
        return response.data.data;
    }
}


export class SecretSDK {
    alias: string;
    account: SecretAccount;
    state: StateTreeClient;
    note: NoteClient;
    trans: TransactionClient;
    circuitPath: string;
    rollupSC: RollupSC;
    smtVerifierContract: any;
    keysFound:any;
    valuesFound:any;
    siblings:any;

    constructor(
        alias: string,
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
        testTokenAddress: string = ""
    ) {
        this.alias = alias;
        this.account = account;
        this.state = new StateTreeClient(serverAddr);
        this.note = new NoteClient(serverAddr);
        this.trans = new TransactionClient(serverAddr);
        this.circuitPath = circuitPath;
        this.rollupSC = new RollupSC(eddsa, alias, userAccount, spongePoseidonAddress, tokenRegistryAddress,
            poseidon2Address, poseidon3Address, poseidon6Address, rollupAddress, testTokenAddress);
        this.smtVerifierContract = undefined;
        this.keysFound = [];
        this.valuesFound = [];
        this.siblings = [];
    }

    async initialize() {
        await this.rollupSC.initialize();
        let smtVerifierContractFactory = new ethers.ContractFactory(
            _smtVerifierContract.abi,
            _smtVerifierContract.bytecode,
            this.rollupSC.userAccount
        );
        this.smtVerifierContract = await smtVerifierContractFactory.deploy(
            this.rollupSC.poseidon2Address,
            this.rollupSC.poseidon3Address
        );
        await this.smtVerifierContract.deployed();
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
                let sharedKey = this.account.signingKey.makeSharedKey(new EigenAddress(item.pubKey));
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
            if (_notes[i]._owner.pubKey == this.account.accountKey.pubKey.pubKey) {
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
        let tmpP = this.account.accountKey.pubKey.unpack(eddsa.babyJub);
        let tmpPub = [eddsa.F.toObject(tmpP[0]), eddsa.F.toObject(tmpP[1])];

        await this.rollupSC.deposit(tmpPub, assetId, Number(value), nonce);

        let accountRequired = false;
        console.log("alias: ", this.alias, this.alias);
        const aliasHashBuffer = eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        const aliasHash = await uint8Array2Bigint(aliasHashBuffer);

        const signer = accountRequired? this.account.signingKey: this.account.accountKey;
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
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
            this.account.accountKey,
            this.account.signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            assetId,
            BigInt(value),
            this.account.signingKey.pubKey,
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
            // console.log(proof);
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

            let transaction = new Transaction(input.outputNotes, this.account.signingKey);
            let txdata = await transaction.encrypt();

            let txInput = new Transaction(input.inputNotes, this.account.signingKey);
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
        const aliasHashBuffer = eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        const aliasHash = await uint8Array2Bigint(aliasHashBuffer);
        const signer = accountRequired? this.account.signingKey: this.account.accountKey;
        const acStateKey = await accountCompress(this.account.accountKey, signer, aliasHash);
        let notes: Array<Note> = [];
        let noteState = [NoteState.CREATING, NoteState.PROVED];
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
            let transaction = new Transaction(input.outputNotes, this.account.signingKey);
            let txdata = await transaction.encrypt();

            let txInput = new Transaction(input.inputNotes, this.account.signingKey);
            let txInputData = await txInput.encrypt();
            assert(txInputData[0].content, encryptedNotes[0].content);

            await this.trans.createTx(ctx, txdata, input, proofAndPublicSignals);

            await this.rollupSC.update(proofAndPublicSignals);

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
        const aliasHashBuffer = eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        const aliasHash = await uint8Array2Bigint(aliasHashBuffer);
        const signer = accountRequired? this.account.signingKey: this.account.accountKey;
        const acStateKey = await accountCompress(this.account.accountKey, signer, aliasHash);
        let notes: Array<Note> = [];
        let noteState = [NoteState.CREATING, NoteState.PROVED];
        let encryptedNotes = await this.note.getNote(ctx, noteState);
        if (encryptedNotes) {
            encryptedNotes.forEach((item: any) => {
                let sharedKey = this.account.signingKey.makeSharedKey(new EigenAddress(item.pubKey));
                notes.push(Note.decrypt(item.content, sharedKey));
            });
        }
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
            BigInt(value),
            this.account.signingKey.pubKey,
            0n,
            this.account.signingKey.pubKey,
            notes,
            accountRequired
        );

        let _proof: string[] = [];
        let lastKeys: Array<bigint> = [];
        let lastSiblings: Array<Array<bigint>> = [];
        let lastValues: Array<bigint> = [];
        let keysFound = [];
        let valuesFound = [];
        let siblings = [];
        let lastDataTreeRoot: any;

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
            let rawSiblings = proof.siblings;
            let paddedSiblings = [
                pad(rawSiblings[0]),
                pad(rawSiblings[1])
            ];
            proof.sibings = paddedSiblings;
            proof.siblingsAC = pad(proof.siblingsAC);
            let circuitInput = input.toCircuitInput(eddsa.babyJub, proof);
            let proofAndPublicSignals = await Prover.updateState(this.circuitPath, circuitInput);
            _proof.push(Prover.serialize(proofAndPublicSignals));

            keysFound.push(input.outputNCs[0]);
            valuesFound.push(input.outputNotes[0].inputNullifier);
            keysFound.push(input.outputNCs[1]);
            valuesFound.push(input.outputNotes[1].inputNullifier);
            lastDataTreeRoot = proof.dataTreeRoot;
            lastKeys = input.outputNCs;
            lastValues = [input.outputNotes[0].inputNullifier, input.outputNotes[1].inputNullifier];

            lastSiblings = []
            for (const item of rawSiblings) {
                let tmpSiblings = [];
                for (const sib of item) {
                    tmpSiblings.push(sib);
                }
                lastSiblings.push(tmpSiblings);
                siblings.push(pad(tmpSiblings));
            }

            let transaction = new Transaction(input.outputNotes, this.account.signingKey);
            let txdata = await transaction.encrypt();

            let txInput = new Transaction(input.inputNotes, this.account.signingKey);
            let txInputData = await txInput.encrypt();
            assert(txInputData[0].content, encryptedNotes[0].content);

            await this.trans.createTx(ctx, txdata, input, proofAndPublicSignals);
            // call contract and deposit
            await this.rollupSC.update(proofAndPublicSignals);
            // settle down the spent notes
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
                    state: NoteState.SPENT
                },
                {
                    index: input.outputNotes[1].index,
                    pubKey: receiverPubKey,
                    content: txdata[1].content,
                    state: NoteState.SPENT
                }
            ]
            await this.note.updateNote(ctx, _notes);
        }

        await this.rollupSC.processDeposits(this.rollupSC.userAccount, keysFound, valuesFound, siblings);

        // let sz = keysFound.length;
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
            values: lastValues,
            siblings: lastSiblings
        }

        // FIXME hash sibings and tree
        let msg = await poseidonSponge(
            [
                BigInt(txInfo.publicValue),
                txInfo.publicOwner[0],
                txInfo.publicOwner[1],
                txInfo.outputNc1,
                txInfo.outputNc2,
                txInfo.dataTreeRoot,
                BigInt(txInfo.publicAssetId)
            ]
        );
        // FIXME @Zelig
        // DEBUG: check by smt verifier
        // let tmpRoot = await this.smtVerifierContract.connect(this.rollupSC.userAccount).smtVerifier(
        //     txInfo.siblings[0], txInfo.outputNc1,
        //     txInfo.values[0], "0", "0", false, false, 20
        // )
        // expect(tmpRoot.toString()).to.eq(txInfo.dataTreeRoot.toString());

        // tmpRoot = await this.smtVerifierContract.connect(this.rollupSC.userAccount).smtVerifier(
        //     txInfo.siblings[1], txInfo.outputNc2,
        //     txInfo.values[1], "0", "0", false, false, 20
        // )
        // expect(tmpRoot.toString()).to.eq(txInfo.dataTreeRoot.toString());

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
        let signer = accountRequired? this.account.signingKey: this.account.accountKey;
        let acStateKey = await accountCompress(this.account.accountKey, signer, aliasHash);
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

        if (!Prover.verifyState(proofAndPublicSignals)) {
            throw new Error("Invalid proof")
        }
        return Prover.serialize(proofAndPublicSignals);
    }

    async migrateAccount(ctx: any, newAccountKey: SigningKey, oldSigningKey: SigningKey, oldSigningKey2: SigningKey) {
        let eddsa = await buildEddsa();
        let proofId = AccountCircuit.PROOF_ID_TYPE_MIGRATE;
        let newAccountPubKey = this.account.accountKey.toCircuitInput();
        let newSigningPubKey1 = oldSigningKey.toCircuitInput();
        let newSigningPubKey2 = oldSigningKey2.toCircuitInput();
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

        if (!Prover.verifyState(proofAndPublicSignals)) {
            throw new Error("Invalid proof")
        }
        return Prover.serialize(proofAndPublicSignals);
    }
}
