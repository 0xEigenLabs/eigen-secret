import * as test from "./test";
import * as utils from "@eigen-secret/core/dist/utils";
import { Note } from "@eigen-secret/core/dist/note";
import { assert, expect } from "chai";
import { ethers } from "ethers";
import { compress as accountCompress, SigningKey } from "@eigen-secret/core/dist/account";
import { WorldState } from "../server/dist/state_tree";
import { JoinSplitCircuit } from "@eigen-secret/core/dist/join_split";
import { AccountCircuit } from "@eigen-secret/core/dist/account";
import { UpdateStatusCircuit, UpdateStatusInput } from "@eigen-secret/core/dist/update_state";
import { Prover } from "@eigen-secret/core/dist/prover";
import { getPublicKey, sign as k1Sign, verify as k1Verify, Point } from "@noble/secp256k1";
const path = require("path");
const { readFileSync } = require("fs");
const snarkjs = require("snarkjs");

const { buildEddsa, buildBabyjub } = require("circomlibjs");

describe("Test JoinSplit Circuit", function () {

    let circuit: any;
    let eddsa: any;
    let babyJub: any;
    let F: any;
    let accountKey: SigningKey;
    let signingKey: SigningKey;
    let aliasHash: bigint = 123n;
    let acStateKey: any;
    let assetId: number = 1;
    let signer: any;
    let accountRequired: boolean = false;

    before(async () => {
        eddsa = await buildEddsa();
        babyJub = await buildBabyjub();
        F = babyJub.F;
        let third = path.join(__dirname, "../third-party");
        circuit = await test.genTempMain("circuits/update_state.circom",
            "UpdateState", "proof_id, public_value, public_owner, num_input_notes, output_nc_1, output_nc_2, data_tree_root, public_asset_id", "20", {include: third});
        accountKey = new SigningKey(eddsa);
        signingKey = new SigningKey(eddsa);
    })

    it("Account create update_state test", async () => {
        let proofId = AccountCircuit.PROOF_ID_TYPE_CREATE;
        let newAccountKey = accountKey;
        let newAccountPubKey = newAccountKey.pubKey.unpack(babyJub);
        newAccountPubKey = [F.toObject(newAccountPubKey[0]), F.toObject(newAccountPubKey[1])];

        let newSigningKey1 = new SigningKey(eddsa);
        let newSigningPubKey1 = newSigningKey1.pubKey.unpack(babyJub);
        newSigningPubKey1 = [F.toObject(newSigningPubKey1[0]), F.toObject(newSigningPubKey1[1])];

        let newSigningKey2 = new SigningKey(eddsa);
        let newSigningPubKey2 = newSigningKey2.pubKey.unpack(babyJub);
        newSigningPubKey2 = [F.toObject(newSigningPubKey2[0]), F.toObject(newSigningPubKey2[1])];

        let input = await UpdateStatusCircuit.createAccountInput(
            proofId,
            accountKey,
            signingKey,
            newAccountPubKey,
            newSigningPubKey1,
            newSigningPubKey2,
            aliasHash,
        );
        let proof = await WorldState.updateStateTree(input.newAccountNC, 1n, 0n, 0n, input.accountNC);
        await utils.executeCircuit(circuit, input.toCircuitInput(babyJub, proof));

        proofId = AccountCircuit.PROOF_ID_TYPE_MIGRATE;
        newAccountKey = new SigningKey(eddsa);
        newAccountPubKey = newAccountKey.pubKey.unpack(babyJub);
        newAccountPubKey = [F.toObject(newAccountPubKey[0]), F.toObject(newAccountPubKey[1])];

        newSigningKey2 = new SigningKey(eddsa);
        newSigningPubKey2 = newSigningKey2.pubKey.unpack(babyJub);
        newSigningPubKey2 = [F.toObject(newSigningPubKey2[0]), F.toObject(newSigningPubKey2[1])];
        input = await UpdateStatusCircuit.createAccountInput(
            proofId,
            accountKey,
            signingKey,
            newAccountPubKey,
            newSigningPubKey1,
            newSigningPubKey2,
            aliasHash,
        );

        proof = await WorldState.updateStateTree(0n, 0n, 0n, 0n, input.accountNC);
        await utils.executeCircuit(circuit, input.toCircuitInput(babyJub, proof));
    })

    it("JoinSplit deposit and send update_state test", async () => {
        signer = accountRequired? signingKey: accountKey;
        acStateKey = await accountCompress(accountKey, signer, aliasHash);

        //let state = await WorldState.getInstance();
        //await state.insert(F.e(acStateKey), 1n);
        await WorldState.updateStateTree(acStateKey, 1n, 0n, 0n, acStateKey);

        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_DEPOSIT;
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
            accountKey,
            signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            assetId,
            10n,
            signingKey.pubKey,
            10n,
            accountKey.pubKey,
            [],
            accountRequired
        );
        for (const input of inputs) {
            const proof = await WorldState.updateStateTree(
                input.outputNCs[0],
                input.outputNotes[0].inputNullifier,
                input.outputNCs[1],
                input.outputNotes[1].inputNullifier,
                acStateKey
            );
            console.log(input.toCircuitInput(babyJub, proof));
            await utils.executeCircuit(circuit, input.toCircuitInput(babyJub, proof));
        }
        let confirmedNote: Note[] = [];
        for (const inp of inputs) {
            confirmedNote.push(inp.outputNotes[0]); // after depositing, all balance becomes private value
            confirmedNote.push(inp.outputNotes[1]);
        }

        // create a send proof
        let noteReceiver = new SigningKey(eddsa);
        proofId = JoinSplitCircuit.PROOF_ID_TYPE_SEND;

        let inputs2 = await UpdateStatusCircuit.createJoinSplitInput(
            accountKey,
            signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            0,
            0n, // public value
            undefined, // public owner
            5n, // receiver private value
            noteReceiver.pubKey,
            confirmedNote,
            accountRequired
        );
        for (const input of inputs2) {
            const proof = await WorldState.updateStateTree(
                input.outputNCs[0],
                input.outputNotes[0].inputNullifier,
                input.outputNCs[1],
                input.outputNotes[1].inputNullifier,
                acStateKey
            );
            await utils.executeCircuit(circuit, input.toCircuitInput(babyJub, proof));
        }

        // create a withdraw proof
        proofId = JoinSplitCircuit.PROOF_ID_TYPE_WITHDRAW;
        confirmedNote = [];
        for (const inp of inputs2) {
            assert(inp.outputNotes[1].val === 5n);
            //confirmedNote.push(inp.outputNotes[0]);
            confirmedNote.push(inp.outputNotes[1]);
        }
        let withrawReceiver = new SigningKey(eddsa);
        let inputs3 = await UpdateStatusCircuit.createJoinSplitInput(
            accountKey,
            signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            assetId,
            2n, // public value
            withrawReceiver.pubKey, // public owner
            0n, // receiver private value
            signingKey.pubKey,
            confirmedNote,
            accountRequired
        );
        for (const input of inputs3) {
            const proof = await WorldState.updateStateTree(
                input.outputNCs[0],
                input.outputNotes[0].inputNullifier,
                input.outputNCs[1],
                input.outputNotes[1].inputNullifier,
                acStateKey
            );
            console.log(input.toCircuitInput(babyJub, proof));
            await utils.executeCircuit(circuit, input.toCircuitInput(babyJub, proof));
        }
    })

    it("update_state verify proof test", async () => {
        let inputJson = path.join(__dirname, "..", "circuits/main_update_state.input.json");
        const input = JSON.parse(readFileSync(inputJson));
        let circuitPath = path.join(__dirname, "..", "circuits");
        let proofAndPublicSignals = await Prover.updateState(circuitPath, input);

        const proof = proofAndPublicSignals.proof;
        const publicSignals = proofAndPublicSignals.publicSignals;

        let zkey = path.join(__dirname, "..", "circuits/circuit_final.zkey.16");
        const vKey = await snarkjs.zKey.exportVerificationKey(zkey);
        const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.equal(res, true)
    })
});
