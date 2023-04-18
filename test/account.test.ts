import * as test from "./test";
import * as utils from "@eigen-secret/core/dist/utils";
import { Note } from "@eigen-secret/core/dist/note";
import { assert, expect } from "chai";
import { ethers } from "ethers";
import { EigenAddress, SigningKey, compress as accountCompress } from "@eigen-secret/core/dist/account";
import { getPublicKey, Point } from "@noble/secp256k1";

const { buildEddsa, buildBabyjub } = require("circomlibjs");

describe("Test Account Compressor", function () {

    let circuit: any;
    let eddsa: any;
    let babyJub: any;
    let F: any;

    before(async () => {
        eddsa = await buildEddsa();
        babyJub = await buildBabyjub();
        F = babyJub.F;
        circuit = await test.genTempMain("circuits/account.circom",
            "AccountNoteCompressor", "", "", {});
    })

    it("EigenAddress Test", async () => {
        let prvKey = ethers.utils.randomBytes(31);
        let pubKey = eddsa.prv2pub(prvKey);
        let pPubKey = eddsa.babyJub.packPoint(pubKey);
        let hexPubKey = "eig:" + Buffer.from(pPubKey).toString("hex");

        let pubKey2 = eddsa.babyJub.unpackPoint(pPubKey);
        expect(Buffer.from(pubKey[0]).toString("hex")).to.eq(
            Buffer.from(pubKey2[0]).toString("hex")
        );

        let key = new EigenAddress(hexPubKey);
        let pubKey3 = key.unpack(babyJub);
        expect(Buffer.from(pubKey[0]).toString("hex")).to.eq(
            Buffer.from(pubKey3[0]).toString("hex")
        );
    })

    it("AccountCompress Test", async() => {
        let accountKey = new SigningKey(eddsa);
        let signingKey = new SigningKey(eddsa);
        let aliasHash = 1n;
        let hashed = await accountCompress(accountKey, signingKey, aliasHash);

        let wtns = await utils.executeCircuit(circuit, {
            npk: (accountKey.toCircuitInput())[0],
            spk: (signingKey.toCircuitInput())[0],
            alias_hash: aliasHash
        });
        await circuit.assertOut(wtns, { out: hashed });
    })
});
