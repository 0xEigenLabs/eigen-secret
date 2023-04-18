const { buildPoseidon, buildEddsa } = require("circomlibjs");
const createBlakeHash = require("blake-hash");
import { Note } from "./note";
import { SigningKey, EigenAddress } from "./account";
import { strict as assert } from "assert";
import { index } from "./utils";
const { Scalar, utils } = require("ffjavascript");

export class JoinSplitInput {
    proofId: number;
    publicValue: bigint;
    publicOwner: bigint;
    assetId: number;
    publicAssetId: number;
    aliasHash: bigint;
    numInputNote: number;
    inputNotes: Note[];
    outputNotes: Note[];
    outputNCs: bigint[];
    // here we lazly update the SMT
    // dataTreeRoot: bigint;
    // siblings: bigint[][];
    // siblingsAC: bigint[];
    accountPrvKey: bigint;
    accountPubKey: bigint[];
    accountRequired: boolean;
    signingPubKey: bigint[];
    signatureR8: bigint[];
    signatureS: bigint;
    enabled: bigint;

    public constructor(
        proofId: number,
        publicValue: bigint,
        publicOwner: bigint,
        assetId: number,
        publicAssetId: number,
        aliasHash: bigint,
        numInputNote: number,
        inputNotes: Note[],
        outputNotes: Note[],
        outputNCs: bigint[],
        // dataTreeRoot: bigint,
        // siblings: bigint[][],
        // siblingsAC: bigint[],
        accountPrvKey: bigint,
        accountPubKey: bigint[],
        signingPubKey: bigint[],
        accountRequired: boolean,
        sig: any,
        enabled: bigint = 1n
    ) {
        this.proofId = proofId;
        this.publicOwner = publicOwner;
        this.publicValue = publicValue;
        this.assetId = assetId;
        this.publicAssetId = publicAssetId;
        this.aliasHash = aliasHash;
        this.numInputNote = numInputNote;
        this.inputNotes = inputNotes;
        this.outputNotes = outputNotes;
        this.outputNCs = outputNCs;
        // this.dataTreeRoot = dataTreeRoot;
        // this.siblings = siblings;
        // this.siblingsAC = siblingsAC;
        this.accountPubKey = accountPubKey;
        this.accountPrvKey = accountPrvKey;
        this.signingPubKey = signingPubKey;
        this.signatureR8 = sig.R8;
        this.signatureS = sig.S;
        this.accountRequired = accountRequired;
        this.enabled = enabled;
    }

    // nomalize the input
    toCircuitInput(babyJub: any, proof: any) {
        const F = babyJub.F;
        let inputJson = {
            proof_id: this.proofId,
            public_value: this.publicValue,
            public_owner: this.publicOwner,
            num_input_notes: BigInt(this.numInputNote),
            output_nc_1: this.outputNCs[0],
            output_nc_2: this.outputNCs[1],
            data_tree_root: proof.dataTreeRoot,
            asset_id: this.assetId,
            public_asset_id: this.publicAssetId,
            alias_hash: this.aliasHash,
            input_note_val: new Array<bigint>(2),
            input_note_secret: new Array<bigint>(2),
            input_note_asset_id: new Array<bigint>(2),
            input_note_owner: new Array<bigint[]>(2),
            input_note_nullifier: new Array<bigint>(2),
            input_note_account_required: new Array<bigint>(2),
            output_note_val: new Array<bigint>(2),
            output_note_secret: new Array<bigint>(2),
            output_note_asset_id: new Array<bigint>(2),
            output_note_owner: new Array<bigint[]>(2),
            output_note_nullifier: new Array<bigint>(2),
            output_note_account_required: new Array<bigint>(2),
            siblings: proof.siblings,
            account_required: this.accountRequired,
            account_note_nk: this.accountPrvKey,
            account_note_npk: this.accountPubKey,
            account_note_spk: this.signingPubKey,
            siblings_ac: proof.siblingsAC,
            signatureR8: [F.toObject(this.signatureR8[0]), F.toObject(this.signatureR8[1])],
            signatureS: this.signatureS,
            enabled: this.enabled
        };

        for (let i = 0; i < 2; i ++) {
            inputJson.input_note_val[i] = this.inputNotes[i].val;
            inputJson.input_note_secret[i] = this.inputNotes[i].secret;
            inputJson.input_note_asset_id[i] = BigInt(this.inputNotes[i].assetId);
            inputJson.input_note_owner[i] = this.inputNotes[i].owner(babyJub);
            inputJson.input_note_nullifier[i] = this.inputNotes[i].inputNullifier;
            inputJson.input_note_account_required[i] = BigInt(this.inputNotes[i].accountRequired);

            inputJson.output_note_val[i] = this.outputNotes[i].val;
            inputJson.output_note_secret[i] = this.outputNotes[i].secret;
            inputJson.output_note_asset_id[i] = BigInt(this.outputNotes[i].assetId);
            inputJson.output_note_owner[i] = this.outputNotes[i].owner(babyJub);
            inputJson.output_note_nullifier[i] = this.outputNotes[i].inputNullifier;
            inputJson.output_note_account_required[i] = BigInt(this.outputNotes[i].accountRequired);
        }
        // console.log(inputJson)
        // const fs = require("fs");
        // fs.writeFileSync("./circuits/main_update_state.input.json", JSON.stringify(inputJson))
        return inputJson;
    }
}

