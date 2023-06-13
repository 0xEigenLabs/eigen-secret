import * as test from "./test";
let EC = require("elliptic").ec;
const ec = new EC("secp256k1");
//import { hashPersonalMessage, ecsign } from "@ethereumjs/util";
import { computeEffEcdsaPubInput } from "@personaelabs/spartan-ecdsa";
import { BigNumberish, utils, Wallet } from "ethers";
import { formatMessage, calcPubKeyPoint, signEOASignature } from "@eigen-secret/core/dist-node/utils";

export const getEffEcdsaCircuitInput = async () => {
  // sign
  let EOAAccount = Wallet.createRandom()
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
  const circuitPubInput = computeEffEcdsaPubInput(r, v, msgHash);

  const pubKey = calcPubKeyPoint(strSig, ethAddress, timestamp);
  const input = {
    enabled: 1n,
    s: BigInt(sig.s),
    Tx: circuitPubInput.Tx,
    Ty: circuitPubInput.Ty,
    Ux: circuitPubInput.Ux,
    Uy: circuitPubInput.Uy,
    pubKeyX: pubKey[0],
    pubKeyY: pubKey[1]
  };
  console.log(input);
  return input;
};

describe("ecdsa", async () => {
  it("should verify valid message", async () => {
    const circuit = await test.genTempMain(
        "circuits/eff_ecdsa.circom",
        "EfficientECDSA",
        "Tx, Ty, Ux, Uy, pubKeyX, pubKeyY",
        {},
        {
            prime: "secq256k1"
        }
    );

    const circuitInput = await getEffEcdsaCircuitInput();
    await test.executeCircuit(circuit, circuitInput);
  });

  // TODO - add more tests
});
