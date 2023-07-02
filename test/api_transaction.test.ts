const request = require("supertest");
const consola = require("consola");
import app from "../server/dist/service";
import { EigenAddress } from "@eigen-secret/core/dist-node/account";
import { ethers } from "ethers";
import { signEOASignature, rawMessage } from "@eigen-secret/core/dist-node/utils";
import { Context } from "@eigen-secret/core/dist-node/context";
import { expect, assert } from "chai";
import { TxData } from "@eigen-secret/core/dist-node/transaction";
/* globals describe, before, it */
describe("POST /transactions", () => {
    const alias = "api.eigen.eth";
    before(async () => {
        let newEOAAccount = await ethers.Wallet.createRandom();
        let timestamp = Math.floor(Date.now()/1000).toString();
        const signature = await signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, timestamp);
        let ctx = new Context(alias, newEOAAccount.address, rawMessage, timestamp, signature);
        // try get
        let response = await request(app)
        .post("/transactions/get")
        .send({
            context: ctx.serialize()
        })
        .set("Accept", "application/json");
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);

        console.log("get transactions", response.body.data);

        response = await request(app)
        .post("/transactions/create")
        .send({
            context: ctx.serialize(),
            inputs: [{
                txData: "{\"aaa\": \"aaaa\"}",
                proof: "0x12",
                operation: "send",
                publicInput: "{\"root\": \"11\"}"
            }]
        })
        .set("Accept", "application/json");

        consola.log(response.body)
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
    });

    it("Test TxData", () => {
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

    it("Get tx", async () => {
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

        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        assert(response.body.data.transactions[0].alias, alias)
    });

    it("Get paging txs", async () => {
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

    it("Update smt", async () => {
        let newEOAAccount = await ethers.Wallet.createRandom();
        let timestamp = Math.floor(Date.now()/1000).toString();
        const signature = await signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, timestamp);
        let ctx = new Context(alias, newEOAAccount.address, rawMessage, timestamp, signature);
        const response = await request(app)
        .post("/statetree")
        .send({
            context: ctx.serialize(),
            newStates: {
                outputNc1: "1",
                nullifier1: "1233",
                outputNc2: "456",
                nullifier2: "1111",
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
});
