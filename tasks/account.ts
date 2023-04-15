import { task } from "hardhat/config";
import { signEOASignature, rawMessage } from "@eigen-secret/core/dist/utils";
import { SigningKey, SecretAccount } from "@eigen-secret/core/dist/account";
import { SecretSDK } from "@eigen-secret/sdk/dist/index";
import { defaultContractABI, defaultContractFile, defaultAccountFile } from "./common";
require("dotenv").config()
const path = require("path");
const fs = require("fs");
const { buildEddsa } = require("circomlibjs");
const createBlakeHash = require("blake-hash");

const circuitPath = path.join(__dirname, "../circuits/");

task("create-account", "Create secret account")
  .addParam("alias", "user alias", "Alice")
  .addParam("password", "password for key sealing", "<your password>")
  .setAction(async ({ alias, password }, { ethers }) => {
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let [user] = await ethers.getSigners();
    console.log("user", user);
    const signature = await signEOASignature(user, rawMessage, user.address, alias, timestamp);
    let signingKey = new SigningKey(eddsa);
    let accountKey = new SigningKey(eddsa);
    let newSigningKey1 = new SigningKey(eddsa);
    let newSigningKey2 = new SigningKey(eddsa);
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
        contractJson.testToken,
        contractJson.smtVerifier
    );
    await secretSDK.initialize(defaultContractABI);
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
    console.log("create account", proofAndPublicSignals);
  })

task("migrate-account", "migrate account to another ETH address")
  .addParam("alias", "user alias", "Alice")
  .addParam("password", "password for key sealing", "<your password>")
  .setAction(async ({ alias, password }, { ethers }) => {
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let [user] = await ethers.getSigners();
    const signature = await signEOASignature(user, rawMessage, user.address, alias, timestamp);
    let newAccountKey = new SigningKey(eddsa);
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
        contractJson.testToken,
        contractJson.smtVerifier
    );
    await secretSDK.initialize(defaultContractABI);
    const ctx = {
      alias: alias,
      ethAddress: user.address,
      rawMessage: rawMessage,
      timestamp: timestamp,
      signature: signature
    };
    let proofAndPublicSignals = await secretSDK.migrateAccount(
        ctx, newAccountKey
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
        contractJson.testToken,
        contractJson.smtVerifier
    );
    await secretSDK.initialize(defaultContractABI);
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
