require('dotenv').config()
const { utils } = require('ethers');
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
const ff = require("ffjavascript");
const unstringifyBigInts = ff.utils.unstringifyBigInts

const ZKIT = process.env.ZKIT || "zkit"
const CIRCUIT_PATH = process.env.CIRCUIT_PATH || ""
const TEST_PATH = process.env.TEST_PATH || ""
const UPDATE_STATE_CIRCUIT_NAME = "update_state_verifier"
const ACCOUNT_DEPTH = 4 // FIXME: We set account depth to 4 in the zkzru demo. Should set in .env later.
const WITHDRAW_SIGNATURE_CIRCUIT_NAME = 'withdraw_signature_verifier'
const numLeaves = 2**ACCOUNT_DEPTH;
const TXS_PER_SNARK = 4;

const fromHexString = (hexString) =>
  Uint8Array.from(hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));

const toHexString = (bytes) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) return reject(error)
      if (stderr) return reject(stderr)
      resolve(stdout)
    })
  })
}

function parsePublicKey(uncompressKey) {
  uncompressKeyStr = uncompressKey.toString()
  if (!uncompressKeyStr.startsWith("0x04")) {
    throw new Error("Invalid public key:" + uncompressKey)
  }
  const address = utils.computeAddress(uncompressKeyStr)
  const xy = uncompressKey.substr(4)
  const x = xy.substr(0, 64)
  const y = xy.substr(64)

  return {"address": address, "x": x, "y": y}
}


