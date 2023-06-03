import { task } from "hardhat/config";
import { signEOASignature, rawMessage } from "@eigen-secret/core/dist-node/utils";
const fs = require("fs");
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
    let sdk: SecretSDK = secretSDKResult.data;
    await sdk.registerToken(token);
    let assetId = await sdk.approveToken(token);
    let result = await sdk.createAsset(ctx, token, assetId.toString());
    fs.writeFileSync(".asset.json", JSON.stringify(result.data))
    console.log(result)
})

task("send-l1", "Send asset from L1 to L1")
.addParam("alias", "user name", "Alice")
.addParam("value", "transaction amount")
.addParam("receiver", "receiver ETH address")
.addParam("assetId", "asset id")
.addParam("password", "password for key sealing", "<your password>")
.setAction(async ({ alias, value, receiver, assetId, password }, { ethers }) => {
    let timestamp = Math.floor(Date.now()/1000).toString();
    assetId = Number(assetId);
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
    let sdk: SecretSDK = secretSDK.data;
    // get token address
    let address = await sdk.getRegisteredToken(assetId);
    let tokenIns = new ethers.Contract(
        address,
        defaultContractABI.testTokenContractABI,
        admin
    );

    let tokenInfo = await sdk.getTokenInfo(address)
    value = await sdk.parseValue(ctx, value, Number(tokenInfo.decimals))
    console.log(value);
    let tx: any;
    if (assetId > 1) {
        tx = await tokenIns.transfer(receiver, BigInt(value));
        await tx.wait();
    } else if (assetId == 1) {
        console.log(admin.address, receiver, value);
        tx = await admin.sendTransaction({
            from: admin.address,
            to: receiver,
            value: value
        })
        await tx.wait();
    }

    let balance = await sdk.getL1Balance(ctx, address, admin, Number(tokenInfo.decimals));
    console.log("balance", balance.data.toString());
});

task("update-assets", "Update asset price")
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
    let sdk: SecretSDK = secretSDK.data;
    await sdk.updateAssets(ctx);
    console.log("The task to update the assets price is running")
})
