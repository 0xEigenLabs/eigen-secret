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

describe.only("Account circuit test", function () {

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
        circuit = await test.genTempMain("circuits/account.circom",
            "Account", "proof_id, public_value, public_owner, num_input_notes, output_nc_1, output_nc_2, data_tree_root, public_asset_id", "20", {});
        accountKey = await (new SigningKey()).newKey(undefined);
        signingKey = await (new SigningKey()).newKey(undefined);
        worldState = new StateTree(); // account and joinsplit share same SMT.
        await worldState.init();
    })

    it("Account create test", async () => {
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

        proofId = AccountCircuit.PROOF_ID_TYPE_MIGRATE;
        newAccountKey = await (new SigningKey()).newKey(undefined);
        newAccountPubKey = newAccountKey.pubKey.unpack(babyJub);
        newAccountPubKey = [F.toObject(newAccountPubKey[0]), F.toObject(newAccountPubKey[1])];

        newSigningKey2 = await (new SigningKey()).newKey(undefined);
        newSigningPubKey2 = newSigningKey2.pubKey.unpack(babyJub);
        newSigningPubKey2 = [F.toObject(newSigningPubKey2[0]), F.toObject(newSigningPubKey2[1])];
        input = await AccountCircuit.createProofInput(
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

    // TODO test alias-address migrating and joinsplit
});
