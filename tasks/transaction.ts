import { task } from "hardhat/config";
import { signEOASignature, rawMessage, __DEFAULT_ALIAS__ } from "@eigen-secret/core/dist-node/utils";
import { Context } from "@eigen-secret/core/dist-node/context";
import { SecretSDK } from "@eigen-secret/core/dist-node/sdk";
require("dotenv").config()
import {
    defaultServerEndpoint,
    defaultCircuitPath, defaultContractABI, defaultContractFile
} from "./common";
import { ErrCode } from "@eigen-secret/core/dist-node/error";

task("deposit", "Deposit asset from L1 to L2")
  .addParam("alias", "user alias")
  .addParam("assetId", "asset id/token id")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("value", "amount of transaction")
  .addParam("index", "user index for test")
  .setAction(async ({ alias, assetId, password, value, index }, { ethers }) => {
    let timestamp = Math.floor(Date.now()/1000).toString();
    let account = await ethers.getSigners();
    let user = account[index];
    const signature = await signEOASignature(user, rawMessage, user.address, timestamp);
    const ctx = new Context(
      alias,
      user.address,
      rawMessage,
      timestamp,
      signature
    );
    const contractJson = require(defaultContractFile);
    let secretSDK = await SecretSDK.initSDKFromAccount(
        ctx, defaultServerEndpoint, password, user, contractJson, defaultCircuitPath, defaultContractABI
    );
    if (secretSDK.errno != ErrCode.Success) {
      console.log("initSDKFromAccount failed: ", secretSDK);
    }
    let nonce = 0; // TODO: get nonce from Metamask
    let receiver = secretSDK.data.account.accountKey.pubKey.pubKey;

    // get tokenAddress by asset id
    let tokenAddress = await secretSDK.data.getRegisteredToken(BigInt(assetId))
    console.log("token", tokenAddress.toString());
    // approve
    let approveTx = await secretSDK.data.approve(tokenAddress.toString(), value);
    await approveTx.wait();

    let proofAndPublicSignals = await secretSDK.data.deposit(ctx, receiver, BigInt(value), Number(assetId), nonce);
    if (proofAndPublicSignals.errno != ErrCode.Success) {
      console.log("deposit failed: ", proofAndPublicSignals);
    }
    console.log(proofAndPublicSignals.data);
    await secretSDK.data.submitProofs(ctx, proofAndPublicSignals.data);
  })

task("send", "Send asset to receiver in L2")
  .addParam("alias", "user alias")
  .addParam("assetId", "asset id/token id")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("value", "amount of transaction")
  .addParam("index", "user index for test")
  .addParam("receiver", "receiver account public key")
  .addParam("receiverAlias", "receiver_alias use for test", __DEFAULT_ALIAS__)
  .setAction(async ({ alias, assetId, password, value, index, receiver, receiverAlias }, { ethers }) => {
    console.log("receiver: ", receiver)
    let timestamp = Math.floor(Date.now()/1000).toString();
    let account = await ethers.getSigners();
    let user = account[index];
    const signature = await signEOASignature(user, rawMessage, user.address, timestamp);
    const ctx = new Context(
      alias,
      user.address,
      rawMessage,
      timestamp,
      signature
    );
    const contractJson = require(defaultContractFile);
    let secretSDK = await SecretSDK.initSDKFromAccount(
        ctx, defaultServerEndpoint, password, user, contractJson, defaultCircuitPath, defaultContractABI
    );
    if (secretSDK.errno != ErrCode.Success) {
      console.log("initSDKFromAccount failed: ", secretSDK);
    }
    let proofAndPublicSignals = await secretSDK.data.send(ctx, receiver, receiverAlias, BigInt(value), Number(assetId));
    if (proofAndPublicSignals.errno != ErrCode.Success) {
      console.log("send failed: ", proofAndPublicSignals);
    }
    console.log(proofAndPublicSignals.data);
    await secretSDK.data.submitProofs(ctx, proofAndPublicSignals.data);
  })

