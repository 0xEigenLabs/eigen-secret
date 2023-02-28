import { test, utils } from "../index";
import { Note } from "../src/note";
import { assert, expect } from "chai";
import { ethers } from "ethers";
import {  } from "../src/join_split";
import { compress as accountCompress, AccountOrNullifierKey, SigningKey } from "../src/account";
import { StateTree } from "../src/state_tree";
import { JoinSplitCircuit } from "../src/join_split";
import { getPublicKey, sign as k1Sign, verify as k1Verify, Point } from "@noble/secp256k1";
const path = require("path");

const { buildEddsa, buildBabyjub } = require("circomlibjs");

describe("Test JoinSplit Circuit", function () {

    let circuit: any;
    let eddsa: any;
    let babyJub: any;
    let F: any;
    let accountKey: AccountOrNullifierKey;
    let signingKey: SigningKey;
    let worldState: any;
    let aliasHash: bigint = 123n;
    let acStateKey: any;
    let assetId: number = 1;

    before(async () => {
        eddsa = await buildEddsa();
        babyJub = await buildBabyjub();
        F = babyJub.F;
        let third = path.join(__dirname, "../third-party");
        circuit = await test.genTempMain("circuits/join_split.circom",
            "JoinSplit", "proof_id, public_value, public_owner, num_input_notes, output_nc_1, output_nc_2, data_tree_root", "20", {include: third});
        accountKey = await (new SigningKey()).newKey(undefined);
        signingKey = await (new SigningKey()).newKey(undefined);
        worldState = new StateTree();
        await worldState.init();
        let acStateKeyTmp = await accountCompress(accountKey, signingKey, aliasHash);
        await worldState.insert(acStateKeyTmp, 1);
        acStateKey = F.toObject(acStateKeyTmp);
    })

    it("JoinSplit deposit test", async () => {
        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_DEPOSIT;
        let noteReceiver = await (new SigningKey()).newKey(undefined);
        let inputs = await JoinSplitCircuit.createDepositInput(
            accountKey,
            signingKey,
            worldState,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            assetId,
            10n,
            signingKey.pubKey,
            signingKey.pubKey,
            []
        );
        for (const input of inputs) {
            await utils.executeCircuit(circuit, input.toCircuitInput(F));
        }
        console.log("test send tx")
        let confirmedNote: Note[] = [];
        for (const inp of inputs) {
            inp.outputNotes[0].index = 10;
            inp.outputNotes[1].index = 10;
            confirmedNote.push(inp.outputNotes[0]);
            confirmedNote.push(inp.outputNotes[1]);
        }
        proofId = JoinSplitCircuit.PROOF_ID_TYPE_SEND;
        let inputs2 = await JoinSplitCircuit.createProofInput(
            accountKey,
            signingKey,
            worldState,
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
        );
        for (const input of inputs2) {
            await utils.executeCircuit(circuit, input.toCircuitInput(F));
        }
    })

    it("JoinSplit send to L2 test", async () => {
    })

    it("JoinSplit send to L1 test", async () => {
    })
});
