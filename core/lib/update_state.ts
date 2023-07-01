import { Note } from "./note";
import { AccountCircuit, SigningKey, EigenAddress } from "./account";
import { JoinSplitCircuit } from "./join_split";
const { buildBabyjub } = require("circomlibjs");

export class UpdateStatusInput {
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
    // dataTreeRoot: bigint;
    // siblings: bigint[][];
    // siblingsAC: bigint[];
    accountPrvKey: bigint;
    accountPubKey: bigint[];
    accountRequired: boolean;
    signingPubKey: bigint[];
    signatureR8: bigint[];
    signatureS: bigint;
    newAccountPubKey: bigint[];
    newSigningPubKey1: bigint[];
    newSigningPubKey2: bigint[];

    // tmp
    accountNC: bigint;
    newAccountNC: bigint;

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
        signatureR8: bigint[],
        signatureS: bigint,
        newAccountPubKey: bigint[],
        newSigningPubKey1: bigint[],
        newSigningPubKey2: bigint[],
        accountNC: bigint,
        newAccountNC: bigint
    ) {
        this.accountNC = accountNC;
        this.newAccountNC = newAccountNC;
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
        this.newAccountPubKey = newAccountPubKey;
        this.newSigningPubKey1 = newSigningPubKey1;
        this.newSigningPubKey2 = newSigningPubKey2;
        this.signatureR8 = signatureR8;
        this.signatureS = signatureS;
        this.accountRequired = accountRequired;
    }

    // nomalize the input
    toCircuitInput(babyJub: any, proof: any) {
        let inputJson = {
            proof_id: this.proofId,
            public_value: this.publicValue,
            public_owner: this.publicOwner,
            num_input_notes: BigInt(this.numInputNote),
            output_nc_1: this.outputNCs[0],
            output_nc_2: this.outputNCs[1],
            data_tree_root: proof.dataTreeRoot,
            siblings: proof.siblings,
            siblings_ac: proof.siblingsAC,
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
            account_required: this.accountRequired,
            account_note_nk: this.accountPrvKey,
            account_note_npk: this.accountPubKey,
            account_note_spk: this.signingPubKey,
            signatureR8: this.signatureR8,
            signatureS: this.signatureS,
            new_account_note_npk: this.newAccountPubKey,
            new_account_note_spk1: this.newSigningPubKey1,
            new_account_note_spk2: this.newSigningPubKey2
        };

        if (this.inputNotes.length > 0) {
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
        } else {
            for (let i = 0; i < 2; i ++) {
                inputJson.input_note_val[i] = 0n;
                inputJson.input_note_secret[i] = 0n;
                inputJson.input_note_asset_id[i] = 0n;
                inputJson.input_note_owner[i] = [0n, 0n];
                inputJson.input_note_nullifier[i] = 0n;
                inputJson.input_note_account_required[i] = 0n;

                inputJson.output_note_val[i] = 0n;
                inputJson.output_note_secret[i] = 0n;
                inputJson.output_note_asset_id[i] = 0n;
                inputJson.output_note_owner[i] = [0n, 0n];
                inputJson.output_note_nullifier[i] = 0n;
                inputJson.output_note_account_required[i] = 0n;
            }
        }

        // console.log(inputJson)
        const fs = require("fs");
        fs.writeFileSync("./circuits/main_update_state.input.json",
                         JSON.stringify(
                             inputJson,
                             (key, value) => typeof value === "bigint" ?
                                 value.toString() :
                                 value // return everything else unchanged
                         ));
        return inputJson;
    }
}

export class UpdateStatusCircuit {
    static async createAccountInput(
        eddsa: any,
        proofId: number,
        accountKey: SigningKey,
        signingKey: SigningKey,
        newAccountPubKey: bigint[],
        newSigningPubKey1: bigint[],
        newSigningPubKey2: bigint[],
        aliasHash: bigint
    ) {
        let accountInput = await AccountCircuit.createProofInput(
            eddsa,
            proofId,
            accountKey,
            signingKey,
            newAccountPubKey,
            newSigningPubKey1,
            newSigningPubKey2,
            aliasHash
        );
        return new UpdateStatusInput(
            accountInput.proofId,
            0n,
            0n,
            0,
            0,
            accountInput.aliasHash,
            0,
            [],
            [],
            accountInput.outputNCs,
            0n,
            accountInput.accountPubKey,
            accountInput.signingPubKey,
            false,
            accountInput.signatureR8,
            accountInput.signatureS,
            newAccountPubKey,
            newSigningPubKey1,
            newSigningPubKey2,
            accountInput.accountNC,
            accountInput.newAccountNC
        );
    }

    static async createJoinSplitInput(
        eddsa: any,
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
        let joinSplitInput = await JoinSplitCircuit.createProofInput(
            eddsa,
            accountKey,
            signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            publicAssetId,
            publicValue,
            publicOwner,
            recipientPrivateOutput,
            noteRecipent,
            confirmedAndPendingInputNotes,
            accountRequired
        );
        let babyJub = await buildBabyjub();
        const F = babyJub.F;
        let inputList = new Array<UpdateStatusInput>(0);
        for (let i=0; i<joinSplitInput.length; i++) {
            let input = new UpdateStatusInput(
                joinSplitInput[i].proofId,
                joinSplitInput[i].publicValue,
                joinSplitInput[i].publicOwner,
                joinSplitInput[i].assetId,
                joinSplitInput[i].publicAssetId,
                joinSplitInput[i].aliasHash,
                joinSplitInput[i].numInputNote,
                joinSplitInput[i].inputNotes,
                joinSplitInput[i].outputNotes,
                joinSplitInput[i].outputNCs,
                joinSplitInput[i].accountPrvKey,
                joinSplitInput[i].accountPubKey,
                joinSplitInput[i].signingPubKey,
                joinSplitInput[i].accountRequired,
                [F.toObject(joinSplitInput[i].signatureR8[0]), F.toObject(joinSplitInput[i].signatureR8[1])],
                joinSplitInput[i].signatureS,
                [0n, 0n], [0n, 0n], [0n, 0n], 0n, 0n
            );
            inputList.push(input);
            if (input.outputNotes[0].inputNullifier !== input.outputNCs[0] ||
                input.outputNotes[1].inputNullifier !== input.outputNCs[1]) {
                throw new Error(`${input.outputNotes} != ${input.outputNCs}`)
            }
        }
        return Promise.resolve(inputList);
    }
}

