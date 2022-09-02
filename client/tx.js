const ffj = require("ffjavascript");
const buildEddsa = require("circomlibjs").buildEddsa;
const buildPoseidon = require("circomlibjs").buildPoseidon;
const buildBabyjub = require("circomlibjs").buildBabyjub;
const TwistedElGamal = require("./twisted_elgamal.js");
const fs = require("fs");
const crypto = require("crypto");
const {prover} = require("@ieigen/plonkjs-node");
var path = require('path');

module.exports = class ZKTX {
  constructor(circuit_path) {
    this.eddsa = undefined;
    this.Scalar = ffj.Scalar;
    this.poseidon = undefined;
    this.F = undefined;
    this.twistedElGamal = undefined;
    this.circuit_path = circuit_path;
  }

  async initialize() {
    this.eddsa = await buildEddsa();
    this.poseidon = await buildPoseidon();
    this.babyJub = await buildBabyjub();
    this.F = this.poseidon.F;
    this.twistedElGamal = new TwistedElGamal(this.babyJub, this.eddsa);
  }

  // amount: BigInt
  // sender: address
  // receiver: address
  // nonce: BigInt
  async createTX(senderBalance, amount, senderPrvKey, nonce, tokenType, receiverPubKey) {
    // make input data
    const F = this.babyJub.F;
    const buf = crypto.randomBytes(32);
    const r_h = ffj.Scalar.shr(ffj.Scalar.fromRprLE(buf, 0, 32), 3);
    let H = this.babyJub.mulPointEscalar(this.babyJub.Base8, r_h)
    let senderPubKey = this.twistedElGamal.pubkey(senderPrvKey);
    const c_s = this.twistedElGamal.encrypt(senderPubKey, H, amount);
    const c_r = this.twistedElGamal.encrypt(receiverPubKey, H, amount);
    // make signature
    const pSenderPubKey = this.babyJub.packPoint(senderPubKey);
    const pReceiverPubKey = this.babyJub.packPoint(receiverPubKey);
    const msg = this.poseidon([pSenderPubKey, pReceiverPubKey, amount, nonce, tokenType]);
    const signature = this.eddsa.signPoseidon(senderPrvKey, msg);
    // make proof
    const proof = await this.createTxProof(senderPubKey, receiverPubKey, H, senderBalance, amount, c_s.r, c_r.r, c_s.c_r, c_r.c_r, msg, signature);

    return {
      signature: signature,
      proof: proof,
      c_s: c_s,
      c_r: c_r,
    }
  }

  async verifyTX(amount, senderPubKey, receiverPubKey, nonce, tokenType, signature, proof) {
    const pSenderPubKey = this.babyJub.packPoint(senderPubKey);
    const pReceiverPubKey = this.babyJub.packPoint(receiverPubKey);
    const msg = this.poseidon([pSenderPubKey, pReceiverPubKey, amount, nonce, tokenType]);
    const verified = this.eddsa.verifyPoseidon(msg, signature, senderPubKey);
    if (verified === false) {
      console.log("invalid signature");
      return false;
    }
    console.log(proof);
    let verify_ok = prover.verify(
      Array.from(proof.vk_bin),
      Array.from(proof.proof_bin),
      "keccak"
    )
    if (verify_ok === false) {
      console.log("invalid tx proof");
      return false;
    }
    return true;
  }

  async createTxProof(senderPubKey, receiverPubKey, H, senderBalance, amount, r, r2, c_s, c_r, msg, signature) {
    const F = this.babyJub.F;
    // TODO: fetch circuit, srs and wasm from eigen server
    let wasm = path.join(this.circuit_path, "zktx_js/zktx.wasm");
    let srs_monomial_form = path.join(this.circuit_path, "setup_2^15.key");
    let circuit_file = path.join(this.circuit_path, "zktx.r1cs");
    const wc = require(path.join(__dirname, "witness_calculator"));

    /* for web
    var reader = new FileReader();     // FileReader object
    reader.readAsArrayBuffer(wasm);
    var buffer = new Uint8Array(reader.result, 0, reader.result.byteLength);eader.readAsArrayBuffer(wasm);    // perform reading
    */
    const buffer = fs.readFileSync(wasm);

    const witnessCalculator = await wc(buffer);

    const input = {
      senderPubkey: [
        F.toString(senderPubKey[0]),
        F.toString(senderPubKey[1])
      ],
      receiverPubkey: [
        F.toString(receiverPubKey[0]),
        F.toString(receiverPubKey[1])
      ],
      amount: amount,
      senderBalance: senderBalance,
      Max: 2**31,
      r1: r,
      r2: r2,
      H: [F.toString(H[0]),  F.toString(H[1])],
      C_S: [
        [F.toString(c_s[0]), F.toString(c_s[1])]
      ],
      C_R: [
        [F.toString(c_r[0]), F.toString(c_r[1])]
      ]
    }

    const witnessBuffer = await witnessCalculator.calculateWTNSBin(
        input,
        0
    );
    console.log("begin to prove");
    let circuit_file_content = fs.readFileSync(circuit_file);
    let srs_monomial_form_content = fs.readFileSync(srs_monomial_form);
    let proof = prover.prove(
      circuit_file_content.toJSON().data,
      Array.from(witnessBuffer),
      srs_monomial_form_content.toJSON().data,
      "keccak"
    );

    // make vk
    let vk = prover.export_verification_key(
      srs_monomial_form_content.toJSON().data,
      circuit_file_content.toJSON().data,
    );

    return {
      proof_bin: proof.proof_bin,
      proof_json: proof.proof_json,
      public_json: proof.public_json,
      vk_bin: vk.vk_bin
    }
  }
}
