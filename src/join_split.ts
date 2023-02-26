const { buildPoseidon, buildEddsa } = require("circomlibjs");
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
    publicOwner: bigint;
    assetId: number;
    aliasHash: bigint;
    inputNotes: Note[];
    outputNotes: Note[];
    outputNCs: bigint[];
    dataTreeRoot: bigint;
    siblings: bigint[][];
    signature: bigint;
    siblingsAC: bigint[];
    accountPrvKey: bigint[];
    accountPubKey: bigint[][];
    signingPubKey: bigint[];

    public constructor(
        proofId: number,
        publicValue: bigint,
        publicOwner: bigint,
        assetId: number,
        aliasHash: bigint,
        inputNotes: Note[],
        outputNotes: Note[],
        outputNCs: bigint[],
        dataTreeRoot: bigint,
        siblings: bigint[][],
        siblingsAC: bigint[],
        accountPrvKey: bigint[],
        accountPubKey: bigint[][],
        signingPubKey: bigint[],
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
        this.dataTreeRoot = dataTreeRoot;
        this.siblings = siblings;
        this.siblingsAC = siblingsAC;
        this.accountPubKey = accountPubKey;
        this.accountPrvKey = accountPrvKey;
        this.signingPubKey = signingPubKey;
        this.signature = sig;
    }

    // nomalize the input
    toCircuitInput(F: any) {
        let numInput = this.inputNotes.length;
        let inputJson = {
            proof_id: this.proofId,
            public_value: this.publicValue,
            public_owner: this.publicOwner,
            num_input_notes: numInput,
            output_nc_1: this.outputNCs[0],
            output_nc_2: this.outputNCs[1],
            data_tree_root: this.dataTreeRoot,
            asset_id: this.assetId,
            alias_hash: this.aliasHash,
            input_note_val: new Array<bigint>(numInput),
            input_note_secret: new Array<bigint>(numInput),
            input_note_asset_id: new Array<bigint>(numInput),
            input_note_owner: new Array<bigint[]>(numInput),
            input_note_nullifier: new Array<bigint>(numInput),
            output_note_val: new Array<bigint>(2),
            output_note_secret: new Array<bigint>(2),
            output_note_asset_id: new Array<bigint>(2),
            output_note_owner: new Array<bigint[]>(2),
            output_note_nullifier: new Array<bigint>(2),
            siblings: this.siblings,
            account_note_nk: this.accountPrvKey,
            account_note_npk: this.accountPubKey,
            account_note_spk: this.signingPubKey,
            siblings_ac: this.siblingsAC,
            signature: bigint2Tuple(this.signature)
        };

        for (let i = 0; i < numInput; i ++) {
            inputJson.input_note_val[i] = this.inputNotes[i].val;
            inputJson.input_note_secret[i] = this.inputNotes[i].secret;
            inputJson.input_note_asset_id[i] = BigInt(this.inputNotes[i].assetId);
            inputJson.input_note_owner[i] = bigint2Tuple(this.inputNotes[i].ownerX);
            inputJson.input_note_nullifier[i] = this.inputNotes[i].inputNullifier;
        }

        for (let i = 0; i < 2; i ++) {
            inputJson.output_note_val[i] = this.outputNotes[i].val;
            inputJson.output_note_secret[i] = this.outputNotes[i].secret;
            inputJson.output_note_asset_id[i] = BigInt(this.outputNotes[i].assetId);
            inputJson.output_note_owner[i] = bigint2Tuple(this.outputNotes[i].ownerX);
            inputJson.output_note_nullifier[i] = this.outputNotes[i].inputNullifier;
        }
        console.log(inputJson)
        fs.writeFileSync("/tmp/zkpay.json", JSON.stringify(inputJson))
        return inputJson;
    }
}

