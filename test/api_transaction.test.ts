const request = require('supertest');
const consola = require("consola");
import app from "../server/dist/service";
import { EigenAddress, SigningKey } from "@eigen-secret/core/dist/account";
import { ethers } from "ethers";
import { signEOASignature, index, rawMessage } from "@eigen-secret/core/dist/utils";
import { expect, assert } from "chai";
import { StateTree } from "@eigen-secret/core/dist/state_tree";
import { NoteState } from "@eigen-secret/core/dist/note";
import { TxData } from "@eigen-secret/core/dist/transaction";
const { buildEddsa } = require("circomlibjs");

describe('POST /transactions', function() {
    this.timeout(1000 * 1000);
    const alias = "api.eigen.eth";
    let tmpKey: any;
    let pubKey: any;
    let eddsa: any;
    before(async() => {
        eddsa = await buildEddsa();
        let newEOAAccount = await ethers.Wallet.createRandom();
        let timestamp = Math.floor(Date.now()/1000).toString();
        const signature = await signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, alias, timestamp);

        tmpKey = new SigningKey(eddsa);
        pubKey = tmpKey.pubKey.pubKey;
        const response = await request(app)
        .post('/transactions')
        .send({
            alias: alias,
            timestamp: timestamp,
            message: rawMessage,
            hexSignature: signature,
            ethAddress: newEOAAccount.address,
            receiver_alias: alias,
            pubKey: pubKey,
            pubKey2: pubKey,
            content: "0x12",
            content2: "0x123",
            noteIndex: index().toString(),
            note2Index: index().toString(),
            proof: "0x12",
            publicInput: "{\"root\": \"11\"}"
        })
        .set('Accept', 'application/json');

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

    it('get tx', async() => {
        const response = await request(app)
        .get('/transactions/' + alias)
        .set('Accept', 'application/json');

        console.log(response.body);
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        assert(response.body.data[0].alias, alias)
    });

    it("update smt", async() => {
        let newEOAAccount = await ethers.Wallet.createRandom();
        let rawMessage = "Use Eigen Secret to shield your asset";
        let timestamp = Math.floor(Date.now()/1000).toString();
        const signature = await signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, alias, timestamp);

        const response = await request(app)
        .post('/statetree')
        .send({
            alias: alias,
            timestamp: timestamp,
            message: rawMessage,
            hexSignature: signature,
            ethAddress: newEOAAccount.address,
            newStates: {
                outputNc1: "1233",
                nullifier1: "1",
                outputNc2: "111",
                nullifier2: "456",
                acStateKey: "111"
            }
        })
        .set('Accept', 'application/json');
        console.log(response.body.data);
        expect(response.status).to.eq(200);
        expect(response.body.errno).to.eq(0);
        assert(response.body.data.dataTreeRoot, "11789410253405726493196100626786015322476180488220624361762052237583743243512")

        const responseNote = await request(app)
        .post('/notes/get')
        .send({
            alias: alias,
            timestamp: timestamp,
            message: rawMessage,
            hexSignature: signature,
            ethAddress: newEOAAccount.address,
            noteState: [NoteState.CREATING, NoteState.PROVED]
        })
        .set('Accept', 'application/json');

        let encryptedNotes = responseNote.body.data;
        console.log(pubKey);
        // update notes
        const response2 = await request(app)
        .post('/notes/update')
        .send({
            alias: alias,
            timestamp: timestamp,
            message: rawMessage,
            hexSignature: signature,
            ethAddress: newEOAAccount.address,
            notes: [
                {
                    alias: alias,
                    index: encryptedNotes[0].index,
                    content: encryptedNotes[0].content,
                    pubKey: pubKey,
                    state: NoteState.SPENT
                },
                {
                    alias: alias,
                    index: encryptedNotes[1].index,
                    content: encryptedNotes[1].content,
                    pubKey: pubKey,
                    state: NoteState.SPENT
                }
            ]
        })
        .set('Accept', 'application/json');
        console.log(response2.body.data);
        expect(response2.status).to.eq(200);
        expect(response2.body.errno).to.eq(0);

    })
});
