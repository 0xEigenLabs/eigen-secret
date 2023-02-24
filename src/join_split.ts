const crypto = require('crypto');
const { buildPoseidon, buildEddsa } = require("circomlibjs");
const { Scalar } = require("ffjavascript");
const createBlakeHash = require("blake-hash");
const { Buffer } = require("buffer");
import { ethers } from "ethers";
import { Note, NoteState } from "./note";
import { SigningKey, AccountOrNullifierKey, EigenAddress, EthAddress } from "./account";
import { strict as assert } from "assert";
import { StateTree } from "./state_tree";

export class JoinSplitInput {
    proofId: number;
    publicValue: bigint;
    publicOwner: EthAddress;
    assetId: number;
    aliasHash: bigint;
    numInputNote: number;
    inputNotes: Note[];
    outputNotes: Note[];

    public constructor(
        proofId: number,
        publicValue: bigint,
        publicOwner: EthAddress,
        assetId: number,
        aliasHash: bigint,
        numInputNote: number,
        inputNotes: Note[],
        outputNotes: Note[]
    ) {
        this.proofId = proofId;
        this.publicOwner = publicOwner;
        this.publicValue = publicValue;
        this.assetId = assetId;
        this.aliasHash = aliasHash;
        this.numInputNote = numInputNote;
        this.inputNotes = inputNotes;
        this.outputNotes = outputNotes;
    }

    // nomalize the input
    toCircuitInput() {

    }
}

export class JoinSplitCircuit {
    static readonly PROOF_ID_TYPE_INVALID: number = 0;
    static readonly PROOF_ID_TYPE_DEPOSIT: number = 1;
    static readonly PROOF_ID_TYPE_WITHDRAW: number = 2;
    static readonly PROOF_ID_TYPE_SEND: number = 3;

    constructor() {}

    static async createSharedSecret(senderPvk: bigint): Promise<Buffer> {
        let eddsa = await buildEddsa();
        let babyJub = eddsa.babyJub;
        let rawSharedKey = babyJub.mulPointEscalar(babyJub.Base8, senderPvk);
        let sharedKey = createBlakeHash("blake256").update(Buffer.from(rawSharedKey)).digest();
        return sharedKey;
    }

    static async hashMsg(nc1: any, nc2: any, outputNote1: any, outputNote2: any, publicOwner: any, publicValue: any) {
        let poseidon = await buildPoseidon();
        let res = poseidon([
            nc1, nc2, outputNote1, outputNote2, publicOwner, publicValue
        ]);
        return poseidon.F.toObject(res);
    }

    static async createDepositInput (
        accountKey: AccountOrNullifierKey,
        signingKey: SigningKey,
        state: StateTree,
        proofId: number,
        aliasHash: bigint,
        assetId: number,
        publicValue: bigint,
        publicOwner: EigenAddress,
    ): Promise<JoinSplitInput> {
        // check proofId and publicValue
        if (publicValue == 0n || proofId != JoinSplitCircuit.PROOF_ID_TYPE_DEPOSIT) {
            return Promise.reject("proofId or publicValue is invalid");
        }

        let numInputNote = 0;
        let secret = await JoinSplitCircuit.createSharedSecret(signingKey.prvKey);
        
        let nc = await note.compress();
        let nullifier = JoinSplitCircuit.calculateNullifier(nc, state.siblings, accountKey);
        let outputNote = new Note(publicValue, secret, signingKey.pubKey, assetId, nullifier, NoteState.Pending);

        let input = new JoinSplitInput (
            proofId,
            publicValue,
            publicOwner,
            assetId,
            aliasHash,
            numInputNote,
            [],
            [outputNote]
        );
        return input;
    }

    static async createSendInput(
        accountKey: AccountOrNullifierKey,
        signingKey: SigningKey,
        state: StateTree,
        proofId: number,
        aliasHash: bigint,
        assetId: number,
        publicValue: bigint,
        publicOwner: EigenAddress,
        confirmedAndPendingInputNotes: Array<Note>
    ) {
        let pendingNote = confirmedAndPendingInputNotes.filter((n) => n.state == NoteState.Pending);
        let confirmedNote = confirmedAndPendingInputNotes.filter((n) => n.state == NoteState.Confirmed);
        let firstNode = pendingNote.shift();

        for (const note of confirmedNote) {
            let nc = await note.compress();
            let nullifier = JoinSplitCircuit.calculateNullifier(nc, state.siblings, accountKey);
            let input = new JoinSplitInput {
                proofId,

            }
        }

    }

    static calculateNullifier(nc: bigint, siblings: bigint[], nk: AccountOrNullifierKey) {

    }

    static updateState() {

    }

    static createProof() {

    }
}
