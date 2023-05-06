const request = require("supertest");
const consola = require("consola");
import app from "../server/dist/service";
import { EigenAddress, SigningKey } from "@eigen-secret/core/dist-node/account";
import { ethers } from "ethers";
import { signEOASignature, index, rawMessage } from "@eigen-secret/core/dist-node/utils";
import { Context } from "@eigen-secret/core/dist-node/context";
import { expect, assert } from "chai";
import { TxData } from "@eigen-secret/core/dist-node/transaction";
const { buildEddsa } = require("circomlibjs");
/* globals describe, before, it */
describe("POST /transactions", function() {
    const alias = "api.eigen.eth";
    let eddsa: any;
    before(async () => {
        eddsa = await buildEddsa();
        let newEOAAccount = await ethers.Wallet.createRandom();
        let timestamp = Math.floor(Date.now()/1000).toString();
        const signature = await signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, timestamp);

        let ctx = new Context(alias, newEOAAccount.address, rawMessage, timestamp, signature);
        const response = await request(app)
        .post("/transactions/create")
        .send({
            context: ctx.serialize(),
            noteIndex: index().toString(),
            note2Index: index().toString(),
            proof: "0x12",
            publicInput: "{\"root\": \"11\"}"
        })
        .set("Accept", "application/json");

        consola.log(response.body)
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        expect(response.body.data["id"]).to.gt(0);
    });

    it("txdata test", () => {
        let tx = new TxData(
            new EigenAddress("eig:8f7b33b85594ec857744ac10374122203ec0cb327a2423586cd5f666a0022e1b"),
            "abc,cdf,123"
        );

        let objStr = tx.toString;

        let tx2 = TxData.toObj(objStr);
        console.log(tx, tx2)
        expect(tx2.pubKey.pubKey).eq(tx.pubKey.pubKey);
        expect(tx2.content.toString()).eq(tx.content.toString());
    })

    it("get tx", async () => {
        let newEOAAccount = await ethers.Wallet.createRandom();
        let timestamp = Math.floor(Date.now()/1000).toString();
        const signature = await signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, timestamp);
        let ctx = new Context(alias, newEOAAccount.address, rawMessage, timestamp, signature);
        const response = await request(app)
        .post("/transactions/get")
        .send({
            context: ctx.serialize()
        })
        .set("Accept", "application/json");

        console.log(response.body);
        console.log(response.body.data);
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        assert(response.body.data.transactions[0].alias, alias)
    });

    it("get paging txs", async () => {
        let newEOAAccount = await ethers.Wallet.createRandom();
        let timestamp = Math.floor(Date.now()/1000).toString();
        const page = 1;
        const pageSize = 1;
        const signature = await signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, timestamp);
        let ctx = new Context(alias, newEOAAccount.address, rawMessage, timestamp, signature);
        const response = await request(app)
        .post("/transactions/get")
        .send({
            context: ctx.serialize(),
            page: page,
            pageSize: pageSize
        })
        .set("Accept", "application/json");

        console.log(response.body);
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        assert(response.body.data.transactions[0].alias, alias)
        expect(response.body.data.transactions.length).to.eq(pageSize);
    });

    it("update smt", async () => {
        let newEOAAccount = await ethers.Wallet.createRandom();
        let timestamp = Math.floor(Date.now()/1000).toString();
        const signature = await signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, timestamp);
        let ctx = new Context(alias, newEOAAccount.address, rawMessage, timestamp, signature);
        const response = await request(app)
        .post("/statetree")
        .send({
            context: ctx.serialize(),
            newStates: {
                outputNc1: "1233",
                nullifier1: "1",
                outputNc2: "111",
                nullifier2: "456",
                acStateKey: "111"
            }
        })
        .set("Accept", "application/json");
        console.log(response.body.data);
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        assert(response.body.data.dataTreeRoot,
            "11789410253405726493196100626786015322476180488220624361762052237583743243512")
    })

    it("get token price", async () => {
        const response = await request(app)
        .post("/token/price")
        .send({})
        .set("Accept", "application/json");

        console.log(response.body);
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
    })
});
