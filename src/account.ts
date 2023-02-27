import { ethers } from "ethers";
const buildBabyjub = require("circomlibjs").buildBabyjub;
const buildEddsa = require("circomlibjs").buildEddsa;
const buildPoseidon = require("circomlibjs").buildPoseidon;
const { Scalar, utils } = require("ffjavascript");
const createBlakeHash = require("blake-hash");
const { Buffer } = require("buffer");
import { getPublicKey, sign as k1Sign, verify as k1Verify, Point } from "@noble/secp256k1";
import { bigint2Array, bigint2Uint8Array, bigint2Tuple } from "./utils";

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

type NewKeyFunc = (seed: string | undefined) => Promise<IKey>;
type SignFunc = (msghash: Uint8Array) => Promise<any>;
type VerifyFunc = (signature: Uint8Array | any, msghash: Uint8Array) => Promise<boolean>;
type KeyToCircuitInput = () => Promise<bigint[][]>;
export interface IKey {
    prvKey: bigint;
    pubKey: any;
    newKey: NewKeyFunc;
    sign: SignFunc;
    verify: VerifyFunc;
    toCircuitInput: KeyToCircuitInput;
}


// eddsa
export class SigningKey implements IKey {
    prvKey: bigint = 0n;
    pubKey: EigenAddress = new EigenAddress("");
    constructor() {}
    newKey: NewKeyFunc = async (_seed: string | undefined) => {
        let eddsa = await buildEddsa();
        let rawpvk = Buffer.from(ethers.utils.randomBytes(31));
        // let pvk = eddsa.pruneBuffer(createBlakeHash("blake512")
        //    .update(rawpvk)
        //    .digest().slice(0, 32));
        // let prvKey = Scalar.shr(utils.leBuff2int(pvk), 3);
        let pubKey = eddsa.prv2pub(rawpvk);
        let pPubKey = eddsa.babyJub.packPoint(pubKey);
        let hexPubKey = "eig:" + Buffer.from(pPubKey).toString("hex");
        this.prvKey = rawpvk;
        this.pubKey = new EigenAddress(hexPubKey);
        return Promise.resolve(this)
    }
    sign: SignFunc = async (msghash: Uint8Array) => {
        let eddsa = await buildEddsa();
        return eddsa.signPoseidon(this.prvKey, msghash);
    }
    verify: VerifyFunc = async (signature: Uint8Array | any, msghash: Uint8Array) => {
        let eddsa = await buildEddsa();
        let pubKey = await this.pubKey.unpack();
        return Promise.resolve(eddsa.verifyPoseidon(msghash, signature, pubKey));
    }
    toCircuitInput: KeyToCircuitInput = async () => {
        let eddsa = await buildEddsa();
        let pPub = await this.pubKey.unpack();
        return [[
            eddsa.F.toObject(pPub[0]),
            eddsa.F.toObject(pPub[1])
        ]];
    }
}

// ecdsa
export class AccountOrNullifierKey implements IKey {
    prvKey: bigint = 0n;
    pubKey: EthAddress = new EthAddress("");
    constructor() {}
    // signature hex string
    newKey: NewKeyFunc = async (signature: string | undefined) => {
        // return the first 32bytes as account key
        if (signature === undefined) {
            signature = ethers.utils.hexlify(ethers.utils.randomBytes(32));
        }
        let prvKey = ethers.utils.arrayify(signature).slice(0, 32);
        // let pubKey: Point = Point.fromPrivateKey(prvKey);
        let pubKey = getPublicKey(prvKey);
        let hexPubKey = "eth:" + Buffer.from(pubKey).toString("hex");
        this.prvKey = Buffer.from(prvKey);
        this.pubKey = new EthAddress(hexPubKey);
        return Promise.resolve(this);
    }
    sign: SignFunc = async (msghash: Uint8Array) => {
            let sig: Uint8Array = await k1Sign(msghash, bigint2Uint8Array(this.prvKey), { canonical: true, der: false })

            var r: Uint8Array = sig.slice(0, 32);
            var r_bigint: bigint = utils.uint8Array2Bigint(r);
            var s: Uint8Array = sig.slice(32, 64);
            var s_bigint: bigint = utils.uint8Array2Bigint(s);

            var r_array: bigint[] = bigint2Array(64, 4, r_bigint);
            var s_array: bigint[] = bigint2Array(64, 4, s_bigint);
            /*
            var msghash_array: bigint[] = utils.bigint2Array(64, 4, msghash_bigint);
            var pub0_array: bigint[] = utils.bigint2Array(64, 4, pub0);
            var pub1_array: bigint[] = utils.bigint2Array(64, 4, pub1);

            console.log('r', r_bigint);
            console.log('s', s_bigint);
            let witness = await circuit.calculateWitness({
                "r": r_array,
                "s": s_array,
                "msghash": msghash_array,
                "pubkey": [pub0_array, pub1_array]
            };
            */
            return Promise.resolve({
                R: r_array,
                S: s_array
            });
    }
    verify: VerifyFunc = async (signature: Uint8Array | any, msghash: Uint8Array) => {
        let pPub = await this.pubKey.unpack();
        return Promise.resolve(k1Verify(signature, msghash, new Point(pPub[0], pPub[1])));
    }
    toCircuitInput: KeyToCircuitInput = async () => {
        let pPub = await this.pubKey.unpack();
        return [bigint2Tuple(pPub[0]), bigint2Tuple(pPub[1])];
    }
}

export async function compress(
    accountKey: AccountOrNullifierKey,
    signingKey: SigningKey,
    aliasHash: bigint) {
    let npk = await accountKey.toCircuitInput();
    let spk = await signingKey.toCircuitInput();

    let poseidon = await buildPoseidon();
    let input: bigint[] = [];
    for (let i = 0; i < 2; i ++) {
        let low = npk[i][0] * (2n**64n) + npk[i][1];
        let high = npk[i][2] * (2n**64n) + npk[i][3];
        input.push(low);
        input.push(high);
    }
    input.push(spk[0][0]);
    input.push(spk[0][1]);
    input.push(aliasHash);
    return poseidon(input);
    // return poseidon.F.toObject(res);
}
