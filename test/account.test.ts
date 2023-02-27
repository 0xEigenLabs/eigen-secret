import { test, utils } from "../index";
import { Note } from "../src/note";
import { assert, expect } from "chai";
import { ethers } from "ethers";
import { EigenAddress, EthAddress, SigningKey, AccountOrNullifierKey, compress as accountCompress } from "../src/account";
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
        circuit = await test.genTempMain("circuits/account_note.circom",
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
        let pubKey3 = await key.unpack();
        expect(Buffer.from(pubKey[0]).toString("hex")).to.eq(
            Buffer.from(pubKey3[0]).toString("hex")
        );
    })

    it("EthAddress Test", async () => {
        let prvKey = ethers.utils.randomBytes(32);
        let pubKey = getPublicKey(prvKey);
        let hexPubKey = "eth:" + Buffer.from(pubKey).toString("hex");

        let key = new EthAddress(hexPubKey);
        let pubKey2 = await key.unpack();
        let pubKey3 = Point.fromPrivateKey(prvKey);
        expect(pubKey2[0]).to.eq(pubKey3.x);
    })

    it("AccountCompress Test", async() => {
        let accountKey = await (new SigningKey()).newKey(undefined);
        let signingKey = await (new SigningKey()).newKey(undefined);
        let aliasHash = 1n;
        let hashed = await accountCompress(accountKey, signingKey, aliasHash);

        let wtns = await utils.executeCircuit(circuit, {
            npk: (await accountKey.toCircuitInput())[0],
            spk: (await signingKey.toCircuitInput())[0],
            alias_hash: aliasHash
        });
        await circuit.assertOut(wtns, { out: F.toObject(hashed) });
    })
});
