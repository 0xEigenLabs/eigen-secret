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

import * as txdb from "./model/tx";
import * as accountdb from "./model/account";
import * as tokendb from "./model/token";

dotenvConfig({path: resolve(__dirname, "./.env")});


const ZKIT = process.env.ZKIT || process.exit(-1)
const CIRCUIT_PATH = global.gConfig.circuit_path
const UPDATE_STATE_CIRCUIT_NAME = global.gConfig.update_state_circuit_name
const numLeaves = 2**global.gConfig.account_depth;
const TXS_PER_SNARK = global.gConfig.txs_per_snark;

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
    const accountTree = new AccountTree(paddedAccounts)
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
    var txs= Array(TXS_PER_SNARK);
    for (var i=0; i < results.length; i++) {
        var res = results[i]
        var senderPK = parsePublicKey(res["senderPubkey"])
        var receiverPK = parsePublicKey(res["receiverPubkey"])
        var tx = new Transaction(
            senderPK["x"],
            senderPK["y"],
            res["index"],
            receiverPK["x"],
            receiverPK["y"],
            res["nonce"],
            res["amount"],
            res["tokenType"],
            res["r8x"],
            res["r8y"],
            res["s"]
        )
        await tx.initialize();
        tx.hashTx();
        txs[i] = tx;
    }

    const txTree = new TxTree(txs)
    const stateTransaction = await accountTree.processTxArray(txTree);
    const inputs = await getCircuitInput(stateTransaction);

    const path = "./test/inputs/" + Date.now() + ".json";

    writeFileSync(
        path,
        JSON.stringify(inputs),
        "utf-8"
    );
    return path;
}


async function prove() {
    // generate input
    const inputPath = await generateInput();
    const outputPath = "./test/witness/" + Date.now() + ".wtns";

    // generate witness
    await generateWitness(inputPath, outputPath, "update_state_verifier")

    // use cmd to export verification key
    let zkey = path.join(CIRCUIT_PATH, "setup_2^20.key");
    const cmd1 = ZKIT + " export_verification_key -s " + zkey + " -c " + CIRCUIT_PATH + UPDATE_STATE_CIRCUIT_NAME + ".r1cs -v " + CIRCUIT_PATH + "vk.bin";
    run(cmd1);

    // use cmd to generate proof
    const cmd2 = ZKIT + " prove -c " + CIRCUIT_PATH + UPDATE_STATE_CIRCUIT_NAME + ".r1cs -w " + outputPath + " -s " + zkey + " -b " + CIRCUIT_PATH + "proof.bin";
    run(cmd2);
}
