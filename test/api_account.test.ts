const request = require('supertest');
const express = require('express');
import { ethers } from "ethers";

import app from "../server/service";
import { SigningKey } from "../src/account";
import * as utils from "../src/utils";
import { expect, assert } from "chai";

describe('POST /accounts', function() {
    this.timeout(1000 * 1000);
    before(async() => {
        let newEOAAccount = await ethers.Wallet.createRandom();
        let timestamp = Math.floor(Date.now()/1000).toString();
        let alias = "eigen.eth";
        const signature = await utils.signEOASignature(newEOAAccount, utils.rawMessage, newEOAAccount.address, alias, timestamp);

        const response = await request(app)
        .post('/accounts/' + newEOAAccount.address)
        .send({
            alias: alias,
            message: utils.rawMessage,
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
