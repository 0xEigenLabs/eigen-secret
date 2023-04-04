import { ethers } from "hardhat";
import { RollupHelper } from "../test/rollup.helper";
import { deploySpongePoseidon, deployPoseidons, deployPoseidonFacade } from "../test/deploy_poseidons.util";

const contractFile = ".contract.json";
const fs = require("fs");

const deploy = async() => {
    let [admin] = await ethers.getSigners();
    let poseidonContracts = await deployPoseidons(
        admin,
        [2, 3, 6]
    );
    let contractJson = new Map<string, string>();
    console.log("Using account ", admin.address);
    contractJson.set("admin", admin.address);

    let spongePoseidon = await deploySpongePoseidon(poseidonContracts[2].address);
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
                SpongePoseidon: spongePoseidon.address,
            }
        }
    );
    contractJson.set("poseidon2", poseidonContracts[0].address);
    contractJson.set("poseidon3", poseidonContracts[1].address);
    contractJson.set("poseidon6", poseidonContracts[2].address);
    let rollup = await factoryR.deploy(
        poseidonContracts[0].address,
        poseidonContracts[1].address,
        tokenRegistry.address,
    );
    await rollup.deployed();
    console.log("rollup deployed to:", rollup.address);
    contractJson.set("rollup", rollup.address);

    let factoryTT = await ethers.getContractFactory("TestToken");
    let testToken = await factoryTT.connect(admin).deploy();
    await testToken.deployed();
    console.log("TestToken deployed to:", testToken.address);
    contractJson.set("testToken", testToken.address);

    console.log(contractJson);
    fs.writeFileSync(contractFile, JSON.stringify(Object.fromEntries(contractJson)))
}


async function main() {
    await deploy();
    console.log("Done");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
