import { task } from "hardhat/config";
import { signEOASignature, rawMessage } from "@eigen-secret/core/dist/utils";
import { SigningKey, SecretAccount } from "@eigen-secret/core/dist/account";
import { SecretSDK } from "@eigen-secret/sdk/dist/index";
import { defaultContractABI, defaultContractFile, defaultAccountFile } from "./common";
require("dotenv").config()
const path = require("path");
const fs = require("fs");
const { buildEddsa } = require("circomlibjs");
const createBlakeHash = require("blake-hash");

const circuitPath = path.join(__dirname, "../circuits/");

task("ci", "Run all task in one command")
  .addParam("alias", "user alias", "Alice")
  .addParam("password", "password for key sealing", "<your password>")
  .setAction(async ({ alias, password }, { ethers }) => {
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let [user] = await ethers.getSigners();
    console.log("user", user);
    const signature = await signEOASignature(user, rawMessage, user.address, alias, timestamp);
    let signingKey = new SigningKey(eddsa);
    let accountKey = new SigningKey(eddsa);
    let newSigningKey1 = new SigningKey(eddsa);
    let newSigningKey2 = new SigningKey(eddsa);
    const contractJson = require(defaultContractFile);

    let sa = new SecretAccount(
        accountKey, signingKey, accountKey, newSigningKey1, newSigningKey2
    );
    let secretSDK = new SecretSDK(
        alias,
        sa,
        "http://127.0.0.1:3000",
        circuitPath,
        eddsa,
        user,
        contractJson.spongePoseidon,
        contractJson.tokenRegistry,
        contractJson.poseidon2,
        contractJson.poseidon3,
        contractJson.poseidon6,
        contractJson.rollup,
        contractJson.testToken,
        contractJson.smtVerifier
    );
    await secretSDK.initialize(defaultContractABI);
    const ctx = {
      alias: alias,
      ethAddress: user.address,
      rawMessage: rawMessage,
      timestamp: timestamp,
      signature: signature
    };
    let proofAndPublicSignals = await secretSDK.createAccount(ctx, sa.newSigningKey1, sa.newSigningKey2);

    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    fs.writeFileSync(defaultAccountFile, sa.serialize(key));
    console.log("create account", proofAndPublicSignals);

    // set rollup nc
    await secretSDK.setRollupNC();
    console.log("setup Rollup NC done");

    // approve testToken
    await secretSDK.registerToken();
    console.log("register token done")

    let newAssetId = await secretSDK.approveToken();
    console.log("approve token done", newAssetId)

    let value = 1000n;
    let approveTx = await secretSDK.approve(value);
    await approveTx.wait();

    let receiver = accountKey.pubKey.pubKey;
    let nonce = 0;
    let assetId = 2;
    value = 10n;

    let proof = await secretSDK.deposit(ctx, receiver, value, assetId, nonce);
    let balance1 = await secretSDK.getNotesValue(ctx, assetId);
    console.log("test1-after deposit")
    console.log(balance1)
    console.log("CreateAccount done, proof: ", proofAndPublicSignals, proof);

    let proof1 = await secretSDK.send(ctx, receiver, 2n, assetId);
    console.log("send proof", proof1);
    let balance2 = await secretSDK.getNotesValue(ctx, assetId);
    console.log(balance2)

    let proof2 = await secretSDK.withdraw(ctx, receiver, 5n, assetId);
    console.log("withdraw done, proof: ", proof2);
  })
