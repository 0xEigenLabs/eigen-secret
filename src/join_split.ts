const crypto = require("crypto");
const { buildPoseidon, buildEddsa } = require("circomlibjs");
const { Scalar, buildBn128, F1Field } = require("ffjavascript");
const createBlakeHash = require("blake-hash");
const { Buffer } = require("buffer");
import { ethers } from "ethers";
import { Note } from "./note";
import { SigningKey, AccountOrNullifierKey, EigenAddress, EthAddress } from "./account";
import { strict as assert } from "assert";
import { StateTree } from "./state_tree";
import { bigint2Tuple, parseProof, Proof } from "./utils";
const fs = require("fs");
const snarkjs = require("snarkjs");
const path = require("path");

export class JoinSplitInput {
    proofId: number;
    publicValue: bigint;
    publicOwner: EthAddress | undefined;
    assetId: number;
    aliasHash: bigint;
    inputNotes: Note[];
    outputNotes: Note[];
    outputNCs: bigint[];
    signature: bigint;

    public constructor(
        proofId: number,
        publicValue: bigint,
        publicOwner: EthAddress | undefined,
        assetId: number,
        aliasHash: bigint,
        inputNotes: Note[],
        outputNotes: Note[],
        outputNCs: bigint[],
        sig: bigint
    ) {
        this.proofId = proofId;
        this.publicOwner = publicOwner;
        this.publicValue = publicValue;
        this.assetId = assetId;
        this.aliasHash = aliasHash;
        this.inputNotes = inputNotes;
        this.outputNotes = outputNotes;
        this.outputNCs = outputNCs;
        this.signature = sig;
    }

