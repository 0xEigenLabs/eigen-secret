const buildPoseidon = require("circomlibjs").buildPoseidon;
import { Aes256gcm } from "./aes_gcm";

export class Note {
    val: bigint;
    secret: bigint;
    owner: bigint[];
    assetId: number;
    inputNullifier: bigint;
    index: number | undefined;

    constructor(val: bigint, secret: bigint, owner: bigint[], assetId: number,
                inputNullifier: bigint, index: number | undefined = undefined) {
        this.val = val;
        this.secret = secret;
        this.owner = owner;
        this.assetId = assetId;
        this.inputNullifier = inputNullifier;
        this.index = index;
    }

    get pending(): boolean {
        console.log(this.index);
        return this.index === undefined;
    }

    toCircuitInput(): any {
        return {
            val: this.val,
            secret: this.secret,
            owner: this.owner,
            asset_id: this.assetId,
            input_nullifier: this.inputNullifier
        }
    }

    async compress(): Promise<bigint> {
        let poseidon = await buildPoseidon();
        let res = poseidon([
            this.val,
            this.secret,
            this.owner[0],
            this.owner[1],
            this.assetId,
            this.inputNullifier
        ]);
        // console.log("NoteCompress js", this.val, this.secret, this.owner, this.assetId, this.inputNullifier);
        return poseidon.F.toObject(res);
    }

    encrypt(): any {
        let aes = new Aes256gcm(this.secret);
        let data = JSON.stringify({
            val: this.val,
            secret: this.secret,
            assetId: this.assetId,
            owner: this.owner,
            inputNullifier: this.inputNullifier,
            index: this.index
        });
        return aes.encrypt(data)
    }

    decrypt(cipherData: any): Note {
        let aes = new Aes256gcm(this.secret);
        let jsonData = aes.decrypt(cipherData[0], cipherData[1], cipherData[2]);
        let data = JSON.parse(jsonData);
        let n = new Note(
            data.val,
            data.secret,
            data.assetId,
            data.owner,
            data.inputNullifier
        );
        n.index = data.index;
        return n;
    }
}
