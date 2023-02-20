const buildPoseidon = require("circomlibjs").buildPoseidon;
import { Aes256gcm } from "./aes_gcm";

export class Note {
    nonce: bigint = 0n;
    assetId: bigint = 0n;
    accountId: bigint = 0n;
    val: bigint = 0n;
    secret: bigint = 0n;
    ownerX: bigint = 0n;
    ownerY: bigint = 0n;

    constructor(nonce: bigint, assetId: bigint, accountId: bigint, val: bigint, secret: bigint, pubKey: bigint[]) {
        this.nonce = nonce;
        this.assetId = assetId;
        this.accountId = accountId;
        this.val = val;
        this.secret = secret;
        this.ownerX = pubKey[0];
        this.ownerY = pubKey[1];
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

    encrypt(key: any): any {
        let aes = new Aes256gcm(key);
        let data = JSON.stringify({
            nonce: this.nonce,
            assetId: this.assetId,
            accountId: this.accountId,
            val: this.val,
            secret: this.secret,
            ownerX: this.ownerX,
            ownerY: this.ownerY,
        });
        return aes.encrypt(data)
    }

    decrypt(key: any, cipherData: any): Note {
        let aes = new Aes256gcm(key);
        let jsonData = aes.decrypt(cipherData[0], cipherData[1], cipherData[2]);
        let data = JSON.parse(jsonData);
        return new Note(
            data.nonce, 
            data.assetId,
            data.accountId,
            data.val,
            data.secret,
            data.pubKey
        );
    }
}

