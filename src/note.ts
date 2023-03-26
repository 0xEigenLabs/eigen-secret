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
            owner: this._owner.pubKey,
            inputNullifier: this.inputNullifier,
            accountRequired: this.accountRequired,
            index: this.index
        }, (_, v) => typeof v === "bigint" ? v.toString() : v);
        // console.log("encrypt", data);
        let cipher = aes.encrypt(data)
        return cipher.join(",")
    }

    static decrypt(_cipherData: string, secret: any): Note {
        let aes = new Aes256gcm(secret);
        let cipherData = _cipherData.split(",");
        if (cipherData.length != 3) {
            throw new Error(`Invalid cipher: ${_cipherData}`)
        }
        let jsonData = aes.decrypt(cipherData[0], cipherData[1], cipherData[2]);
        let data = JSON.parse(jsonData);
        // console.log("cipher", cipherData, data);
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