export class JoinSplitCircuit {
    static readonly PROOF_ID_TYPE_INVALID: number = 0;
    static readonly PROOF_ID_TYPE_DEPOSIT: number = 1;
    static readonly PROOF_ID_TYPE_WITHDRAW: number = 2;
    static readonly PROOF_ID_TYPE_SEND: number = 3;

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
        acStateKey: bigint,
        proofId: number,
        aliasHash: bigint,
        assetId: number,
        publicValue: bigint,
        publicOwner: EigenAddress,
        confirmedAndPendingInputNotes: Array<Note>
    ): Promise<Array<JoinSplitInput>> {
        // check proofId and publicValue
        if (publicValue == 0n || proofId != JoinSplitCircuit.PROOF_ID_TYPE_DEPOSIT) {
            return Promise.reject(new Error("proofId or publicValue is invalid"));
        }

        let res = await JoinSplitCircuit.createProofInput(
            accountKey,
            signingKey,
            state,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            publicValue,
            publicOwner,
            0n,
            0n,
            publicValue,
            signingKey.pubKey,
            confirmedAndPendingInputNotes
        );
        return Promise.resolve(res);
    }

    static fakeNote(F: any, ownerX: bigint, assetId: number) {
        return new Note(0n, 0n, ownerX, assetId, F.toObject(F.random()));
    }

    static async createProofInput(
        accountKey: AccountOrNullifierKey,
        signingKey: SigningKey,
        state: StateTree,
        acStateKey: bigint,
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
        let eddsa = await buildEddsa();
        const F = eddsa.F;
        const confirmedNote = confirmedAndPendingInputNotes.filter((n) => !n.pending);
        let owner = await signingKey.pubKey.unpack();
        let ownerX = F.toObject(owner[0]);

        let publicOwnerXY = await publicOwner.unpack();
        let publicOwnerX = F.toObject(publicOwnerXY[0]);

        let firstNote = confirmedAndPendingInputNotes.find((n) => n.pending) ||
            confirmedNote.shift() ||
            JoinSplitCircuit.fakeNote(F, ownerX, assetId);
        const lastNote = confirmedNote.pop();

        let inputList = new Array<JoinSplitInput>(0);
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

            let secret = F.toObject(F.random());
            let outputNote1: Note = new Note(
                0n, secret, F.toObject(owner[0]), assetId, nullifier1);
            let outputNc1 = await outputNote1.compress();
            let outputNote2: Note = new Note(
                firstNote.val + note.val, secret, F.toObject(owner[0]), assetId, nullifier2);
            let outputNc2 = await outputNote2.compress();

            let sig = await JoinSplitCircuit.calculateSignature(
                accountKey, nc1, nc2, outputNc1, outputNc2, publicOwnerX, publicValue);
            await state.insert(outputNc1, 2);
            await state.insert(outputNc2, 2);

            let noteInput1 = await state.find(outputNc1);
            let noteInput2 = await state.find(outputNc2);
            let ac = await state.find(F.e(acStateKey))

            let input = new JoinSplitInput(
                proofId, 0n, 0n, assetId, aliasHash,
                [firstNote, note],
                [outputNote1, outputNote2],
                [outputNc1, outputNc2],
                F.toObject(state.root()),
                [noteInput1.siblings, noteInput2.siblings],
                ac.siblings,
                bigint2Tuple(accountKey.prvKey),
                await accountKey.toCircuitInput(),
                (await signingKey.toCircuitInput())[0],
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
            for (let i = inputNotes.length; i < 2; i ++) {
                inputNotes.push(
                    JoinSplitCircuit.fakeNote(F, ownerX, assetId)
                );
            }

            let nc1 = await inputNotes[0].compress();
            let nullifier1 = await JoinSplitCircuit.calculateNullifier(nc1, 1n, accountKey);
            let secret = F.toObject(F.random());
            let outputNote1 = new Note(0n, secret, F.toObject(owner[0]), assetId, nullifier1);
            let outputNc1 = await outputNote1.compress();

            let nc2 = 0n;
            let outputNc2 = 0n;
            let outputNotes = [outputNote1];
            let outputNCs = [outputNc1];
            const totalInputNoteValue = inputNotes.reduce((sum, n) => sum + n.val, 0n);
            const change = totalInputNoteValue > privateValue ? totalInputNoteValue - privateValue : 0n;

            assert(inputNotes[1]);
            nc2 = await inputNotes[1].compress();
            let nullifier2 = await JoinSplitCircuit.calculateNullifier(nc2, 1n, accountKey);
            let outputNote2: Note = new Note(
                change + publicValue,
                secret, F.toObject(owner[0]), assetId, nullifier2
            );
            outputNotes.push(outputNote2);
            outputNc2 = await outputNote2.compress();
            outputNCs.push(outputNc2);

            let publicOwnerXY = await publicOwner.unpack();
            let publicOwnerX = F.toObject(publicOwnerXY[0]);
            let sig = await JoinSplitCircuit.calculateSignature(
                accountKey, nc1, nc2, outputNc1, outputNc2, publicOwnerX, publicValue);
            await state.insert(outputNc1, inputNotes.length);
            await state.insert(outputNc2, inputNotes.length);

            let noteInput1 = await state.find(outputNc1);
            let noteInput2 = await state.find(outputNc2);
            let ac = await state.find(F.e(acStateKey))
            let input = new JoinSplitInput(
                proofId, publicValue, publicOwnerX, assetId, aliasHash, inputNotes, outputNotes, outputNCs,
                F.toObject(state.root()),
                [noteInput1.siblings, noteInput2.siblings],
                ac.siblings,
                bigint2Tuple(F.toObject(accountKey.prvKey)),
                await accountKey.toCircuitInput(),
                (await signingKey.toCircuitInput())[0],
                sig
            );
            inputList.push(input);
        }

        return Promise.resolve(inputList);
    }

    static async calculateSignature(
        accountKey: AccountOrNullifierKey,
        nc1: bigint, nc2: bigint, outputNc1: bigint,
        outputNc2: bigint, publicOwner: bigint, publicValue: bigint) {
        let poseidon = await buildPoseidon();
        let msghash = poseidon([
            nc1,
            nc2,
            outputNc1,
            outputNc2,
            publicOwner,
            publicValue
        ]);
        let sig = await accountKey.sign(msghash);
        return poseidon.F.toObject(sig);
    }

    static async calculateNullifier(nc: bigint, inputNoteInUse: bigint, nk: AccountOrNullifierKey) {
        let poseidon = await buildPoseidon();
        let owner = bigint2Tuple(poseidon.F.toObject(nk.prvKey));
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

    static async createProof(circuitPath: string, input: JoinSplitInput, F: any): Promise<Proof> {
        let wasm = path.join(circuitPath, "main_js", "main.wasm");
        let zkey = path.join(circuitPath, "circuit_final.zkey");
        const wc = require(`${circuitPath}/main_js/witness_calculator`);
        const buffer = fs.readFileSync(wasm);
        const witnessCalculator = await wc(buffer);

        let inputJson = input.toCircuitInput(F);
        const witnessBuffer = await witnessCalculator.calculateWTNSBin(
            inputJson,
            0
        );

        const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, witnessBuffer);
        return Promise.resolve(parseProof(proof));
    }
}
