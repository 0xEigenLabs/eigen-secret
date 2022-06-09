import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
import { ethers } from 'ethers';
import consola from "consola";
const path = require("path");
const exec = require('child_process').exec;
const { readFileSync, writeFileSync } = require("fs");

const getCircuitInput = require("../src/circuitInput");

const Transaction = require("../src/.transaction");
const AccountTree = require("../src/accountTree");
const Account = require("../src/account");
const treeHelper = require("../src/treeHelper");

const buildMimc7 = require("circomlibjs").buildMimc7;
const buildBabyJub = require("circomlibjs").buildBabyJub;
const buildEddsa = require("circomlibjs").buildEddsa;

import * as txdb from "./model/tx";
import * as accountdb from "./model/account";
import * as tokendb from "./model/token";

dotenvConfig({path: resolve(__dirname, "./.env")});

const TX_DEPTH = 2
const BAL_DEPTH = 4
const numLeaves = 2**BAL_DEPTH;

const ZKIT = process.env.ZKIT || process.exit(-1)
const CIRCUIT_PATH = process.env.CIRCUIT_PATH || process.exit(-1)

function run(cmd: string, ) {
    exec(cmd, (err, stdout, stderr) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(stdout);
    });
}

const generateWitness = async(inputPath, outputPath, circuitName) => {
    let wasm = path.join(CIRCUIT_PATH, circuitName+"_js",  circuitName+".wasm");
    let zkey = path.join(CIRCUIT_PATH, "setup_2^20.key");
    let requirePath = path.join(CIRCUIT_PATH, circuitName + "_js", "witness_calculator")
    const wc = require(requirePath);

    const input = JSON.parse(readFileSync(inputPath, "utf8"));
    const witnessBuffer = await wc.calculateWTNSBin(
        input,
        0
    );

    const buff= await wc.calculateWTNSBin(input,0);
    writeFileSync(outputPath, buff, "utf-8");
}

const parsePublicKey = (uncompressKey) => {
    if (!uncompressKey.startWith("04")) {
        throw new Error("Invalid public key:" + uncompressKey)
    }
    const address = ethers.utils.computeAddress(uncompressKey)
    const xy = uncompressKey.substr(2)
    const x = xy.substr(0, 32)
    const y = xy.substr(32)

    return {"address": address, "x": x, "y": y}
}

const generateInput = async () => {

    await treeHelper.initialize()
    let eddsa = await buildEddsa();
    let mimcjs = await buildMimc7();

    let F = mimcjs.F;

    let zeroAccount = new Account();
    await zeroAccount.initialize();
    // 1. construct account tree
    const accountsInDB = await accountdb.findAll({})
    let accounts = new Array()
    for (var i = 0; i < accountsInDB.length; i ++) {
        const acc = accountsInDB[i]
        const pk = parsePublicKey(acc["pubkey"])
        const account = new Account(
            acc["index"],
            pk["x"],
            pk["y"],
            acc["balance"],
            acc["nonce"],
            acc["tokenType"],
            undefined, //private key
        )
        await account.initialize()
        accounts.push(account)
    }
    const paddedAccounts = treeHelper.padArray(accounts, zeroAccount, numLeaves);
    // 2. retrieve all tx
    const txs = await txdb.findAll({})
    if (txs.length % 2 != 0) {
        console.log("tx total number should be even")
    }

    for (var i = 0; i < txs.length; i++) {
        const sender = parsePublicKey(txs[i]["senderPubkey"])
        const receiver = parsePublicKey(txs[i]["receiverPubkey"])
        const tx = new Transaction(
            sender["x"],
            sender["y"],
            txs["index"],
            receiver["x"],
            receiver["y"],
            txs[i]["nonce"],
            txs[i]["amount"],
            txs[i]["tokenType"],
        )
    }
}


function prove() {
}

