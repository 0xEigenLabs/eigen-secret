import { task } from "hardhat/config";
import { signEOASignature, rawMessage } from "@eigen-secret/core/dist-node/utils";
import { SigningKey } from "@eigen-secret/core/dist-node/account";
import { SecretSDK } from "@eigen-secret/core/dist-node/sdk";
import { Context } from "@eigen-secret/core/dist-node/context";
import {
    defaultServerEndpoint,
    defaultCircuitPath,
    defaultContractABI,
    defaultContractFile
} from "./common";
import { ErrCode } from "@eigen-secret/core/dist-node/error";
require("dotenv").config()
const { buildEddsa } = require("circomlibjs");

async function createAccountForUser(user:any, alias:string, password:any) {
  let timestamp = Math.floor(Date.now()/1000).toString();
  console.log("ETH address", user.address);
  const signature = await signEOASignature(user, rawMessage, user.address, timestamp);
  const contractJson = require(defaultContractFile);
  const ctx = new Context(alias, user.address, rawMessage, timestamp, signature);
  let secretSDK = await SecretSDK.initSDKFromAccount(
      ctx, defaultServerEndpoint, password, user, contractJson, defaultCircuitPath, defaultContractABI, true
  );
  if (secretSDK.errno != ErrCode.Success) {
    console.log("initSDKFromAccount failed: ", secretSDK);
  }
  let sdk: SecretSDK = secretSDK.data;
  let proofAndPublicSignals = await sdk.createAccount(ctx, password);
  if (proofAndPublicSignals.errno != ErrCode.Success) {
    console.log("createAccount failed: ", proofAndPublicSignals);
  }
  console.log("create account", proofAndPublicSignals.data);
}

task("create-account", "Create secret account")
  .addParam("alias", "user alias")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("index", "user index for test")
  .setAction(async ({ alias, password, index }, { ethers }) => {
    let account = await ethers.getSigners();
    let user = account[index];
    await createAccountForUser(user, alias, password);
  })

task("create-accounts", "Create multiple secret accounts")
  .addParam("numAccount", "number of accounts to use")
  .addParam("password", "password for key sealing", "<your password>")
  .setAction(async ({ numAccount, password }, { ethers }) => {
    let accounts = await ethers.getSigners();
    accounts.splice(2, 1); // remove the third user (index 2) since the proxy contract is deployed using this account
    accounts.shift();
    accounts = accounts.slice(0, numAccount-1);
    let userAliases = ["Bob", "Charlie", "David", "Eve", "Frank", "George", "Hannah", "Ivy", "Jack"];
    let createAccountPromises = accounts.map((account, i) => {
      let userName = userAliases[i];
      return createAccountForUser(account, userName, password);
    });
    await Promise.all(createAccountPromises);
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
    const signature = await signEOASignature(user, rawMessage, user.address, timestamp);
    const ctx = new Context(alias, user.address, rawMessage, timestamp, signature);
    let newAccountKey = new SigningKey(eddsa);
    const contractJson = require(defaultContractFile);
    let secretSDK = await SecretSDK.initSDKFromAccount(
        ctx, defaultServerEndpoint, password, user, contractJson, defaultCircuitPath, defaultContractABI
    );
    if (secretSDK.errno != ErrCode.Success) {
      console.log("initSDKFromAccount failed: ", secretSDK);
    }
    let sdk: SecretSDK = secretSDK.data;
    let proofAndPublicSignals = await sdk.migrateAccount(
        ctx, newAccountKey, password
    );
    if (proofAndPublicSignals.errno != ErrCode.Success) {
      console.log("migrateAccount failed: ", proofAndPublicSignals);
    }
    console.log(proofAndPublicSignals.data);
  })

task("update-account", "Update signing key")
  .addParam("alias", "user alias")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("index", "user index for test")
  .setAction(async ({ alias, password, index }, { ethers }) => {
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let accounts = await ethers.getSigners();
    let user = accounts[index];
    const signature = await signEOASignature(user, rawMessage, user.address, timestamp);
    const ctx = new Context(alias, user.address, rawMessage, timestamp, signature);
    const contractJson = require(defaultContractFile);
    let secretSDK = await SecretSDK.initSDKFromAccount(
        ctx, defaultServerEndpoint, password, user, contractJson, defaultCircuitPath, defaultContractABI
    );
    if (secretSDK.errno != ErrCode.Success) {
      console.log("initSDKFromAccount failed: ", secretSDK);
    }
    let sdk: SecretSDK = secretSDK.data;
    let newSigningKey = new SigningKey(eddsa);
    let proofAndPublicSignals = await sdk.updateAccount(
        ctx, newSigningKey, password
    );
    if (proofAndPublicSignals.errno != ErrCode.Success) {
      console.log("updateAccount failed: ", proofAndPublicSignals);
    }
    console.log(proofAndPublicSignals.data);
  })

task("get-account", "Get account info")
  .addParam("alias", "user alias")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("index", "user index for test")
  .setAction(async ({ alias, password, index }, { ethers }) => {
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let account = await ethers.getSigners();
    let user = account[index];
    console.log("ETH address", user.address);
    const signature = await signEOASignature(user, rawMessage, user.address, timestamp);
    const ctx = new Context(alias, user.address, rawMessage, timestamp, signature);
    const contractJson = require(defaultContractFile);
    let secretSDK = await SecretSDK.initSDKFromAccount(
        ctx, defaultServerEndpoint, password, user, contractJson, defaultCircuitPath, defaultContractABI
    );
    if (secretSDK.errno != ErrCode.Success) {
      console.log("initSDKFromAccount failed: ", secretSDK);
    }
    console.log(secretSDK.data.account.toString(eddsa));
  })
