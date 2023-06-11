import { ethers } from "ethers";
const { Scalar, utils } = require("ffjavascript-browser");
const createBlakeHash = require("blake-hash");
const { Buffer } = require("buffer");
import { Aes256gcm } from "./aes_gcm";
import { Note } from "./note";
import { __DEFAULT_ALIAS__, uint8Array2Bigint } from "./utils";
const consola = require("consola");
import { getPoseidon } from "./digest";

type UnpackFunc = (babyJub: any) => [any, any];
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
    unpack: UnpackFunc = (babyJub: any) => {
        let pubKey = this.pubKey;
        if (pubKey.startsWith(this.protocol)) {
            pubKey = pubKey.substring(this.protocol.length);
        }
        let bPubKey = Buffer.from(pubKey, "hex");
        let pPubKey = babyJub.unpackPoint(bPubKey);
        return pPubKey;
    };
}

type SignFunc = (msghash: Uint8Array) => any;
type VerifyFunc = (signature: Uint8Array | any, msghash: Uint8Array) => boolean;
type KeyToCircuitInput = () => bigint[][];
type MakeSharedKey = (receiver: Address) => Buffer;

export interface IKey {
    prvKey: string;
    pubKey: any;
    sign: SignFunc;
    verify: VerifyFunc;
    toCircuitInput: KeyToCircuitInput;
    makeSharedKey: MakeSharedKey;
}

// eddsa
export class SigningKey implements IKey {
    prvKey: string;
    pubKey: EigenAddress;
    eddsa: any;
    constructor(eddsa: any, _rawkeyHex?: string) {
        this.eddsa = eddsa;
        let rawpvk: string = _rawkeyHex === undefined?
            Buffer.from(ethers.utils.randomBytes(31)).toString("hex") : _rawkeyHex;
        if (rawpvk.startsWith("0x")) {
            rawpvk = rawpvk.slice(2);
        }
        let pubKey = eddsa.prv2pub(rawpvk);
        let pPubKey = eddsa.babyJub.packPoint(pubKey);
        let hexPubKey = "eig:" + Buffer.from(pPubKey).toString("hex");
        this.prvKey = rawpvk;
        this.pubKey = new EigenAddress(hexPubKey);
        return this;
    }

    sign: SignFunc = (msghash: Uint8Array) => {
        let result = this.eddsa.signPoseidon(this.prvKey, msghash);
        return {
            R8: [result.R8[0], result.R8[1]],
            S: result.S
        }
    }
    verify: VerifyFunc = (signature: Uint8Array | any, msghash: Uint8Array) => {
        let pubKey = this.pubKey.unpack(this.eddsa.babyJub);
        return this.eddsa.verifyPoseidon(msghash, signature, pubKey);
    }
    makeSharedKey: MakeSharedKey = (receiver: EigenAddress) => {
        let babyJub = this.eddsa.babyJub;
        let receiverPoint = receiver.unpack(babyJub);

        const sBuff = this.eddsa.pruneBuffer(createBlakeHash("blake512").update(Buffer.from(this.prvKey)).digest());
        let s = Scalar.fromRprLE(sBuff, 0, 32);
        let prvKey = Scalar.shr(s, 3);
        let rawSharedKey = babyJub.mulPointEscalar(receiverPoint, prvKey);
        let sharedKey = createBlakeHash("blake256").
            update(Buffer.from(rawSharedKey[0])).
            update(Buffer.from(rawSharedKey[1])).
            digest();
        return sharedKey;
    }
    toCircuitInput: KeyToCircuitInput = () => {
        let pPub = this.pubKey.unpack(this.eddsa.babyJub);
        const pvk = this.eddsa.pruneBuffer(createBlakeHash("blake512").update(this.prvKey).digest().slice(0, 32));
        const S = Scalar.shr(utils.leBuff2int(pvk), 3);

        return [[
            this.eddsa.F.toObject(pPub[0]),
            this.eddsa.F.toObject(pPub[1])
        ], [S]];
    }
}

export async function compress(
    accountKey: SigningKey,
    signingKey: SigningKey,
    aliasHash: bigint) {
    let npk = accountKey.toCircuitInput();
    let spk = signingKey.toCircuitInput();
    return await rawCompress(npk[0], spk[0], aliasHash);
}

