const request = require('supertest');
const express = require('express');
import { ethers } from "ethers";

import app from "../api/service";
import { SigningKey } from "../src/account";
import sequelize from "../api/db";

import { expect, assert } from "chai";

describe('POST /accounts', function() {
    this.timeout(1000 * 1000);
    before(async() => {
        let tmpKey = await (new SigningKey()).newKey(undefined);
        let pubKey = tmpKey.pubKey.pubKey;

        let newEOAAccount = await ethers.Wallet.createRandom();

        // example: https://github.com/ethers-io/ethers.js/issues/447
        let rawMessage = "Use Eigen Secret to shield your asset";
        let strRawMessage = "\x19Ethereum Signed Message:\n" + rawMessage.length + rawMessage
        const signatue = await newEOAAccount.signMessage(strRawMessage)

        const response = await request(app)
        .post('/accounts/' + newEOAAccount.address)
        .send({
            alias: "eigen.eth",
            timestamp: Math.floor(Date.now()/1000),
            message: rawMessage,
            hexSignature: signatue
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
    after(() => { sequelize.close() })
});
