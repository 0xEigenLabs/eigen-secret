import { task } from 'hardhat/config'
import { uint8Array2Bigint, signEOASignature, prepareJson } from "../src/utils";
import { aliasHashDigest, compress as accountCompress, EigenAddress, SigningKey } from "../src/account";
const { buildEddsa } = require("circomlibjs");
import {SecretSDK} from "../sdk/main";
const path = require("path");
const circuitPath = path.join(__dirname, "../circuits/");
require('dotenv').config()

const assetId = 1;
const rawMessage = "Use Eigen Secret to shield your asset";

task('createAccount', 'createAccount and first transaction depositing to itself')
    .addParam('alias', 'user alias')
    .addParam('value', 'first deposit value')
	  .setAction(async ({ alias, index, value }, {ethers}) => {
        let timestamp = Math.floor(Date.now()/1000).toString();
        let [admin, user] = await ethers.getSigners();
        // const newEOAAccount = ethers.Wallet.createRandom();
        const signature = await signEOASignature(user, rawMessage, user.address, alias, timestamp);
        const eddsa = await buildEddsa();
        let signingKey = await (new SigningKey()).newKey(undefined);
        let accountKey = await (new SigningKey()).newKey(undefined);
        let newAccountKey = accountKey;
        let newSigningKey1 = await (new SigningKey()).newKey(undefined);
        let newSigningKey2 = await (new SigningKey()).newKey(undefined);
        let secretSDK = new SecretSDK(alias, accountKey, signingKey, "http://127.0.0.1:3000", circuitPath);
        const ctx = {
          alias: alias,
          ethAddress: user.address,
          rawMessage: rawMessage,
          timestamp: timestamp,
          signature: signature,
          signingKey: signingKey,
          accountKey: accountKey
        };
        let proofAndPublicSignals = await secretSDK.createAccount(ctx, newSigningKey1, newSigningKey2);
        let receiver = accountKey.pubKey.pubKey;
        let proof = await secretSDK.deposit(ctx, receiver, value, assetId);
        console.log("CreateAccount done, proof: ", proofAndPublicSignals, proof);
	})

// task('processDeposit', 'process user deposit')

// task('deposit', 'user deposit')

// task('withdraw', 'user withdraw')
