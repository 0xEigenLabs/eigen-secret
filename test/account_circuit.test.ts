import { test, utils } from "../index";
import { Note } from "../src/note";
import { assert, expect } from "chai";
import { ethers } from "ethers";
import {  } from "../src/join_split";
import { compress as accountCompress, AccountOrNullifierKey, SigningKey, AccountCircuit } from "../src/account";
import { StateTree } from "../src/state_tree";
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
        circuit = await test.genTempMain("circuits/account.circom",
            "Account", "proof_id, public_value, public_owner, num_input_notes, output_nc_1, output_nc_2, data_tree_root", "20", {include: third});
        accountKey = await (new SigningKey()).newKey(undefined);
        signingKey = await (new SigningKey()).newKey(undefined);
        worldState = new StateTree();
        await worldState.init();
        acStateKey = await accountCompress(accountKey, signingKey, aliasHash);
        await worldState.insert(F.e(acStateKey), 1);
    })

    it("Account create test", async () => {
        let proofId = AccountCircuit.PROOF_ID_TYPE_CREATE;
        let newAccountKey = accountKey;
        let newAccountPubKey = await newAccountKey.pubKey.unpack();
        newAccountPubKey = [F.toObject(newAccountPubKey[0]), F.toObject(newAccountPubKey[1])];

        let newSigningKey1 = await (new SigningKey()).newKey(undefined);
        let newSigningPubKey1 = await newSigningKey1.pubKey.unpack();
        newSigningPubKey1 = [F.toObject(newSigningPubKey1[0]), F.toObject(newSigningPubKey1[1])];

        let newSigningKey2 = await (new SigningKey()).newKey(undefined);
        let newSigningPubKey2 = await newSigningKey2.pubKey.unpack();
        newSigningPubKey2 = [F.toObject(newSigningPubKey2[0]), F.toObject(newSigningPubKey2[1])];

        let input = await AccountCircuit.createProofInput(
            proofId,
            accountKey,
            signingKey,
            newAccountPubKey,
            newSigningPubKey1,
            newSigningPubKey2,
            aliasHash,
            worldState
        );
        await utils.executeCircuit(circuit, input.toCircuitInput());
    })
});
