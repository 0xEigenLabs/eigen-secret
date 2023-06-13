import * as test from "./test";
let EC = require("elliptic").ec;
const ec = new EC("secp256k1");
import { BigNumberish, utils, Wallet } from "ethers";
import { formatMessage, calcPubKeyPoint, signEOASignature } from "@eigen-secret/core/dist-node/utils";
import { calculateEffECDSACircuitInput } from "./secp256k1_utils";

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

  const circuitPubInput = calculateEffECDSACircuitInput(strSig, msgHash);
  return circuitInput;
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
    let pubkey = EOAAccount.publicKey;

    const circuitInput = await getEffEcdsaCircuitInput(EOAAccount);
    const wtns = await test.executeCircuit(circuit, circuitInput);
    console.log(wtns, pubkey);
  });
  // TODO - add more tests
});
