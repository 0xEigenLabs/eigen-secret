import { task } from "hardhat/config";
import { signEOASignature, rawMessage } from "@eigen-secret/core/dist-node/utils";
import { Context } from "@eigen-secret/core/dist-node/context";
import {
    defaultServerEndpoint,
    defaultCircuitPath, defaultContractABI, defaultContractFile
} from "./common";
import { SecretSDK } from "@eigen-secret/core/dist-node/sdk";
import { ErrCode } from "@eigen-secret/core/dist-node/error";

task("setup-rollup", "Setup rollup coordinator")
.addParam("alias", "user alias", "Alice")
.addParam("password", "password for key sealing", "<your password>")
.setAction(async ({ alias, password }, { ethers }) => {
    let timestamp = Math.floor(Date.now()/1000).toString();
    let [admin] = await ethers.getSigners();
    const signature = await signEOASignature(admin, rawMessage, admin.address, timestamp);
    const ctx = new Context(alias, admin.address, rawMessage, timestamp, signature);
    const contractJson = require(defaultContractFile);
    let secretSDK = await SecretSDK.initSDKFromAccount(
        ctx, defaultServerEndpoint, password, admin, contractJson, defaultCircuitPath, defaultContractABI
    );
    if (secretSDK.errno != ErrCode.Success) {
        console.log("initSDKFromAccount failed: ", secretSDK);
      }
    // set rollup nc
    await secretSDK.data.setRollupNC();
    console.log("setup Rollup NC done");
})

task("register-token", "Register token to Rollup")
.addParam("alias", "user alias", "Alice")
.addParam("token", "the token to be registered")
.addParam("password", "password for key sealing", "<your password>")
.setAction(async ({ alias, token, password }, { ethers }) => {
    let timestamp = Math.floor(Date.now()/1000).toString();
    let [admin] = await ethers.getSigners();
    const signature = await signEOASignature(admin, rawMessage, admin.address, timestamp);
    const ctx = new Context(alias, admin.address, rawMessage, timestamp, signature);
    const contractJson = require(defaultContractFile);
    let secretSDKResult = await SecretSDK.initSDKFromAccount(
        ctx, defaultServerEndpoint, password, admin, contractJson, defaultCircuitPath, defaultContractABI
    );
    if (secretSDKResult.errno != ErrCode.Success) {
        console.log("initSDKFromAccount failed: ", secretSDKResult);
    }
    let secretSDK = secretSDKResult.data;
    await secretSDK.registerToken(token);
    let assetId = await secretSDK.approveToken(token);
    let result = await secretSDK.createAsset(ctx, token, assetId.toString());
    console.log("approve token done, asset is ", result)
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
    const signature = await signEOASignature(admin, rawMessage, admin.address, timestamp);
    const ctx = new Context(alias, admin.address, rawMessage, timestamp, signature);
    const contractJson = require(defaultContractFile);
    let secretSDK = await SecretSDK.initSDKFromAccount(
        ctx, defaultServerEndpoint, password, admin, contractJson, defaultCircuitPath, defaultContractABI
    );
    if (secretSDK.errno != ErrCode.Success) {
        console.log("initSDKFromAccount failed: ", secretSDK);
      }
    // get token address
    let address = await secretSDK.data.getRegisteredToken(BigInt(assetId));
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