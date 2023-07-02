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
const assert = require("assert");

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
    return await sdk.getAllBalance(ctx)
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
  return await sdk.getAllBalance(ctx)
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
  return await sdk.getAllBalance(ctx);
}

async function getBalanceForUser(ethers: any, user: any, alias: string, password: string, assetId: number, expectedL2Balance: string) {
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
  let balance = await sdk.getAllBalance(ctx);
  if (balance.errno != ErrCode.Success) {
    console.log("getAllBalance failed: ", balance);
  }
  console.log("L2 balance for", alias, JSON.stringify(balance.data));
  if (expectedL2Balance !== "") {
    assert.strictEqual(balance.data.assetInfo[0].balance, expectedL2Balance, `${alias}'s actual L2 balance does not match the expected balance`);
  }
  assetId = Number(assetId);
  let address = await sdk.getRegisteredToken(assetId);
  console.log("Token Address for", alias, address);
  const ti = await sdk.getTokenInfo(address);

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
  balanceL1 = sdk.formatValue(ctx, balanceL1, ti.decimals);
  return balanceL1;
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

task("get-balances-multi", "Get multiple users' both L1 and L2 balance")
  .addParam("numAccount", "number of accounts to use")
  .addParam("assetId", "asset id")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("expectedL1Balance", "Expected L1 balance for each account")
  .addParam("expectedL2Balance", "Expected L2 balance for each account")
  .setAction(async ({ numAccount, assetId, password, expectedL1Balance, expectedL2Balance }, { ethers }) => {
    let accounts = await ethers.getSigners();
    accounts.splice(2, 1); // remove the third user (index 2) since the proxy contract is deployed using this account
    accounts = accounts.slice(0, numAccount); // Use the first 'numAccount' accounts
    let userAliases = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank", "George", "Hannah", "Ivy", "Jack"];
    let balancePromises = accounts.map(async (account, i) => {
      let userName = userAliases[i];
      let balanceL1 = await getBalanceForUser(ethers, account, userName, password, assetId, expectedL2Balance);
      console.log("L1 balance for", userName, balanceL1.toString());
      if (userName !== "Alice") {
        assert.strictEqual(balanceL1.toString(), expectedL1Balance, `${userName}'s actual L1 balance does not match the expected balance`);
      }
    });
    let results = await Promise.allSettled(balancePromises);
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        console.error(`Error getting balance for ${userAliases[i]}:`, result.reason);
      }
    });
  });

task("get-balance", "Get user's both L1 and L2 balance")
  .addParam("alias", "user name", "Alice")
  .addParam("assetId", "asset id")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("index", "user index for test")
  .addParam("expectedL2Balance", "Expected L2 balance user")
  .setAction(async ({ alias, assetId, password, index, expectedL2Balance }, { ethers }) => {
    let account = await ethers.getSigners();
    let user = account[index];
    let balanceL1 = await getBalanceForUser(ethers, user, alias, password, assetId, expectedL2Balance);
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

task("deposit-multi", "Deposit assets from multiple users")
.addParam("numAccount", "select the number of test users from 3-10")
.addParam("assetId", "asset id/token id")
.addParam("password", "password for key sealing", "<your password>")
.addParam("value", "amount of transaction")
.setAction(async ({ numAccount, assetId, password, value }, { ethers }) => {
  let accounts = await ethers.getSigners();
  accounts.splice(2, 1); // remove the third user (index 2) since the proxy contract is deployed using this account
  accounts = accounts.slice(0, numAccount);
  let userAliases = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank", "George", "Hannah", "Ivy", "Jack"];
  let taskPromises = accounts.map((account, i) => {
    let userName = userAliases[i];
    return runDepositTask(userName, assetId, password, value, account);
  });
  let result = await Promise.allSettled(taskPromises);
  console.log(JSON.stringify(result))
});

task("send-multi", "Collaborative asset transfer by multiple users")
.addParam("numAccount", "select the number of test users from 3-10")
.addParam("assetId", "asset id/token id")
.addParam("password", "password for key sealing", "<your password>")
.addParam("value", "amount of transaction")
.addParam("receiverAlias", "receiver_alias use for test", __DEFAULT_ALIAS__)
.setAction(async ({ numAccount, assetId, password, value, receiverAlias }, { ethers }) => {
  let accounts = await ethers.getSigners();
  accounts.splice(2, 1); // remove the third user (index 2) since the proxy contract is deployed using this account
  accounts = accounts.slice(0, numAccount);
  let userAliases = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank", "George", "Hannah", "Ivy", "Jack"];
  async function setupUser(user: any, userName: string) {
    let timestamp = Math.floor(Date.now()/1000).toString();
    const signature = await signEOASignature(user, rawMessage, user.address, timestamp);
    const ctx = new Context(userName, user.address, rawMessage, timestamp, signature);
    const contractJson = require(defaultContractFile);
    let secretSDK = await SecretSDK.initSDKFromAccount(
      ctx, defaultServerEndpoint, password, user, contractJson, defaultCircuitPath, defaultContractABI
    );
    if (secretSDK.errno != ErrCode.Success) {
      console.log("initSDKFromAccount failed: ", secretSDK);
    }
    let accountKeyPubKey = secretSDK.data.account.accountKey.pubKey.pubKey;
    return { user, userName, accountKeyPubKey };
  }

  let setupPromises = accounts.map((account, i) => {
    let userName = userAliases[i];
    return setupUser(account, userName);
  });
  let setups = await Promise.all(setupPromises);

  let taskPromises = setups.map((setup, i) => {
    let nextSetup = setups[(i + 1) % setups.length]; // get the next user's setup
    return runSendTask(setup.userName, assetId, password, value, setup.user, nextSetup.accountKeyPubKey, receiverAlias);
  });
  let result = await Promise.allSettled(taskPromises);

  console.log(JSON.stringify(result))
});

task("withdraw-multi", "Withdraw assets from multiple users")
.addParam("numAccount", "select the number of test users from 3-10")
.addParam("assetId", "asset id/token id")
.addParam("password", "password for key sealing", "<your password>")
.addParam("value", "amount of transaction")
.setAction(async ({ numAccount, assetId, password, value }, { ethers }) => {
  let accounts = await ethers.getSigners();
  accounts.splice(2, 1); // remove the third user (index 2) since the proxy contract is deployed using this account
  accounts = accounts.slice(0, numAccount);
  let userAliases = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank", "George", "Hannah", "Ivy", "Jack"];
  let taskPromises = accounts.map((account, i) => {
    let userName = userAliases[i];
    return runWithdrawTask(userName, assetId, password, value, account);
  });
  let result = await Promise.allSettled(taskPromises);
  console.log(JSON.stringify(result))
});

task("execute-all", "Execute deposit-multi, send-multi, and withdraw-multi simultaneously")
.addParam("numAccount", "select the number of test users from 3-10")
.addParam("assetId", "asset id/token id")
.addParam("password", "password for key sealing", "<your password>")
.addParam("value", "amount of transaction")
.addParam("receiverAlias", "receiver_alias use for test", __DEFAULT_ALIAS__)
.setAction(async ({ numAccount, assetId, password, value, receiverAlias }, { run }) => {
  let depositPromise = run("deposit-multi", { numAccount, assetId, password, value });
  let sendPromise = run("send-multi", { numAccount, assetId, password, value, receiverAlias });
  let withdrawPromise = run("withdraw-multi", { numAccount, assetId, password, value });
  await Promise.all([depositPromise, sendPromise, withdrawPromise]);
});
