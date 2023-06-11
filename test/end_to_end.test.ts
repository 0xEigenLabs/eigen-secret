const request = require("supertest");
const createBlakeHash = require("blake-hash");
import app from "../server/dist/service";
import { ethers } from "ethers";
import { signEOASignature, prepareJson, rawMessage } from "@eigen-secret/core/dist-node/utils";
import { Context } from "@eigen-secret/core/dist-node/context";
import { expect, assert } from "chai";
import { pad } from "@eigen-secret/core/dist-node/state_tree";
import { Note, NoteState } from "@eigen-secret/core/dist-node/note";
import { calcAliasHash, compress as accountCompress } from "@eigen-secret/core/dist-node/account";
import { JoinSplitCircuit } from "@eigen-secret/core/dist-node/join_split";
import { AccountCircuit, decryptNotes } from "@eigen-secret/core/dist-node/account";
import { UpdateStatusCircuit } from "@eigen-secret/core/dist-node/update_state";
import { Prover } from "@eigen-secret/core/dist-node/prover";
import { Transaction } from "@eigen-secret/core/dist-node/transaction";
const { buildEddsa } = require("circomlibjs");
import { RollupHelper } from "./rollup.helper";
const path = require("path");
import { alias2Bigint } from "@eigen-secret/core/dist-node/digest";
const hre = require("hardhat")
import { poseidonSponge } from "@eigen-secret/core/dist-node/sponge_poseidon";
import { deployPoseidons } from "@eigen-secret/core/dist-node/deploy_poseidons.util";
/* globals describe, before, it */
describe("POST /transactions", function() {
    const alias = "eigen.eth";
    let eddsa: any;
    let babyJub: any;
    const circuitPath = path.join(__dirname, "../circuits/");
    let Fr: any;
    let newEOAAccount: any;
    let aliasHash: any;
    const accountRequired = false;
    let signer: any;
    let assetId = 0;
    let rollupHelper: RollupHelper;
    let userAccounts: any;

    let smtVerifierContract: any;

    before("end2end deposit", async () => {
        userAccounts = await hre.ethers.getSigners()

        let poseidons = await deployPoseidons(hre.ethers, userAccounts[0], [2, 3]);
        let factorySMT = await hre.ethers.getContractFactory("SMT");
        smtVerifierContract = await factorySMT.deploy(poseidons[0].address, poseidons[1].address);
        await smtVerifierContract.deployed()

        newEOAAccount = await ethers.Wallet.createRandom();
        let timestamp = Math.floor(Date.now()/1000).toString();
        const signature = await signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, timestamp);

        let ctx = new Context(alias, newEOAAccount.address, rawMessage, timestamp, signature);
        eddsa = await buildEddsa();
        aliasHash = await calcAliasHash(eddsa, alias, ctx.pubKey);
        rollupHelper = new RollupHelper(userAccounts);
        await rollupHelper.initialize(eddsa);
        assetId = (await rollupHelper.deploy()).toNumber();

        babyJub = eddsa.babyJub;
        Fr = eddsa.F;
        const value = 10n;

        let signingKey = rollupHelper.eigenSigningKeys[0][0];
        let accountKey = rollupHelper.eigenAccountKey[0];

        // 1. create account
        let proofId = AccountCircuit.PROOF_ID_TYPE_CREATE;
        let newAccountKey = accountKey;
        let newAccountPubKey = newAccountKey.pubKey.unpack(babyJub);
        newAccountPubKey = [Fr.toObject(newAccountPubKey[0]), Fr.toObject(newAccountPubKey[1])];

        let newSigningKey1 = rollupHelper.eigenSigningKeys[0][1]
        let newSigningPubKey1 = newSigningKey1.pubKey.unpack(babyJub);
        newSigningPubKey1 = [Fr.toObject(newSigningPubKey1[0]), Fr.toObject(newSigningPubKey1[1])];

        let newSigningKey2 = rollupHelper.eigenSigningKeys[0][2]
        let newSigningPubKey2 = newSigningKey2.pubKey.unpack(babyJub);
        newSigningPubKey2 = [Fr.toObject(newSigningPubKey2[0]), Fr.toObject(newSigningPubKey2[1])];

        let keysFound = []
        let valuesFound = [];
        let siblings = [];
        let input = await UpdateStatusCircuit.createAccountInput(
            eddsa,
            proofId,
            accountKey,
            signingKey,
            newAccountPubKey,
            newSigningPubKey1,
            newSigningPubKey2,
            aliasHash
        );

        signer = accountRequired? accountKey: signingKey;
        let acStateKey = await accountCompress(accountKey, signer, aliasHash);

        let tmpInput = prepareJson({
            context: ctx.serialize(),
            padding: true,
            newStates: {
                outputNc1: acStateKey,
                nullifier1: 1n,
                outputNc2: 0n,
                nullifier2: 0n,
                acStateKey: acStateKey
            }
        });
        // console.log("tmpInput", tmpInput, acStateKey);
        const response = await request(app)
        .post("/statetree")
        .send(
            tmpInput
        )
        .set("Accept", "application/json");
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);

        let singleProof = response.body.data;

        keysFound.push(acStateKey);
        valuesFound.push(1n);
        let tmpSiblings = [];
        for (const sib of singleProof.siblings[0]) {
            tmpSiblings.push(BigInt(sib));
        }
        siblings.push(tmpSiblings);

        let bAlias = alias2Bigint(eddsa, alias);
        let circuitInput = input.toCircuitInput(babyJub, singleProof, bAlias, ctx.toCircuitInput());
        console.log(circuitInput);
        await Prover.updateState(circuitPath, circuitInput);

        // 1. first transaction depositing to itself
        let receiver = accountKey;

        ctx = new Context(alias, newEOAAccount.address, rawMessage, timestamp, signature);
        const responseNote = await request(app)
            .post("/notes/get")
            .send({
                context: ctx.serialize(),
                noteState: [NoteState.PROVED]
            })
            .set("Accept", "application/json");
        console.log(responseNote.body.data);
        let encryptedNotes = responseNote.body.data;

        // decrypt
        let notes: Array<Note> = decryptNotes(accountKey, encryptedNotes);

        // console.log("note: ", notes);
        let nonce = 0; // get nonce from metamask
        await rollupHelper.deposit(0, assetId, value, nonce);
        // create notes
        proofId = JoinSplitCircuit.PROOF_ID_TYPE_DEPOSIT;
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
            eddsa,
            accountKey,
            signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            assetId,
            BigInt(value),
            accountKey.pubKey,
            BigInt(value),
            receiver.pubKey,
            notes,
            accountRequired
        );

        for (const input of inputs) {
            ctx = new Context(alias, newEOAAccount.address, rawMessage, timestamp, signature);
            let tmpInput = prepareJson({
                context: ctx.serialize(),
                padding: true,
                newStates: {
                    outputNc1: input.outputNCs[0],
                    nullifier1: input.outputNotes[0].inputNullifier,
                    outputNc2: input.outputNCs[1],
                    nullifier2: input.outputNotes[1].inputNullifier,
                    acStateKey: acStateKey
                }
            });
            const response = await request(app)
                .post("/statetree")
                .send(
                    tmpInput
                )
                .set("Accept", "application/json");
            console.log(response.body.data);
            expect(response.status).to.eq(200);
            expect(response.body.errno).to.eq(0);

            // generate proof
            let singleProof = response.body.data;
            let circuitInput = input.toCircuitInput(babyJub, singleProof, bAlias, ctx.toCircuitInput());
            let proofAndPublicSignals = await Prover.updateState(circuitPath, circuitInput);

            keysFound.push(input.outputNCs[0]);
            valuesFound.push(input.outputNotes[0].inputNullifier);
            keysFound.push(input.outputNCs[1]);
            valuesFound.push(input.outputNotes[1].inputNullifier);
            for (const item of singleProof.siblings) {
                let tmpSiblings = [];
                for (const sib of item) {
                    tmpSiblings.push(BigInt(sib));
                }
                siblings.push(tmpSiblings);
            }

            // output transaction
            let transaction = new Transaction(input, eddsa);
            let txData = await transaction.encryptNote();

            ctx = new Context(alias, newEOAAccount.address, rawMessage, timestamp, signature);
            // create tx. FIXME: should peg input?
            const responseTx = await request(app)
            .post("/transactions/create")
                .send({
                    context: ctx.serialize(),
                    inputs: [{
                        txData: transaction.encryptTx(signingKey, value),
                        operation: "deposit",
                        proof: Prover.serialize(proofAndPublicSignals.proof),
                        publicInput: Prover.serialize(proofAndPublicSignals.publicSignals)
                    }]
                })
                .set("Accept", "application/json");
            // console.log(responseTx.body);
            expect(responseTx.status).to.eq(200);
            expect(responseTx.body.errno).to.eq(0);

            // call contract and deposit
            await rollupHelper.update(0, proofAndPublicSignals);

            // settle down the spent notes
            ctx = new Context(alias, newEOAAccount.address, rawMessage, timestamp, signature);
            const responseSt = await request(app)
            .post("/transactions/create")
            .send(prepareJson({
                context: ctx.serialize(),
                inputs: [],
                notes: [
                    {
                        alias: alias,
                        index: input.inputNotes[0].index,
                        pubKey: txData[0].pubKey.pubKey,
                        // pubKey: it's the first depositing, so the init public key is a random
                        content: txData[0].content,
                        state: NoteState.SPENT
                    },
                    {
                        alias: alias,
                        index: input.inputNotes[1].index,
                        pubKey: txData[1].pubKey.pubKey, // same as above
                        content: txData[1].content,
                        state: NoteState.SPENT
                    },
                    {
                        alias: alias,
                        index: input.outputNotes[0].index,
                        pubKey: txData[2].pubKey.pubKey,
                        content: txData[2].content,
                        state: NoteState.PROVED
                    },
                    {
                        alias: alias,
                        index: input.outputNotes[1].index,
                        pubKey: txData[3].pubKey.pubKey,
                        content: txData[3].content,
                        state: NoteState.PROVED
                    }
                ]
            }))
            .set("Accept", "application/json");
            console.log(responseSt.body.data);
            expect(responseSt.status).to.eq(200);
            expect(responseSt.body.errno).to.eq(0);
        }

        await rollupHelper.processDeposits(0, keysFound, valuesFound, siblings);
    })

    it("end2end send", async () => {
        let timestamp = Math.floor(Date.now()/1000).toString();
        const signature = await signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, timestamp);
        let signingKey = rollupHelper.eigenSigningKeys[0][0];
        let accountKey = rollupHelper.eigenAccountKey[0];
        let accountRequired = false;
        signer = accountRequired? accountKey: signingKey;
        let acStateKey = await accountCompress(accountKey, signer, aliasHash);

        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_SEND;
        const value = 5n;

        let receiver = rollupHelper.eigenAccountKey[0];

        // 1. first transaction
        let ctx = new Context(alias, newEOAAccount.address, rawMessage, timestamp, signature);
        const responseNote = await request(app)
        .post("/notes/get")
        .send({
            context: ctx.serialize(),
            noteState: [NoteState.PROVED]
        })
        .set("Accept", "application/json");
        console.log(responseNote.body.data);
        let encryptedNotes = responseNote.body.data;

        // decrypt
        let notes: Array<Note> = decryptNotes(accountKey, encryptedNotes);
        assert(notes.length > 0, "Invalid notes");

        // create notes
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
            eddsa,
            accountKey,
            signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            0,
            0n,
            undefined,
            BigInt(value),
            receiver.pubKey,
            notes,
            accountRequired
        );
        let bAlias = alias2Bigint(eddsa, alias);
        for (const input of inputs) {
            ctx = new Context(alias, newEOAAccount.address, rawMessage, timestamp, signature);
            const response = await request(app)
            .post("/statetree")
            .send(prepareJson({
                context: ctx.serialize(),
                padding: true,
                newStates: {
                    outputNc1: input.outputNCs[0],
                    nullifier1: input.outputNotes[0].inputNullifier,
                    outputNc2: input.outputNCs[1],
                    nullifier2: input.outputNotes[1].inputNullifier,
                    acStateKey: acStateKey
                }
            }))
            .set("Accept", "application/json");
            // console.log(response.body.data);
            expect(response.status).to.eq(200);
            expect(response.body.errno).to.eq(0);

            // generate proof
            let singleProof = response.body.data;
            let circuitInput = input.toCircuitInput(babyJub, singleProof, bAlias, ctx.toCircuitInput());
            let proofAndPublicSignals = await Prover.updateState(circuitPath, circuitInput);

            let transaction = new Transaction(input, eddsa);
            let txData = await transaction.encryptNote();

            assert(txData[0].content, encryptedNotes[0].content);

            // create tx
            ctx = new Context(alias, newEOAAccount.address, rawMessage, timestamp, signature);
            const responseTx = await request(app)
            .post("/transactions/create")
            .send({
                context: ctx.serialize(),
                inputs: [{
                    txData: transaction.encryptTx(signingKey, value),
                    operation: "send",
                    proof: Prover.serialize(proofAndPublicSignals.proof),
                    publicInput: Prover.serialize(proofAndPublicSignals.publicSignals)
                }]
            })
                .set("Accept", "application/json");
            expect(responseTx.status).to.eq(200);
            expect(responseTx.body.errno).to.eq(0);

            // call contract and deposit
            await rollupHelper.update(0, proofAndPublicSignals);

            // settle down the spent notes
            ctx = new Context(alias, newEOAAccount.address, rawMessage, timestamp, signature);
            const responseSt = await request(app)
            .post("/transactions/create")
            .send(prepareJson({
                context: ctx.serialize(),
                inputs: [],
                notes: [
                    {
                        alias: alias,
                        index: input.inputNotes[0].index,
                        pubKey: txData[0].pubKey.pubKey,
                        content: txData[0].content,
                        state: NoteState.SPENT
                    },
                    {
                        alias: alias,
                        index: input.inputNotes[1].index,
                        pubKey: txData[1].pubKey.pubKey,
                        content: txData[1].content,
                        state: NoteState.SPENT
                    },
                    {
                        alias: alias,
                        index: input.outputNotes[0].index,
                        pubKey: txData[2].pubKey.pubKey,
                        content: txData[2].content,
                        state: NoteState.PROVED
                    },
                    {
                        alias: alias,
                        index: input.outputNotes[1].index,
                        pubKey: txData[3].pubKey.pubKey,
                        content: txData[3].content,
                        state: NoteState.PROVED
                    }
                ]
            }))
            .set("Accept", "application/json");
            // console.log(responseSt.body.data);
            expect(responseSt.status).to.eq(200);
            expect(responseSt.body.errno).to.eq(0);
        }
    })

    it("should accept valid withdrawals", async () => {
        let timestamp = Math.floor(Date.now()/1000).toString();
        const signature = await signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, timestamp);
        let signingKey = rollupHelper.eigenSigningKeys[0][0];
        let accountKey = rollupHelper.eigenAccountKey[0];

        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_WITHDRAW;
        let accountRequired = false;
        signer = accountRequired? accountKey: signingKey;
        let acStateKey = await accountCompress(accountKey, signer, aliasHash);
        const value = 5n;

        // 1. first transaction
        let ctx = new Context(alias, newEOAAccount.address, rawMessage, timestamp, signature);
        const responseNote = await request(app)
        .post("/notes/get")
        .send({
            context: ctx.serialize(),
            noteState: [NoteState.PROVED]
        })
        .set("Accept", "application/json");
        // console.log(responseNote.body.data);
        let encryptedNotes = responseNote.body.data;

        // decrypt
        let notes: Array<Note> = decryptNotes(accountKey, encryptedNotes);
        assert(notes.length > 0, "Invalid notes");

        // create notes
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
            eddsa,
            accountKey,
            signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            assetId,
            BigInt(value),
            accountKey.pubKey,
            0n,
            accountKey.pubKey,
            notes,
            accountRequired
        );
        let lastKeys: Array<bigint> = [];
        // let lastSiblings: Array<Array<bigint>> = [];
        // let lastValues: Array<bigint> = [];
        let keysFound: Array<bigint> = [];
        let valuesFound: Array<bigint> = [];
        let dataTreeRootsFound: Array<bigint> = [];
        let lastDataTreeRoot: bigint = 0n;
        let siblings: Array<Array<bigint>> = [];
        let bAlias = alias2Bigint(eddsa, alias);
        for (const input of inputs) {
            ctx = new Context(alias, newEOAAccount.address, rawMessage, timestamp, signature);
            const response = await request(app)
            .post("/statetree")
            .send(prepareJson({
                context: ctx.serialize(),
                padding: false, // NOTE: DO NOT pad because we need call smtVerifier smartcontract
                newStates: {
                    outputNc1: input.outputNCs[0],
                    nullifier1: input.outputNotes[0].inputNullifier,
                    outputNc2: input.outputNCs[1],
                    nullifier2: input.outputNotes[1].inputNullifier,
                    acStateKey: acStateKey
                }
            }))
            .set("Accept", "application/json");
            // console.log(response.body.data);
            expect(response.status).to.eq(200);
            expect(response.body.errno).to.eq(0);

            // generate proof
            let singleProof = response.body.data;
            let rawSiblings = singleProof.siblings;
            console.log("rawSiblings", rawSiblings);
            // pad siblings

            let paddedSiblings = [
                pad(rawSiblings[0]),
                pad(rawSiblings[1])
            ];
            singleProof.siblings = paddedSiblings;

            // pad account siblings
            singleProof.siblingsAC = pad(singleProof.siblingsAC);

            let circuitInput = input.toCircuitInput(babyJub, singleProof, bAlias, ctx.toCircuitInput());
            let proofAndPublicSignals = await Prover.updateState(circuitPath, circuitInput);

            keysFound.push(input.outputNCs[0]);
            valuesFound.push(input.outputNotes[0].inputNullifier);
            keysFound.push(input.outputNCs[1]);
            valuesFound.push(input.outputNotes[1].inputNullifier);
            dataTreeRootsFound.push(BigInt(singleProof.dataTreeRoot));
            lastDataTreeRoot = singleProof.dataTreeRoot;
            lastKeys = input.outputNCs;
            // lastValues = [input.outputNotes[0].inputNullifier, input.outputNotes[1].inputNullifier];

            // lastSiblings = []
            for (const item of rawSiblings) {
                let tmpSiblings = [];
                for (const sib of item) {
                    tmpSiblings.push(sib);
                }
                // lastSiblings.push(tmpSiblings);
                siblings.push(tmpSiblings);
            }

            let transaction = new Transaction(input, eddsa);
            let txData = await transaction.encryptNote();

            assert(txData[0].content, encryptedNotes[0].content);

            // create tx
            ctx = new Context(alias, newEOAAccount.address, rawMessage, timestamp, signature);
            const responseTx = await request(app)
            .post("/transactions/create")
            .send({
                context: ctx.serialize(),
                inputs: [{
                    txData: transaction.encryptTx(signingKey, value),
                    operation: "withdraw",
                    proof: Prover.serialize(proofAndPublicSignals.proof),
                    publicInput: Prover.serialize(proofAndPublicSignals.publicSignals)
                }]
            })
                .set("Accept", "application/json");
            expect(responseTx.status).to.eq(200);
            expect(responseTx.body.errno).to.eq(0);

            // call contract and deposit
            await rollupHelper.update(0, proofAndPublicSignals);

            // settle down the spent notes
            ctx = new Context(alias, newEOAAccount.address, rawMessage, timestamp, signature);
            const responseSt = await request(app)
            .post("/transactions/create")
            .send(prepareJson({
                context: ctx.serialize(),
                notes: [
                    {
                        alias: alias,
                        index: input.inputNotes[0].index,
                        pubKey: txData[0].pubKey.pubKey,
                        content: txData[0].content,
                        state: NoteState.SPENT
                    },
                    {
                        alias: alias,
                        index: input.inputNotes[1].index,
                        pubKey: txData[0].pubKey.pubKey,
                        content: txData[1].content,
                        state: NoteState.SPENT
                    },
                    {
                        alias: alias,
                        index: input.outputNotes[0].index,
                        pubKey: txData[2].pubKey.pubKey,
                        content: txData[2].content,
                        state: NoteState.SPENT
                    },
                    {
                        alias: alias,
                        index: input.outputNotes[1].index,
                        pubKey: txData[3].pubKey.pubKey,
                        content: txData[3].content,
                        state: NoteState.SPENT
                    }
                ]
            }))
            .set("Accept", "application/json");
            // console.log(responseSt.body.data);
            expect(responseSt.status).to.eq(200);
            expect(responseSt.body.errno).to.eq(0);
        }

        // let sz = keysFound.length;

        let xy = rollupHelper.pubkeyEigenSigningKeys[0][0];
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
        let tmpRoot = await smtVerifierContract.smtVerifier(
                txInfo.siblings[0], txInfo.keys[0],
                txInfo.values[0], 0, 0, false, false, 20
        )
        expect(tmpRoot.toString()).to.eq(dataTreeRootsFound[0].toString());

        tmpRoot = await smtVerifierContract.smtVerifier(
                txInfo.siblings[1], txInfo.keys[1],
                txInfo.values[1], 0, 0, false, false, 20
        )
        expect(tmpRoot.toString()).to.eq(dataTreeRootsFound[0].toString());

        let sig = await signingKey.sign(Fr.e(msg));
        let input = {
            enabled: 1,
            Ax: xy[0],
            Ay: xy[1],
            M: msg,
            R8x: Fr.toObject(sig.R8[0]),
            R8y: Fr.toObject(sig.R8[1]),
            S: sig.S
        }

        let proofAndPublicSignals = await Prover.withdraw(circuitPath, input);
        await rollupHelper.withdraw(
            0,
            1,
            txInfo,
            proofAndPublicSignals
        );
    })
});
