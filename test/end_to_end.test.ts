const request = require('supertest');
const express = require('express');
const createBlakeHash = require("blake-hash");
const consola = require("consola");
import app from "../server/service";
import sequelize from "../src/db";
import { ethers } from "ethers";
import { uint8Array2Bigint, signEOASignature, prepareJson } from "../src/utils";
import { expect, assert } from "chai";
import { StateTree } from "../src/state_tree";
import { NoteState, NoteModel as DBNote } from "../server/note";
import { Note } from "../src/note";
import { aliasHashDigest, compress as accountCompress, EigenAddress, SigningKey } from "../src/account";
import { JoinSplitCircuit } from "../src/join_split";
import { AccountCircuit } from "../src/account";
import { UpdateStatusCircuit, UpdateStatusInput } from "../src/update_state";
import { Prover } from "../src/prover";
import { getPublicKey, sign as k1Sign, verify as k1Verify, Point } from "@noble/secp256k1";
import { Transaction } from "../src/transaction";
const { buildEddsa } = require("circomlibjs");
import { RollupHelper } from "./rollup.helper";
const path = require("path");
const hre = require('hardhat')
import { poseidonSponge } from "../src/sponge_poseidon";

describe('POST /transactions', function() {
    this.timeout(1000 * 1000);
    const alias = "eigen.eth";
    let eddsa: any;
    let babyJub: any;
    const circuitPath = path.join(__dirname, "../circuits/");
    let F: any;
    let newEOAAccount: any;
    const rawMessage = "Use Eigen Secret to shield your asset";
    let aliasHash: any;
    const accountRequired = false;
    let signer: any;
    let assetId = 0;
    let rollupHelper: RollupHelper;
    let userAccounts: any;
    before("end2end deposit", async() => {
        userAccounts = await hre.ethers.getSigners()
        rollupHelper = new RollupHelper(userAccounts);
        await rollupHelper.initialize();
        assetId = (await rollupHelper.deploy()).toNumber();
        newEOAAccount = await ethers.Wallet.createRandom();
        let timestamp = Math.floor(Date.now()/1000).toString();
        const signature = await signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, alias, timestamp);

        eddsa = await buildEddsa();
        babyJub = eddsa.babyJub;
        F = eddsa.F;
        const value = 10;

        let signingKey = rollupHelper.eigenSigningKeys[0][0];
        let accountKey = rollupHelper.eigenAccountKey[0];
        const aliasHashBuffer = eddsa.pruneBuffer(createBlakeHash("blake512").update(alias).digest().slice(0, 32));
        aliasHash = uint8Array2Bigint(aliasHashBuffer);
        let _accountRequired = true;
        signer = _accountRequired? signingKey: accountKey;
        let acStateKey = await accountCompress(eddsa, accountKey, signer, aliasHash);

        // 1. create account
        let proofId = AccountCircuit.PROOF_ID_TYPE_CREATE;
        let newAccountKey = accountKey;
        let newAccountPubKey = newAccountKey.pubKey.unpack(babyJub);
        newAccountPubKey = [F.toObject(newAccountPubKey[0]), F.toObject(newAccountPubKey[1])];

        let newSigningKey1 = rollupHelper.eigenSigningKeys[0][1]
        let newSigningPubKey1 = newSigningKey1.pubKey.unpack(babyJub);
        newSigningPubKey1 = [F.toObject(newSigningPubKey1[0]), F.toObject(newSigningPubKey1[1])];

        let newSigningKey2 = rollupHelper.eigenSigningKeys[0][2]
        let newSigningPubKey2 = newSigningKey2.pubKey.unpack(babyJub);
        newSigningPubKey2 = [F.toObject(newSigningPubKey2[0]), F.toObject(newSigningPubKey2[1])];

        let keysFound = []
        let valuesFound = [];
        let siblings = [];
        let input = await UpdateStatusCircuit.createAccountInput(
            proofId,
            accountKey,
            signingKey,
            newAccountPubKey,
            newSigningPubKey1,
            newSigningPubKey2,
            aliasHash,
        );
        assert(input.newAccountNC == acStateKey, "Invalid accountNC");

        signer = accountRequired? signingKey: accountKey;
        acStateKey = await accountCompress(eddsa, accountKey, signer, aliasHash);

        let tmpInput = prepareJson({
            alias: alias,
            timestamp: timestamp,
            message: rawMessage,
            hexSignature: signature,
            ethAddress: newEOAAccount.address,
            newStates: {
                outputNc1: acStateKey,
                nullifier1: 1n,
                outputNc2: 0n,
                nullifier2: 0n,
                acStateKey: acStateKey
            }
        });
        //console.log("tmpInput", tmpInput, acStateKey);
        const response = await request(app)
        .post('/statetree')
        .send(
            tmpInput
        )
        .set('Accept', 'application/json');
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

        let circuitInput = input.toCircuitInput(babyJub, singleProof);
        let proofAndPublicSignals = await Prover.updateState(circuitPath, circuitInput, F);

        // 1. first transaction depositing to itself
        let receiver = accountKey;

        const responseNote = await request(app)
            .post('/notes/get')
            .send({
                alias: alias,
                timestamp: timestamp,
                message: rawMessage,
                hexSignature: signature,
                ethAddress: newEOAAccount.address
            })
            .set('Accept', 'application/json');
        //console.log(responseNote.body.data);
        let encryptedNotes = responseNote.body.data;

        // decrypt
        let notes: Array<Note> = [];
        if (encryptedNotes) {
            encryptedNotes.forEach((item: DBNote) => {
                let sharedKey = signingKey.makeSharedKey(eddsa, new EigenAddress(item.pubKey));
                notes.push(Note.decrypt(item.content, sharedKey));
            });
        }

        //console.log("note: ", notes);

        await rollupHelper.deposit(0, assetId, value);
        // create notes
        proofId = JoinSplitCircuit.PROOF_ID_TYPE_DEPOSIT;
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
            accountKey,
            signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            assetId,
            BigInt(value),
            signingKey.pubKey,
            BigInt(value),
            receiver.pubKey,
            notes,
            accountRequired
        );

        for (const input of inputs) {
            let tmpInput = prepareJson({
                alias: alias,
                timestamp: timestamp,
                message: rawMessage,
                hexSignature: signature,
                ethAddress: newEOAAccount.address,
                newStates: {
                    outputNc1: input.outputNCs[0],
                    nullifier1: input.outputNotes[0].inputNullifier,
                    outputNc2: input.outputNCs[1],
                    nullifier2: input.outputNotes[1].inputNullifier,
                    acStateKey: acStateKey
                }
            });
            //console.log("tmpInput", tmpInput);
            const response = await request(app)
                .post('/statetree')
                .send(
                    tmpInput
                )
                .set('Accept', 'application/json');
            console.log(response.body.data);
            expect(response.status).to.eq(200);
            expect(response.body.errno).to.eq(0);

            // generate proof
            let singleProof = response.body.data;
            let circuitInput = input.toCircuitInput(babyJub, singleProof);
            let proofAndPublicSignals = await Prover.updateState(circuitPath, circuitInput, F);

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
            let transaction = new Transaction(input.outputNotes, signingKey);
            let txdata = await transaction.encrypt();

            let txInput = new Transaction(input.inputNotes, signingKey);
            let txInputData = await txInput.encrypt();

            // create tx. FIXME: should peg input?
            const responseTx = await request(app)
            .post('/transactions')
            .send({
                alias: alias,
                timestamp: timestamp,
                message: rawMessage,
                hexSignature: signature,
                ethAddress: newEOAAccount.address,
                pubKey: txdata[0].pubKey.pubKey,
                pubKey2: txdata[1].pubKey.pubKey,
                content: txdata[0].content,
                content2: txdata[1].content,
                noteIndex:  input.outputNotes[0].index.toString(),
                note2Index: input.outputNotes[1].index.toString(),
                proof: Prover.serialize(proofAndPublicSignals.proof),
                publicInput: Prover.serialize(proofAndPublicSignals.publicSignals)
            })
            .set('Accept', 'application/json');
            //console.log(responseTx.body);
            expect(responseTx.status).to.eq(200);
            expect(responseTx.body.errno).to.eq(0);

            // call contract and deposit
            await rollupHelper.update(0, proofAndPublicSignals);

            // settle down the spent notes
            const responseSt = await request(app)
            .post('/notes/update')
            .send(prepareJson({
                alias: alias,
                timestamp: timestamp,
                message: rawMessage,
                hexSignature: signature,
                ethAddress: newEOAAccount.address,
                notes: [
                    {
                        index: input.inputNotes[0].index,
                        pubKey: txInputData[0].pubKey.pubKey, //it's the first depositing, so the init public key is a random
                        content: txInputData[0].content,
                        state: NoteState.SPENT
                    },
                    {
                        index: input.inputNotes[1].index,
                        pubKey: txInputData[1].pubKey.pubKey, //same as above
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
            }))
            .set('Accept', 'application/json');
            //console.log(responseSt.body.data);
            expect(responseSt.status).to.eq(200);
            expect(responseSt.body.errno).to.eq(0);
        }

        await rollupHelper.processDeposits(0, keysFound, valuesFound, siblings);
    })

    it("end2end send", async() => {
        let timestamp = Math.floor(Date.now()/1000).toString();
        const signature = await signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, alias, timestamp);
        let signingKey = rollupHelper.eigenSigningKeys[0][0];
        let accountKey = rollupHelper.eigenAccountKey[0];
        let accountRequired = false;
        signer = accountRequired? signingKey: accountKey;
        let acStateKey = await accountCompress(eddsa, accountKey, signer, aliasHash);

        let proof = [];
        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_SEND;
        const value = 5;

        let receiver = rollupHelper.eigenAccountKey[0];
        let pubKey = receiver.pubKey.pubKey;

        // 1. first transaction
        const responseNote = await request(app)
        .post('/notes/get')
        .send({
            alias: alias,
            timestamp: timestamp,
            message: rawMessage,
            hexSignature: signature,
            ethAddress: newEOAAccount.address
        })
        .set('Accept', 'application/json');
        //console.log(responseNote.body.data);
        let encryptedNotes = responseNote.body.data;

        // decrypt
        let notes: Array<Note> = [];
        if (encryptedNotes) {
            encryptedNotes.forEach((item: DBNote) => {
                let sharedKey = signingKey.makeSharedKey(eddsa, new EigenAddress(item.pubKey));
                notes.push(Note.decrypt(item.content, sharedKey));
            });
        }
        assert(notes.length > 0, "Invalid notes");

        // create notes
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
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
        for (const input of inputs) {
            const response = await request(app)
            .post('/statetree')
            .send(prepareJson({
                alias: alias,
                timestamp: timestamp,
                message: rawMessage,
                hexSignature: signature,
                ethAddress: newEOAAccount.address,
                newStates: {
                    outputNc1: input.outputNCs[0],
                    nullifier1: input.outputNotes[0].inputNullifier,
                    outputNc2: input.outputNCs[1],
                    nullifier2: input.outputNotes[1].inputNullifier,
                    acStateKey: acStateKey
                }
            }))
            .set('Accept', 'application/json');
            //console.log(response.body.data);
            expect(response.status).to.eq(200);
            expect(response.body.errno).to.eq(0);

            // generate proof
            let singleProof = response.body.data;
            let circuitInput = input.toCircuitInput(babyJub, singleProof);
            let proofAndPublicSignals = await Prover.updateState(circuitPath, circuitInput, F);

            let transaction = new Transaction(input.outputNotes, signingKey);
            let txdata = await transaction.encrypt();

            let txInput = new Transaction(input.inputNotes, signingKey);
            let txInputData = await txInput.encrypt();
            assert(txInputData[0].content, encryptedNotes[0].content);

            // create tx
            const responseTx = await request(app)
            .post('/transactions')
            .send({
                alias: alias,
                timestamp: timestamp,
                message: rawMessage,
                hexSignature: signature,
                ethAddress: newEOAAccount.address,
                pubKey: txdata[0].pubKey.pubKey,
                pubKey2: txdata[1].pubKey.pubKey,
                content: txdata[0].content,
                content2: txdata[1].content,
                noteIndex:  input.outputNotes[0].index.toString(),
                note2Index: input.outputNotes[1].index.toString(),
                proof: Prover.serialize(proofAndPublicSignals.proof),
                publicInput: Prover.serialize(proofAndPublicSignals.publicSignals)
            })
            .set('Accept', 'application/json');
            expect(responseTx.status).to.eq(200);
            expect(responseTx.body.errno).to.eq(0);

            // call contract and deposit
            await rollupHelper.update(0, proofAndPublicSignals);

            // settle down the spent notes
            const responseSt = await request(app)
            .post('/notes/update')
            .send(prepareJson({
                alias: alias,
                timestamp: timestamp,
                message: rawMessage,
                hexSignature: signature,
                ethAddress: newEOAAccount.address,
                notes: [
                    {
                        index: encryptedNotes[0].index,
                        pubKey: pubKey,
                        content: encryptedNotes[0].content,
                        state: NoteState.SPENT
                    },
                    {
                        index: encryptedNotes[1].index,
                        pubKey: pubKey,
                        content: encryptedNotes[1].content,
                        state: NoteState.SPENT
                    },
                    {
                        index: input.outputNotes[0].index,
                        pubKey: pubKey,
                        content: txdata[0].content,
                        state: NoteState.PROVED
                    },
                    {
                        index: input.outputNotes[1].index,
                        pubKey: pubKey,
                        content: txdata[1].content,
                        state: NoteState.PROVED
                    },
                ]
            }))
            .set('Accept', 'application/json');
            //console.log(responseSt.body.data);
            expect(responseSt.status).to.eq(200);
            expect(responseSt.body.errno).to.eq(0);
        }
    })

    it("should accept valid withdrawals", async() => {
        let timestamp = Math.floor(Date.now()/1000).toString();
        const signature = await signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, alias, timestamp);
        let signingKey = rollupHelper.eigenSigningKeys[0][0];
        let accountKey = rollupHelper.eigenAccountKey[0];

        let proof = [];
        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_WITHDRAW;
        let accountRequired = false;
        signer = accountRequired? signingKey: accountKey;
        let acStateKey = await accountCompress(eddsa, accountKey, signer, aliasHash);
        const value = 5;

        let receiver = rollupHelper.eigenAccountKey[0];
        let pubKey = receiver.pubKey.pubKey;

        // 1. first transaction
        const responseNote = await request(app)
        .post('/notes/get')
        .send({
            alias: alias,
            timestamp: timestamp,
            message: rawMessage,
            hexSignature: signature,
            ethAddress: newEOAAccount.address
        })
        .set('Accept', 'application/json');
        //console.log(responseNote.body.data);
        let encryptedNotes = responseNote.body.data;

        // decrypt
        let notes: Array<Note> = [];
        if (encryptedNotes) {
            encryptedNotes.forEach((item: DBNote) => {
                let sharedKey = signingKey.makeSharedKey(eddsa, new EigenAddress(item.pubKey));
                notes.push(Note.decrypt(item.content, sharedKey));
            });
        }
        assert(notes.length > 0, "Invalid notes");

        // create notes
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
            accountKey,
            signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            assetId,
            BigInt(value),
            signingKey.pubKey,
            0n,
            signingKey.pubKey,
            notes,
            accountRequired
        );
        let lastProof: any;
        let lastSiblings: any;
        for (const input of inputs) {
            const response = await request(app)
            .post('/statetree')
            .send(prepareJson({
                alias: alias,
                timestamp: timestamp,
                message: rawMessage,
                hexSignature: signature,
                ethAddress: newEOAAccount.address,
                newStates: {
                    outputNc1: input.outputNCs[0],
                    nullifier1: input.outputNotes[0].inputNullifier,
                    outputNc2: input.outputNCs[1],
                    nullifier2: input.outputNotes[1].inputNullifier,
                    acStateKey: acStateKey
                }
            }))
            .set('Accept', 'application/json');
            //console.log(response.body.data);
            expect(response.status).to.eq(200);
            expect(response.body.errno).to.eq(0);

            // generate proof
            let singleProof = response.body.data;
            let circuitInput = input.toCircuitInput(babyJub, singleProof);
            let proofAndPublicSignals = await Prover.updateState(circuitPath, circuitInput, F);

            let transaction = new Transaction(input.outputNotes, signingKey);
            let txdata = await transaction.encrypt();

            let txInput = new Transaction(input.inputNotes, signingKey);
            let txInputData = await txInput.encrypt();
            assert(txInputData[0].content, encryptedNotes[0].content);

            // create tx
            const responseTx = await request(app)
            .post('/transactions')
            .send({
                alias: alias,
                timestamp: timestamp,
                message: rawMessage,
                hexSignature: signature,
                ethAddress: newEOAAccount.address,
                pubKey: txdata[0].pubKey.pubKey,
                pubKey2: txdata[1].pubKey.pubKey,
                content: txdata[0].content,
                content2: txdata[1].content,
                noteIndex:  input.outputNotes[0].index.toString(),
                note2Index: input.outputNotes[1].index.toString(),
                proof: Prover.serialize(proofAndPublicSignals.proof),
                publicInput: Prover.serialize(proofAndPublicSignals.publicSignals)
            })
            .set('Accept', 'application/json');
            expect(responseTx.status).to.eq(200);
            expect(responseTx.body.errno).to.eq(0);

            // call contract and deposit
            await rollupHelper.update(0, proofAndPublicSignals);
            lastProof = proofAndPublicSignals;
            lastSiblings = singleProof.siblings;

            // settle down the spent notes
            const responseSt = await request(app)
            .post('/notes/update')
            .send(prepareJson({
                alias: alias,
                timestamp: timestamp,
                message: rawMessage,
                hexSignature: signature,
                ethAddress: newEOAAccount.address,
                notes: [
                    {
                        index: encryptedNotes[0].index,
                        pubKey: pubKey,
                        content: encryptedNotes[0].content,
                        state: NoteState.SPENT
                    },
                    {
                        index: encryptedNotes[1].index,
                        pubKey: pubKey,
                        content: encryptedNotes[1].content,
                        state: NoteState.SPENT
                    },
                    {
                        index: input.outputNotes[0].index,
                        pubKey: pubKey,
                        content: txdata[0].content,
                        state: NoteState.PROVED
                    },
                    {
                        index: input.outputNotes[1].index,
                        pubKey: pubKey,
                        content: txdata[1].content,
                        state: NoteState.PROVED
                    },
                ]
            }))
            .set('Accept', 'application/json');
            //console.log(responseSt.body.data);
            expect(responseSt.status).to.eq(200);
            expect(responseSt.body.errno).to.eq(0);
        }

        let xy = rollupHelper.pubkeyEigenSigningKeys[0][0];
        // last tx
        const txInfo = {
            publicValue: value, // lastProof.publicSignals[1]
            publicOwner: xy, //lastProof.publicSignals[2]
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
                txInfo.publicAssetId,
            ]
        );

        let sig = await signingKey.sign(eddsa.F.e(msg));
        let input = {
            enabled: 1,
            Ax: xy[0],
            Ay: xy[1],
            M: msg,
            R8x: F.toObject(sig.R8[0]),
            R8y: F.toObject(sig.R8[1]),
            S: sig.S,
        }
        let proofAndPublicSignals = await Prover.withdraw(circuitPath, input, eddsa.F);
        await rollupHelper.withdraw(
            0,
            1,
            txInfo,
            proofAndPublicSignals
        );

        //TODO balance test
    })
});
