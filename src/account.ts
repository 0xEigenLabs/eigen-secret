import { ethers } from "ethers";
const buildEddsa = require("circomlibjs").buildEddsa;
const { Scalar, utils } = require("ffjavascript");
const createBlakeHash = require("blake-hash");
const { Buffer } = require("buffer");
import { getPublicKey, sign, Point } from "@noble/secp256k1";

interface Address {
    protocol: string;
    pubKey: [bigint, bigint];
}
export class EigenAddress implements Address {
    protocol: string = "eig";
    pubKey: [bigint, bigint];
    constructor(pubKey: string) {
        if (pubKey.startsWith(this.protocol)) {
            pubKey = pubKey.substring(this.protocol.length);
        }
        let p0 = BigInt(pubKey.substring(0, 32));
        let p1 = BigInt(pubKey.substring(32));
        this.pubKey = [p0, p1];
    }
}

type NewKeyFunc = (seed: string) => Promise<IKey>;
export interface IKey {
    prvKey: bigint;
    pubKey: [bigint, bigint] | ethers.utils.Bytes;
    keyFunc: NewKeyFunc;
}


// eddsa
export class SigningKey implements IKey {
    prvKey: bigint = 0n;
    pubKey: [bigint, bigint] = [0n, 0n];
    constructor(prvKey: any, pubKey: any) {
        this.prvKey = prvKey;
        this.pubKey = pubKey;
    }
    keyFunc: NewKeyFunc = async (seed: string) => {
        let rawpvk = Buffer.from(ethers.utils.randomBytes(31));
        let eddsa = await buildEddsa();
        let pvk = createBlakeHash("blake512")
            .update(rawpvk)
            .update(seed)
            .digest().slice(0, 32);
        let prvKey = Scalar.shr(utils.leBuff2int(pvk), 3);
        let pubKey = eddsa.prv2pub(prvKey);
        let result: IKey = new SigningKey(prvKey, pubKey);
        return new Promise<IKey>((resolve, reject) => {
            resolve(result);
        });
    }
}

// ecdsa
export class AccountOrNullifierKey implements IKey {
    prvKey: bigint = 0n;
    pubKey: [bigint, bigint] | ethers.utils.Bytes = [0n, 0n];
    constructor(prvKey: any, pubKey: any) {
        this.prvKey = prvKey;
        this.pubKey = pubKey;
    }
    // signature hex string
    keyFunc: NewKeyFunc = async (signature: string) => {
        // return the first 32bytes as account key
        let prvKey = ethers.utils.arrayify(signature).slice(0, 32);
        let pubKey: Point = Point.fromPrivateKey(prvKey);
        let result: IKey = new AccountOrNullifierKey(prvKey, [pubKey.x, pubKey.y]);
        return new Promise<IKey>((resolve, reject) => {
            resolve(result);
        });
    }
}