export class JoinSplitCircuit {
    static readonly PROOF_ID_TYPE_INVALID: number = 0;
    static readonly PROOF_ID_TYPE_DEPOSIT: number = 1;
    static readonly PROOF_ID_TYPE_WITHDRAW: number = 2;
    static readonly PROOF_ID_TYPE_SEND: number = 3;

    static async hashMsg(nc1: any, nc2: any, outputNote1: any, outputNote2: any, publicOwner: any, publicValue: any) {
        let poseidon = await buildPoseidon();
        let res = poseidon([
            nc1, nc2, outputNote1, outputNote2, publicOwner, publicValue
        ]);
        return poseidon.F.toObject(res);
    }

    static async createDepositInput(
        accountKey: SigningKey,
        signingKey: SigningKey,
        acStateKey: bigint,
        proofId: number,
        aliasHash: bigint,
        assetId: number,
        publicAssetId: number,
        publicValue: bigint,
        publicOwner: EigenAddress | undefined,
        noteRecipent: EigenAddress, // allow user to deposit to others
        confirmedAndPendingInputNotes: Array<Note>,
        accountRequired: boolean
    ): Promise<Array<JoinSplitInput>> {
        // check proofId and publicValue
        if (publicValue == 0n || proofId != JoinSplitCircuit.PROOF_ID_TYPE_DEPOSIT) {
            return Promise.reject(new Error("proofId or publicValue is invalid"));
        }

        let res = await JoinSplitCircuit.createProofInput(
            accountKey,
            signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            publicAssetId,
            publicValue,
            publicOwner,
            publicValue,
            noteRecipent,
            confirmedAndPendingInputNotes,
            accountRequired
        );
        return Promise.resolve(res);
    }

    static fakeNote(F: any, owner: EigenAddress, assetId: number, index: bigint) {
        return new Note(0n, 0n, owner, assetId, F.toObject(F.random()), false, index);
    }

