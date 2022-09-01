const ffj = require("ffjavascript");
const buildEddsa = require("circomlibjs").buildEddsa;
const buildPoseidon = require("circomlibjs").buildPoseidon;
const buildBabyjub = require("circomlibjs").buildBabyjub;
const fs = require("fs");
const fromHexString = hexString =>
  new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

const Scalar = ffj.Scalar;
let eddsa
let poseidon

const printP = (msg, p, F) => {
  console.log(msg,
    F.toString(p[0]),
    F.toString(p[1]),
  )
}

const main = async (outputPath) => {
  eddsa = await buildEddsa()
  poseidon = await buildPoseidon();
  babyJub = await buildBabyjub();
  let F = poseidon.F

  var prvKey = Buffer.from("4".padStart(64,'0'), "hex");
  var pubKey = eddsa.prv2pub(prvKey);

  var nonce = 0;
  var recipient = BigInt('0xC33Bdb8051D6d2002c0D80A1Dd23A1c9d9FC26E4');
  var m = poseidon([nonce, recipient])
  const msg = F.e(m);

  var signature = eddsa.signPoseidon(prvKey, msg);

  var verify = eddsa.verifyPoseidon(msg, signature, pubKey)
  console.log(verify)

  let r_h = 122121;
  let H = babyJub.mulPointEscalar(babyJub.Base8, r_h)

  let r = 10;
  let amount = 100;

  let c_l = babyJub.mulPointEscalar(pubKey, r)
  printP("c_l", c_l, F);

  let c_r = babyJub.addPoint(
    babyJub.mulPointEscalar(babyJub.Base8, r),
    babyJub.mulPointEscalar(H, amount)
  );
  printP("c_r", c_r, F);

  let c_l_new = babyJub.addPoint(c_l, c_l);
  let c_r_new = babyJub.addPoint(c_r, c_r);
  printP("c_l_new", c_l_new, F);
  printP("c_r_new", c_r_new, F);

  let pk = [
    F.toString(pubKey[0]),
    F.toString(pubKey[1])
  ]
  const inputs = {
    senderPubkey: pk,
    senderBalance: 10000,
    receiverPubkey: pk,
    Max: 100000,
    amount: amount,
    r1: r,
    r2: r,
    H: [F.toString(H[0]),  F.toString(H[1])],
    C_S: [
      [F.toString(c_r[0]), F.toString(c_r[1])]
    ],
    C_R: [
      [F.toString(c_r[0]), F.toString(c_r[1])]
    ]
    /*,
    Ax: F.toString(pubKey[0]),
    Ay: F.toString(pubKey[1]),
    R8x: F.toString(signature.R8[0]),
    R8y: F.toString(signature.R8[1]),
    S: signature.S.toString(),
    M: F.toString(msg)
    */
  }

  fs.writeFileSync(
    outputPath + "/input.json",
    JSON.stringify(inputs),
    "utf-8"
  );
}

const args = process.argv;
let path = ".";
if (args.length > 2) {
  path = args[2];
}
console.log(path);
main(path).then(() => {
  console.log("Done")
})
