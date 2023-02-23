import { ethers } from "ethers";
const buildEddsa = require("circomlibjs").buildEddsa;
const { Scalar, utils } = require("ffjavascript");
const createBlakeHash = require("blake-hash");
const { Buffer } = require("buffer");
import { Point } from "@noble/secp256k1";

type PackFunc = () => Promise<string>;
type UnpackFunc = (s: string) => Promise<void>;
interface Address {
    protocol: string;
    pubKey: [bigint, bigint];
    pack: PackFunc;
    unpack: UnpackFunc;
}
export class EigenAddress implements Address {
    protocol: string = "eig";
    pubKey: [bigint, bigint] = [0n, 0n];
    constructor() {}
    unpack: UnpackFunc = async (pubKey: string) => {
        if (pubKey.startsWith(this.protocol)) {
            pubKey = pubKey.substring(this.protocol.length);
        }
        let ecdsa = await buildEddsa();
        this.pubKey = ecdsa.unpackPoint(pubKey);
        return Promise.resolve();
    };
    pack: PackFunc = async () => {
        let ecdsa = await buildEddsa();
        let sPoint = ecdsa.pack(this.pubKey);
        return Promise.resolve(this.protocol + Buffer.from(sPoint).toString("hex"));
    };
}

export class EthAddress implements Address {
    protocol: string = "eth";
    pubKey: [bigint, bigint] = [0n, 0n];
    constructor() {}
    unpack: UnpackFunc = async (pubKey: string) => {
        let p = Point.fromHex(pubKey);
        this.pubKey = [p.x, p.y];
        return Promise.resolve();
    }
    pack: PackFunc = async () => {
        return Promise.resolve((new Point(this.pubKey[0], this.pubKey[1])).toHex(true));
    }
}

type NewKeyFunc = (seed: string) => Promise<IKey>;
export interface IKey {
    prvKey: bigint;
    pubKey: [bigint, bigint];
    keyFunc: NewKeyFunc;
}


// eddsa
export class SigningKey implements IKey {
    prvKey: bigint = 0n;
    pubKey: [bigint, bigint];
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
    pubKey: [bigint, bigint] = [0n, 0n];
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
