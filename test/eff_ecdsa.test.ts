import * as test from "./test";
let EC = require("elliptic").ec;
const ec = new EC("secp256k1");
//import { hashPersonalMessage, ecsign } from "@ethereumjs/util";
import { computeEffEcdsaPubInput } from "@personaelabs/spartan-ecdsa";
import { BigNumberish, utils, Wallet } from "ethers";
import { formatMessage, calcPubKeyPoint, signEOASignature } from "@eigen-secret/core/dist-node/utils";

export const getEffEcdsaCircuitInput = async (privKey: Buffer) => {
  //const pubKey = ec.keyFromPrivate(privKey.toString("hex")).getPublic();
  //const msgHash = hashPersonalMessage(msg);
  //const { v, r: _r, s } = ecsign(msgHash, privKey);
  //const r = BigInt("0x" + _r.toString("hex"));

  // sign
  let EOAAccount = Wallet.createRandom()
  let ethAddress = EOAAccount.address;
  let timestamp = "123";
  let strRawMessage = formatMessage(ethAddress, timestamp)
  console.log(strRawMessage);

  let strSig = await signEOASignature(EOAAccount, ethAddress, timestamp)

  const sig = utils.splitSignature(strSig);
  const r = BigInt(sig.r);
  const v = BigInt(sig.v);

  // recover public key
  let messageHash = utils.hashMessage(strRawMessage);
  let msgHash = Buffer.from(utils.arrayify(messageHash))
  const circuitPubInput = computeEffEcdsaPubInput(r, v, msgHash);

  const pubKey = calcPubKeyPoint(strSig, "", "");
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

    const privKey = Buffer.from(
      "f5b552f608f5b552f608f5b552f6082ff5b552f608f5b552f608f5b552f6082f",
      "hex"
    );
    const circuitInput = await getEffEcdsaCircuitInput(privKey);
    await test.executeCircuit(circuit, circuitInput);
  });

  // TODO - add more tests
});
