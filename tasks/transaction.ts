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

async function runDepositTask(alias: string, assetId: number, password: string, value: any, user:any) {
    let timestamp = Math.floor(Date.now()/1000).toString();
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
    let sdk: SecretSDK = secretSDK.data;
    let nonce = 0; // TODO: get nonce from Metamask
    let receiver = sdk.account.accountKey.pubKey.pubKey;

    // get tokenAddress by asset id
    assetId = Number(assetId);
    let tokenAddress = await sdk.getRegisteredToken(assetId)
    console.log("token", tokenAddress.toString());

    let tokenInfo = await sdk.getTokenInfo(tokenAddress.toString())
    // approve
    value = sdk.parseValue(ctx, value, tokenInfo.decimals);
    let allowance = await sdk.allowance(tokenAddress.toString())
    if (allowance.data < value) {
      await sdk.approve(tokenAddress.toString(), value);
    }

    let proofAndPublicSignals = await sdk.deposit(ctx, receiver, BigInt(value), assetId, nonce);
    if (proofAndPublicSignals.errno != ErrCode.Success) {
      console.log("deposit failed: ", proofAndPublicSignals);
    }
    console.log(proofAndPublicSignals.data);
    await sdk.submitProofs(ctx, proofAndPublicSignals.data);
}

async function runSendTask(alias: string, assetId: number, password: string, value: any, user:any, receiver:any, receiverAlias: string) {
  let timestamp = Math.floor(Date.now()/1000).toString();
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
  let sdk: SecretSDK = secretSDK.data;

  // get tokenAddress by asset id
  let tokenAddress = await sdk.getRegisteredToken(Number(assetId))
  let tokenInfo = await sdk.getTokenInfo(tokenAddress.toString())

  value = sdk.parseValue(ctx, value, tokenInfo.decimals);
  let proofAndPublicSignals = await sdk.send(ctx, receiver, receiverAlias, BigInt(value), Number(assetId));
  if (proofAndPublicSignals.errno != ErrCode.Success) {
    console.log("send failed: ", proofAndPublicSignals);
  }
  console.log(proofAndPublicSignals.data);
  await sdk.submitProofs(ctx, proofAndPublicSignals.data);
}

async function runWithdrawTask(alias: string, assetId: number, password: string, value: any, user:any) {
  let timestamp = Math.floor(Date.now()/1000).toString();
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
  assetId = Number(assetId);
  let sdk: SecretSDK = secretSDK.data;
  let tokenAddress = await sdk.getRegisteredToken(assetId)
  let tokenInfo = await sdk.getTokenInfo(tokenAddress.toString())
  value = sdk.parseValue(ctx, value, tokenInfo.decimals);
  let proofAndPublicSignals = await sdk.withdraw(ctx, user.address, BigInt(value), assetId);
  if (proofAndPublicSignals.errno != ErrCode.Success) {
    console.log("withdraw failed: ", proofAndPublicSignals);
  }
  console.log(proofAndPublicSignals.data);
  await sdk.submitProofs(ctx, proofAndPublicSignals.data);
}

task("deposit", "Deposit asset from L1 to L2")
  .addParam("alias", "user alias")
  .addParam("assetId", "asset id/token id")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("value", "amount of transaction")
  .addParam("index", "user index for test")
  .setAction(async ({ alias, assetId, password, value, index }, { ethers }) => {
    let account = await ethers.getSigners();
    let user = account[index];
    await runDepositTask(alias, assetId, password, value, user);
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
    let account = await ethers.getSigners();
    let user = account[index];
    await runSendTask(alias, assetId, password, value, user, receiver, receiverAlias);
  })

task("withdraw", "Withdraw asset from L2 to L1")
  .addParam("alias", "user alias")
  .addParam("assetId", "asset id/token id")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("value", "amount of transaction")
  .addParam("index", "user index for test")
  .setAction(async ({ alias, assetId, password, value, index }, { ethers }) => {
    let account = await ethers.getSigners();
    let user = account[index];
    await runWithdrawTask(alias, assetId, password, value, user);
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
    let sdk: SecretSDK = secretSDK.data;
    let balance = await sdk.getAllBalance(ctx);
    if (balance.errno != ErrCode.Success) {
      console.log("getAllBalance failed: ", balance);
    }
    console.log("L2 balance", JSON.stringify(balance.data));

    assetId = Number(assetId);
    let address = await sdk.getRegisteredToken(assetId);
    console.log("Token Address", address);
    let balanceL1: any;
    if (assetId !== 1) {
        let tokenIns = new ethers.Contract(
            address,
            defaultContractABI.testTokenContractABI,
            user
        );

        balanceL1 = await tokenIns.balanceOf(user.address);
    } else {
        balanceL1 = await user.getBalance();
    }
    console.log("L1 balance", balanceL1.toString());
});