task("withdraw", "Withdraw asset from L2 to L1")
  .addParam("alias", "user alias")
  .addParam("assetId", "asset id/token id")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("value", "amount of transaction")
  .addParam("index", "user index for test")
  .setAction(async ({ alias, assetId, password, value, index }, { ethers }) => {
    let timestamp = Math.floor(Date.now()/1000).toString();
    let account = await ethers.getSigners();
    let user = account[index];
    const signature = await signEOASignature(user, rawMessage, user.address, timestamp);
    const ctx = new Context(
      alias,
      user.address,
      rawMessage,
      timestamp,
      signature
    );
    const contractJson = require(defaultContractFile);
    let secretSDK = await SecretSDK.initSDKFromAccount(
        ctx, defaultServerEndpoint, password, user, contractJson, defaultCircuitPath, defaultContractABI
    );
    if (secretSDK.errno != ErrCode.Success) {
      console.log("initSDKFromAccount failed: ", secretSDK);
    }
    let receiver = secretSDK.data.account.accountKey.pubKey.pubKey;
    let proofAndPublicSignals = await secretSDK.data.withdraw(ctx, receiver, BigInt(value), Number(assetId));
    if (proofAndPublicSignals.errno != ErrCode.Success) {
      console.log("withdraw failed: ", proofAndPublicSignals);
    }
    console.log(proofAndPublicSignals.data);
    await secretSDK.data.submitProofs(ctx, proofAndPublicSignals.data);
  })

task("get-balance", "Get user's both L1 and L2 balance")
  .addParam("alias", "user name", "Alice")
  .addParam("assetId", "asset id")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("index", "user index for test")
  .setAction(async ({ alias, assetId, password, index }, { ethers }) => {
    let timestamp = Math.floor(Date.now()/1000).toString();
    let account = await ethers.getSigners();
    let user = account[index];
    const signature = await signEOASignature(user, rawMessage, user.address, timestamp);
    const ctx = new Context(
      alias,
      user.address,
      rawMessage,
      timestamp,
      signature
    );
    const contractJson = require(defaultContractFile);
    let secretSDK = await SecretSDK.initSDKFromAccount(
        ctx, defaultServerEndpoint, password, user, contractJson, defaultCircuitPath, defaultContractABI
    );
    if (secretSDK.errno != ErrCode.Success) {
      console.log("initSDKFromAccount failed: ", secretSDK);
    }
    let balance = await secretSDK.data.getAllBalance(ctx);
    if (balance.errno != ErrCode.Success) {
      console.log("getAllBalance failed: ", balance);
    }
    console.log("L2 balance", JSON.stringify(balance.data));

    let address = await secretSDK.data.getRegisteredToken(BigInt(assetId));
    let tokenIns = new ethers.Contract(
        address,
        defaultContractABI.testTokenContractABI,
        user
    );

    balance = await tokenIns.balanceOf(user.address);
    console.log("L1 balance", balance.toString());
  });

  task("get-transactions", "Get user's transactions")
  .addParam("alias", "user name", "Alice")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("index", "user index for test")
  .addParam("page", "page")
  .addParam("pageSize", "page size")
  .setAction(async ({ alias, password, index, page, pageSize }, { ethers }) => {
    let timestamp = Math.floor(Date.now()/1000).toString();
    let account = await ethers.getSigners();
    let user = account[index];
    const signature = await signEOASignature(user, rawMessage, user.address, timestamp);
    const ctx = new Context(
      alias,
      user.address,
      rawMessage,
      timestamp,
      signature
    );
    const contractJson = require(defaultContractFile);
    let secretSDK = await SecretSDK.initSDKFromAccount(
        ctx, defaultServerEndpoint, password, user, contractJson, defaultCircuitPath, defaultContractABI
    );
    if (secretSDK.errno != ErrCode.Success) {
      console.log("initSDKFromAccount failed: ", secretSDK);
    }
    const transactions = await secretSDK.data.getTransactions(ctx, { page, pageSize });
    if (transactions.errno != ErrCode.Success) {
      console.log("getAllBalance failed: ", transactions);
    }
    console.log("transactions", transactions.data);
  });
