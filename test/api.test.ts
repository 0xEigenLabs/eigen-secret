const request = require('supertest');
const express = require('express');

import app from "../api/service";
import { SigningKey } from "../src/account";
import sequelize from "../api/db";

describe('GET /txs', function() {
    before(async(done) => {
        let tmpKey = await (new SigningKey()).newKey(undefined);
        let pubKey = tmpKey.pubKey.pubKey;
        request(app)
        .post('/txs/')
        .send({
            alias: "alice.eth",
            pubKey: pubKey,
            content: "0x12",
            proof: "0x12",
            publicInput: "{\"root\": 0x1}"
        })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200, done);
    });

    it('responds with json', function(done) {
        request(app)
        .get('/txs/alias.eth')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200, done);
    });
    after(() => { sequelize.close() })
});
