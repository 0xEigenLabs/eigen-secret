import { Buffer } from "buffer";
import { BigNumberish } from "ethers";
import { N_LEVEL } from "./state_tree";

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
  return Object.entries(symbols).filter(([index, symbol]) => index.startsWith(arrName))
    .map(([index, symbol]) => Object.assign({}, symbol, { "name": index, "value": witness[symbol["varIdx"]] }));
}

export function getWitnessArray(witness: any, symbols: Map<string, any>, arrName: string): any {
  return Object.entries(symbols).filter(([index, symbol]) => index.startsWith(`${arrName}[`))
    .map(([index, symbol]) => witness[symbol["varIdx"]]);
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

export async function executeCircuit(
  circuit: any,
  inputs: any
) {
  const witness = await circuit.calculateWitness(inputs, true)
  await circuit.checkConstraints(witness)
  await circuit.loadSymbols()
  return witness
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

export function siblingsPad(siblings: any, F: any) {
  for (let i = 0; i < siblings.length; i++) siblings[i] = F.toObject(siblings[i]);
  while (siblings.length < N_LEVEL) siblings.push(0);
  return siblings;
}
