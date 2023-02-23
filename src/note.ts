const buildPoseidon = require("circomlibjs").buildPoseidon;
import { Aes256gcm } from "./aes_gcm";
import { bigint2Tuple } from "./utils";

export enum NoteState {
    Pending = 1,
    Confirmed, // UTXO
    Destroyed,
    Cancel
}

export class Note {
    val: bigint;
    secret: bigint;
    ownerX: bigint;
    assetId: bigint;
    inputNullifier: bigint;
    state: NoteState;

    constructor(val: bigint, secret: bigint, ownerX: bigint, assetId: bigint, inputNullifier: bigint, state: NoteState) {
        this.val = val;
        this.secret = secret;
        this.ownerX = ownerX;
        this.assetId = assetId;
        this.inputNullifier = inputNullifier;
        this.state = state;
    }

    toCircuitInput(): any {
        return {
            val: this.val,
            secret: this.secret,
            owner: bigint2Tuple(this.ownerX),
            asset_id: this.assetId,
            input_nullifier: this.inputNullifier,
        }
    }

    async compress(): Promise<bigint> {
        let poseidon = await buildPoseidon();
        let owner = bigint2Tuple(this.ownerX);
        let res = poseidon([
            this.val,
            this.secret,
            owner[0],
            owner[1],
            owner[2],
            owner[3],
            this.assetId,
            this.inputNullifier
        ]);
        return poseidon.F.toObject(res);
    }

    encrypt(): any {
        let aes = new Aes256gcm(this.secret);
        let data = JSON.stringify({
            val: this.val,
            secret: this.secret,
            assetId: this.assetId,
            ownerX: this.ownerX,
            inputNullifier: this.inputNullifier,
            state: this.state
        });
        return aes.encrypt(data)
    }

    decrypt(cipherData: any): Note {
        let aes = new Aes256gcm(this.secret);
        let jsonData = aes.decrypt(cipherData[0], cipherData[1], cipherData[2]);
        let data = JSON.parse(jsonData);
        return new Note(
            data.val,
            data.secret,
            data.assetId,
            data.ownerX,
            data.inputNullifier,
            data.state
        );
    }
}
