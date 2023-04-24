import { task } from "hardhat/config";
import { signEOASignature, rawMessage } from "@eigen-secret/core/dist-node/utils";
import { SigningKey, SecretAccount } from "@eigen-secret/core/dist-node/account";
import { SecretSDK } from "@eigen-secret/core/dist-node/sdk";
import {
    defaultServerEndpoint,
    defaultCircuitPath,
    defaultContractABI,
    defaultContractFile,
    accountFile
} from "./common";
require("dotenv").config()
const fs = require("fs");
const { buildEddsa } = require("circomlibjs");
const createBlakeHash = require("blake-hash");

task("create-account", "Create secret account")
  .addParam("alias", "user alias")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("index", "user index for test")
  .setAction(async ({ alias, password, index }, { ethers }) => {
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let account = await ethers.getSigners();
    let user = account[index];
    console.log("ETH address", user.address);

    const signature = await signEOASignature(user, rawMessage, user.address, alias, timestamp);
    let signingKey = new SigningKey(eddsa);
    let accountKey = new SigningKey(eddsa);
    let newSigningKey1 = new SigningKey(eddsa);
    let newSigningKey2 = new SigningKey(eddsa);
    const contractJson = require(defaultContractFile);
    console.log("accountKey: ", accountKey.pubKey.pubKey);
    let sa = new SecretAccount(
        alias, accountKey, signingKey, accountKey, newSigningKey1, newSigningKey2
    );
    let secretSDK = new SecretSDK(
        sa,
        defaultServerEndpoint,
        defaultCircuitPath,
        eddsa,
        user,
        contractJson.spongePoseidon,
        contractJson.tokenRegistry,
        contractJson.poseidon2,
        contractJson.poseidon3,
        contractJson.poseidon6,
        contractJson.rollup,
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
    fs.writeFileSync(accountFile(alias), sa.serialize(key));
    console.log("create account", proofAndPublicSignals);
  })

task("migrate-account", "Migrate account to another ETH address")
  .addParam("alias", "user alias", "Alice")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("index", "user index for test")
  .setAction(async ({ alias, password, index }, { ethers }) => {
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let account = await ethers.getSigners();
    let user = account[index];
    let accountData = fs.readFileSync(accountFile(alias));
    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    let sa = SecretAccount.deserialize(eddsa, key, accountData.toString())
    const signature = await signEOASignature(user, rawMessage, user.address, sa.alias, timestamp);
    let newAccountKey = new SigningKey(eddsa);
    const contractJson = require(defaultContractFile);
    let secretSDK = new SecretSDK(
        sa,
        defaultServerEndpoint,
        defaultCircuitPath,
        eddsa,
        user,
        contractJson.spongePoseidon,
        contractJson.tokenRegistry,
        contractJson.poseidon2,
        contractJson.poseidon3,
        contractJson.poseidon6,
        contractJson.rollup,
        contractJson.smtVerifier
    );
    await secretSDK.initialize(defaultContractABI);
    const ctx = {
      alias: sa.alias,
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
    fs.writeFileSync(accountFile(sa.alias), sa.serialize(key2));
    console.log(proofAndPublicSignals);
  })

task("update-account", "Update signing key")
  .addParam("alias", "user alias")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("index", "user index for test")
  .setAction(async ({ alias, password, index }, { ethers }) => {
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let account = await ethers.getSigners();
    let user = account[index];
    let accountData = fs.readFileSync(accountFile(alias));
    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    let sa = SecretAccount.deserialize(eddsa, key, accountData.toString())
    const signature = await signEOASignature(user, rawMessage, user.address, sa.alias, timestamp);
    const contractJson = require(defaultContractFile);
    let secretSDK = new SecretSDK(
        sa,
        defaultServerEndpoint,
        defaultCircuitPath,
        eddsa,
        user,
        contractJson.spongePoseidon,
        contractJson.tokenRegistry,
        contractJson.poseidon2,
        contractJson.poseidon3,
        contractJson.poseidon6,
        contractJson.rollup,
        contractJson.smtVerifier
    );
    await secretSDK.initialize(defaultContractABI);
    const ctx = {
      alias: sa.alias,
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
    fs.writeFileSync(accountFile(sa.alias), sa.serialize(key2));
    console.log(proofAndPublicSignals);
  })

task("get-account", "Get account info")
  .addParam("alias", "user alias")
  .addParam("password", "password for key sealing", "<your password>")
  .setAction(async ({ alias, password }) => {
    const eddsa = await buildEddsa();
    let accountData = fs.readFileSync(accountFile(alias));
    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    let sa = SecretAccount.deserialize(eddsa, key, accountData.toString())
    // TODO: prety print @LW
    console.log(sa);
  })