export async function rawCompress(
    npk: bigint[],
    spk: bigint[],
    aliasHash: bigint) {
    let poseidon = await getPoseidon();
    let input: bigint[] = [];
    input.push(npk[0]);
    input.push(npk[1]);
    input.push(spk[0]);
    input.push(spk[1]);
    input.push(aliasHash);
    return poseidon.F.toObject(poseidon(input));
}

async function accountDigest(
    aliasHash: bigint,
    accountPubKeyX: bigint,
    newAccountPubKeyX: bigint,
    newSigningPubKey1X: bigint,
    newSigningPubKey2X: bigint,
    nullifier1: bigint,
    nullifier2: bigint
) {
    let poseidon = await getPoseidon();
    return poseidon([
        aliasHash,
        accountPubKeyX,
        newAccountPubKeyX,
        newSigningPubKey1X,
        newSigningPubKey2X,
        nullifier1,
        nullifier2
    ]);
}

export async function calcAliasHash(eddsa: any, alias: string, pubKey: bigint[]) {
    // hash alias to field element
    let poseidon = await getPoseidon();
    const aliasHashBuffer = eddsa.pruneBuffer(
        createBlakeHash("blake512")
        .update(alias).digest().slice(0, 32)
    );
    const aliasHash = uint8Array2Bigint(aliasHashBuffer);
    // poseidon
    return poseidon.F.toObject(poseidon([
        aliasHash,
        pubKey[0],
        pubKey[1]
    ]));
}

/*
async function aliasHashDigest(aliasHash: bigint) {
    let poseidon = await getPoseidon();
    let result = poseidon([
        aliasHash
    ]);
    return poseidon.F.toObject(result);
}
*/

async function newAccountDigest(newAccountPubKey: bigint[]) {
    let poseidon = await getPoseidon();
    let result = poseidon([
        newAccountPubKey[0],
        newAccountPubKey[1]
    ]);
    return poseidon.F.toObject(result);
}

export class SecretAccount {
    alias: string;

    accountKey: SigningKey;
    signingKey: SigningKey;

    newAccountKey: SigningKey;
    newSigningKey1: SigningKey;
    newSigningKey2: SigningKey;

    constructor(
        alias: string,
        accountKey: SigningKey,
        signingKey: SigningKey,
        newAccountKey: SigningKey,
        newSigningKey1: SigningKey,
        newSigningKey2: SigningKey
    ) {
        this.alias = alias;
        this.accountKey = accountKey;
        this.signingKey = signingKey;
        this.newAccountKey = newAccountKey;
        this.newSigningKey1 = newSigningKey1;
        this.newSigningKey2 = newSigningKey2;
    }

    // generate key: const key = crypto.generateKeySync('aes', { length: 256 });
    serialize(key: any): string {
        let keys = [
            this.alias,
            this.accountKey.prvKey,
            this.signingKey.prvKey,
            this.newAccountKey.prvKey,
            this.newSigningKey1.prvKey,
            this.newSigningKey2.prvKey
        ].join(",");
        let aes = new Aes256gcm(key);
        let cipher = aes.encrypt(keys);
        return cipher;
    }

    static deserialize(eddsa: any, key: any, ciphertext: string): SecretAccount {
        let aes = new Aes256gcm(key);
        let keyData = aes.decrypt(ciphertext);
        let keys = keyData.split(",");
        return new SecretAccount(
            keys[0],
            new SigningKey(eddsa, keys[1]),
            new SigningKey(eddsa, keys[2]),
            new SigningKey(eddsa, keys[3]),
            new SigningKey(eddsa, keys[4]),
            new SigningKey(eddsa, keys[5])
        );
    }

