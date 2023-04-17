import { task } from "hardhat/config";
import { signEOASignature, rawMessage } from "@eigen-secret/core/dist/utils";
import { SecretAccount } from "@eigen-secret/core/dist/account";
import { SecretSDK } from "@eigen-secret/sdk/dist/index";
require("dotenv").config()
const fs = require("fs");
const { buildEddsa } = require("circomlibjs");
import {
    defaultServerEndpoint,
    defaultCircuitPath, defaultContractABI, defaultContractFile, accountFile } from "./common";
const createBlakeHash = require("blake-hash");

task("deposit", "Deposit asset from L1 to L2")
  .addParam("alias", "user alias")
  .addParam("assetId", "asset id/token id")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("value", "amount of transaction")
  .addParam("index", "user index for test")
  .setAction(async ({ alias, assetId, password, value, index }, { ethers }) => {
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let account = await ethers.getSigners();
    let user = account[index];
    let accountData = fs.readFileSync(accountFile(alias));
    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    let sa = SecretAccount.deserialize(eddsa, key, accountData.toString());
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
    let nonce = 0; // get nonce from Metamask
    let receiver = sa.accountKey.pubKey.pubKey;

    // get tokenAddress by asset id
    let tokenAddress = await secretSDK.getRegisteredToken(BigInt(assetId))
    console.log(tokenAddress.toString());
    // approve
    let approveTx = await secretSDK.approve(tokenAddress.toString(), value);
    await approveTx.wait();

    let proofAndPublicSignals = await secretSDK.deposit(ctx, receiver, BigInt(value), Number(assetId), nonce);
    console.log(proofAndPublicSignals);
  })

task("send", "Send asset to receiver in L2")
  .addParam("alias", "user alias")
  .addParam("assetId", "asset id/token id")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("value", "amount of transaction")
  .addParam("index", "user index for test")
  .addParam("receiver", "receiver account public key")
  .addParam("receiverSigningkey", "receiver account public key")
  .addParam("receiverAlias", "receiver_alias use for test")
  .setAction(async ({ alias, assetId, password, value, index, receiver, receiverSigningkey, receiverAlias }, { ethers }) => {
    console.log("receiver: ", receiver)
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let account = await ethers.getSigners();
    let user = account[index];
    let accountData = fs.readFileSync(accountFile(alias));
    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    let sa = SecretAccount.deserialize(eddsa, key, accountData.toString());
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
    // let _receiver = sa.accountKey.pubKey.pubKey;
    let proofAndPublicSignals = await secretSDK.send(ctx, receiver, receiverSigningkey, receiverAlias, BigInt(value), Number(assetId));
    console.log(proofAndPublicSignals);
  })

task("withdraw", "Withdraw asset from L2 to L1")
  .addParam("alias", "user alias")
  .addParam("assetId", "asset id/token id")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("value", "amount of transaction")
  .addParam("index", "user index for test")
  .setAction(async ({ alias, assetId, password, value, index }, { ethers }) => {
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let account = await ethers.getSigners();
    let user = account[index];
    let accountData = fs.readFileSync(accountFile(alias));
    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    let sa = SecretAccount.deserialize(eddsa, key, accountData.toString());
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
    let receiver = sa.accountKey.pubKey.pubKey;
    let proofAndPublicSignals = await secretSDK.withdraw(ctx, receiver, BigInt(value), Number(assetId));
    console.log(proofAndPublicSignals);
  })

task("get-balance-l2", "Get user L2 balance")
  .addParam("alias", "user name", "Alice")
  .addParam("assetId", "asset id")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("index", "user index for test")
  .setAction(async ({ alias, assetId, password, index }, { ethers }) => {
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let account = await ethers.getSigners();
    let user = account[index];
    let accountData = fs.readFileSync(accountFile(alias));
    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    let sa = SecretAccount.deserialize(eddsa, key, accountData.toString());
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

    let balance = await secretSDK.getNotesValue(ctx, assetId);
    console.log("balance", balance.toString());
  });