async function generateWitness (inputPath, outputPath, circuitName) {
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

async function generateInput (accArray, txArray, curTime) {
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
  console.log("Generate input.json successfully in:", inputPath)

  return {inputPath, txRoot};
}

async function generateWithdrawSignatureInput(pubkey, sig, msg, curTime) {
  let mimcjs = await buildMimc7();
  let F = mimcjs.F;
  const inputs = {
    Ax: F.toString(pubkey[0]),
    Ay: F.toString(pubkey[1]),
    R8x: F.toString(sig.R8[0]),
    R8y: F.toString(sig.R8[1]),
    S: sig.S.toString(),
    M: F.toString(msg)
  }

  const inputPath = join(TEST_PATH, "withdraw_signature_inputs", curTime + ".json")

  writeFileSync(
    inputPath,
    JSON.stringify(inputs),
    "utf-8"
  );

  return inputPath;
}

function join (base, ...pathes) {
  let filename = path.join(base, ...pathes)

  const finalPath = path.dirname(filename)
  if (!existsSync(finalPath)) {
    mkdirSync(finalPath, true)
  }
  return filename
}


module.exports = {

  async parseDBData(accountInDB, txInDB) {
    let accArray = new Array()
    for (var i = 0; i < accountInDB.length; i ++) {
      const acc = accountInDB[i]
      let account;
      if (acc["pubkey"] == "0") {
        account = new Account();
      } else {
        const pk = parsePublicKey(acc["pubkey"])
        account = new Account(
          acc["account_index"],
          fromHexString(pk["x"]),
          fromHexString(pk["y"]),
          BigInt(acc["balance"]),
          acc["nonce"],
          acc["tokenType"],
        )
      }
      await account.initialize()
      accArray.push(account)
    }

    if (txInDB.length != TXS_PER_SNARK) {
      throw new Error("Invalid tx batch length:" + txInDB.length)
    }
    var txArray= Array(TXS_PER_SNARK);
    for (var i=0; i < txInDB.length; i++) {
      var res = txInDB[i]
      var tx;
      var senderPK = parsePublicKey(res["senderPubkey"])
      if (res["receiverPubkey"] == "0") {
        tx = new Transaction(
          fromHexString(senderPK["x"]),
          fromHexString(senderPK["y"]),
          res["from_index"],
          0,
          0,
          res["nonce"],
          BigInt(res["amount"]),
          res["tokenTypeFrom"],
          fromHexString(res["r8x"]),
          fromHexString(res["r8y"]),
          unstringifyBigInts(res["s"])
        )
      } else {
        var receiverPK = parsePublicKey(res["receiverPubkey"])
        tx = new Transaction(
          fromHexString(senderPK["x"]),
          fromHexString(senderPK["y"]),
          res["from_index"],
          fromHexString(receiverPK["x"]),
          fromHexString(receiverPK["y"]),
          res["nonce"],
          BigInt(res["amount"]),
          res["tokenTypeFrom"],
          fromHexString(res["r8x"]),
          fromHexString(res["r8y"]),
          unstringifyBigInts(res["s"])
        )
      }

      await tx.initialize();
      tx.hashTx();

      txArray[i] = tx;
    }
    return {accArray, txArray}
  },

  async prove(accArray, txArrary) {
    // generate input
    const curTime = Date.now().toString()
    const {inputPath, txRoot} = await generateInput(accArray, txArrary, curTime);
    const outputPath = join(TEST_PATH, "witness", curTime+".wtns")

    // generate witness
    await generateWitness(inputPath, outputPath, "update_state_verifier")

    // use cmd to export verification key
    let zkey = path.join(CIRCUIT_PATH, "setup_2^20.key");
    const vk = join(TEST_PATH, "vk", curTime+"_vk.bin")
    const cmd1 = ZKIT + " export_verification_key -s " + zkey + " -c " + CIRCUIT_PATH + UPDATE_STATE_CIRCUIT_NAME + ".r1cs -v " + vk;
    console.log(cmd1)
    let result = await run(cmd1);
    console.log(result)

    // use cmd to generate proof
    let proof = join(TEST_PATH, "proof", curTime+"_proof.bin")
    let publicJson = join(TEST_PATH, "public", curTime+"_public.json")
    let proofJson = join(TEST_PATH, "proof", curTime+"_proof.json")
    const cmd2 = ZKIT + " prove -c " + CIRCUIT_PATH + UPDATE_STATE_CIRCUIT_NAME + ".r1cs -w " + outputPath + " -s " + zkey + " -b " + proof + " -j " + proofJson + " -p " + publicJson;
    console.log(cmd2)
    result = await run(cmd2);
    console.log(result)
    let inputJson = inputPath
    return {vk, proof, inputJson, proofJson, publicJson, txRoot};
  },

  async verify(vk, proof) {
    const cmd = ZKIT + " verify -p " + proof + " -v " + vk;
    console.log(cmd)
    const result = await run(cmd);
    return result.toString().startsWith('Proof is valid');
  },

  async proveWithdrawSignature(pubkey, sig, msg) {
    // generate input
    const curTime = Date.now().toString()
    const inputPath = await generateWithdrawSignatureInput(pubkey, sig, msg, curTime);
    const outputPath = join(TEST_PATH, "withdraw_signature_witness", curTime+".wtns")

    // generate witness
    await generateWitness(inputPath, outputPath, "withdraw_signature_verifier")

    // use cmd to export verification key
    let zkey = path.join(CIRCUIT_PATH, "setup_2^20.key");
    const vk = join(TEST_PATH, "withdraw_signature_vk", curTime+"_vk.bin")
    const cmd1 = ZKIT + " export_verification_key -s " + zkey + " -c " + CIRCUIT_PATH + WITHDRAW_SIGNATURE_CIRCUIT_NAME + ".r1cs -v " + vk;
    console.log(cmd1)
    let result = await run(cmd1);
    console.log(result)

    // use cmd to generate proof
    let proof = join(TEST_PATH, "withdraw_signature_proof", curTime+"_proof.bin")
    let publicJson = join(TEST_PATH, "withdraw_signature_public", curTime+"_public.json")
    let proofJson = join(TEST_PATH, "withdraw_signature_proof", curTime+"_proof.json")
    const cmd2 = ZKIT + " prove -c " + CIRCUIT_PATH + WITHDRAW_SIGNATURE_CIRCUIT_NAME + ".r1cs -w " + outputPath + " -s " + zkey + " -b " + proof + " -j " + proofJson + " -p " + publicJson;
    console.log(cmd2)
    result = await run(cmd2);
    console.log(result)
    return {vk, proof, proofJson};
  },

  async verifyWithdrawSignature(vk, proof) {
    const cmd = ZKIT + " verify -p " + proof + " -v " + vk;
    console.log(cmd)
    const result = await run(cmd);
    return result.toString().startsWith('Proof is valid');
  },
}
