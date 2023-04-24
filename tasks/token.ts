import { task } from "hardhat/config";
import { SecretAccount } from "@eigen-secret/core/dist-node/account";
import {
    defaultServerEndpoint,
    defaultCircuitPath, defaultContractABI, defaultContractFile, accountFile } from "./common";
const { buildEddsa } = require("circomlibjs");
const createBlakeHash = require("blake-hash");
import { SecretSDK } from "@eigen-secret/core/dist-node/sdk";
const fs = require("fs");

task("setup-rollup", "Setup rollup coordinator")
      .addParam("alias", "user alias", "Alice")
      .addParam("password", "password for key sealing", "<your password>")
      .setAction(async ({ alias, password }, { ethers }) => {
    let [admin] = await ethers.getSigners();
    let eddsa = await buildEddsa();
    let accountData = fs.readFileSync(accountFile(alias));
    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    let sa = SecretAccount.deserialize(eddsa, key, accountData.toString())
    const contractJson = require(defaultContractFile);

    let secretSDK = new SecretSDK(
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
      .addParam("token", "the token to be registered")
      .addParam("password", "password for key sealing", "<your password>")
      .setAction(async ({ alias, token, password }, { ethers }) => {
    let [admin] = await ethers.getSigners();
    let eddsa = await buildEddsa();
    let accountData = fs.readFileSync(accountFile(alias));
    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    let sa = SecretAccount.deserialize(eddsa, key, accountData.toString())
    const contractJson = require(defaultContractFile);

    let secretSDK = new SecretSDK(
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
    console.log("approve token done, assetId is", assetId.toString())
})

task("send-l1", "Send asset from L1 to L1")
    .addParam("alias", "user name", "Alice")
    .addParam("value", "transaction amount")
    .addParam("receiver", "receiver ETH address")
    .addParam("assetId", "asset id")
    .addParam("password", "password for key sealing", "<your password>")
    .setAction(async ({ alias, value, receiver, assetId, password }, { ethers }) => {
        let [admin] = await ethers.getSigners();
        let eddsa = await buildEddsa();
        let accountData = fs.readFileSync(accountFile(alias));
        let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
        let sa = SecretAccount.deserialize(eddsa, key, accountData.toString())
        const contractJson = require(defaultContractFile);
        let secretSDK = new SecretSDK(
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
        // get token address
        let address = await secretSDK.getRegisteredToken(BigInt(assetId));
        let tokenIns = new ethers.Contract(
            address,
            defaultContractABI.testTokenContractABI,
            admin
        );

        let tx = await tokenIns.transfer(receiver, BigInt(value));
        await tx.wait();

        let balance = await tokenIns.balanceOf(receiver);
        console.log("balance", balance.toString());
    });
