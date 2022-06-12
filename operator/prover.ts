import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
import { ethers } from 'ethers';
import consola from "consola";
const path = require("path");
const exec = require('child_process').exec;
const { readFileSync, writeFileSync } = require("fs");
const getCircuitInput = require("../src/circuitInput");
const Transaction = require("../src/transaction");
const AccountTree = require("../src/accountTree");
const Account = require("../src/account");
const treeHelper = require("../src/treeHelper");
const TxTree = require("../src/txTree");

const buildMimc7 = require("circomlibjs").buildMimc7;
const buildBabyJub = require("circomlibjs").buildBabyJub;
const buildEddsa = require("circomlibjs").buildEddsa;

dotenvConfig({path: resolve(__dirname, "./.env")});

import { gConfig } from "./config";

const ZKIT = process.env.ZKIT || process.exit(-1)
const CIRCUIT_PATH = process.env.CIRCUIT_PATH || process.exit(-1)
const TEST_PATH = process.env.TEST_PATH || process.exit(-1)
const UPDATE_STATE_CIRCUIT_NAME = gConfig.update_state_circuit_name
const numLeaves = 2**gConfig.account_depth;
const TXS_PER_SNARK = gConfig.txs_per_snark;

function run(cmd: string, ) {
    exec(cmd, {shell: '/usr/bin/zsh'}, (error, stdout, stderr) => {
        if (error) {
            console.error(error);
            return;
        }
        console.log(stdout);
        console.log(stderr);
    });
}

const generateWitness = async(inputPath, outputPath, circuitName) => {
    let wasm = path.join(CIRCUIT_PATH, circuitName+"_js",  circuitName+".wasm");
    let zkey = path.join(CIRCUIT_PATH, "setup_2^20.key");
    let requirePath = path.join(CIRCUIT_PATH, circuitName + "_js", "witness_calculator")
    const wc = require(requirePath);

    const buffer = readFileSync(wasm);
    const witnesssCalculator = await wc(buffer);

    const input = JSON.parse(readFileSync(inputPath, "utf8"));
    const witnessBuffer = await witnesssCalculator.calculateWTNSBin(
        input,
        0
    );

    //const buff= await wc.calculateWTNSBin(input,0);
    writeFileSync(outputPath, witnessBuffer, "utf-8");
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

const generateInput = async (accArray, txArray) => {
    await treeHelper.initialize()
    let eddsa = await buildEddsa();
    let mimcjs = await buildMimc7();

    let F = mimcjs.F;

    let zeroAccount = new Account();
    await zeroAccount.initialize();
    // 1. construct account tree
    //const accountsInDB = await accountdb.findAll({})
    // let accounts = new Array()
    // for (var i = 0; i < accArray.length; i ++) {
    //     const acc = accArray[i]
    //     const pk = parsePublicKey(acc["pubkey"])
    //     const account = new Account(
    //         acc["index"],
    //         pk["x"],
    //         pk["y"],
    //         acc["balance"],
    //         acc["nonce"],
    //         acc["tokenType"],
    //         undefined, //private key
    //     )
    //     await account.initialize()
    //     accounts.push(account)
    // }
    //const paddedAccounts = treeHelper.padArray(accounts, zeroAccount, numLeaves);
    const paddedAccounts = treeHelper.padArray(accArray, zeroAccount, numLeaves);
    const accountTree = new AccountTree(paddedAccounts)
    /*
    // 2. retrieve all tx
    let results = await txdb.findAll({
        where: {status: 0},
        limit: TXS_PER_SNARK,
        order: [['nonce', 'ASC']]
    });
    // update status
    for (var i=0; i < results.length; i++) {
        await results[i].update({status: 1});
        await results[i].save()
    }
    */
    // var txs= Array(TXS_PER_SNARK);
    // for (var i=0; i < txArrary.length; i++) {
    //     var res = txArrary[i]
    //     var senderPK = parsePublicKey(res["senderPubkey"])
    //     var receiverPK = parsePublicKey(res["receiverPubkey"])
    //     var tx = new Transaction(
    //         senderPK["x"],
    //         senderPK["y"],
    //         res["index"],
    //         receiverPK["x"],
    //         receiverPK["y"],
    //         res["nonce"],
    //         res["amount"],
    //         res["tokenType"],
    //         res["r8x"],
    //         res["r8y"],
    //         res["s"]
    //     )
    //     await tx.initialize();
    //     tx.hashTx();
    //     txs[i] = tx;
    // }

    // const txTree = new TxTree(txs)
    const txTree = new TxTree(txArray)
    const stateTransaction = await accountTree.processTxArray(txTree);
    const inputs = await getCircuitInput(stateTransaction);

    const path = TEST_PATH + "inputs/" + Date.now() + ".json";

    writeFileSync(
        path,
        JSON.stringify(inputs),
        "utf-8"
    );
    return path;
}

export async function prove(accArray, txArrary) {
    // generate input
    console.log(111)
    const inputPath = await generateInput(accArray, txArrary);
    console.log(222)
    const outputPath = TEST_PATH + "witness/" + Date.now() + ".wtns";
    console.log(outputPath)
    const WORKSPACE = "/tmp/zkit_zkzru_update_state/";

    // generate witness
    console.log(333)
    await generateWitness(inputPath, outputPath, "update_state_verifier")
    console.log(444)

    // use cmd to export verification key
    let zkey = path.join(CIRCUIT_PATH, "setup_2^20.key");
    let vk = TEST_PATH + "vk/" + Date.now() + "_vk.bin";
    const cmd1 = ZKIT + " export_verification_key -s " + zkey + " -c " + WORKSPACE + UPDATE_STATE_CIRCUIT_NAME + ".r1cs -v " + vk;
    console.log(cmd1)
    run(cmd1);
    console.log(555)

    // use cmd to generate proof
    let proof = TEST_PATH + "proof/" + Date.now() + "_proof.bin";
    const cmd2 = ZKIT + " prove -c " + WORKSPACE + UPDATE_STATE_CIRCUIT_NAME + ".r1cs -w " + outputPath + " -s " + zkey + " -b " + proof;
    console.log(cmd2)
    run(cmd2);
    console.log(666)
    return {vk, proof};
}

export function verify(vk, proof) {
    const cmd = ZKIT + " verify -p " + proof + " -v " + vk;
    console.log(cmd)
    run(cmd);
}
