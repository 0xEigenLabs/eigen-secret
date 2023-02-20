const crypto = require('crypto');
const { buildBabyJub, buildEddsa } = require("circomlibjs");
const { Scalar } = require("ffjavascript");
const createBlakeHash = require("blake-hash");
import {Note} from "./note";

export class Transaction {
    readonly PROOF_ID_TYPE_DEPOSIT = 1;
    readonly PROOF_ID_TYPE_WITHDRAW = 2;
    readonly PROOF_ID_TYPE_SEND = 3;

    input: Note[] = new Array<Note>(2);
    output: Note[] = new Array<Note>(2);
    secret: bigint = 0n;
    receiver: bigint[] = new Array<bigint>(2);

    public constructor() {}

    async crateSharedSecret(senderPvk: bigint): Promise<Buffer> {
        let eddsa = await buildEddsa();
        let babyJub = await buildBabyJub();
        let rawSharedKey = babyJub.mulPointEscalar(babyJub.Base8, senderPvk);
        let sharedKey = createBlakeHash("blake256").update(Buffer.from(rawSharedKey)).digest();
        return sharedKey;
    }

    async crateTx(senderPvk: bigint, receiver: any, val: bigint, signature: any) {
        // crate note
        let secret = await this.crateSharedSecret(senderPvk);
    }
}
