const request = require('supertest');
const express = require('express');
const createBlakeHash = require("blake-hash");
const consola = require("consola");
import app from "../server/service";
import sequelize from "../src/db";
import { ethers } from "ethers";
import { uint8Array2Bigint, signEOASignature, prepareJson } from "../src/utils";
import { expect, assert } from "chai";
import { StateTree } from "../src/state_tree";
import { NoteState, NoteModel as DBNote } from "../server/note";
import { Note } from "../src/note";
import { aliasHashDigest, compress as accountCompress, EigenAddress, SigningKey } from "../src/account";
// import { JoinSplitCircuit } from "../src/join_split";
// import { AccountCircuit } from "../src/account";
// import { UpdateStatusCircuit, UpdateStatusInput } from "../src/update_state";
// import { Prover } from "../src/prover";
import {SecretSDK} from "../sdk/main"
import { getPublicKey, sign as k1Sign, verify as k1Verify, Point } from "@noble/secp256k1";
// import { Transaction } from "../src/transaction";
const { buildEddsa } = require("circomlibjs");
const path = require("path");

describe('sdk test', function() {
    this.timeout(1000 * 1000);
    const alias = "eigen.eth";
    let eddsa: any;
    let babyJub: any;
    const circuitPath = path.join(__dirname, "../circuits/");
    let F: any;
    let newEOAAccount: any;
    let newEOAAccountAddress: any;
    const rawMessage = "Use Eigen Secret to shield your asset";
    let signingKey: SigningKey;
    let accountKey: SigningKey;
    const assetId = 1;
    before("end2end deposit", async() => {
        eddsa = await buildEddsa();
        babyJub = eddsa.babyJub;
        F = eddsa.F;

        signingKey = await (new SigningKey()).newKey(undefined);
        accountKey = await (new SigningKey()).newKey(undefined);

        newEOAAccount = await ethers.Wallet.createRandom();
        newEOAAccountAddress = newEOAAccount.address;
    })

    it("1. create account", async() => {
        let timestamp = Math.floor(Date.now()/1000).toString();
        const signature = await signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, alias, timestamp);
        let newAccountKey = accountKey;
        let newSigningKey1 = await (new SigningKey()).newKey(undefined); 
        let newSigningKey2 = await (new SigningKey()).newKey(undefined);
       
        let secretSDK = new SecretSDK(alias, newAccountKey, signingKey, "http://127.0.0.1:3000", circuitPath);
        const ctx = {
            alias: alias,
            ethAddress: newEOAAccountAddress,
            rawMessage: rawMessage,
            timestamp: timestamp,
            signature: signature
          };
        let proofAndPublicSignals = await secretSDK.createAccount(ctx, newSigningKey1, newSigningKey2);
        // console.log(proofAndPublicSignals)
    })
    it("2. first deposit", async() => {
        let timestamp = Math.floor(Date.now()/1000).toString();
        const signature = await signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, alias, timestamp);
        const value = "10";
        let secretSDK = new SecretSDK(alias, accountKey, signingKey, "http://127.0.0.1:3000", circuitPath);
        let _pPubKey = accountKey.pubKey;
        let pPubKey = _pPubKey.unpack(babyJub);
        let receiver = Buffer.from(pPubKey[0]).toString("hex");
        const ctx = {
            alias: alias,
            ethAddress: newEOAAccountAddress,
            rawMessage: rawMessage,
            timestamp: timestamp,
            signature: signature,
            signingKey: signingKey,
            accountKey: accountKey
          };
        let proofAndPublicSignals = await secretSDK.deposit(ctx, receiver, value, assetId);
        // console.log(proofAndPublicSignals)
  })
  it.skip("3. end2end send", async() => {
    let timestamp = Math.floor(Date.now()/1000).toString();
    const signature = await signEOASignature(newEOAAccount, rawMessage, newEOAAccount.address, alias, timestamp);
    const value = "5";
    let secretSDK = new SecretSDK(alias, accountKey, signingKey, "http://127.0.0.1:3000", circuitPath);
    let receiver = await (new SigningKey()).newKey(undefined);
    let pubKey = receiver.pubKey.pubKey;
    const ctx = {
      alias: alias,
      ethAddress: newEOAAccountAddress,
      rawMessage: rawMessage,
      timestamp: timestamp,
      signature: signature,
      signingKey: signingKey,
      accountKey: accountKey
    };
    let proofAndPublicSignals = await secretSDK.send(ctx, pubKey, value, assetId);
    // console.log(proofAndPublicSignals)
  })

});