    static async createProofInput(
        accountKey: SigningKey,
        signingKey: SigningKey,
        acStateKey: bigint,
        proofId: number,
        aliasHash: bigint,
        assetId: number,
        publicAssetId: number,
        publicValue: bigint,
        publicOwner: EigenAddress | undefined,
        recipientPrivateOutput: bigint,
        noteRecipent: EigenAddress,
        confirmedAndPendingInputNotes: Array<Note>,
        accountRequired: boolean
    ) {
        let eddsa = await buildEddsa();
        const F = eddsa.F;
        const babyJub = eddsa.babyJub;
        const confirmedNote = confirmedAndPendingInputNotes.filter((n) => !n.pending);

        let owner = accountKey.pubKey;
        let publicOwnerX = 0n;
        if (publicOwner !== undefined) {
            let publicOwnerXY = publicOwner.unpack(babyJub);
            publicOwnerX = F.toObject(publicOwnerXY[0]);
        }

        let firstNote = confirmedAndPendingInputNotes.find((n) => n.pending) ||
            confirmedNote.shift();
        let lastNote = confirmedNote.pop();
        let numInputNote = 0;

        let inputList = new Array<JoinSplitInput>(0);
        // Merge all the confirmed notes and public input and output into 2 notes.
        // Assume a is pending utxo and a.val is greater than 0, [a] is confirmed utxo, and [[a]] is spent input.
        // Given a sequence, <[[o]], [a], [b], [c], d>, we firstly filter all the confirmed notes,
        // and begin to merge [a] and [b], outputs [a'] with 0 value and [b'] with a+b'value,
        // then merge [b'] and [c], to get [c'],  [c'] and d to [d].
        for (const note of confirmedNote) {
            assert(firstNote);
            let nc1 = await firstNote.compress(babyJub);
            let nullifier1 = await JoinSplitCircuit.calculateNullifier(nc1, 1n, accountKey);

            let nc2 = await note.compress(babyJub);
            let nullifier2 = await JoinSplitCircuit.calculateNullifier(nc2, 1n, accountKey);

            numInputNote = 2;
            let secret = F.toObject(F.random());
            let outputNote1: Note = new Note(
                0n, secret, owner, assetId, nullifier1, false, index());
            let outputNc1 = await outputNote1.compress(babyJub);
            let outputNote2: Note = new Note(
                firstNote.val + note.val, secret, owner, assetId, nullifier2, false, index());
            let outputNc2 = await outputNote2.compress(babyJub);

            let sig = await JoinSplitCircuit.calculateSignature(
                accountKey, nullifier1, nullifier2, outputNc1, outputNc2, 0n, 0n);

            /*
            let state = await WorldState.getInstance();
            await state.insert(outputNc1, nullifier1);
            await state.insert(outputNc2, nullifier2);

            let noteInput1 = await state.find(outputNc1);
            let noteInput2 = await state.find(outputNc2);
            let ac = await state.find(F.e(acStateKey));
            */

            let ak = await accountKey.toCircuitInput();

            let input = new JoinSplitInput(
                JoinSplitCircuit.PROOF_ID_TYPE_SEND, 0n, 0n, assetId, 0, aliasHash,
                numInputNote,
                [firstNote, note],
                [outputNote1, outputNote2],
                [outputNc1, outputNc2],
                // F.toObject(state.root()),
                // [siblingsPad(noteInput1.siblings, F), siblingsPad(noteInput2.siblings, F)],
                // siblingsPad(ac.siblings, F),
                ak[1][0],
                ak[0],
                (await signingKey.toCircuitInput())[0],
                accountRequired,
                sig
            );
            inputList.push(input);
            firstNote = outputNote2;
        }

        // merge the last note and public input
        {
            // assert(firstNote);
            let inputNotes: Note[] = [];
            if (firstNote) {
                inputNotes = lastNote? [firstNote, lastNote] : [firstNote];
            }
            let inputNoteInUse: bigint[] = [1n, 1n];
            numInputNote = inputNotes.length;
            for (let i = inputNotes.length; i < 2; i ++) {
                inputNotes.push(
                    JoinSplitCircuit.fakeNote(F, owner, assetId, index())
                );
                inputNoteInUse[i] = 0n;
            }

            let nc1 = await inputNotes[0].compress(babyJub);
            let nullifier1 = await JoinSplitCircuit.calculateNullifier(nc1, inputNoteInUse[0], accountKey);
            let secret = F.toObject(F.random());
            let outputNote1 = new Note(
                recipientPrivateOutput,
                secret,
                noteRecipent,
                assetId,
                nullifier1,
                false,
                index()
            );
            let outputNc1 = await outputNote1.compress(babyJub);

            let outputNotes = [outputNote1];
            let outputNCs = [outputNc1];
            let totalInputNoteValue = inputNotes.reduce((sum, n) => sum + n.val, 0n);
            console.log(`init: totalIn ${totalInputNoteValue}, publicValue: ${publicValue}, recipientPrivateOutput: ${recipientPrivateOutput}`);
            if (proofId != JoinSplitCircuit.PROOF_ID_TYPE_DEPOSIT) {
                if (totalInputNoteValue < recipientPrivateOutput) {
                    throw new Error(
                        `Insufficient balance to private value: ${totalInputNoteValue}, ${recipientPrivateOutput}`
                    )
                }
            } else {
                totalInputNoteValue += publicValue;
            }
            console.log(`total: totalIn ${totalInputNoteValue}, publicValue: ${publicValue}, recipientPrivateOutput: ${recipientPrivateOutput}`);
            let change = totalInputNoteValue - recipientPrivateOutput;
            console.log(`sub private: totalIn ${totalInputNoteValue}, publicValue: ${publicValue}, recipientPrivateOutput: ${recipientPrivateOutput}, change ${change}`);

            if (proofId != JoinSplitCircuit.PROOF_ID_TYPE_DEPOSIT) {
                if (change < publicValue) {
                    throw new Error(`Insufficient balance to public value: ${change}, ${publicValue}`);
                }
                change = change - publicValue;
            }
            console.log(`sub public: totalIn ${totalInputNoteValue}, publicValue: ${publicValue}, recipientPrivateOutput: ${recipientPrivateOutput}, change ${change}`);

            assert(inputNotes[1]);
            let nc2 = await inputNotes[1].compress(babyJub);
            let nullifier2 = await JoinSplitCircuit.calculateNullifier(nc2, inputNoteInUse[1], accountKey);
            secret = F.toObject(F.random());
            let outputNote2: Note = new Note(
                change, secret, owner, assetId, nullifier2, false,
                index()
            );
            outputNotes.push(outputNote2);
            let outputNc2 = await outputNote2.compress(babyJub);
            outputNCs.push(outputNc2);

            let sig = await JoinSplitCircuit.calculateSignature(
                accountKey, nullifier1, nullifier2, outputNc1, outputNc2, publicOwnerX, publicValue);
            /*
            let state = await WorldState.getInstance();
            await state.insert(outputNc1, nullifier1);
            await state.insert(outputNc2, nullifier2);

            let noteInput1 = await state.find(outputNc1);
            let noteInput2 = await state.find(outputNc2);
             let ac = await state.find(F.e(acStateKey));
             */

            let ak = accountKey.toCircuitInput();
            let input = new JoinSplitInput(
                proofId, publicValue, publicOwnerX, assetId, publicAssetId, aliasHash,
                numInputNote, inputNotes, outputNotes, outputNCs,
                // F.toObject(state.root()),
                // [siblingsPad(noteInput1.siblings, F), siblingsPad(noteInput2.siblings, F)],
                // siblingsPad(ac.siblings, F),
                ak[1][0],
                ak[0],
                (signingKey.toCircuitInput())[0],
                accountRequired,
                sig
            );
            inputList.push(input);
        }
        return Promise.resolve(inputList);
    }

    static async calculateSignature(
        accountKey: SigningKey,
        nf1: bigint, nf2: bigint, outputNc1: bigint,
        outputNc2: bigint, publicOwner: bigint, publicValue: bigint) {
        let poseidon = await buildPoseidon();
        let msghash = poseidon([
            nf1,
            nf2,
            outputNc1,
            outputNc2,
            publicOwner,
            publicValue
        ]);
        let sig = await accountKey.sign(msghash);
        return sig;
    }

    static async calculateNullifier(nc: bigint, inputNoteInUse: bigint, nk: SigningKey) {
        let eddsa = await buildEddsa();
        let poseidon = await buildPoseidon();
        const pvk = eddsa.pruneBuffer(createBlakeHash("blake512").update(nk.prvKey).digest().slice(0, 32));
        const ak = Scalar.shr(utils.leBuff2int(pvk), 3);

        let res = poseidon([
            nc,
            inputNoteInUse,
            ak
        ]);
        return poseidon.F.toObject(res);
    }
}
