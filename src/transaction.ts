const crypto = require('crypto');
const { buildBabyJub, buildEddsa } = require("circomlibjs");
const { Scalar } = require("ffjavascript");
const createBlakeHash = require("blake-hash");
const { Buffer } = require("buffer");
import { Note } from "./note";
import { SigningKey, AccountOrNullifierKey, EigenAddress } from "./account";

export class Transaction {
    readonly PROOF_ID_TYPE_DEPOSIT = 1;
    readonly PROOF_ID_TYPE_WITHDRAW = 2;
    readonly PROOF_ID_TYPE_SEND = 3;

    input: Note[] = new Array<Note>(2);
    output: Note[] = new Array<Note>(2);
    secret: bigint = 0n;
    receiver: bigint[] = new Array<bigint>(2);

    public constructor() { }

    async crateSharedSecret(senderPvk: bigint): Promise<Buffer> {
        let eddsa = await buildEddsa();
        let babyJub = await buildBabyJub();
        let rawSharedKey = babyJub.mulPointEscalar(babyJub.Base8, senderPvk);
        let sharedKey = createBlakeHash("blake256").update(Buffer.from(rawSharedKey)).digest();
        return sharedKey;
    }

    async createTx(sender: AccountOrNullifierKey, receiver: EigenAddress, val: bigint, signature: string) {
        // find all the UTXO from database

        let secret = await this.crateSharedSecret(sender.prvKey);
    }
}
