const crypto = require('crypto');
const { buildPoseidon, buildEddsa } = require("circomlibjs");
const { Scalar, buildBn128, F1Field } = require("ffjavascript");
const createBlakeHash = require("blake-hash");
const { Buffer } = require("buffer");
import { ethers } from "ethers";
import { Note, NoteState } from "./note";
import { SigningKey, AccountOrNullifierKey, EigenAddress, EthAddress } from "./account";
import { strict as assert } from "assert";
import { StateTree } from "./state_tree";
import { bigint2Tuple } from "./utils";

export class JoinSplitInput {
    proofId: number;
    publicValue: bigint;
    publicOwner: EthAddress;
    assetId: number;
    aliasHash: bigint;
    numInputNote: number;
    inputNotes: Note[];
    outputNotes: Note[];
    signature: bigint;

    public constructor(
        proofId: number,
        publicValue: bigint,
        publicOwner: EthAddress,
        assetId: number,
        aliasHash: bigint,
        numInputNote: number,
        inputNotes: Note[],
        outputNotes: Note[],
        sig: bigint,
    ) {
        this.proofId = proofId;
        this.publicOwner = publicOwner;
        this.publicValue = publicValue;
        this.assetId = assetId;
        this.aliasHash = aliasHash;
        this.numInputNote = numInputNote;
        this.inputNotes = inputNotes;
        this.outputNotes = outputNotes;
        this.signature = sig;
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

        let bn128 = await buildBn128();
        const F = new F1Field(bn128.r);

        let numInputNote = 0;
        let secret = F.random();

        let nc = 0n;
        let nullifier = await JoinSplitCircuit.calculateNullifier(nc, state.tree.siblings, accountKey);
        let owner = await signingKey.pubKey.unpack();
        let outputNote = new Note(publicValue, secret, F.toObject(owner[0]), assetId, nullifier, NoteState.Pending);

        // signature
        let outputNc1 = await outputNote.compress();
        let sig = await JoinSplitCircuit.calculateSignature(accountKey, 0n, 0n, outputNc1, 0n, publicOwner, publicValue);

        let input = new JoinSplitInput (
            proofId,
            publicValue,
            publicOwner,
            assetId,
            aliasHash,
            numInputNote,
            [],
            [outputNote],
            sig,
        );
        return input;
    }

    /*
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
            let nullifier = await JoinSplitCircuit.calculateNullifier(nc, state.siblings, accountKey);
            let input = new JoinSplitInput {
                proofId,

            }
        }

    }
    */

    static async calculateSignature(
        accountKey: AccountOrNullifierKey,
        nc1: bigint, nc2: bigint, outputNc1: bigint,
        outputNc2: bigint, publicOwner: EthAddress, publicValue: bigint) {
        let publicOwnerX = await publicOwner.unpack();
        let poseidon = await buildPoseidon();
        let msghash = poseidon([
            nc1,
            nc2,
            outputNc1,
            outputNc2,
            publicOwnerX[0],
            publicValue
        ]);
        let sig = await accountKey.sign(msghash);
        return poseidon.F.toObject(sig);
    }

    static async calculateNullifier(nc: bigint, inputNoteInUse: bigint, nk: AccountOrNullifierKey) {
        let poseidon = await buildPoseidon();
        let owner = bigint2Tuple(nk.prvKey);
        let res = poseidon([
            nc,
            inputNoteInUse,
            owner[0],
            owner[1],
            owner[2],
            owner[3],
        ]);
        return poseidon.F.toObject(res);
    }

    static updateState() {

    }

    static createProof() {

    }
}
