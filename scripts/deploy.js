const {BigNumber, ContractFactory} = require("ethers");
const hre = require('hardhat')
const assert = require('assert');
const cls = require("circomlibjs");

async function main() {
  accounts = await hre.ethers.getSigners()
  console.log("account address:", accounts[0].address)
  const SEED = "mimc";
  let abi = cls.mimc7Contract.abi
  let createCode = cls.mimc7Contract.createCode
  let factory = new ContractFactory(
      abi, createCode(SEED, 91), accounts[0]
  )
  mimc = await factory.deploy()

  factory = await ethers.getContractFactory("MiMCMerkle");
  miMCMerkle = await factory.deploy(mimc.address)
  await miMCMerkle.deployed()

  factory = await ethers.getContractFactory("TokenRegistry");
  tokenRegistry = await factory.deploy(accounts[0].address)
  await tokenRegistry.deployed()
  console.log("tokenRegistry address:", tokenRegistry.address)

  factory = await ethers.getContractFactory("RollupNC");
  rollupNC = await factory.deploy(mimc.address, miMCMerkle.address, tokenRegistry.address)
  await rollupNC.deployed()
  console.log("rollupNC address:", rollupNC.address)

  factory = await ethers.getContractFactory("TestToken");
  testToken = await factory.connect(accounts[0]).deploy()
  await testToken.deployed()
  console.log("testToken address:", testToken.address)
  
  let setRollupNC = await tokenRegistry.connect(accounts[0]).setRollupNC(rollupNC.address);

  let registerToken = await rollupNC.connect(accounts[0]).registerToken(testToken.address);

  let approveToken = await rollupNC.connect(accounts[0]).approveToken(testToken.address);

  let approve = await testToken.connect(accounts[0]).approve(rollupNC.address, 1700);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })