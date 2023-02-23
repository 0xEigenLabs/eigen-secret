const crypto = require('crypto');
const { buildPoseidon, buildEddsa } = require("circomlibjs");
const { Scalar } = require("ffjavascript");
const createBlakeHash = require("blake-hash");
const { Buffer } = require("buffer");
import { ethers } from "ethers";
import { Note, NoteState } from "./note";
import { SigningKey, AccountOrNullifierKey, EigenAddress } from "./account";
import { strict as assert } from "assert";

/*
export class JoinSplitInput {
    readonly PROOF_ID_TYPE_INVALID: number = 0;
    readonly PROOF_ID_TYPE_DEPOSIT: number = 1;
    readonly PROOF_ID_TYPE_WITHDRAW: number = 2;
    readonly PROOF_ID_TYPE_SEND: number = 3;

    proofId: number = 0;
    publicValue: bigint = 0n;
    publicOwner: EthAddress = new EthAddress("0x0"),
    assetId: number = 0;
    numInputNotes: number = 0;
    oldDataRoot: bigint = 0n;
    inputNoteIndices: number[] = new Array<number>(0);
    inputNote: Note[] = new Array<Note>(2);
    outputNote: Note[] = new Array<Note>(2);

    aliasHash: bigint = 0n;
    accountPrivateKey: AccountOrNullifierKey,
    signature: string,

    val: bigint = 0n;

    public constructor(publicOwner: EthAddress, accountPrivateKey: AccountOrNullifierKey, signingKey: SigningKey) {
        this.publicOwner = publicOwner;
        this.accountPrivateKey = accountPrivateKey;

        this.signature = "";
    }

    async createSharedSecret(senderPvk: bigint): Promise<Buffer> {
        let eddsa = await buildEddsa();
        let babyJub = eddsa.babyJub;
        let rawSharedKey = babyJub.mulPointEscalar(babyJub.Base8, senderPvk);
        let sharedKey = createBlakeHash("blake256").update(Buffer.from(rawSharedKey)).digest();
        return sharedKey;
    }

    async hashMsg(nc1: any, nc2: any, outputNote1: any, outputNote2: any, publicOwner: any, publicValue: any) {
        let poseidon = await buildPoseidon();
        let res = poseidon([
            nc1, nc2, outputNote1, outputNote2, publicOwner, publicValue
        ]);
        return poseidon.F.toObject(res);
    }

    async createDepositInput (
        accountKey: AccountOrNullifierKey,
        signingKey: SigningKey,
        proofId: number,
        receiver: EigenAddress,
        val: bigint,
        alias_hash: bigint,
        accountId: bigint,
        assetId: bigint,
        publicValue: bigint,
        publicOwner: EigenAddress,
        creator: EigenAddress,
        confirmedAndPendingInputNotes: Array<Note>
    ): Promise<JoinSplitInput> {

        let pendingInput = confirmedAndPendingInputNotes.filter((n) => n.state == NoteState.Pending);
        let confirmedInput = confirmedAndPendingInputNotes.filter((n) => n.state == NoteState.Confirmed);



        let keys = await this.crateSharedSecret(signingKey.prvKey);

        // check proofId and publicValue
        let isDeposit = publicValue > 0n && proofId == this.PROOF_ID_TYPE_DEPOSIT;
        let isWithdraw = publicValue > 0n && proofId == this.PROOF_ID_TYPE_WITHDRAW;
        // TODO: isDefi or is Private Computation
        let 

        let outputNote1 = new Note(nonce, assetId, accountId, val, secret, receiver.pubKey, creator);
        let outputNote2 = new Note(nonce, assetId, accountId, publicValue, secret, receiver.pubKey, creator);
        let onc1 = await outputNote1.compress();
        let onc2 = await outputNote2.compress();

        let digest = await this.hashMsg(nc1, nc2, onc1, onc2, publicOwner, publicValue);

        let wallet = new ethers.Wallet(ethers.utils.arrayify(accountKey.prvKey));
        let signature = await wallet.signMessage(digest);

        this.proofId = proofId;
        this.publicValue = publicValue;
        this.publicOwner = publicOwner;
        return this;
    }

    updateState() {

    }

    createProof() {

    }
}
*/
