import { Note } from "./note";
import { AccountCircuit, SigningKey, EigenAddress } from "./account";
import { JoinSplitCircuit } from "./join_split";
const { buildBabyjub } = require("circomlibjs");

export class UpdateStatusInput {
    proofId: number = 0;
    publicValue: bigint = 0n;
    publicOwner: bigint = 0n;
    assetId: number = 0;
    publicAssetId: number = 0;
    aliasHash: bigint = 0n;
    numInputNote: number = 0;
    inputNotes: Note[] = [];
    outputNotes: Note[] = [];
    outputNCs: bigint[] = [];
    // dataTreeRoot: bigint;
    // siblings: bigint[][];
    // siblingsAC: bigint[];
    accountPrvKey: bigint = 0n;
    accountPubKey: bigint[] = [];
    accountRequired: boolean = false;
    signingPubKey: bigint[] = [];
    signatureR8: bigint[] = [];
    signatureS: bigint = 0n;
    newAccountPubKey: bigint[] = [];
    newSigningPubKey1: bigint[] = [];
    newSigningPubKey2: bigint[] = [];

    // tmp
    accountNC: bigint = 0n;
    newAccountNC: bigint = 0n;

    public constructor(
        usi: Partial<UpdateStatusInput>
    ) {
        Object.assign(this, usi);
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

        /*
        // console.log(inputJson)
        const fs = require("fs");
        fs.writeFileSync("./circuits/main_update_state.input.json",
                         JSON.stringify(
                             inputJson,
                             (key, value) => typeof value === "bigint" ?
                                 value.toString() :
                                 value // return everything else unchanged
                         ));
        */
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
            {
                proofId: accountInput.proofId,
                publicValue: 0n,
                publicOwner: 0n,
                assetId: 0,
                publicAssetId: 0,
                aliasHash: accountInput.aliasHash,
                numInputNote: 0,
                inputNotes: [],
                outputNotes: [],
                outputNCs: accountInput.outputNCs,
                accountPrvKey: 0n, // FIXME
                accountPubKey: accountInput.accountPubKey,
                signingPubKey: accountInput.signingPubKey,
                accountRequired: false,
                signatureR8: accountInput.signatureR8,
                signatureS: accountInput.signatureS,
                newAccountPubKey,
                newSigningPubKey1,
                newSigningPubKey2,
                accountNC: accountInput.accountNC,
                newAccountNC: accountInput.newAccountNC
            }
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
            let input = new UpdateStatusInput({
                proofId: joinSplitInput[i].proofId,
                publicValue: joinSplitInput[i].publicValue,
                publicOwner: joinSplitInput[i].publicOwner,
                assetId: joinSplitInput[i].assetId,
                publicAssetId: joinSplitInput[i].publicAssetId,
                aliasHash: joinSplitInput[i].aliasHash,
                numInputNote: joinSplitInput[i].numInputNote,
                inputNotes: joinSplitInput[i].inputNotes,
                outputNotes: joinSplitInput[i].outputNotes,
                outputNCs: joinSplitInput[i].outputNCs,
                accountPrvKey: joinSplitInput[i].accountPrvKey,
                accountPubKey: joinSplitInput[i].accountPubKey,
                signingPubKey: joinSplitInput[i].signingPubKey,
                accountRequired: joinSplitInput[i].accountRequired,
                signatureR8: [F.toObject(joinSplitInput[i].signatureR8[0]), F.toObject(joinSplitInput[i].signatureR8[1])],
                signatureS: joinSplitInput[i].signatureS,
                newAccountPubKey: [0n, 0n],
                newSigningPubKey1: [0n, 0n],
                newSigningPubKey2: [0n, 0n],
                accountNC: 0n,
                newAccountNC: 0n
            });
            inputList.push(input);
        }
        return Promise.resolve(inputList);
    }
}

