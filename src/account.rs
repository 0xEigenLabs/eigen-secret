import { ethers } from "ethers";
const buildEddsa = require("circomlibjs").buildEddsa;
const buildBabyjub = require("circomlibjs").buildBabyjub;

enum KeyType {
    SigningKey,
    AccountOrNullifierKey
}

interface Key {
    kind: KeyType;
    prvKey: Uint8Array;
    pubKey: [bigint, bigint] | ethers.utils.Bytes;
    async new(seed: string): Key;
}

// eddsa
class SigningKey implements Key {
    kind: KeyType = SigningKey;
    constructor() {}
    async new(seed: string) {
        let rawpvk = Buffer.from(ethers.utils.randomBytes(31));
        let eddsa = await buildEddsa();
        let pvk = createBlakeHash("blake512")
            .update(rawpvk)
            .update(seed)
            .digest().slice(0, 32);
        this.prvKey = Scalar.shr(ffutils.leBuff2int(pvk), 3);
        this.pubKey = eddsa.prv2pub(this.prvKey);
    }
}

// ecdsa
class AccountOrNullifierKey implements Key {
    kind: KeyType = AccountOrNullifierKey;
    constructor() {}
    // signature hex string
    async new(signature: string) {
        // get the first 32bytes as accout key
        this.prvKey = ethers.utils.arrayify(signature).slice(0, 32);
        this.pubKey = ethers.utils.computePublicKey(this.prvKey);
    }
}
