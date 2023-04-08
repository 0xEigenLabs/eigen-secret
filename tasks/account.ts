import { subtask, task } from "hardhat/config";
import { INIT } from "./task-names";
import { signEOASignature } from "../src/utils";
import { SigningKey } from "../src/account";
import { SecretSDK } from "../sdk/main";
import { RollupSC } from "../src/rollup.sc";
import { deploySpongePoseidon, deployPoseidons } from "../src/deploy_poseidons.util";
require("dotenv").config()
const path = require("path");
const circuitPath = path.join(__dirname, "../circuits/");
const { buildEddsa } = require("circomlibjs");
const assetId = 2;
const rawMessage = "Use Eigen Secret to shield your asset";

const eddsa = buildEddsa();
export const userAccount = async () =>{
    return {
        accountKey: new SigningKey(await eddsa, undefined),
        signingKey: new SigningKey(await eddsa, undefined)
    };
};

subtask(INIT, "Init contract and sdk for user")
  .addParam("alias")
  .setAction(async ( { alias }, { ethers } ) => {
    let account = await userAccount();
    let accountKey = account.accountKey;
    let signingKey = account.signingKey;
    console.log("init test------begin")
    console.log(accountKey)
    console.log(signingKey)

    let [admin] = await ethers.getSigners();
    let poseidonContracts = await deployPoseidons(
        ethers,
        admin,
        [2, 3, 6]
    );
    let contractJson = new Map<string, string>();
    console.log("Using account ", admin.address);
    contractJson.set("admin", admin.address);

    let spongePoseidon = await deploySpongePoseidon(ethers, poseidonContracts[2].address);
    contractJson.set("spongePoseidon", spongePoseidon.address);
    let factoryTR = await ethers.getContractFactory("TokenRegistry");
    let tokenRegistry = await factoryTR.deploy(admin.address)
    await tokenRegistry.deployed()
    console.log("tokenRegistry deployed to:", tokenRegistry.address);
    contractJson.set("tokenRegistry", tokenRegistry.address);

    let factoryR = await ethers.getContractFactory(
        "Rollup",
        {
            libraries: {
                SpongePoseidon: spongePoseidon.address
            }
        }
    );
    contractJson.set("poseidon2", poseidonContracts[0].address);
    contractJson.set("poseidon3", poseidonContracts[1].address);
    contractJson.set("poseidon6", poseidonContracts[2].address);
    let rollup = await factoryR.deploy(
        poseidonContracts[0].address,
        poseidonContracts[1].address,
        tokenRegistry.address
    );
    await rollup.deployed();
    console.log("rollup deployed to:", rollup.address);
    contractJson.set("rollup", rollup.address);

    let factoryTT = await ethers.getContractFactory("TestToken");
    let testToken = await factoryTT.connect(admin).deploy();
    await testToken.deployed();
    console.log("TestToken deployed to:", testToken.address);
    let testTokenAddress = testToken.address;
    contractJson.set("testToken", testTokenAddress);

    console.log(contractJson);
    const rollupSC = new RollupSC(eddsa, alias, admin, rollup, tokenRegistry, testToken, spongePoseidon,
      spongePoseidon.address, testToken.address,
      poseidonContracts[0].address, poseidonContracts[0].address,
      poseidonContracts[0].address, rollup.address, testToken.address);

    const secretSDK = new SecretSDK(alias, accountKey, signingKey, "http://127.0.0.1:3000", circuitPath, rollupSC);
    return (secretSDK)
  })

task("create-account", "Create account and first transaction depositing to itself")
  .addParam("alias", "user alias", "Alice")
  .addParam("value", "first deposit value", "10")
  .setAction(async ({ alias, value }, { run, ethers }) => {
    let secretSDK = await run(INIT, { alias });
    console.log(secretSDK)
    console.log("init test------end")

    await secretSDK.deploy();
    console.log("deploy test------end")

    let timestamp = Math.floor(Date.now()/1000).toString();
    let [user] = await ethers.getSigners();
    // const newEOAAccount = ethers.Wallet.createRandom();
    const signature = await signEOASignature(user, rawMessage, user.address, alias, timestamp);
    let accountKey = secretSDK.accountKey;
    let signingKey = secretSDK.signingKey;
    let newSigningKey1 = new SigningKey(await eddsa, undefined);
    let newSigningKey2 = new SigningKey(await eddsa, undefined);
    const ctx = {
      alias: alias,
      ethAddress: user.address,
      rawMessage: rawMessage,
      timestamp: timestamp,
      signature: signature,
      signingKey: signingKey,
      accountKey: accountKey
    };
    let proofAndPublicSignals = await secretSDK.createAccount(ctx, newSigningKey1, newSigningKey2);
    let receiver = accountKey.pubKey.pubKey;
    let nonce = 0;
    let proof = await secretSDK.deposit(ctx, receiver, value, assetId, nonce);
    let balance1 = await secretSDK.getBalance(ctx, assetId);
    console.log("test1-after deposit")
    console.log(balance1)
    console.log("CreateAccount done, proof: ", proofAndPublicSignals, proof);

    let proof1 = await secretSDK.send(ctx, receiver, "2", assetId);
    let balance2 = await secretSDK.getBalance(ctx, assetId);
    console.log("test2-after send")
    console.log(balance2)
    console.log("end2end send done, proof: ", proof1);

    let proof2 = await secretSDK.withdraw(ctx, receiver, "5", assetId);
    console.log("withdraw done, proof: ", proof2);
  })

