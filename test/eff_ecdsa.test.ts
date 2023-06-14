import * as test from "./test";
// let EC = require("elliptic").ec;
// const ec = new EC("secp256k1");
import { utils, Wallet } from "ethers";
import { formatMessage, calcPubKeyPoint, signEOASignature } from "@eigen-secret/core/dist-node/utils";
import { splitToRegisters, calculateEffECDSACircuitInput, registersToHex } from "@eigen-secret/core/dist-node/secp256k1_utils";
import { assert } from "chai";
// const { hashPersonalMessage, ecsign } = require("@ethereumjs/util");

/*
const privKey = BigInt(
  "0xf5b552f608f5b552f608f5b552f6082ff5b552f608f5b552f608f5b552f6082f"
);
 */
let timestamp = Math.floor(Date.now()/1000).toString();
const getEffEcdsaCircuitInput = async (EOAAccount: any) => {
    // sign
    // const privKey = BigInt(EOAAccount.privateKey)
    let ethAddress = EOAAccount.address;
    let strRawMessage = formatMessage(ethAddress, timestamp)
    let messageHash = utils.hashMessage(strRawMessage);
    let msgHash = Buffer.from(utils.arrayify(messageHash))

    /*
  const pubKey = ec.keyFromPrivate(privKey.toString(16)).getPublic();
  const sig  = ecsign(msgHash, privKey);
    console.log(sig, sig.r.toString("hex"), sig.v, sig.s.toString("hex"));
     */

    let strSig = await signEOASignature(EOAAccount, ethAddress, timestamp)
    // const r = BigInt(sig.r);
    // const v = BigInt(sig.v);

    // recover public key

    const input = calculateEffECDSACircuitInput(strSig, msgHash);
    return input;
};

/* eslint-disable no-undef */
describe("ecdsa", async () => {
    it("should verify valid message", async () => {
        const circuit = await test.genTempMain(
            "circuits/eff_ecdsa.circom",
            "EfficientECDSA",
            "U",
            "64, 4",
            {}
        );

        let EOAAccount = Wallet.createRandom()
        const pubKey = EOAAccount.publicKey;

        /*
    const privKey = BigInt(EOAAccount.privateKey)
    const pubKey = ec.keyFromPrivate(privKey.toString(16)).getPublic();
    console.log("pubkey", pubKeyOld, pubKey, pubKey.encode("hex"));
         */

        const circuitInput = await getEffEcdsaCircuitInput(EOAAccount);
        const wtns = await test.executeCircuit(circuit, circuitInput);

        const ethAddress = await EOAAccount.getAddress();
        let strSig = await signEOASignature(EOAAccount, ethAddress, timestamp)
        const pubKeyPoint = await calcPubKeyPoint(strSig, ethAddress, timestamp);
        let pubKeyOutputX = splitToRegisters(pubKeyPoint[0])
        let pubKeyOutputY = splitToRegisters(pubKeyPoint[1])

        const outputPubKeyX = registersToHex(wtns.slice(1, 5).reverse());
        const outputPubKeyY = registersToHex(wtns.slice(5, 9).reverse());
        const outputPubKey = `${outputPubKeyX}${outputPubKeyY}`;
        console.log(pubKeyPoint, pubKeyOutputX.toString(), pubKeyOutputY.toString(), outputPubKeyX, outputPubKeyY);

        assert(`0x04${outputPubKey}` === pubKey);

        console.log(pubKeyPoint[0].toString(16), outputPubKeyX);
        console.log(pubKeyPoint[1].toString(16), outputPubKeyY);
        assert(pubKeyPoint[0].toString(16) === outputPubKeyX);
        assert(pubKeyPoint[1].toString(16) === outputPubKeyY);
    });
    // TODO - add more tests
});
