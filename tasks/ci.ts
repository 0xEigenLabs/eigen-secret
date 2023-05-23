import { task } from "hardhat/config";
import { signEOASignature, rawMessage } from "@eigen-secret/core/dist-node/utils";
import { SigningKey, SecretAccount } from "@eigen-secret/core/dist-node/account";
import { SecretSDK } from "@eigen-secret/core/dist-node/sdk";
import { Context } from "@eigen-secret/core/dist-node/context";
import {
    defaultServerEndpoint,
    defaultCircuitPath, defaultContractABI, defaultContractFile
} from "./common";
import { ErrCode } from "@eigen-secret/core/dist-node/error";
import { token } from "typechain/@openzeppelin/contracts";
require("dotenv").config()
const { buildEddsa } = require("circomlibjs");

task("ci", "Run all task in one command")
  .addParam("alias", "user alias", "Alice")
  .addParam("password", "password for key sealing", "<your password>")
  .setAction(async ({ alias, password }, { ethers }) => {
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let account = await ethers.getSigners();
    let user = account[0];
    const signature = await signEOASignature(user, rawMessage, user.address, timestamp);
    let signingKey = new SigningKey(eddsa);
    let accountKey = new SigningKey(eddsa);
    let newSigningKey1 = new SigningKey(eddsa);
    let newSigningKey2 = new SigningKey(eddsa);
    const contractJson = require(defaultContractFile);

    let sa = new SecretAccount(
        alias, accountKey, signingKey, accountKey, newSigningKey1, newSigningKey2
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
    if (proofAndPublicSignals.errno != ErrCode.Success) {
      console.log("createAccount failed: ", proofAndPublicSignals);
    }
    console.log("create account", proofAndPublicSignals.data);

    // set rollup nc
    await secretSDK.setRollupNC();
    console.log("setup Rollup NC done");

    // approve testToken
    await secretSDK.registerToken(contractJson.testToken);
    console.log("register token done")

    let assetId = await secretSDK.approveToken(contractJson.testToken);
    console.log("approve token done", assetId)

    let value = 1000n;
    let approveTx = await secretSDK.approve(contractJson.testToken, value);
    await approveTx.wait();

    let receiver = accountKey.pubKey.pubKey;
    let nonce = 0;
    value = 10n;

    let proof = await secretSDK.deposit(ctx, receiver, value, assetId, nonce);
    if (proof.errno != ErrCode.Success) {
      console.log("deposit failed: ", proof);
    }
    let balance1 = await secretSDK.getAllBalance(ctx);
    if (balance1.errno != ErrCode.Success) {
      console.log("getAllBalance failed: ", balance1);
    }
    console.log("test1-after deposit")
    console.log(balance1.data)
    console.log("CreateAccount done, proof: ", proofAndPublicSignals.data, proof.data);

    let proof1 = await secretSDK.send(ctx, receiver, alias, 2n, assetId);
    console.log("send proof", proof1.data);
    if (proof1.errno != ErrCode.Success) {
      console.log("send failed: ", proof1);
    }
    let balance2 = await secretSDK.getAllBalance(ctx);
    if (balance2.errno != ErrCode.Success) {
      console.log("getAllBalance failed: ", balance2);
    }
    console.log(balance2.data)

    let proof2 = await secretSDK.withdraw(ctx, receiver, 5n, assetId);
    if (proof2.errno != ErrCode.Success) {
      console.log("withdraw failed: ", proof2);
    }
    console.log("withdraw done, proof: ", proof2.data);
  })
