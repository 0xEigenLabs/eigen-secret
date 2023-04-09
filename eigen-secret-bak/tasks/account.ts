import { task } from "hardhat/config";
import { signEOASignature } from "../src/utils";
import { SigningKey } from "../src/account";
import { SecretSDK } from "../sdk/main";
const path = require("path");
const circuitPath = path.join(__dirname, "../circuits/");
require("dotenv").config()
const { buildEddsa } = require("circomlibjs");

const assetId = 1;
const rawMessage = "Use Eigen Secret to shield your asset";

task("create-account", "Create account and first transaction depositing to itself")
    .addParam("alias", "user alias", "Bob")
    .addParam("value", "first deposit value", "10")
    .setAction(async ({ alias, value }, { ethers }) => {
        let eddsa = await buildEddsa();
        let timestamp = Math.floor(Date.now()/1000).toString();
        let [user] = await ethers.getSigners();
        // const newEOAAccount = ethers.Wallet.createRandom();
        const signature = await signEOASignature(user, rawMessage, user.address, alias, timestamp);
        let signingKey = new SigningKey(eddsa, undefined);
        let accountKey = new SigningKey(eddsa, undefined);
        let newSigningKey1 = new SigningKey(eddsa, undefined);
        let newSigningKey2 = new SigningKey(eddsa, undefined);
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

        let proof1 = await secretSDK.send(ctx, receiver, "5", assetId);
        console.log("end2end send done, proof: ", proof1);

        let proof2 = await secretSDK.withdraw(ctx, receiver, "5", assetId);
        console.log("withdraw done, proof: ", proof2);
    })

