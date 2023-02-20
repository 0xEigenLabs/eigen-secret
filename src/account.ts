import { ethers } from "ethers";
const buildEddsa = require("circomlibjs").buildEddsa;
const buildBabyjub = require("circomlibjs").buildBabyjub;
const { Scalar, utils } = require("ffjavascript");
const createBlakeHash = require("blake-hash");

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
};

export interface Key {
    prvKey: Uint8Array;
    pubKey: [bigint, bigint] | ethers.utils.Bytes;
    async new(seed: string): Promise<Key>;
}

// eddsa
export class SigningKey implements Key {
    prvKey: Uint8Array;
    pubKey: [bigint, bigint] | ethers.utils.Bytes;
    constructor() {}
    async new(seed: string): Promise<Key> {
        let rawpvk = Buffer.from(ethers.utils.randomBytes(31));
        let eddsa = await buildEddsa();
        let pvk = createBlakeHash("blake512")
            .update(rawpvk)
            .update(seed)
            .digest().slice(0, 32);
        this.prvKey = Scalar.shr(utils.leBuff2int(pvk), 3);
        this.pubKey = eddsa.prv2pub(this.prvKey);
    }
}

// ecdsa
export class AccountOrNullifierKey implements Key {
    constructor() {}
    // signature hex string
    async new(signature: string): Promise<Key> {
        // get the first 32bytes as accout key
        this.prvKey = ethers.utils.arrayify(signature).slice(0, 32);
        this.pubKey = ethers.utils.computePublicKey(this.prvKey);
    }
}
