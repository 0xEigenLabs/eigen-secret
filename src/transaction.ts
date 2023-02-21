const crypto = require('crypto');
const { buildPoseidon, buildEddsa } = require("circomlibjs");
const { Scalar } = require("ffjavascript");
const createBlakeHash = require("blake-hash");
const { Buffer } = require("buffer");
import { ethers } from "ethers";
import { Note } from "./note";
import { SigningKey, AccountOrNullifierKey, EigenAddress } from "./account";

export class Transaction {
    readonly PROOF_ID_TYPE_INVALID: number = 0;
    readonly PROOF_ID_TYPE_DEPOSIT: number = 1;
    readonly PROOF_ID_TYPE_WITHDRAW: number = 2;
    readonly PROOF_ID_TYPE_SEND: number = 3;

    input: Note[] = new Array<Note>(2);
    output: Note[] = new Array<Note>(2);
    secret: bigint = 0n;
    receiver: bigint[] = new Array<bigint>(2);
    val: bigint = 0n;
    nonce: bigint = 0n;

    public constructor() { }

    async crateSharedSecret(senderPvk: bigint): Promise<Buffer> {
        let eddsa = await buildEddsa();
        let babyJub = eddsa.babyJub;
        let rawSharedKey = babyJub.mulPointEscalar(babyJub.Base8, senderPvk);
        let sharedKey = createBlakeHash("blake256").update(Buffer.from(rawSharedKey)).digest();
        return sharedKey;
    }

    async hashMsg(nc1: any, nc2: any, outputNote1: any, outputNote2: any, outputOwner: any) {
        let poseidon = await buildPoseidon();
        let res = poseidon([
            nc1, nc2, outputNote1, outputNote2, outputOwner
        ]);
        return poseidon.F.toObject(res);
    }

    async createTx(
        accountKey: AccountOrNullifierKey,
        signingKey: SigningKey,
        receiver: EigenAddress,
        val: bigint,
        nonce: bigint,
        accountId: bigint,
        assetId: bigint,
        publicValue: bigint,
        publicOwner: EigenAddress,
        isDeposit: boolean,
        isWithdraw: boolean,
        inputNotes: Array<Note>
    ) {
        if (isDeposit || isWithdraw) {
            assert(publicValue > 0);
        }
        let secret = await this.crateSharedSecret(signingKey.prvKey);

        let nc1: any;
        let nc2: any;
        let proofId: any = this.PROOF_ID_TYPE_INVALID;
        if (isDeposit) {
            proofId = this.PROOF_ID_TYPE_DEPOSIT;
            if (inputNotes.length == 0) {
                nc1 = new Note(nonce, assetId, accountId, publicValue, secret, );
                nc2 = new Note(nonce, assetId, accountId, 0n, secret, );
            } else if (inputNotes.length == 1) {
                nc1 = await inputNotes[0].compress();
                nc2 = new Note(nonce, assetId, accountId, 0n, secret, );
            } else {
                assert(inputNotes.length == 2);
                nc1 = await inputNotes[0].compress();
                nc2 = await inputNotes[1].compress();
            }
        } else if (isWithdraw) {
            proofId = this.PROOF_ID_TYPE_WITHDRAW;
            if (inputNotes.length == 0) {
                nc1 = new Note(nonce, assetId, accountId, 0n, secret, );
                nc2 = new Note(nonce, assetId, accountId, 0n, secret, );
            } else if (inputNotes.length == 1) {
                nc1 = await inputNotes[0].compress();
                nc2 = new Note(nonce, assetId, accountId, 0n, secret, );
            } else {
                assert(inputNotes.length == 2);
                nc1 = await inputNotes[0].compress();
                nc2 = await inputNotes[1].compress();
            }
        } else {
            proofId = this.PROOF_ID_TYPE_SEND;
            if (inputNotes.length == 0) {
                nc1 = new Note(nonce, assetId, accountId, 0n, secret, );
                nc2 = new Note(nonce, assetId, accountId, 0n, secret, );
            } else if (inputNotes.length == 1) {
                nc1 = await inputNotes[0].compress();
                nc2 = new Note(nonce, assetId, accountId, 0n, secret, );
            } else {
                assert(inputNotes.length == 2);
                nc1 = await inputNotes[0].compress();
                nc2 = await inputNotes[1].compress();
            }
        }

        let outputNote1 = new Note(nonce, assetId, accountId, val, secret, receiver.pubKey);
        let outputNote2 = new Note(nonce, assetId, accountId, publicValue, secret, receiver.pubKey);


        let digest = await hashMsg();

        let wallet = new ethers.Wallet(accountKey.prvKey);
        let signature = await wallet.signMessage(digest);
    }
}
