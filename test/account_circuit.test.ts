import * as test from "./test";
import * as utils from "@eigen-secret/core/dist/utils";
import { SigningKey, AccountCircuit } from "@eigen-secret/core/dist/account";
import { WorldState } from "../server/dist/state_tree";

const { buildEddsa, buildBabyjub } = require("circomlibjs");
/* globals describe, before, it */
describe("Account circuit test", function() {
    let circuit: any;
    let eddsa: any;
    let babyJub: any;
    let F: any;
    let accountKey: SigningKey;
    let signingKey: SigningKey;
    let aliasHash: bigint = 123n;

    before(async () => {
        eddsa = await buildEddsa();
        babyJub = await buildBabyjub();
        F = babyJub.F;
        circuit = await test.genTempMain("circuits/account.circom",
            "Account",
            "proof_id, public_value, public_owner," +
            "num_input_notes, output_nc_1, output_nc_2, data_tree_root, public_asset_id",
            "20",
            {});
        accountKey = new SigningKey(eddsa);
        signingKey = new SigningKey(eddsa);
    })

    it("Account create test", async () => {
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

        let input = await AccountCircuit.createProofInput(
            proofId,
            accountKey,
            signingKey,
            newAccountPubKey,
            newSigningPubKey1,
            newSigningPubKey2,
            aliasHash
        );

        // FIXME: nullifier hardcoded to 1
        let proof = await WorldState.updateStateTree(input.accountNC, 1n, 0n, 0n, input.accountNC);
        await utils.executeCircuit(circuit, input.toCircuitInput(proof));

        proofId = AccountCircuit.PROOF_ID_TYPE_MIGRATE;
        newAccountKey = new SigningKey(eddsa);
        newAccountPubKey = newAccountKey.pubKey.unpack(babyJub);
        newAccountPubKey = [F.toObject(newAccountPubKey[0]), F.toObject(newAccountPubKey[1])];

        newSigningKey2 = new SigningKey(eddsa);
        newSigningPubKey2 = newSigningKey2.pubKey.unpack(babyJub);
        newSigningPubKey2 = [F.toObject(newSigningPubKey2[0]), F.toObject(newSigningPubKey2[1])];
        input = await AccountCircuit.createProofInput(
            proofId,
            accountKey,
            signingKey,
            newAccountPubKey,
            newSigningPubKey1,
            newSigningPubKey2,
            aliasHash
        );

        proof = await WorldState.updateStateTree(input.newAccountNC, 1n, 0n, 0n, input.accountNC);
        await utils.executeCircuit(circuit, input.toCircuitInput(proof));

        proofId = AccountCircuit.PROOF_ID_TYPE_UPDATE;

        newSigningKey2 = new SigningKey(eddsa);
        newSigningPubKey2 = newSigningKey2.pubKey.unpack(babyJub);
        newSigningPubKey2 = [F.toObject(newSigningPubKey2[0]), F.toObject(newSigningPubKey2[1])];
        input = await AccountCircuit.createProofInput(
            proofId,
            newAccountKey,
            signingKey,
            newAccountPubKey,
            newSigningPubKey1,
            newSigningPubKey2,
            aliasHash
        );

        proof = await WorldState.updateStateTree(0n, 0n, 0n, 0n, input.accountNC);
        await utils.executeCircuit(circuit, input.toCircuitInput(proof));
    })
});
