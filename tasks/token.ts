import { task } from "hardhat/config";
import { signEOASignature, rawMessage, prepareJson } from "@eigen-secret/core/dist-node/utils";
import { SecretAccount } from "@eigen-secret/core/dist-node/account";
import {
    defaultServerEndpoint,
    defaultCircuitPath, defaultContractABI, defaultContractFile } from "./common";
const { buildEddsa } = require("circomlibjs");
const createBlakeHash = require("blake-hash");
import { SecretSDK } from "@eigen-secret/core/dist-node/sdk";
const axios = require("axios").default;

task("setup-rollup", "Setup rollup coordinator")
      .addParam("alias", "user alias", "Alice")
      .addParam("password", "password for key sealing", "<your password>")
      .setAction(async ({ alias, password }, { ethers }) => {
    let timestamp = Math.floor(Date.now()/1000).toString();
    let [admin] = await ethers.getSigners();
    let eddsa = await buildEddsa();
    const signature = await signEOASignature(admin, rawMessage, admin.address, alias, timestamp);
    let options = {
      method: "POST",
      url: defaultServerEndpoint + "/accounts/get",
      headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
      },
      data: prepareJson({
          alias: alias,
          timestamp: timestamp,
          message: rawMessage,
          hexSignature: signature,
          ethAddress: admin.address
      })
  };
  let response = await axios.request(options);
    let accountData = response.data.data[0].secretAccount;
    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    let sa = SecretAccount.deserialize(eddsa, key, accountData)
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
        let timestamp = Math.floor(Date.now()/1000).toString();
        let [admin] = await ethers.getSigners();
        let eddsa = await buildEddsa();
        const signature = await signEOASignature(admin, rawMessage, admin.address, alias, timestamp);
        let options = {
          method: "POST",
          url: defaultServerEndpoint + "/accounts/get",
          headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
          },
          data: prepareJson({
              alias: alias,
              timestamp: timestamp,
              message: rawMessage,
              hexSignature: signature,
              ethAddress: admin.address
          })
      };
      let response = await axios.request(options);
        let accountData = response.data.data[0].secretAccount;
    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    let sa = SecretAccount.deserialize(eddsa, key, accountData)
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
        let timestamp = Math.floor(Date.now()/1000).toString();
        let [admin] = await ethers.getSigners();
        let eddsa = await buildEddsa();
        const signature = await signEOASignature(admin, rawMessage, admin.address, alias, timestamp);
        let options = {
          method: "POST",
          url: defaultServerEndpoint + "/accounts/get",
          headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
          },
          data: prepareJson({
              alias: alias,
              timestamp: timestamp,
              message: rawMessage,
              hexSignature: signature,
              ethAddress: admin.address
          })
      };
      let response = await axios.request(options);
        let accountData = response.data.data[0].secretAccount;
        let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
        let sa = SecretAccount.deserialize(eddsa, key, accountData)
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
