import { ethers } from "hardhat";
import { RollupHelper } from "../test/rollup.helper";
import { deploySpongePoseidon, deployPoseidons, deployPoseidonFacade } from "../test/deploy_poseidons.util";

const contractAddress = ".contract.json";
const fs = require("fs");

const deploy = async() => {
    let [admin] = await ethers.getSigners();
    let poseidonContracts = await deployPoseidons(
        admin,
        [2, 3, 6]
    );
    console.log("Using account ", admin.address);

    let spongePoseidon = await deploySpongePoseidon(poseidonContracts[2].address);
    let factoryTR = await ethers.getContractFactory("TokenRegistry");
    let tokenRegistry = await factoryTR.deploy(admin.address)
    await tokenRegistry.deployed()

    let factoryR = await ethers.getContractFactory(
        "Rollup",
        {
            libraries: {
                SpongePoseidon: spongePoseidon.address,
            }
        }
    );
    let rollup = await factoryR.deploy(
        poseidonContracts[0].address,
        poseidonContracts[1].address,
        tokenRegistry.address,
    );
    await rollup.deployed();
    console.log("Done");
}


const deployTestToken = async() => {
    let [admin] = await ethers.getSigners();

    let factoryTT = await ethers.getContractFactory("TestToken");
    let testToken = await factoryTT.connect(admin).deploy();
    await testToken.deployed();
    console.log("Done");
}


async function main() {
    await deploy();
    await deployTestToken();
    console.log("Done");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
