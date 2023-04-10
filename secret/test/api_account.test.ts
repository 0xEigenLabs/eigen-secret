const request = require('supertest');
import { ethers } from "ethers";

import app from "../../server/dist/service";
import { SigningKey } from "@eigen-secret/core/dist/account";
import * as utils from "@eigen-secret/core/dist/utils";
import { expect, assert } from "chai";

describe('POST /accounts', function() {
    this.timeout(1000 * 1000);
    before(async() => {
        let newEOAAccount = await ethers.Wallet.createRandom();
        let rawMessage = "Use Eigen Secret to shield your asset";
        let timestamp = Math.floor(Date.now()/1000).toString();
        let alias = "eigen.eth";
        const signature = await utils.signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, alias, timestamp);

        const response = await request(app)
        .post('/accounts/' + newEOAAccount.address)
        .send({
            alias: alias,
            message: rawMessage,
            timestamp: timestamp,
            hexSignature: signature
        })
        .set('Accept', 'application/json');

        console.log(response.body)
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        expect(response.body.data["id"]).to.gt(0);
        expect(response.body.data["ethAddress"]).to.eq(newEOAAccount.address);
    });

    it.skip('responds with json', async() => {
        const response = await request(app)
        .get('/accounts/alice.eth')
        .set('Accept', 'application/json');

        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        console.log(response.body);
        assert(response.body.data[0].alias, 'alice.eth')
    });
});
