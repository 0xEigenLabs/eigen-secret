const elliptic = require("elliptic");
const ec = new elliptic.ec("secp256k1");
const BN = require("bn.js");
import { utils } from "ethers";

const SECP256K1_N = new BN(
    "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
    16
);

const STRIDE = 8n;
const NUM_STRIDES = 256n / STRIDE; // = 32
const REGISTERS = 4n;
const addHexPrefix = (str: string) => {
    if (str.startsWith("0x")) {
        return str;
    }
    return `0x${str}`;
}
export const splitToRegisters = (value: any) => {
  const registers = [];

  if (!value) {
    return [0n, 0n, 0n, 0n];
  }

  const hex = value.toString(16).padStart(64, "0");
  for (let k = 0; k < REGISTERS; k++) {
    // 64bit = 16 chars in hex
    const val = hex.slice(k * 16, (k + 1) * 16);

    registers.unshift(BigInt(addHexPrefix(val)));
  }

  return registers.map(el => el.toString());
};

const getPointPreComputes = (point: any) => {
  const keyPoint = ec.keyFromPublic({
    x: Buffer.from(point.x.toString(16).padStart(64, 0), "hex"),
    y: Buffer.from(point.y.toString(16).padStart(64, 0), "hex")
  });

  const gPowers = []; // [32][256][2][4]
  for (let i = 0n; i < NUM_STRIDES; i++) {
    const stride = [];
    const power = 2n ** (i * STRIDE);
    for (let j = 0n; j < 2n ** STRIDE; j++) {
      const l = j * power;

      const gPower = keyPoint.getPublic().mul(new BN(l));

      const x = splitToRegisters(gPower.x);
      const y = splitToRegisters(gPower.y);

      stride.push([x, y]);
    }
    gPowers.push(stride);
  }

  return gPowers;
};


export const calculateEffECDSACircuitInput = (strSig: string, msgHash: Buffer) => {
    const sig = utils.splitSignature(strSig);
    const r = BigInt(sig.r);
    const v = BigInt(sig.v);
    // Get the group element: -(m * r^−1 * G)
    const rInv = new BN(r).invm(SECP256K1_N);
    // w = -(r^-1 * msg)
    const w = rInv.mul(new BN(msgHash)).neg().umod(SECP256K1_N);
    // U = -(w * G) = -(r^-1 * msg * G)
    const U = ec.curve.g.mul(w);

    const isYOdd = (v - BigInt(27)) % BigInt(2);
    const rPoint = ec.keyFromPublic(
        ec.curve.pointFromX(new BN(r), isYOdd).encode("hex"),
        "hex"
    );
    // T = r^-1 * R
    const T = rPoint.getPublic().mul(rInv);

    console.log("Calculating point cache...");
    console.time("Point cache calculation");
    const TPreComputes = getPointPreComputes(T);
    console.timeEnd("Point cache calculation");

    return {
        T: TPreComputes,
        U: [splitToRegisters(U.x), splitToRegisters(U.y)],
        s: [splitToRegisters(sig.s)]
    };
}


export const registersToHex = (registers: any) => {
  return registers
    .map((el: any) => BigInt(el).toString(16).padStart(16, "0"))
    .join("");
};
