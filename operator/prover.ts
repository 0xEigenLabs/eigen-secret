import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
import { ethers } from 'ethers';
import consola from "consola";
const path = require("path");
const exec = require('child_process').exec;
const { mkdirSync, existsSync, readFileSync, writeFileSync } = require("fs");
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

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) return reject(error)
      if (stderr) return reject(stderr)
      resolve(stdout)
    })
  })
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

const generateInput = async (accArray, txArray, curTime) => {
    await treeHelper.initialize()
    let mimcjs = await buildMimc7();

    let F = mimcjs.F;

    let zeroAccount = new Account();
    await zeroAccount.initialize();
    
    const paddedAccounts = treeHelper.padArray(accArray, zeroAccount, numLeaves);
    const accountTree = new AccountTree(paddedAccounts)
    
    const txTree = new TxTree(txArray)
    const stateTransaction = await accountTree.processTxArray(txTree);
    const txRoot = F.toString(stateTransaction.txTree.root)
    const inputs = await getCircuitInput(stateTransaction);

    const inputPath = join(TEST_PATH, "inputs", curTime + ".json")

    writeFileSync(
        inputPath,
        JSON.stringify(inputs),
        "utf-8"
    );
    return {inputPath, txRoot};
}

const join = (base, ...pathes) => {
    let filename = path.join(base, ...pathes)

    const finalPath = path.dirname(filename)
    if (!existsSync(finalPath)) {
        mkdirSync(finalPath)
    }
    return filename
}

export async function prove(accArray, txArrary) {
    // generate input
    const curTime = Date.now().toString()
    const {inputPath, txRoot} = await generateInput(accArray, txArrary, curTime);
    const outputPath = join(TEST_PATH, "witness", curTime+".wtns")

    // generate witness
    await generateWitness(inputPath, outputPath, "update_state_verifier")

    // use cmd to export verification key
    let zkey = path.join(CIRCUIT_PATH, "setup_2^20.key");
    const vk = join(TEST_PATH, "vk", curTime+"_vk.bin")
    const cmd1 = ZKIT + " export_verification_key -s " + zkey + " -c " + CIRCUIT_PATH + "update_state_verifier_js/"  + UPDATE_STATE_CIRCUIT_NAME + ".r1cs -v " + vk;
    console.log(cmd1)
    let result = await run(cmd1);
    console.log(result)

    // use cmd to generate proof
    let proof = join(TEST_PATH, "proof", curTime+"_proof.bin")
    let publicJson = join(TEST_PATH, "public", curTime+"_public.json")
    let proofJson = join(TEST_PATH, "proof", curTime+"_proof.json")
    const cmd2 = ZKIT + " prove -c " + CIRCUIT_PATH + "update_state_verifier_js/" + UPDATE_STATE_CIRCUIT_NAME + ".r1cs -w " + outputPath + " -s " + zkey + " -b " + proof + " -j " + proofJson + " -p " + publicJson;
    console.log(cmd2)
    result = await run(cmd2);
    console.log(result)
    return {vk, proof, proofJson, publicJson, txRoot};
}

export async function verify(vk, proof) {
    const cmd = ZKIT + " verify -p " + proof + " -v " + vk;
    console.log(cmd)
    const result = await run(cmd);
    return result.toString().startsWith('Proof is valid');
}
