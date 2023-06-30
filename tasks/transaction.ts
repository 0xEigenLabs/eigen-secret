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
}

async function getBalanceForUser(user: any, alias: string, password: string, assetId: number) {
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

  assetId = Number(assetId);
  let address = await sdk.getRegisteredToken(assetId);
  console.log("Token Address for", alias, address);
  return address;
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
  .addParam("accountNum", "number of accounts to use")
  .addParam("assetId", "asset id")
  .addParam("password", "password for key sealing", "<your password>")
  .setAction(async ({ accountNum, assetId, password }, { ethers }) => {
    let accounts = await ethers.getSigners();
    accounts.splice(2, 1); // remove the third user (index 2) since the proxy contract is deployed using this account
    accounts = accounts.slice(0, accountNum); // Use the first 'accountNum' accounts
    let userAliases = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank", "George", "Hannah", "Ivy", "Jack"];
    let balancePromises = accounts.map(async (account, i) => {
      let userName = userAliases[i];
      let address = await getBalanceForUser(account, userName, password, assetId);
      let balanceL1: any;
      if (assetId !== 1) {
          let tokenIns = new ethers.Contract(
              address,
              defaultContractABI.testTokenContractABI,
              account
          );
          balanceL1 = await tokenIns.balanceOf(account.address);
      } else {
          balanceL1 = await account.getBalance();
      }
      console.log("L1 balance for", userName, balanceL1.toString());
    });

    await Promise.all(balancePromises);
  });

task("get-balance", "Get user's both L1 and L2 balance")
  .addParam("alias", "user name", "Alice")
  .addParam("assetId", "asset id")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("index", "user index for test")
  .setAction(async ({ alias, assetId, password, index }, { ethers }) => {
    let account = await ethers.getSigners();
    let user = account[index];
    let address = await getBalanceForUser(user, alias, password, assetId);
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

task("deposit-multi", "Deposit assets from multiple users")
.addParam("accountNum", "select the number of test users from 3-10")
.addParam("assetId", "asset id/token id")
.addParam("password", "password for key sealing", "<your password>")
.addParam("value", "amount of transaction")
.setAction(async ({ accountNum, assetId, password, value }, { ethers }) => {
  let accounts = await ethers.getSigners();
  accounts.splice(2, 1); // remove the third user (index 2) since the proxy contract is deployed using this account
  accounts = accounts.slice(0, accountNum);
  let userAliases = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank", "George", "Hannah", "Ivy", "Jack"];
  let taskPromises = accounts.map((account, i) => {
    let userName = userAliases[i];
    return runDepositTask(userName, assetId, password, value, account);
  });
  let result = await Promise.allSettled(taskPromises);
  console.log(JSON.stringify(result))
});

task("send-multi", "Collaborative asset transfer by multiple users")
.addParam("accountNum", "select the number of test users from 3-10")
.addParam("assetId", "asset id/token id")
.addParam("password", "password for key sealing", "<your password>")
.addParam("value", "amount of transaction")
.addParam("receiverAlias", "receiver_alias use for test", __DEFAULT_ALIAS__)
.setAction(async ({ accountNum, assetId, password, value, receiverAlias }, { ethers }) => {
  let accounts = await ethers.getSigners();
  accounts.splice(2, 1); // remove the third user (index 2) since the proxy contract is deployed using this account
  accounts = accounts.slice(0, accountNum);
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
.addParam("accountNum", "select the number of test users from 3-10")
.addParam("assetId", "asset id/token id")
.addParam("password", "password for key sealing", "<your password>")
.addParam("value", "amount of transaction")
.setAction(async ({ accountNum, assetId, password, value }, { ethers }) => {
  let accounts = await ethers.getSigners();
  accounts.splice(2, 1); // remove the third user (index 2) since the proxy contract is deployed using this account
  accounts = accounts.slice(0, accountNum);
  let userAliases = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank", "George", "Hannah", "Ivy", "Jack"];
  let taskPromises = accounts.map((account, i) => {
    let userName = userAliases[i];
    return runWithdrawTask(userName, assetId, password, value, account);
  });
  let result = await Promise.allSettled(taskPromises);
  console.log(JSON.stringify(result))
});
