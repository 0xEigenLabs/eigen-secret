import { test, utils } from "../index";
import { Note } from "../src/note";
import { assert, expect } from "chai";
import { ethers } from "ethers";
import { compress as accountCompress, AccountOrNullifierKey, SigningKey } from "../src/account";
import { WorldState } from "../src/state_tree";
import { JoinSplitCircuit } from "../src/join_split";
import { AccountCircuit } from "../src/account";
import { UpdateStatusCircuit, UpdateStatusInput } from "../src/update_state";
import { Prover } from "../src/prover";
import { getPublicKey, sign as k1Sign, verify as k1Verify, Point } from "@noble/secp256k1";
const path = require("path");
const { readFileSync } = require("fs");
const snarkjs = require("snarkjs");
import SMTModel from "../src/state_tree_db";

const { buildEddsa, buildBabyjub } = require("circomlibjs");

describe("Test JoinSplit Circuit", function () {

    let circuit: any;
    let eddsa: any;
    let babyJub: any;
    let F: any;
    let accountKey: AccountOrNullifierKey;
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
        accountKey = await (new SigningKey()).newKey(undefined);
        signingKey = await (new SigningKey()).newKey(undefined);
    })

    it("Account create update_state test", async () => {
        let proofId = AccountCircuit.PROOF_ID_TYPE_CREATE;
        let newAccountKey = accountKey;
        let newAccountPubKey = newAccountKey.pubKey.unpack(babyJub);
        newAccountPubKey = [F.toObject(newAccountPubKey[0]), F.toObject(newAccountPubKey[1])];

        let newSigningKey1 = await (new SigningKey()).newKey(undefined);
        let newSigningPubKey1 = newSigningKey1.pubKey.unpack(babyJub);
        newSigningPubKey1 = [F.toObject(newSigningPubKey1[0]), F.toObject(newSigningPubKey1[1])];

        let newSigningKey2 = await (new SigningKey()).newKey(undefined);
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
        await utils.executeCircuit(circuit, input.toCircuitInput(babyJub));

        proofId = AccountCircuit.PROOF_ID_TYPE_MIGRATE;
        newAccountKey = await (new SigningKey()).newKey(undefined);
        newAccountPubKey = newAccountKey.pubKey.unpack(babyJub);
        newAccountPubKey = [F.toObject(newAccountPubKey[0]), F.toObject(newAccountPubKey[1])];

        newSigningKey2 = await (new SigningKey()).newKey(undefined);
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
        await utils.executeCircuit(circuit, input.toCircuitInput(babyJub));
    })

    it("JoinSplit deposit and send update_state test", async () => {
        signer = accountRequired? signingKey: accountKey;
        acStateKey = await accountCompress(eddsa, accountKey, signer, aliasHash);

        let state = await WorldState.getInstance();
        await state.insert(F.e(acStateKey), 1n);

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
            await utils.executeCircuit(circuit, input.toCircuitInput(babyJub));
        }
        console.log("test send tx")
        let confirmedNote: Note[] = [];
        for (const inp of inputs) {
            confirmedNote.push(inp.outputNotes[0]); // after depositing, all balance becomes private value
            confirmedNote.push(inp.outputNotes[1]);
        }

        // create a send proof
        let noteReceiver = await (new SigningKey()).newKey(undefined);
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
            await utils.executeCircuit(circuit, input.toCircuitInput(babyJub));
        }
    })

    it("update_state verify proof test", async () => {
        let inputJson = path.join(__dirname, "..", "circuits/main_update_state.input.json");
        const input = JSON.parse(readFileSync(inputJson));
        let circuitPath = path.join(__dirname, "..", "circuits");
        let proofAndPublicSignals = Prover.updateState(circuitPath, input, F);
        console.log((await proofAndPublicSignals).publicSignals);

        const proof = (await proofAndPublicSignals).proof;
        const publicSignals = (await proofAndPublicSignals).publicSignals;

        let zkey = path.join(__dirname, "..", "circuits/circuit_final.zkey");
        const vKey = await snarkjs.zKey.exportVerificationKey(zkey);
        const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.equal(res, true)
    })
});
