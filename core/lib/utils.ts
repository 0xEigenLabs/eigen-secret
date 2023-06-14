import { Buffer } from "buffer";
import { BigNumberish, utils } from "ethers";
import consola from "consola";
import { randomBytes as _randomBytes } from "crypto";
const createBlakeHash = require("blake-hash");
let EC = require("elliptic").ec;
const ec = new EC("secp256k1");
// import { hashPersonalMessage, ecsign } from "@ethereumjs/util";

export const rawMessage = "Sign this message as a credential to interact with Eigen Secret L2. " +
"IMPORTANT: Sign this message if you trust the application.";

export function index() {
    return BigInt("0x" + _randomBytes(31).toString("hex"))
}

// FIXME
export const formatMessage = (_ethAddress: string, _timestamp: string) => {
    return rawMessage;
}

export function arrayChunk(array: Array<number>, chunkSize: number): any {
  return Array(Math.ceil(array.length / chunkSize)).map((_, index) => index * chunkSize)
    .map((begin) => array.slice(begin, begin + chunkSize));
}

export function bits2NumBE(n: number, in1: any) {
  let lc1 = 0n;
  let e2 = 1n;
  for (let i = n - 1; i >= 0; i--) {
    lc1 += BigInt(in1[i]) * e2;
    e2 = e2 + e2;
  }
  return lc1
}

export function bigintArray2Bits(arr: Array<bigint>, intSize: number = 16): number[] {
  let result: string[] = [];
  return result.concat(...arr.map((n) => n.toString(2).padStart(intSize, "").split("")))
    .map((bit: string) => bit == "1" ? 1 : 0);
}

export function bigIntArray2Buffer(arr: Array<bigint>, intSize: number = 16): any {
  return bitArray2Buffer(bigintArray2Bits(arr, intSize));
}

export function bitArray2Buffer(a: Array<number>) {
  return Buffer.from(arrayChunk(a, 8).map((b: any) => parseInt(b.join(""), 2)))
}

export function getWitnessValue(witness: any, symbols: any, varName: string) {
  return witness[symbols[varName]["varIdx"]];
}

export function getWitnessMap(witness: any, symbols: Map<string, any>, arrName: string): any {
  return Object.entries(symbols).filter(([index, _]) => index.startsWith(arrName))
    .map(([index, symbol]) => Object.assign({}, symbol, { "name": index, "value": witness[symbol["varIdx"]] }));
}

export function getWitnessArray(witness: any, symbols: Map<string, any>, arrName: string): any {
  return Object.entries(symbols).filter(([index, _]) => index.startsWith(`${arrName}[`))
    .map(([_, symbol]) => witness[symbol["varIdx"]]);
}

export function getWitnessBuffer(witness: any, symbols: Map<string, any>, arrName: string, varSize: number = 1) {
  const witnessArray = getWitnessArray(witness, symbols, arrName);
  if (varSize == 1) {
    return bitArray2Buffer(witnessArray);
  } else {
    return bigIntArray2Buffer(witnessArray, varSize);
  }
}

export function bits2Bignum(bits: [number], nWidth: number) {
  let result = [];
  let nBlock = Math.floor((bits.length - 1) / nWidth) + 1;
  for (let i = 0; i < nBlock; i++) {
    let end = Math.min((i + 1) * nWidth, bits.length);
    let tmpbits = bits.slice(i * nWidth, end);
    result.push(bits2NumBE(end - i * nWidth, tmpbits));
  }
  return result;
}

export function bigint2Tuple(x: bigint) {
  let mod: bigint = 2n ** 64n;
  let ret: [bigint, bigint, bigint, bigint] = [0n, 0n, 0n, 0n];

  let x_temp: bigint = x;
  for (let idx = 0; idx < ret.length; idx++) {
    ret[idx] = x_temp % mod;
    x_temp = x_temp / mod;
  }
  return ret;
}

export function bigint2Array(n: number, k: number, x: bigint) {
  let mod: bigint = 1n;
  for (let idx = 0; idx < n; idx++) {
    mod = mod * 2n;
  }

  let ret: bigint[] = [];
  let x_temp: bigint = x;
  for (let idx = 0; idx < k; idx++) {
    ret.push(x_temp % mod);
    x_temp = x_temp / mod;
  }
  return ret;
}

