const request = require("supertest");
import { ethers } from "ethers";

import app from "../server/dist/service";
import * as utils from "@eigen-secret/core/dist/utils";
import { expect, assert } from "chai";
/* globals describe, before, it */
describe("POST /accounts", function() {
    before(async () => {
        let newEOAAccount = await ethers.Wallet.createRandom();
        let timestamp = Math.floor(Date.now()/1000).toString();
        let alias = "eigen.eth";
        const signature = await utils.signEOASignature(newEOAAccount,
            utils.rawMessage,
            newEOAAccount.address,
            alias,
            timestamp);
        const response = await request(app)
        .post("/accounts/" + newEOAAccount.address)
        .send({
            alias: alias,
            message: utils.rawMessage,
            timestamp: timestamp,
            hexSignature: signature
        })
        .set("Accept", "application/json");

        console.log(response.body)
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        expect(response.body.data["id"]).to.gt(0);
        expect(response.body.data["ethAddress"]).to.eq(newEOAAccount.address);
    });

    it.skip("responds with json", async () => {
        const response = await request(app)
        .get("/accounts/alice.eth")
        .set("Accept", "application/json");

        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        console.log(response.body);
        assert(response.body.data[0].alias, "alice.eth")
    });
});
