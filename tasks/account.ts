import { task } from "hardhat/config";
import { signEOASignature } from "../src/utils";
import { SigningKey, SecretAccount } from "../src/account";
import { SecretSDK } from "../sdk/main";
require("dotenv").config()
const path = require("path");
const fs = require("fs");
const circuitPath = path.join(__dirname, "../circuits/");
const { buildEddsa } = require("circomlibjs");
import { defaultContractFile, defaultAccountFile } from "./common";
const createBlakeHash = require("blake-hash");

const rawMessage = "Use Eigen Secret to shield your asset";

task("create-account", "Create secret account")
  .addParam("alias", "user alias", "Alice")
  .addParam("password", "password for key sealing", "<your password>")
  .setAction(async ({ alias, password }, { ethers }) => {
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let [user] = await ethers.getSigners();
    // const newEOAAccount = ethers.Wallet.createRandom();
    const signature = await signEOASignature(user, rawMessage, user.address, alias, timestamp);
    let signingKey = new SigningKey(eddsa, undefined);
    let accountKey = new SigningKey(eddsa, undefined);
    let newSigningKey1 = new SigningKey(eddsa, undefined);
    let newSigningKey2 = new SigningKey(eddsa, undefined);
    const contractJson = require(defaultContractFile);

    let sa = new SecretAccount(
        accountKey, signingKey, accountKey, newSigningKey1, newSigningKey2
    );
    let secretSDK = new SecretSDK(
        alias,
        sa,
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
      signature: signature
    };
    let proofAndPublicSignals = await secretSDK.createAccount(ctx, sa.newSigningKey1, sa.newSigningKey2);

    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    fs.writeFileSync(defaultAccountFile, sa.serialize(key));
    console.log(proofAndPublicSignals);
    /*
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
    */
  })

task("migrate-account", "migrate account to another ETH address")
  .addParam("alias", "user alias", "Alice")
  .addParam("password", "password for key sealing", "<your password>")
  .setAction(async ({ alias, password }, { ethers }) => {
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let [user] = await ethers.getSigners();
    const signature = await signEOASignature(user, rawMessage, user.address, alias, timestamp);
    let newAccountKey = new SigningKey(eddsa, undefined);
    const contractJson = require(defaultContractFile);
    let accountData = fs.readFileSync(defaultAccountFile);
    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    let sa = SecretAccount.deserialize(eddsa, key, accountData.toString())
    let secretSDK = new SecretSDK(
        alias,
        sa,
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
      signature: signature
    };
    let proofAndPublicSignals = await secretSDK.migrateAccount(
        ctx, newAccountKey, sa.newSigningKey1, sa.newSigningKey2
    );
    sa.accountKey = newAccountKey;
    sa.newAccountKey = newAccountKey;
    let key2 = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    fs.writeFileSync(defaultAccountFile, sa.serialize(key2));
    console.log(proofAndPublicSignals);
  })

  task("update-account", "update account")
  .addParam("alias", "user alias", "Alice")
  .addParam("password", "password for key sealing", "<your password>")
  .setAction(async ({ alias, password }, { ethers }) => {
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let [user] = await ethers.getSigners();
    const signature = await signEOASignature(user, rawMessage, user.address, alias, timestamp);
    const contractJson = require(defaultContractFile);
    let accountData = fs.readFileSync(defaultAccountFile);
    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    let sa = SecretAccount.deserialize(eddsa, key, accountData.toString())
    let secretSDK = new SecretSDK(
        alias,
        sa,
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
      signature: signature
    };
    let proofAndPublicSignals = await secretSDK.updateAccount(
        ctx, sa.newSigningKey1, sa.newSigningKey2
    );
    sa.signingKey = sa.newSigningKey1;
    sa.newSigningKey1 = sa.newSigningKey2;
    let key2 = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    fs.writeFileSync(defaultAccountFile, sa.serialize(key2));
    console.log(proofAndPublicSignals);
  })
