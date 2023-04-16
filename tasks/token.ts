import { task } from "hardhat/config";
import { SecretAccount } from "@eigen-secret/core/dist/account";
import {
    defaultServerEndpoint,
    defaultCircuitPath, defaultContractABI, defaultContractFile, defaultAccountFile } from "./common";
const { buildEddsa } = require("circomlibjs");
const createBlakeHash = require("blake-hash");
import { SecretSDK } from "@eigen-secret/sdk/dist/index";
const fs = require("fs");

task("setup-rollup", "Setup rollup coordinator")
      .addParam("alias", "user alias", "Alice")
      .addParam("contractFile", "[output] contract address", defaultContractFile)
      .addParam("password", "password for key sealing", "<your password>")
      .setAction(async ({ alias, contractFile, password }, { ethers }) => {
    let [admin] = await ethers.getSigners();
    let eddsa = await buildEddsa();
    let accountData = fs.readFileSync(defaultAccountFile);
    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    let sa = SecretAccount.deserialize(eddsa, key, accountData.toString())
    const contractJson = require(contractFile);

    let secretSDK = new SecretSDK(
        alias,
        sa,
        defaultServerEndpoint,
        defaultCircuitPath,
        eddsa,
        admin,
        contractJson.spongePoseidon,
        contractJson.tokenRegistry,
        contractJson.poseidon2,
        contractJson.poseidon3,
        contractJson.poseidon6,
        contractJson.rollup,
        contractJson.smtVerifier
    );
    await secretSDK.initialize(defaultContractABI);

    // set rollup nc
    await secretSDK.setRollupNC();
    console.log("setup Rollup NC done");
})

task("register-token", "Register token to Rollup")
      .addParam("alias", "user alias", "Alice")
      .addParam("contractFile", "[output] contract address", defaultContractFile)
      .addParam("token", "the token to be registered")
      .addParam("password", "password for key sealing", "<your password>")
      .setAction(async ({ alias, contractFile, token, password }, { ethers }) => {
    let [admin] = await ethers.getSigners();
    let eddsa = await buildEddsa();
    let accountData = fs.readFileSync(defaultAccountFile);
    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    let sa = SecretAccount.deserialize(eddsa, key, accountData.toString())
    const contractJson = require(contractFile);

    let secretSDK = new SecretSDK(
        alias,
        sa,
        defaultServerEndpoint,
        defaultCircuitPath,
        eddsa,
        admin,
        contractJson.spongePoseidon,
        contractJson.tokenRegistry,
        contractJson.poseidon2,
        contractJson.poseidon3,
        contractJson.poseidon6,
        contractJson.rollup,
        contractJson.smtVerifier
    );
    await secretSDK.initialize(defaultContractABI);

    await secretSDK.registerToken(token);
    console.log("register token done")
    let assetId = await secretSDK.approveToken(token);
    console.log("approve token done, assetId is", assetId, toString())
})
