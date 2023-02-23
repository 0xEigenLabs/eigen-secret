import { test, utils } from "../index";
import { Note } from "../src/note";
import { assert, expect } from "chai";
import { ethers } from "ethers";
import { EigenAddress, EthAddress, SigningKey } from "../src/account";
import { getPublicKey, Point } from "@noble/secp256k1";

const { buildEddsa, buildBabyjub } = require("circomlibjs");

describe("Test NoteCompressor", function () {

    let circuit: any;
    let eddsa: any;
    let babyJub: any;
    let F: any;

    before(async () => {
        eddsa = await buildEddsa();
        babyJub = await buildBabyjub();
        F = babyJub.F;
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
});
