import * as test from "./test";
import * as utils from "@eigen-secret/core/dist/utils";
const createBlakeHash = require("blake-hash");
import { assert, expect } from "chai";
import { ethers } from "ethers";
const Scalar = require("ffjavascript").Scalar;
const ffutils = require("ffjavascript").utils;
import { SigningKey, SecretAccount } from "@eigen-secret/core/dist/account";
const crypto = require("crypto");

const { buildEddsa, buildBabyjub } = require("circomlibjs");

describe("Test View Key", function () {
    let circuit: any;
    let eddsa: any;
    let babyJub: any;
    let F: any;

    before(async () => {
        eddsa = await buildEddsa();
        babyJub = await buildBabyjub();
        F = babyJub.F;
        circuit = await test.genTempMain("node_modules/circomlib/circuits/eddsaposeidon.circom",
            "EdDSAPoseidonVerifier", "", "", {});
    })

    it("EdDSA Sign test", async () => {
        const msg = F.e(123411111111111n);
        let prvKey = ethers.utils.randomBytes(31);
        let pubKey = eddsa.prv2pub(prvKey);
        let signature = eddsa.signPoseidon(prvKey, msg);
        assert(eddsa.verifyPoseidon(msg, signature, pubKey));

        const input = {
            enabled: 1,
            Ax: F.toObject(pubKey[0]),
            Ay: F.toObject(pubKey[1]),
            R8x: F.toObject(signature.R8[0]),
            R8y: F.toObject(signature.R8[1]),
            S: signature.S,
            M: F.toObject(msg)
        };

        await utils.executeCircuit(circuit, input);
    })

    it("SigningKey Sign test", async () => {
        const msg = F.e(123411111111111n);
        let key = new SigningKey(eddsa);
        let signature = key.sign(msg);
        let pubKey = key.toCircuitInput();
        assert(key.verify(signature, msg));
        const input = {
            enabled: 1,
            Ax: pubKey[0][0],
            Ay: pubKey[0][1],
            R8x: F.toObject(signature.R8[0]),
            R8y: F.toObject(signature.R8[1]),
            S: signature.S,
            M: F.toObject(msg)
        };
        await utils.executeCircuit(circuit, input);
    })

    it("Serialize and deserialize key", () => {
        let keys = new Array(5).fill(new SigningKey(eddsa))
        let sa = new SecretAccount(
            "Alice",
            keys[0],
            keys[1],
            keys[2],
            keys[3],
            keys[4]
        );
        const secret = crypto.generateKeySync('aes', { length: 256 });
        let serKeys = sa.serialize(secret);
        let derKeys = SecretAccount.deserialize(eddsa, secret, serKeys);
        expect(keys[0].prvKey).to.eq(derKeys.accountKey.prvKey);
        expect(keys[1].prvKey).to.eq(derKeys.signingKey.prvKey);
        expect(keys[2].prvKey).to.eq(derKeys.newAccountKey.prvKey);
        expect(keys[3].prvKey).to.eq(derKeys.newSigningKey1.prvKey);
        expect(keys[4].prvKey).to.eq(derKeys.newSigningKey2.prvKey);
    })
});

describe("Test Proof knowledge of Private Key", function () {
    let circuit: any;
    let eddsa: any;
    let babyJub: any;
    let F: any;

    before(async () => {
        eddsa = await buildEddsa();
        babyJub = await buildBabyjub();
        F = babyJub.F;
        circuit = await test.genTempMain("node_modules/circomlib/circuits/babyjub.circom",
            "BabyPbk", "", "", {});
    })

    it("prv2Pub circuit test", async () => {
        let rawpvk = Buffer.from(ethers.utils.randomBytes(31));
        let pvk = eddsa.pruneBuffer(createBlakeHash("blake512").update(rawpvk).digest().slice(0, 32));
        let prvKey = Scalar.shr(ffutils.leBuff2int(pvk), 3);
        let pubKey = eddsa.prv2pub(rawpvk);
        let input = {
            in: prvKey,
        };
        let wtns = await utils.executeCircuit(circuit, input);
        await circuit.assertOut(wtns, { Ax: F.toObject(pubKey[0]), Ay: F.toObject(pubKey[1]) });
    })
});
