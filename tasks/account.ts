import { task } from "hardhat/config";
import { signEOASignature } from "../src/utils";
import { SigningKey } from "../src/account";
import { SecretSDK } from "../sdk/main";
require("dotenv").config()
const path = require("path");
const fs = require("fs");
const circuitPath = path.join(__dirname, "../circuits/");
const { buildEddsa } = require("circomlibjs");
const assetId = 2;
const rawMessage = "Use Eigen Secret to shield your asset";
const defaultContractFile = ".contract.json";

task("create-account", "Create account and first transaction depositing to itself")
  .addParam("alias", "user alias", "Alice")
  .addParam("value", "first deposit value", "10")
  .setAction(async ({ alias, value }, { ethers }) => {
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let [user] = await ethers.getSigners();
    // const newEOAAccount = ethers.Wallet.createRandom();
    const signature = await signEOASignature(user, rawMessage, user.address, alias, timestamp);
    let signingKey = new SigningKey(eddsa, undefined);
    let accountKey = new SigningKey(eddsa, undefined);
    let newSigningKey1 = new SigningKey(eddsa, undefined);
    let newSigningKey2 = new SigningKey(eddsa, undefined);
    const rawData = fs.readFileSync(defaultContractFile);
    const contractJson = JSON.parse(rawData.toString());
    let secretSDK = new SecretSDK(
        alias,
        accountKey,
        signingKey,
        "http://127.0.0.1:3000",
        circuitPath,
        eddsa,
        user,
        contractJson.spongePoseidon,
        contractJson.tokenRegistry,
        contractJson.poseidon2,
        contractJson.poseidon3,
        contractJson.poseidon6,
        contractJson.rollup,
        contractJson.testToken
    );
    await secretSDK.initialize();
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
    let nonce = 0;
    let proof = await secretSDK.deposit(ctx, receiver, value, assetId, nonce);
    let balance1 = await secretSDK.getNotesValue(ctx, assetId);
    console.log("test1-after deposit")
    console.log(balance1)
    console.log("CreateAccount done, proof: ", proofAndPublicSignals, proof);

    let proof1 = await secretSDK.send(ctx, receiver, "2", assetId);
    let balance2 = await secretSDK.getNotesValue(ctx, assetId);
    console.log("test2-after send")
    console.log(balance2)
    console.log("end2end send done, proof: ", proof1);

    let proof2 = await secretSDK.withdraw(ctx, receiver, "5", assetId);
    console.log("withdraw done, proof: ", proof2);
  })

