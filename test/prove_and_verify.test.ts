const {waffle, ethers} = require("hardhat");
import { ContractFactory, BigNumber} from "ethers";
const hre = require('hardhat')
const assert = require('assert');
const cls = require("circomlibjs");
const Account = require("../src/account.js");
const Transaction = require("../src/transaction.js");

import {prove, verify} from "../operator/prover";
import { gConfig } from "../operator/config";
import treeHelper from "../src/treeHelper";

import {Blob} from "buffer";

const ACCOUNT_DEPTH = gConfig.account_depth;
const TXS_PER_SNARK = gConfig.txs_per_snark;
const NUM_LEAVES = 2 ** ACCOUNT_DEPTH;

function generatePrvkey(i){
    let prvkey = Buffer.from(i.toString().padStart(64,'0'), "hex");
    return prvkey;
}


describe("Prover generates proof and verify", () => {
    // let accounts;
    // let rollupNC;
    // let tokenRegistry;
    // let testToken;
    // let mimc;
    // let miMCMerkle;
    let eddsa;

    before(async function () {
        // accounts = await hre.ethers.getSigners()

        // const SEED = "mimc";
        // let abi = cls.mimc7Contract.abi
        // let createCode = cls.mimc7Contract.createCode
        // let factory = new ContractFactory(
        //     abi, createCode(SEED, 91), accounts[0]
        // )
        // mimc = await factory.deploy()

        // factory = await ethers.getContractFactory("MiMCMerkle");
        // miMCMerkle = await factory.deploy(mimc.address)
        // await miMCMerkle.deployed()

        // factory = await ethers.getContractFactory("TokenRegistry");
        // tokenRegistry = await factory.deploy(accounts[0].address)
        // await tokenRegistry.deployed()

        // factory = await ethers.getContractFactory("RollupNC");
        // rollupNC = await factory.deploy(mimc.address, miMCMerkle.address, tokenRegistry.address)
        // await rollupNC.deployed()

        // factory = await ethers.getContractFactory("TestToken");
        // testToken = await factory.connect(accounts[3]).deploy()
        // await testToken.deployed()

        eddsa = await cls.buildEddsa();
    });

    // ----------------------------------------------------------------------------------

    it("should generate proof and verify", async () => {
        // mock the account and transaction data
        // generate 8 accounts
        let zeroAccount = new Account();
        await zeroAccount.initialize();
        var accArray = [zeroAccount]

        const coordinatorPrvkey = generatePrvkey(1);
        const coordinatorPubkey = generatePubkey(coordinatorPrvkey);
        const coordinator = new Account(
            1, coordinatorPubkey[0], coordinatorPubkey[1],
            0, 0, 0, coordinatorPrvkey
        );
        await coordinator.initialize()

        accArray.push(coordinator);

        const numAccounts = 6
        const tokenTypes = [2, 1, 2, 1, 2, 1];
        const balances = [1000, 20, 200, 100, 500, 20];
        const nonces = [0, 0, 0, 0, 0, 0];

        function generatePubkey(prvkey){
            let pubkey = eddsa.prv2pub(prvkey);
            return pubkey;
        }
        
        for (var i = 0; i < numAccounts; i++) {
            var prvkey = generatePrvkey(i + 2);
            var pubkey = generatePubkey(prvkey);
            var account = new Account(
                i + 2, // index
                pubkey[0], // pubkey x coordinate
                pubkey[1], // pubkey y coordinate
                balances[i], // balance
                nonces[i], // nonce
                tokenTypes[i], // tokenType,
                prvkey
            )
            await account.initialize()
            accArray.push(account);
        }

        // const paddedAccounts = treeHelper.padArray(accArray, zeroAccount, NUM_LEAVES)
        console.log("hi there there")
        // generate 4 txs
        let fromAccountsIdx = [2, 4, 3, 1]
        let toAccountsIdx = [4, 0, 5, 0]

        const amounts = [500, 200, 10, 0]
        const txTokenTypes = [2, 2, 1, 0]
        const txNonces = [0, 0, 0, 0]

        var txArray = new Array(TXS_PER_SNARK)

        for (var i = 0; i < txArray.length; i++){
            let fromAccount = accArray[fromAccountsIdx[i]];
            let toAccount = accArray[toAccountsIdx[i]];
            let tx = new Transaction(
            fromAccount.pubkeyX,
            fromAccount.pubkeyY,
            fromAccount.index,
            toAccount.pubkeyX,
            toAccount.pubkeyY,
            txNonces[i],
            amounts[i],
            txTokenTypes[i]
            );
            await tx.initialize()

            tx.hashTx();
            tx.signTxHash(fromAccount.prvkey);

            tx.checkSignature()

            txArray[i] = tx;
        }

        let {vk, proof} = await prove(accArray, txArray);

        verify(vk, proof);
    });
});