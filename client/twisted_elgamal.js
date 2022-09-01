const ffj = require("ffjavascript");
const buildEddsa = require("circomlibjs").buildEddsa;
const buildPoseidon = require("circomlibjs").buildPoseidon;
const buildBabyjub = require("circomlibjs").buildBabyjub;
const ethers = require("ethers");
const crypto = require("crypto");

module.exports = class TwistedElGamal {
  constructor(babyJub, eddsa) {
    this.babyJub = babyJub;
    this.eddsa = eddsa;
  }

  random(size) {
    return ethers.utils.randomBytes(size)
  }

  pubkey(sk) {
    return this.eddsa.prv2pub(sk)
  }

  encrypt(publicKey, H, amount) {
    const buf = crypto.randomBytes(32);
    const r = ffj.Scalar.shr(ffj.Scalar.fromRprLE(buf, 0, 32), 3)
    let c_l = this.babyJub.mulPointEscalar(publicKey, r)

    let c_r = this.babyJub.addPoint(
      this.babyJub.mulPointEscalar(this.babyJub.Base8, r),
      this.babyJub.mulPointEscalar(H, amount)
    );
    return {
      r: r,
      c_l: c_l,
      c_r: c_r
    }
  }

  decrypt(sk, c_l, c_r) {
    throw new Exception("not implemented")
  }
}