    // nomalize the input
    toCircuitInput() {
        return {
            proof_id: this.proofId,
            public_value: this.publicValue,
            public_owner: this.publicOwner,
            num_input_notes: this.inputNotes.length,
            output_nc_1: this.outputNCs[0],
            output_nc_2: this.outputNCs[1]

        }
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

    static async createDepositInput(
        accountKey: AccountOrNullifierKey,
        signingKey: SigningKey,
        state: StateTree,
        proofId: number,
        aliasHash: bigint,
        assetId: number,
        publicValue: bigint,
        publicOwner: EigenAddress
    ): Promise<JoinSplitInput> {
        // check proofId and publicValue
        if (publicValue == 0n || proofId != JoinSplitCircuit.PROOF_ID_TYPE_DEPOSIT) {
            return Promise.reject("proofId or publicValue is invalid");
        }

        let bn128 = await buildBn128();
        const F = new F1Field(bn128.r);
        let secret = F.random();

        let nc = 0n;
        let nullifier = await JoinSplitCircuit.calculateNullifier(nc, 0n, accountKey);
        let owner = await signingKey.pubKey.unpack();
        let outputNote = new Note(publicValue, secret, F.toObject(owner[0]), assetId, nullifier);

        // signature
        let outputNc1 = await outputNote.compress();
        let sig = await JoinSplitCircuit.calculateSignature(accountKey, 0n, 0n, outputNc1, 0n, publicOwner, publicValue);

        let input = new JoinSplitInput(
            proofId,
            publicValue,
            publicOwner,
            assetId,
            aliasHash,
            [],
            [outputNote],
            [outputNc1],
            sig
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
        privateValue: bigint,
        recipientPrivateOutput: bigint,
        senderPrivateOutput: bigint,
        noteRecipent: EigenAddress | undefined,
        confirmedAndPendingInputNotes: Array<Note>
    ) {
        if (privateValue && !confirmedAndPendingInputNotes.length) {
            throw new Error(`Failed to find notes that sum to ${privateValue}.`)
        }
        const confirmedNote = confirmedAndPendingInputNotes.filter((n) => !n.pending);
        let firstNote = confirmedAndPendingInputNotes.find((n) => n.pending) || confirmedNote.shift();
        if (firstNote === undefined) {
            throw new Error(`Failed to find notes that sum to ${privateValue} + ${publicValue}`)
        }
        const lastNote = confirmedNote.pop();

        let bn128 = await buildBn128();
        const F = new F1Field(bn128.r);

        let inputList = new Array<JoinSplitInput>();
        let owner = await signingKey.pubKey.unpack();
        // Merge all the confirmed notes and public input and output into 2 notes.
        // Assume a is pending utxo and a.val is greater than 0, [a] is confirmed utxo, and [[a]] is spent input.
        // Given sequence, <[[o]], [a], [b], [c], d>, we firstly filter all the confirmed notes,
        // and begin to merge [a] and [b], outputs [a'] with 0 value and [b'] with a+b'value,
        // then merge [b'] and [c], to get [c'],  [c'] and d to [d].
        for (const note of confirmedNote) {
            let nc1 = await firstNote.compress();
            let nullifier1 = await JoinSplitCircuit.calculateNullifier(nc1, 1n, accountKey);

            let nc2 = await note.compress();
            let nullifier2 = await JoinSplitCircuit.calculateNullifier(nc2, 1n, accountKey);

            let secret = F.random();
            let outputNote1: Note = new Note(0n, secret, F.toObject(owner[0]), assetId, nullifier1);
            let outputNc1 = await outputNote1.compress();
            let outputNote2: Note = new Note(firstNote.val + note.val, secret, F.toObject(owner[0]), assetId, nullifier2);
            let outputNc2 = await outputNote2.compress();

            let sig = await JoinSplitCircuit.calculateSignature(accountKey, nc1, nc2, outputNc1, outputNc2, publicOwner, publicValue);
            let input = new JoinSplitInput(
                proofId, 0n, undefined, assetId, aliasHash,
                [firstNote, note],
                [outputNote1, outputNote2],
                [outputNc1, outputNc2],
                sig
            );
            inputList.push(input);
            firstNote = outputNote2;
            // TODO: update state of the spent note
        }

        // merge the last note and public input
        {
            const inputNotes = lastNote? [firstNote, lastNote]: [firstNote];
            assert(inputNotes[0]);
            let nc1 = await inputNotes[0].compress();
            let nullifier1 = await JoinSplitCircuit.calculateNullifier(nc1, 1n, accountKey);
            let secret = F.random();
            let outputNote1 = new Note(0n, secret, F.toObject(owner[0]), assetId, nullifier1);
            let outputNc1 = await outputNote1.compress();

            let nc2 = 0n;
            let outputNc2 = 0n;
            let outputNotes = [outputNote1];
            let outputNCs = [outputNc1];
            const totalInputNoteValue = inputNotes.reduce((sum, n) => sum + n.val, 0n);
            const change = totalInputNoteValue > privateValue ? totalInputNoteValue - privateValue : 0n;

            if (inputNotes.length > 1) {
                assert(inputNotes[1]);
                nc2 = await inputNotes[1].compress();
                let nullifier2 = await JoinSplitCircuit.calculateNullifier(nc2, 1n, accountKey);
                let outputNote2: Note = new Note(change + inputNotes[0].val + inputNotes[1].val, secret, F.toObject(owner[0]), assetId, nullifier2);
                outputNotes.push(outputNote2);
                outputNc2 = await outputNote2.compress();
                outputNCs.push(outputNc2);
            }

            let sig = await JoinSplitCircuit.calculateSignature(accountKey, nc1, nc2, outputNc1, outputNc2, publicOwner, publicValue);

            let input = new JoinSplitInput(
                proofId, publicValue, publicOwner, assetId, aliasHash, inputNotes, outputNotes, outputNCs, sig
            );
        }

        return Promise.resolve(inputList);
    }

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
            owner[3]
        ]);
        return poseidon.F.toObject(res);
    }

    static async updateState(
        state: StateTree
    ) {

    }

    static async createProof(circuitPath: string, input: JoinSplitInput): Promise<Proof> {
        let wasm = path.join(circuitPath, "main_js", "main.wasm");
        let zkey = path.join(circuitPath, "circuit_final.zkey");
        const wc = require(`${circuitPath}/main_js/witness_calculator`);
        const buffer = fs.readFileSync(wasm);
        const witnessCalculator = await wc(buffer);

        let inputJson = input.toCircuitInput();
        const witnessBuffer = await witnessCalculator.calculateWTNSBin(
            inputJson,
            0
        );

        const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, witnessBuffer);
        return Promise.resolve(parseProof(proof));
    }
}