    toString(eddsa: any) {
        const F = eddsa.F;
        let accountPubKeyP = this.accountKey.pubKey.unpack(eddsa.babyJub);
        let accountPubKey = [F.toObject(accountPubKeyP[0]), F.toObject(accountPubKeyP[1])];

        let newAccountPubKeyP = this.newAccountKey.pubKey.unpack(eddsa.babyJub);
        let newAccountPubKey = [F.toObject(newAccountPubKeyP[0]), F.toObject(newAccountPubKeyP[1])];

        let signingPubKeyP = this.signingKey.pubKey.unpack(eddsa.babyJub);
        let signingPubKey = [F.toObject(signingPubKeyP[0]), F.toObject(signingPubKeyP[1])];


        let signingPubKey1P = this.newSigningKey1.pubKey.unpack(eddsa.babyJub);
        let signingPubKey1 = [F.toObject(signingPubKey1P[0]), F.toObject(signingPubKey1P[1])];

        let signingPubKey2P = this.newSigningKey2.pubKey.unpack(eddsa.babyJub);
        let signingPubKey2 = [F.toObject(signingPubKey2P[0]), F.toObject(signingPubKey2P[1])];

        return {
            accountPubKey,
            accountPubKeyP: this.accountKey.pubKey.pubKey,
            signingPubKey,
            signingPubKeyP: this.signingKey.pubKey.pubKey,
            newAccountPubKey,
            newAccountPubKeyP: this.newAccountKey.pubKey.pubKey,
            signingPubKey1,
            signingPubKey1P: this.newSigningKey1.pubKey.pubKey,
            signingPubKey2,
            signingPubKey2P: this.newSigningKey2.pubKey.pubKey
        }
    }
}

export class AccountCircuit {
    static readonly PROOF_ID_TYPE_INVALID: number = 0;
    static readonly PROOF_ID_TYPE_CREATE: number = 11;
    static readonly PROOF_ID_TYPE_MIGRATE: number = 12;
    static readonly PROOF_ID_TYPE_UPDATE: number = 13;

    proofId: number;
    outputNCs: bigint[];

    // dataTreeRoot: bigint;
    // siblingsAC: bigint[];

    aliasHash: bigint;
    accountPubKey: bigint[];
    signingPubKey: bigint[];

    newAccountPubKey: bigint[];
    newSigningPubKey1: bigint[];
    newSigningPubKey2: bigint[];

    signatureR8: bigint[];
    signatureS: bigint;
    enabled: bigint;

    // aux
    accountNC: bigint;
    newAccountNC: bigint;

    constructor(
        proofId: number,
        outputNCs: bigint[],
        // dataTreeRoot: bigint,
        // siblingsAC: bigint[],
        aliasHash: bigint,
        accountPubKey: bigint[],
        signingPubKey: bigint[],
        newAccountPubKey: bigint[],
        newSigningPubKey1: bigint[],
        newSigningPubKey2: bigint[],
        signatureR8: bigint[],
        signatureS: bigint,
        accountNC: bigint,
        newAccountNC: bigint,
        enabled: bigint = 1n
    ) {
        // this.dataTreeRoot = dataTreeRoot;
        // this.siblingsAC = siblingsAC;
        this.proofId = proofId;
        this.outputNCs = outputNCs;
        this.aliasHash = aliasHash;
        this.accountPubKey = accountPubKey;
        this.signingPubKey = signingPubKey;
        this.newAccountPubKey = newAccountPubKey;
        this.newSigningPubKey1 = newSigningPubKey1;
        this.newSigningPubKey2 = newSigningPubKey2;
        this.signatureR8 = signatureR8;
        this.signatureS = signatureS;
        this.accountNC = accountNC;
        this.newAccountNC = newAccountNC;
        this.enabled = enabled;
    }

