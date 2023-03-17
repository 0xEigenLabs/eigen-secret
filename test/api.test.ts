const request = require('supertest');
const express = require('express');

import app from "../api/service";
import { SigningKey } from "../src/account";
import sequelize from "../api/db";

import { expect, assert } from "chai";

describe('GET /txs', function() {
    this.timeout(1000 * 1000);
    before(async() => {
        let tmpKey = await (new SigningKey()).newKey(undefined);
        let pubKey = tmpKey.pubKey.pubKey;
        const response = await request(app)
        .post('/txs')
        .send({
            alias: "alice.eth",
            pubKey: pubKey,
            content: "0x12",
            proof: "0x12",
            publicInput: "{\"root\": 0x1}"
        })
        .set('Accept', 'application/json');

        console.log(response.body)
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        expect(response.body.data["id"]).to.gt(0);
    });

    it('responds with json', async() => {
        const response = await request(app)
        .get('/txs/alice.eth')
        .set('Accept', 'application/json');

        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        console.log(response.body);
        assert(response.body.data[0].alias, 'alice.eth')
    });
    after(() => { sequelize.close() })
});