task("get-transactions", "Get user's transactions")
  .addParam("alias", "user name", "Alice")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("index", "user index for test")
  .addParam("page", "page", "0")
  .addParam("pageSize", "page size", "10")
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
      console.log(secretSDK);
    let sdk: SecretSDK = secretSDK.data;
    const transactions = await sdk.getTransactions(ctx, { page, pageSize });
    if (transactions.errno != ErrCode.Success) {
      console.log("getAllBalance failed: ", transactions);
    }
    console.log("transactions", transactions.data);
});

task("depositall", "Deposit assets from multiple users")
.addParam("assetId", "asset id/token id")
.addParam("value", "amount of transaction")
.setAction(async ({assetId, value},{ ethers }) => {
  let account = await ethers.getSigners();
  let user0 = account[0];
  let user1 = account[1];
  let user2 = account[3];
  await Promise.all([
    runDepositTask('Alice', assetId, '<your password>', value, user0),
    runDepositTask('Bob', assetId, '<your password>', value, user1),
    runDepositTask('Charlie', assetId, '<your password>', value, user2),
  ]);
});

task("sendall", "Collaborative asset transfer by multiple users")
.addParam("assetId", "asset id/token id")
.addParam("password", "password for key sealing", "<your password>")
.addParam("value", "amount of transaction")
.addParam("receiverAlias", "receiver_alias use for test", __DEFAULT_ALIAS__)
.setAction(async ({assetId, password, value, receiverAlias},{ ethers }) => {
  let account = await ethers.getSigners();
  let user0 = account[0];
  let user1 = account[1];
  let user2 = account[3];
  // const eddsa = await buildEddsa();
  let timestamp = Math.floor(Date.now()/1000).toString();
  const signature0 = await signEOASignature(user0, rawMessage, user0.address, timestamp);
  const ctx0 = new Context('Alice', user0.address, rawMessage, timestamp, signature0);
  const contractJson = require(defaultContractFile);
  let secretSDK0 = await SecretSDK.initSDKFromAccount(
    ctx0, defaultServerEndpoint, password, user0, contractJson, defaultCircuitPath, defaultContractABI
  );
  if (secretSDK0.errno != ErrCode.Success) {
    console.log("initSDKFromAccount failed: ", secretSDK0);
  }
  let accountKeyPubKey0 = secretSDK0.data.account.accountKey.pubKey.pubKey;

  const signature1 = await signEOASignature(user1, rawMessage, user1.address, timestamp);
  const ctx1 = new Context('Bob', user1.address, rawMessage, timestamp, signature1);
  let secretSDK1 = await SecretSDK.initSDKFromAccount(
    ctx1, defaultServerEndpoint, password, user1, contractJson, defaultCircuitPath, defaultContractABI
  );
  if (secretSDK1.errno != ErrCode.Success) {
    console.log("initSDKFromAccount failed: ", secretSDK1);
  }
  let accountKeyPubKey1 = secretSDK1.data.account.accountKey.pubKey.pubKey;

  const signature2 = await signEOASignature(user2, rawMessage, user2.address, timestamp);
  const ctx2 = new Context('Charlie', user2.address, rawMessage, timestamp, signature2);
  let secretSDK2 = await SecretSDK.initSDKFromAccount(
    ctx2, defaultServerEndpoint, password, user2, contractJson, defaultCircuitPath, defaultContractABI
  );
  if (secretSDK2.errno != ErrCode.Success) {
    console.log("initSDKFromAccount failed: ", secretSDK2);
  }
  let accountKeyPubKey2 = secretSDK2.data.account.accountKey.pubKey.pubKey;

  await Promise.allSettled([
    runSendTask('Alice', assetId, '<your password>', value, user0, accountKeyPubKey1, receiverAlias),
    runSendTask('Bob', assetId, '<your password>', value, user1, accountKeyPubKey2, receiverAlias),
    runSendTask('Charlie', assetId, '<your password>', value, user2, accountKeyPubKey0, receiverAlias),
    runWithdrawTask('Alice', assetId, '<your password>', value, user0),
    runWithdrawTask('Bob', assetId, '<your password>', value, user1),
    runWithdrawTask('Charlie', assetId, '<your password>', value, user2),
  ]);
});