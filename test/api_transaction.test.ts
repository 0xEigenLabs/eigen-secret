const request = require('supertest');
const express = require('express');
const consola = require("consola");
import app from "../server/service";
import { SigningKey } from "../src/account";
import sequelize from "../src/db";
import { ethers } from "ethers";
import {signEOASignature} from "../src/utils";
import { expect, assert } from "chai";

describe('POST /transactions', function() {
    this.timeout(1000 * 1000);
    const alias = "eigen.eth";
    before(async() => {
        let newEOAAccount = await ethers.Wallet.createRandom();
        let rawMessage = "Use Eigen Secret to shield your asset";
        let timestamp = Math.floor(Date.now()/1000).toString();
        const signature = await signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, alias, timestamp);

        let tmpKey = await (new SigningKey()).newKey(undefined);
        let pubKey = tmpKey.pubKey.pubKey;
        // TODO create proof for `createAccount` and `joinSplit`
        const response = await request(app)
        .post('/transactions')
        .send({
            alias: alias,
            timestamp: timestamp,
            message: rawMessage,
            hexSignature: signature,
            ethAddress: newEOAAccount.address,
            pubKey: pubKey,
            content: "0x12",
            proof: "0x12",
            publicInput: "{\"root\": 0x1}"
        })
        .set('Accept', 'application/json');

        consola.log(response.body)
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        expect(response.body.data["id"]).to.gt(0);
    });

    it('get tx', async() => {
        const response = await request(app)
        .get('/transactions/' + alias)
        .set('Accept', 'application/json');

        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        console.log(response.body);
        assert(response.body.data[0].alias, alias)
    });

    it.skip("fetchIndices", async() => {
        let alias = "eigen.eth";
        let newEOAAccount = await ethers.Wallet.createRandom();
        let rawMessage = "Use Eigen Secret to shield your asset";
        let timestamp = Math.floor(Date.now()/1000).toString();

        const signature = await signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, alias, timestamp);
        const response = await request(app)
        .post('/transactions/index')
        .send({
            alias: alias,
            timestamp: timestamp,
            message: rawMessage,
            hexSignature: signature,
            ethAddress: newEOAAccount.address,
            commitments: [
                "0x123",
                "0x234",
                "0x1231",
                "0x2342"
            ],
        })
        .set('Accept', 'application/json');
        console.log(response.body);
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        assert(response.body.data[0].cmt, alias)
    })
});
