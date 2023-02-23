const crypto = require('crypto');
const { buildPoseidon, buildEddsa } = require("circomlibjs");
const { Scalar } = require("ffjavascript");
const createBlakeHash = require("blake-hash");
const { Buffer } = require("buffer");
import { ethers } from "ethers";
import { Note, NoteState } from "./note";
import { SigningKey, AccountOrNullifierKey, EigenAddress, EthAddress } from "./account";
import { strict as assert } from "assert";

export class JoinSplitInput {
    static readonly PROOF_ID_TYPE_INVALID: number = 0;
    static readonly PROOF_ID_TYPE_DEPOSIT: number = 1;
    static readonly PROOF_ID_TYPE_WITHDRAW: number = 2;
    static readonly PROOF_ID_TYPE_SEND: number = 3;

    proofId: number;
    publicValue: bigint;
    publicOwner: EthAddress;
    assetId: number;
    numInputNotes: number;
    oldDataRoot: bigint;
    inputNoteIndices: number[];
    inputNote: Note[];
    outputNote: Note[];
    aliasHash: bigint;


    public constructor(
        proofId: number,
        publicValue: bigint,
        publicOwner: EthAddress,
        assetId: number,
        numInputNotes: number,
        oldDataRoot: bigint,
        inputNoteIndices: number[],
        inputNote: Note[],
        aliasHash: bigint) {
        this.proofId = proofId;
        this.publicOwner = publicOwner;
        this.publicValue = publicValue;
        this.assetId = assetId;
        this.numInputNotes = numInputNotes;
        this.oldDataRoot = oldDataRoot;
        this.inputNoteIndices = inputNoteIndices;
        this.inputNote = inputNote;
        this.outputNote = new Array<Note>(0);
        this.aliasHash = aliasHash;
    }

    static async createSharedSecret(senderPvk: bigint): Promise<Buffer> {
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

    static async createDepositInput (
        accountKey: AccountOrNullifierKey,
        signingKey: SigningKey,
        proofId: number,
        receiver: EigenAddress,
        aliasHash: bigint,
        assetId: bigint,
        publicValue: bigint,
        publicOwner: EigenAddress,
        confirmedAndPendingInputNotes: Array<Note>
    ): Promise<Array<JoinSplitInput>> {
        // check proofId and publicValue
        if (publicValue == 0n || proofId != JoinSplitInput.PROOF_ID_TYPE_DEPOSIT) {
            return Promise.reject("proofId or publicValue is invalid");
        }

        let pendingNote = confirmedAndPendingInputNotes.filter((n) => n.state == NoteState.Pending);
        let confirmedNote = confirmedAndPendingInputNotes.filter((n) => n.state == NoteState.Confirmed);
        let firstNode = pendingNote.shift();

        let JoinSplitInputList = new Array<JoinSplitInput>();
        for (const note of confirmedNote) {
        }


        //let keys = await JoinSplitInput.crateSharedSecret(signingKey.prvKey);

        return JoinSplitInputList;
    }

    static async createSendInput() {

    }

    updateState() {

    }

    createProof() {

    }
}
