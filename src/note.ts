const buildPoseidon = require("circomlibjs").buildPoseidon;
import { Aes256gcm } from "./aes_gcm";

export class Note {
    nonce: bigint = 0n;
    assetId: bigint = 0n;
    accountId: bigint = 0n;
    val: bigint = 0n;
    secret: bigint = 0n;
    owner_x: bigint = 0n;
    owner_y: bigint = 0n;

    constructor(nonce: bigint, assetId: bigint, accountId: bigint, val: bigint, secret: bigint, pubKey: bigint[]) {
        this.nonce = nonce;
        this.assetId = assetId;
        this.accountId = accountId;
        this.val = val;
        this.secret = secret;
        this.owner_x = pubKey[0];
        this.owner_y = pubKey[1];
    }

    toCircuitInput():any {
        return {
            val: this.val,
            secret: this.secret,
            account_id: this.accountId,
            nonce: this.nonce,
            asset_id: this.assetId,
        }
    }

    async compress():Promise<bigint> {
        let poseidon = await buildPoseidon();
        let res = poseidon([
            this.val, this.secret, this.accountId, this.nonce, this.assetId,
        ]);
        return poseidon.F.toObject(res);
    }

    async encrypt(key: any): any {
        let aes = new Aes256gcm(key);
        let data = JSON.stringify({
            nonce: this.nonce;
            assetId: this.assetId;
            accountId: this.accountId;
            val: this.val;
            secret: this.secret;
            owner_x: this.owner_x;
            owner_y: this.owner_y;
        });
        return aes.encrypt(data)
    }

    async decrypt(key: any, cipherData) {
        let aes = new Aes256gcm(key);
        let data = aes.decrypt(cipherData);
    }
}

