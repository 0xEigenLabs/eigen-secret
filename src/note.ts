const buildPoseidon = require("circomlibjs").buildPoseidon;
import { Aes256gcm } from "./aes_gcm";
import { EigenAddress } from "./account";

export class Note {
    val: bigint;
    secret: bigint;
    _owner: EigenAddress; // account key
    assetId: number;
    inputNullifier: bigint;
    accountRequired: boolean;
    index: bigint;
    poseidon: any;

    constructor(val: bigint, secret: bigint, owner: EigenAddress, assetId: number,
                inputNullifier: bigint, accountRequired: boolean, index: bigint) {
        this.val = val;
        this.secret = secret;
        this._owner = owner;
        this.assetId = assetId;
        this.inputNullifier = inputNullifier;
        this.accountRequired = accountRequired;
        this.index = index;
    }

    get pending(): boolean {
        console.log(this.index);
        return this.index === undefined;
    }

    owner(babyJub: any): bigint[] {
        let owner = this._owner.unpack(babyJub);
        const F = babyJub.F;
        return [F.toObject(owner[0]), F.toObject(owner[1])];
    }

    toCircuitInput(babyJub: any): any {
        return {
            val: this.val,
            secret: this.secret,
            owner: this.owner(babyJub),
            asset_id: this.assetId,
            input_nullifier: this.inputNullifier,
            account_required: BigInt(this.accountRequired)
        }
    }

    async compress(babyJub: any): Promise<bigint> {
        let poseidon = await buildPoseidon();
        let owner = this.owner(babyJub);

        let res = poseidon([
            this.val,
            this.secret,
            owner[0],
            owner[1],
            this.assetId,
            this.inputNullifier,
            this.accountRequired? 1: 0
        ]);
        // console.log("NoteCompress js", this.val, this.secret, this.owner, this.assetId, this.inputNullifier);
        return poseidon.F.toObject(res);
    }

    encrypt(secret: any): any {
        let aes = new Aes256gcm(secret);
        let data = JSON.stringify({
            val: this.val,
            secret: this.secret,
            assetId: this.assetId,
            owner: this.owner,
            inputNullifier: this.inputNullifier,
            accountRequired: this.accountRequired,
            index: this.index
        });
        return aes.encrypt(data)
    }

    static decrypt(cipherData: any, secret: any): Note {
        let aes = new Aes256gcm(secret);
        let jsonData = aes.decrypt(cipherData[0], cipherData[1], cipherData[2]);
        let data = JSON.parse(jsonData);
        let n = new Note(
            data.val,
            data.secret,
            data.assetId,
            data.owner,
            data.inputNullifier,
            data.accountRequired,
            data.index
        );
        return n;
    }
}
