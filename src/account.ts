import { ethers } from "ethers";
const buildBabyjub = require("circomlibjs").buildBabyjub;
const buildEddsa = require("circomlibjs").buildEddsa;
const { Scalar, utils } = require("ffjavascript");
const createBlakeHash = require("blake-hash");
const { Buffer } = require("buffer");
import { getPublicKey, sign as k1Sign, Point } from "@noble/secp256k1";
import { bigint2Uint8Array } from "./utils";

type UnpackFunc = () => Promise<[any, any]>;
interface Address {
    protocol: string;
    pubKey: string;
    unpack: UnpackFunc;
}
export class EigenAddress implements Address {
    protocol: string = "eig:";
    pubKey: string;
    constructor(pubKey: string) {
        this.pubKey = pubKey;
    }
    unpack: UnpackFunc = async () => {
        let pubKey = this.pubKey;
        if (pubKey.startsWith(this.protocol)) {
            pubKey = pubKey.substring(this.protocol.length);
        }
        let babyJub = await buildBabyjub();
        let bPubKey = Buffer.from(pubKey, "hex");
        let pPubKey = babyJub.unpackPoint(bPubKey);
        return Promise.resolve(pPubKey);
    };
}

export class EthAddress implements Address {
    protocol: string = "eth:";
    pubKey: string;
    constructor(pubKey: string) {
        this.pubKey = pubKey;
    }
    unpack: UnpackFunc = async () => {
        let pubKey = this.pubKey;
        if (pubKey.startsWith(this.protocol)) {
            pubKey = pubKey.substring(this.protocol.length);
        }
        let p = Point.fromHex(pubKey);
        return Promise.resolve([p.x, p.y]);
    }
}

type NewKeyFunc = (seed: string) => Promise<IKey>;
type SignFunc = (msghash: Uint8Array) => Promise<Uint8Array>;
export interface IKey {
    prvKey: bigint;
    pubKey: any;
    newKey: NewKeyFunc;
    sign: SignFunc;
}


// eddsa
export class SigningKey implements IKey {
    prvKey: bigint;
    pubKey: EigenAddress;
    constructor(prvKey: any, pubKey: EthAddress) {
        this.prvKey = prvKey;
        this.pubKey = pubKey;
    }
    newKey: NewKeyFunc = async (seed: string) => {
        let rawpvk = Buffer.from(ethers.utils.randomBytes(31));
        let eddsa = await buildEddsa();
        let pvk = createBlakeHash("blake512")
            .update(rawpvk)
            .update(seed)
            .digest().slice(0, 32);
        let prvKey = Scalar.shr(utils.leBuff2int(pvk), 3);
        let pubKey = eddsa.prv2pub(prvKey);
        let pPubKey = eddsa.babyJub.packPoint(pubKey);
        let hexPubKey = "eig:" + Buffer.from(pPubKey).toString("hex");
        let result: IKey = new SigningKey(prvKey, new EigenAddress(hexPubKey));
        return Promise.resolve(result)
    }
    sign: SignFunc = async (msghash: Uint8Array) => {
        return Promise.reject("Unimplemented function");
    }
}

// ecdsa
export class AccountOrNullifierKey implements IKey {
    prvKey: bigint;
    pubKey: EthAddress;
    constructor(prvKey: any, pubKey: any) {
        this.prvKey = prvKey;
        this.pubKey = pubKey;
    }
    // signature hex string
    newKey: NewKeyFunc = async (signature: string) => {
        // return the first 32bytes as account key
        let prvKey = ethers.utils.arrayify(signature).slice(0, 32);
        // let pubKey: Point = Point.fromPrivateKey(prvKey);
        let pubKey = getPublicKey(prvKey);
        let hexPubKey = "eth:" + Buffer.from(pubKey).toString("hex");
        let result: IKey = new AccountOrNullifierKey(prvKey, hexPubKey);
        return Promise.resolve(result);
    }
    sign: SignFunc = async (msghash: Uint8Array) => {
            let sig: Uint8Array = await k1Sign(msghash, bigint2Uint8Array(this.prvKey), { canonical: true, der: false })
            return Promise.resolve(sig);
    }
}
