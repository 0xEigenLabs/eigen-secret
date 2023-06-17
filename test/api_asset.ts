const request = require("supertest");
import app from "../server/dist/service";
import { ethers } from "ethers";
import { signEOASignature } from "@eigen-secret/core/dist-node/utils";
import { Context } from "@eigen-secret/core/dist-node/context";
import { expect } from "chai";
/* globals describe, before, it */
describe("POST /assets", () => {
    const alias = "api.eigen.eth";
    let timestamp = Math.floor(Date.now()/1000).toString();
    before(async () => {
        let newEOAAccount = await ethers.Wallet.createRandom();
        const signature = await signEOASignature(newEOAAccount, newEOAAccount.address, timestamp);
        let ctx = new Context(alias, newEOAAccount.address, timestamp, signature);
        // create asset
        const response = await request(app)
        .post("/assets/create")
        .send({
            context: ctx.serialize(),
            assetId: 2,
            contractAddress: "0xA468870b2a5B9063356818362FbEf73fc8Ae5ECC",
            lastPrice: 1,
            last24hPrice: 2,
            symbol: "TT"
        })
        .set("Accept", "application/json");

        console.log("create", response.body);
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
    })

    it("Get token price", async () => {
        let newEOAAccount = await ethers.Wallet.createRandom();
        const signature = await signEOASignature(newEOAAccount, newEOAAccount.address, timestamp);
        let ctx = new Context(alias, newEOAAccount.address, timestamp, signature);
        const responseGet = await request(app)
        .post("/assets/get")
        .send({
            context: ctx.serialize(),
            assetId: [2]
        })
        .set("Accept", "application/json");
        console.log("assets", responseGet.body);
        expect(responseGet.status).to.eq(200);
        expect(responseGet.body.errno).to.eq(0);

        const responsePrice = await request(app)
        .post("/assets/price")
        .send({
            context: ctx.serialize(),
            assetInfo: { 2: 10 }
        })
        .set("Accept", "application/json");
        console.log(responsePrice.body);
        expect(responsePrice.status).to.eq(200);
        expect(responsePrice.body.errno).to.eq(0);
    })
});
