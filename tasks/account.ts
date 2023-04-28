import { task } from "hardhat/config";
import { signEOASignature, rawMessage } from "@eigen-secret/core/dist-node/utils";
import { SigningKey, SecretAccount } from "@eigen-secret/core/dist-node/account";
import { SecretSDK } from "@eigen-secret/core/dist-node/sdk";
import { Context } from "@eigen-secret/core/dist-node/context";
import {
    defaultServerEndpoint,
    defaultCircuitPath,
    defaultContractABI,
    defaultContractFile
} from "./common";
require("dotenv").config()
const { buildEddsa } = require("circomlibjs");

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
    // let newSigningKey1 = new SigningKey(eddsa);
    let newSigningKey2 = new SigningKey(eddsa);
    const contractJson = require(defaultContractFile);
    let sa = new SecretAccount(
        alias, accountKey, signingKey, accountKey, signingKey, newSigningKey2
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
    const ctx = new Context(alias, user.address, rawMessage, timestamp, signature);
    let proofAndPublicSignals = await secretSDK.createAccount(ctx, password);
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
    const signature = await signEOASignature(user, rawMessage, user.address, alias, timestamp);
    const ctx = new Context(alias, user.address, rawMessage, timestamp, signature);
    let newAccountKey = new SigningKey(eddsa);
    const contractJson = require(defaultContractFile);
    let secretSDK = await SecretSDK.initSDKFromAccount(
        ctx, defaultServerEndpoint, password, user, contractJson, defaultCircuitPath, defaultContractABI
    );
    let proofAndPublicSignals = await secretSDK.migrateAccount(
        ctx, newAccountKey, password
    );
    console.log(proofAndPublicSignals);
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
    const signature = await signEOASignature(user, rawMessage, user.address, alias, timestamp);
    const ctx = new Context(alias, user.address, rawMessage, timestamp, signature);
    const contractJson = require(defaultContractFile);
    let secretSDK = await SecretSDK.initSDKFromAccount(
        ctx, defaultServerEndpoint, password, user, contractJson, defaultCircuitPath, defaultContractABI
    );

    let newSigningKey = new SigningKey(eddsa);
    let proofAndPublicSignals = await secretSDK.updateAccount(
        ctx, newSigningKey, password
    );
    console.log(proofAndPublicSignals);
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
    const signature = await signEOASignature(user, rawMessage, user.address, alias, timestamp);
    const ctx = new Context(alias, user.address, rawMessage, timestamp, signature);
    const contractJson = require(defaultContractFile);
    let sdk = await SecretSDK.initSDKFromAccount(
        ctx, defaultServerEndpoint, password, user, contractJson, defaultCircuitPath, defaultContractABI
    );
    console.log(sdk.account.toString(eddsa));
  })