// converts x = sum of a[i] * 2 ** (small_stride * i) for 0 <= 2 ** small_stride - 1
//      to:     sum of a[i] * 2 ** (stride * i)
export function getStridedBigint(stride: bigint, small_stride: bigint, x: bigint) {
  let ret: bigint = 0n;
  let exp: bigint = 0n;
  while (x > 0) {
    let mod: bigint = x % (2n ** small_stride);
    ret = ret + mod * (2n ** (stride * exp));
    x = x / (2n ** small_stride);
    exp = exp + 1n;
  }
  return ret;
}

// bigendian
export function bigint2Uint8Array(x: bigint) {
  let ret: Uint8Array = new Uint8Array(32);
  for (let idx = 31; idx >= 0; idx--) {
    ret[idx] = Number(x % 256n);
    x = x / 256n;
  }
  return ret;
}

// bigendian
export function uint8Array2Bigint(x: Uint8Array) {
  let ret: bigint = 0n;
  for (let idx = 0; idx < x.length; idx++) {
    ret = ret * 256n;
    ret = ret + BigInt(x[idx]);
  }
  return ret;
}

export interface Proof {
    a: [BigNumberish, BigNumberish];
    b: [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]];
    c: [BigNumberish, BigNumberish];
}

export function parseProof(proof: any): Proof {
    return {
        a: [proof.pi_a[0], proof.pi_a[1]],
        b: [
            [proof.pi_b[0][1], proof.pi_b[0][0]],
            [proof.pi_b[1][1], proof.pi_b[1][0]]
        ],
        c: [proof.pi_c[0], proof.pi_c[1]]
    };
}

// example: https://github.com/ethers-io/ethers.js/issues/447
export function verifyEOASignature(
    hexSignature: string,
    ethAddress: string,
    timestamp: string
) {
    let strRawMessage = formatMessage(ethAddress, timestamp)
    let messageHash = utils.hashMessage(strRawMessage);
    let address = utils.recoverAddress(utils.arrayify(messageHash), hexSignature);
    return address == ethAddress;
}

export function calcPubKeyPoint(
    hexSignature: string,
    ethAddress: string,
    timestamp: string
): bigint[] {
    let strRawMessage = formatMessage(ethAddress, timestamp);
    let messageHash = utils.hashMessage(strRawMessage);

    const sig = utils.splitSignature(hexSignature);
    const rs = { r: utils.arrayify(sig.r), s: utils.arrayify(sig.s) };
    let pubKeyP = ec.recoverPubKey(utils.arrayify(messageHash), rs, sig.recoveryParam);

    // return "0x" + getCurve().recoverPubKey(arrayify(messageHash), rs, sig.recoveryParam).encode("hex", false);
    // let pubKey = ethers.utils.recoverPublicKey(ethers.utils.arrayify(messageHash), hexSignature);
    return [BigInt(pubKeyP.x.toString()), BigInt(pubKeyP.y.toString())];
}

export async function signEOASignature(
    EOAAccount: any,
    ethAddress: string,
    timestamp: string
) {
    let strRawMessage = formatMessage(ethAddress, timestamp);
    return await EOAAccount.signMessage(strRawMessage)
}

const requireEnvVariables = (envVars: Array<string>) => {
  for (const envVar of envVars) {
    if (!process.env[envVar]) {
      throw new Error(`Error: set your '${envVar}' environmental variable `);
    }
  }
  consola.success("Environmental variables properly set 👍");
};

const prepareJson = function(data: any) {
  return JSON.parse(JSON.stringify(data, (key, value) =>
    typeof value === "bigint"? value.toString() : value
  ));
}

const hasValue = function(variable: any) {
  if (variable === undefined) {
    return false;
  }
  if (typeof variable === "string" && variable.trim() === "") {
    return false;
  }
  return true;
};

const pathJoin = (parts: Array<string>, sep="/") => parts.join(sep).replace(new RegExp(sep+"{1,}", "g"), sep);
const __DEFAULT_ALIAS__ = "EIGEN_BUILTIN_ALIAS";
const SESSION_DURATION = 20 * 60; // seconds
const ETH = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const normalizeAlias = (alias: string) => {
    return /^[A-Za-z][A-Za-z0-9_.]{2,32}$/.test(alias)
}

export { hasValue, requireEnvVariables, prepareJson, pathJoin, __DEFAULT_ALIAS__, SESSION_DURATION, normalizeAlias, ETH };
