import { task } from "hardhat/config";
import { signEOASignature } from "../src/utils";
import { SigningKey, SecretAccount } from "../src/account";
import { SecretSDK } from "../sdk/main";
require("dotenv").config()
const path = require("path");
const fs = require("fs");
const circuitPath = path.join(__dirname, "../circuits/");
const { buildEddsa } = require("circomlibjs");
import { defaultContractFile, defaultAccountFile } from "./common";
const createBlakeHash = require("blake-hash");

const assetId = 2;
const rawMessage = "Use Eigen Secret to shield your asset";

task("deposit", "Deposit asset from L1 to L2")
  .addParam("alias", "user alias", "Alice")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("value", "amount of transaction", "10")
  .addParam("receiver", "receiver account public key or alias", "Bob")
  .setAction(async ({ alias, password, value, receiver }, { ethers }) => {
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let [user] = await ethers.getSigners();
    // const newEOAAccount = ethers.Wallet.createRandom();
    const signature = await signEOASignature(user, rawMessage, user.address, alias, timestamp);
    let signingKey = new SigningKey(eddsa, undefined);
    let accountKey = new SigningKey(eddsa, undefined);
    const contractJson = require(defaultContractFile);
    let accountData = fs.readFileSync(defaultAccountFile);
    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    let sa = SecretAccount.deserialize(eddsa, key, accountData)
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
        contractJson.testToken
    );
    await secretSDK.initialize();
    const ctx = {
      alias: alias,
      ethAddress: user.address,
      rawMessage: rawMessage,
      timestamp: timestamp,
      signature: signature,
      signingKey: signingKey,
      accountKey: accountKey
    };
    let nonce = 0; // get nonce from Metamask
    let proofAndPublicSignals = await secretSDK.deposit(ctx, receiver, value, assetId, nonce);
    console.log(proofAndPublicSignals);
  })


// task("send", "send asset to receiver in L2")
// task("withdraw", "withdraw assert from L2 to L1")