    static async createProofInput(
        eddsa: any,
        proofId: number,
        accountKey: SigningKey,
        signingKey: SigningKey,
        newAccountPubKey: bigint[],
        newSigningPubKey1: bigint[],
        newSigningPubKey2: bigint[],
        aliasHash: bigint
    ) {
        const F = eddsa.F;

        let accountPubKey = accountKey.pubKey.unpack(eddsa.babyJub);
        accountPubKey = [F.toObject(accountPubKey[0]), F.toObject(accountPubKey[1])];

        let signingPubKey = signingKey.pubKey.unpack(eddsa.babyJub);
        signingPubKey = [F.toObject(signingPubKey[0]), F.toObject(signingPubKey[1])];

        let accountNC = await rawCompress(accountPubKey, signingPubKey, aliasHash);
        let newAccountNC = await rawCompress(newAccountPubKey, signingPubKey, aliasHash);
        let outputNC1 = await rawCompress(newAccountPubKey, newSigningPubKey1, aliasHash);
        let outputNC2 = await rawCompress(newAccountPubKey, newSigningPubKey2, aliasHash);

        let nullifier1 = proofId == AccountCircuit.PROOF_ID_TYPE_CREATE? aliasHash : 0n;
        let nullifier2 = (proofId == AccountCircuit.PROOF_ID_TYPE_CREATE ||
            proofId == AccountCircuit.PROOF_ID_TYPE_MIGRATE) ?
            (await newAccountDigest(newAccountPubKey)): 0;

        let msghash = await accountDigest(
            aliasHash,
            accountPubKey[0],
            newAccountPubKey[0],
            newSigningPubKey1[0],
            newSigningPubKey2[0],
            nullifier1,
            nullifier2
        );

        /*
        let state = await WorldState.getInstance();
        if (proofId == AccountCircuit.PROOF_ID_TYPE_CREATE) {
            await state.insert(F.e(accountNC), 1n);
        }
        if (proofId == AccountCircuit.PROOF_ID_TYPE_MIGRATE) {
            await state.insert(F.e(newAccountNC), 1n);
        }

        let leaf = await state.find(F.e(accountNC));

        let tmpAccountNC = accountNC;
        if (proofId == AccountCircuit.PROOF_ID_TYPE_MIGRATE) {
            tmpAccountNC = newAccountNC;
        }
        */

        let sig = await signingKey.sign(msghash);
        return new AccountCircuit(
            proofId,
            [outputNC1, outputNC2],
            // F.toObject(state.root()),
            // siblingsPad(leaf.siblings, F),
            aliasHash,
            accountPubKey,
            signingPubKey,
            newAccountPubKey,
            newSigningPubKey1,
            newSigningPubKey2,
            [F.toObject(sig.R8[0]), F.toObject(sig.R8[1])],
            sig.S,
            accountNC,
            newAccountNC
        );
    }

    toCircuitInput(proof: any) {
        let result = {
            proof_id: this.proofId,
            public_value: 0n,
            public_owner: 0n,
            num_input_notes: 0n,
            output_nc_1: this.outputNCs[0],
            output_nc_2: this.outputNCs[1],
            data_tree_root: proof.dataTreeRoot,
            siblings_ac: proof.siblingsAC,
            public_asset_id: 0n,
            alias_hash: this.aliasHash,
            account_note_npk: this.accountPubKey,
            account_note_spk: this.signingPubKey,
            new_account_note_npk: this.newAccountPubKey,
            new_account_note_spk1: this.newSigningPubKey1,
            new_account_note_spk2: this.newSigningPubKey2,
            signatureR8: this.signatureR8,
            signatureS: this.signatureS,
            enabled: this.enabled
        }
        // console.log(result);
        // fs.writeFileSync("circuits/main_update_state.input.json", JSON.stringify(result));
        return result;
    }
}

export function decryptNotes(accountKey: SigningKey, encryptedNotes: any, skipZeroNote: boolean = true) {
    let notes: Array<Note> = [];
    if (encryptedNotes) {
        encryptedNotes.forEach((item: any) => {
            let sharedKey = accountKey.makeSharedKey(new EigenAddress(item.pubKey));
            try {
                // fetch all the notes that current user can decrypt
                let tmpNote = Note.decrypt(item.content, sharedKey);
                // mark the wild notes
                if (item.alias === __DEFAULT_ALIAS__) {
                    tmpNote.adopted = false;
                }
                if (tmpNote.val > 0) {
                    notes.push(tmpNote);
                } else if (!skipZeroNote) {
                    notes.push(tmpNote);
                }
            } catch (err: any) {
                consola.log(item);
                consola.log(`try to decrypt but failed ${err} for note ${item.alias}`);
                if (item.alias !== __DEFAULT_ALIAS__) {
                    throw (err)
                }
            }
        });
    }
    return notes;
}
