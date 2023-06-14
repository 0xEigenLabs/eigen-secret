import * as test from "./test";
let EC = require("elliptic").ec;
const ec = new EC("secp256k1");
import { BigNumberish, utils, Wallet } from "ethers";
import { formatMessage, calcPubKeyPoint, signEOASignature } from "@eigen-secret/core/dist-node/utils";
import { splitToRegisters, calculateEffECDSACircuitInput, registersToHex } from "./secp256k1_utils";

export const getEffEcdsaCircuitInput = async (EOAAccount: any) => {
  // sign
  let ethAddress = EOAAccount.address;
  let timestamp = Math.floor(Date.now()/1000).toString();
  let strSig = await signEOASignature(EOAAccount, ethAddress, timestamp)

  const sig = utils.splitSignature(strSig);
  const r = BigInt(sig.r);
  const v = BigInt(sig.v);

  // recover public key
  let strRawMessage = formatMessage(ethAddress, timestamp)
  let messageHash = utils.hashMessage(strRawMessage);
  let msgHash = Buffer.from(utils.arrayify(messageHash))

  const input = calculateEffECDSACircuitInput(strSig, msgHash);
  return input;
};

describe("ecdsa", async () => {
  it("should verify valid message", async () => {
    const circuit = await test.genTempMain(
        "circuits/eff_ecdsa.circom",
        "EfficientECDSA",
        "T, U",
        "64, 4",
        {}
    );

    let EOAAccount = Wallet.createRandom()
    const pubKey = EOAAccount.publicKey;
    const pubKeyPoint = ec.keyFromPublic(pubKey.slice(2), "hex");
    console.log(pubKeyPoint, pubKeyPoint.pub)

    const circuitInput = await getEffEcdsaCircuitInput(EOAAccount);
    const wtns = await test.executeCircuit(circuit, circuitInput);

    let pubkeyOutputX = splitToRegisters(pubKeyPoint.pub.x.toString("hex"))
    let pubkeyOutputY = splitToRegisters(pubKeyPoint.pub.y.toString("hex"))

    const outputPubkeyX = registersToHex(wtns.slice(1, 5).reverse());
    const outputPubkeyY = registersToHex(wtns.slice(5, 9).reverse());
    const outputPubKey = `${outputPubkeyX}${outputPubkeyY}`;

    console.log(wtns, outputPubKey, pubKey, pubkeyOutputX, pubkeyOutputY);
  });
  // TODO - add more tests
});
