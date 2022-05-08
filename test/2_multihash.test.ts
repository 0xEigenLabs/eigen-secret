const {waffle, ethers} = require("hardhat");
import { ContractFactory, BigNumber} from "ethers";
const hre = require('hardhat')
const assert = require('assert');
const cls = require("circomlibjs");
import { expect } from "chai";

/*
    Here we want to test the smart contract's deposit functionality.
*/

describe("Test Multihash", () => {
    let accounts;
    let rollupNC;
    let tokenRegistry;
    let testToken;
    let mimc;
    let mimcjs;
    let miMCMerkle;

    before(async function () {
        accounts = await hre.ethers.getSigners()

        const SEED = "mimc";
        let abi = cls.mimc7Contract.abi
        let createCode = cls.mimc7Contract.createCode
        let factory = new ContractFactory(
            abi, createCode(SEED, 91), accounts[0]
        )
        mimc = await factory.deploy();
        factory = await ethers.getContractFactory("MiMCMerkle");
        miMCMerkle = await factory.deploy(mimc.address)
        await miMCMerkle.deployed()

        mimcjs = await cls.buildMimc7();

    })

    it("test multi hash", async () => {
        let arr = [0, 0, 0, 0];
        let mh1 = mimcjs.multiHash(arr)
        let mh11 = await miMCMerkle.multiHashMiMC(arr);
        expect(mimcjs.F.toString(mh1)).to.eq(mh11.toString());

        let size = 500;
        for (var i = 0; i < 10; i ++) {
            arr = Array(size).fill(1).map(v => Math.floor(Math.random() * 0xffffffff))
            mh1 = mimcjs.multiHash(arr)
            mh11 = await miMCMerkle.multiHashMiMC(arr);
            expect(mimcjs.F.toString(mh1)).to.eq(mh11.toString());
        }
    })

})

