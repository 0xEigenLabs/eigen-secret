const request = require("supertest");
import { ethers } from "ethers";
const createBlakeHash = require("blake-hash");
import app from "../server/dist/service";
import * as utils from "@eigen-secret/core/dist-node/utils";
import { expect, assert } from "chai";
import { SigningKey, SecretAccount } from "@eigen-secret/core/dist-node/account";
const { buildEddsa } = require("circomlibjs");

/* globals describe, before, it */
describe("POST /accounts", function() {
    let alias = "eigen.eth";
    let newEOAAccount: any;
    let secretAccount: any;
    let eddsa: any;
    let key:any;
    before(async () => {
        newEOAAccount = await ethers.Wallet.createRandom();
        eddsa = await buildEddsa();
        let timestamp = Math.floor(Date.now()/1000).toString();
        let signingKey = new SigningKey(eddsa);
        let accountKey = new SigningKey(eddsa);
        let newSigningKey1 = new SigningKey(eddsa);
        let newSigningKey2 = new SigningKey(eddsa);
        secretAccount = new SecretAccount(
            alias, accountKey, signingKey, accountKey, newSigningKey1, newSigningKey2
        );

        const signature = await utils.signEOASignature(
            newEOAAccount,
            utils.rawMessage,
            newEOAAccount.address,
            alias,
            timestamp
        );

        let password = "12121";
        key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
        const response = await request(app)
        .post("/accounts/create")
        .send({
            alias: alias,
            ethAddress: newEOAAccount.address,
            message: utils.rawMessage,
            timestamp: timestamp,
            hexSignature: signature,
            secretAccount: secretAccount.serialize(key)
        })
        .set("Accept", "application/json");

        console.log(response.body)
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        expect(response.body.data["id"]).to.gt(0);
        expect(response.body.data["ethAddress"]).to.eq(newEOAAccount.address);
    });

    it("responds with json", async () => {
        let timestamp = Math.floor(Date.now()/1000).toString();
        const signature = await utils.signEOASignature(
            newEOAAccount,
            utils.rawMessage,
            newEOAAccount.address,
            alias,
            timestamp
        );
        const response = await request(app)
        .post("/accounts/get")
        .send({
            alias: alias,
            ethAddress: newEOAAccount.address,
            message: utils.rawMessage,
            timestamp: timestamp,
            hexSignature: signature
        })
        .set("Accept", "application/json");

        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        assert(response.body.data[0].alias, "alice.eth")
        let sa = SecretAccount.deserialize(eddsa, key, response.body.data[0].secretAccount);
        assert(
            sa.accountKey.pubKey.pubKey,
            secretAccount.accountKey.pubKey.pubKey
        );
        assert(
            sa.signingKey.pubKey.pubKey,
            secretAccount.signingKey.pubKey.pubKey
        );
    });
});
