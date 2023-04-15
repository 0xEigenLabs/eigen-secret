import { task } from "hardhat/config";
import { deploySpongePoseidon, deployPoseidons } from "@eigen-secret/core/dist/deploy_poseidons.util";

import { defaultContractFile } from "./common";
const fs = require("fs");

task("deploy", "Deploy all smart contract")
      .addParam("testTokenAddress", "test token address, default none", "")
      .addParam("contractFile", "[output] contract address", defaultContractFile)
      .setAction(async ({ testTokenAddress, contractFile }, { ethers }) => {
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

    if (testTokenAddress == "") {
        let factoryTT = await ethers.getContractFactory("TestToken");
        let testToken = await factoryTT.connect(admin).deploy();
        await testToken.deployed();
        console.log("TestToken deployed to:", testToken.address);
        testTokenAddress = testToken.address;
    }
    contractJson.set("testToken", testTokenAddress);

    // DEBUG only
    let smtVerifierContractFactory = await ethers.getContractFactory("SMT");
    let smtVerifierContract = await smtVerifierContractFactory.deploy(
        poseidonContracts[0].address,
        poseidonContracts[1].address
    );
    await smtVerifierContract.deployed();
    contractJson.set("smtVerifier", smtVerifierContract.address);

    console.log(contractJson);
    fs.writeFileSync(contractFile, JSON.stringify(Object.fromEntries(contractJson)))
})
