const buildPoseidon = require("circomlibjs").buildPoseidon;
import { Aes256gcm } from "./aes_gcm";
import { EigenAddress } from "./account";

export enum NoteState {
    _CREATING = 1,
    PROVED,
    SPENT,
}

export class Note {
    val: bigint;
    secret: bigint;
    _owner: EigenAddress; // account key
    assetId: number;
    inputNullifier: bigint;
    accountRequired: boolean;
    index: bigint;
    poseidon: any;
    adopted: boolean;

    constructor(val: bigint, secret: bigint, owner: EigenAddress, assetId: number,
                inputNullifier: bigint, accountRequired: boolean, index: bigint) {
        this.val = val;
        this.secret = secret;
        this._owner = owner;
        this.assetId = assetId;
        this.inputNullifier = inputNullifier;
        this.accountRequired = accountRequired;
        this.index = index;
        this.adopted = true;
    }

    get pending(): boolean {
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

    encrypt(key: any): any {
        let aes = new Aes256gcm(key);
        let data = JSON.stringify({
            val: this.val,
            secret: this.secret,
            assetId: this.assetId,
            owner: this._owner.pubKey,
            inputNullifier: this.inputNullifier,
            accountRequired: this.accountRequired,
            index: this.index
        }, (_, v) => typeof v === "bigint" ? v.toString() : v);
        let cipher = aes.encrypt(data)
        return cipher;
    }

    static decrypt(_cipherData: string, key: any): Note {
        let aes = new Aes256gcm(key);
        let jsonData = aes.decrypt(_cipherData);
        let data = JSON.parse(jsonData);
        let n = new Note(
            BigInt(data.val),
            BigInt(data.secret),
            new EigenAddress(data.owner),
            data.assetId,
            BigInt(data.inputNullifier),
            data.accountRequired,
            BigInt(data.index)
        );
        return n;
    }
}
