const request = require("supertest");
import { ethers } from "ethers";
const createBlakeHash = require("blake-hash");
import app from "../server/dist/service";
import * as utils from "@eigen-secret/core/dist-node/utils";
import { ErrCode } from "@eigen-secret/core/dist-node/error";
import { Context } from "@eigen-secret/core/dist-node/context";
import { expect, assert } from "chai";
import { SigningKey, SecretAccount } from "@eigen-secret/core/dist-node/account";
const { buildEddsa } = require("circomlibjs");

/* globals describe, before, it */
describe("POST /accounts", function() {
    let alias = "eigen.eth";
    let newEOAAccount: any;
    let secretAccount: any;
    let signature: any;
    let eddsa: any;
    let timestamp: any;
    const password = "12121";
    let key:any;
    before(async () => {
        newEOAAccount = await ethers.Wallet.createRandom();
        eddsa = await buildEddsa();
        timestamp = Math.floor(Date.now()/1000).toString();
        let signingKey = new SigningKey(eddsa);
        let accountKey = new SigningKey(eddsa);
        let newSigningKey1 = new SigningKey(eddsa);
        let newSigningKey2 = new SigningKey(eddsa);
        secretAccount = new SecretAccount(
            alias, accountKey, signingKey, accountKey, newSigningKey1, newSigningKey2
        );

        signature = await utils.signEOASignature(
            newEOAAccount,
            newEOAAccount.address,
            timestamp
        );

        key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
        let ctx = new Context(alias, newEOAAccount.address, timestamp, signature);
        const response = await request(app)
        .post("/accounts/create")
        .send({
            context: ctx.serialize(),
            accountKeyPubKey: accountKey.pubKey.pubKey,
            secretAccount: secretAccount.serialize(key)
        })
        .set("Accept", "application/json");
        console.log(response);
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        expect(response.body.data["id"]).to.gt(0);
        expect(response.body.data["ethAddress"]).to.eq(newEOAAccount.address);
    });

    it("responds with json", async () => {
        let ctx = new Context(alias, newEOAAccount.address, timestamp, signature);
        const response = await request(app)
        .post("/accounts/get")
        .send({
            context: ctx.serialize()
        })
        .set("Accept", "application/json");

        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        assert(response.body.data.alias, alias)
        assert(response.body.data.accountKeyPubKey, secretAccount.accountKey.pubKey.pubKey)
        let sa = SecretAccount.deserialize(eddsa, key, response.body.data.secretAccount);
        assert(
            sa.accountKey.pubKey.pubKey,
            secretAccount.accountKey.pubKey.pubKey
        );
        assert(
            sa.signingKey.pubKey.pubKey,
            secretAccount.signingKey.pubKey.pubKey
        );
    });

    it("duplicated account error", async () => {
        let newEOAAccount2 = await ethers.Wallet.createRandom();
        const newSig = await utils.signEOASignature(
            newEOAAccount2,
            newEOAAccount2.address,
            timestamp
        );
        let ctx = new Context(alias, newEOAAccount2.address, timestamp, newSig);
        const response = await request(app)
        .post("/accounts/create")
        .send({
            context: ctx.serialize(),
            secretAccount: secretAccount.serialize(key)
        })
        .set("Accept", "application/json");
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(ErrCode.DuplicatedRecordError);
    });

    it("get account by eth address only", async () => {
        const newSig = await utils.signEOASignature(
            newEOAAccount,
            newEOAAccount.address,
            timestamp
        );
        let ctx = new Context(utils.__DEFAULT_ALIAS__, newEOAAccount.address, timestamp, newSig);
        const response = await request(app)
        .post("/accounts/get")
        .send({
            context: ctx.serialize(),
            accountKeyPubKey: secretAccount.accountKey.pubKey.pubKey,
            secretAccount: secretAccount.serialize(key)
        })
        .set("Accept", "application/json");
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        let sa = SecretAccount.deserialize(eddsa, key, response.body.data.secretAccount);
        assert(
            sa.accountKey.pubKey.pubKey,
            secretAccount.accountKey.pubKey.pubKey
        );
        assert(
            sa.signingKey.pubKey.pubKey,
            secretAccount.signingKey.pubKey.pubKey
        );
    });

    it("update account", async () => {
        let ctx = new Context(alias, newEOAAccount.address, timestamp, signature);
        const response = await request(app)
        .post("/accounts/update")
        .send({
            context: ctx.serialize(),
            accountKeyPubKey: secretAccount.accountKey.pubKey.pubKey,
            secretAccount: secretAccount.serialize(key)
        })
        .set("Accept", "application/json");
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        expect(response.body.data["id"]).to.gt(0);
        expect(response.body.data["ethAddress"]).to.eq(newEOAAccount.address);
    });
});
