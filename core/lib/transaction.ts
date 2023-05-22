/**
 * transaction.ts
 * create tx encryption
 */
import { Note } from "./note";
import { SigningKey, EigenAddress } from "./account";
import { prepareJson } from "./utils";
import { Aes256gcm } from "./aes_gcm";

export class TxData {
    pubKey: EigenAddress;
    content: string;
    constructor(pk: EigenAddress, cd: string) {
        this.pubKey = pk;
        this.content = cd;
    }

    get toString(): string {
        let obj = {
            pubKey: this.pubKey.pubKey,
            content: this.content
        }
        return JSON.stringify(obj)
    }

    static toObj(objStr: any): TxData {
        let obj = JSON.parse(objStr);
        return new TxData(new EigenAddress(obj.pubKey), obj.content)
    }
}

export enum TransactionModelStatus {
    UNKNOWN = 1,
    CONFIRMED = 2, // tx confirmed on L2
    AGGREGATING = 3, // tx is being aggregated to BatchProof
    SETTLED = 4, // tx confirmed on L1
}

export class Transaction {
    notes: Array<Note>;
    eddsa: any;

    static PlainTxData = class {
        from: string;
        to: string;
        assetId: number;
        amount: bigint;
        constructor(from: string, to: string, assetId: number, amount: bigint) {
            this.from = from;
            this.to = to;
            this.assetId = assetId;
            this.amount = amount;
        }
    }

    constructor(input: any, eddsa: any) {
        this.notes = input.inputNotes.concat(input.outputNotes);
        this.eddsa = eddsa;
    }

    async encryptNote(): Promise<Array<TxData>> {
        let tes = [];
        for (let note of this.notes) {
            let tmpKey = new SigningKey(this.eddsa);
            let sharedKey = tmpKey.makeSharedKey(note._owner);
            tes.push(
                new TxData(tmpKey.pubKey, note.encrypt(sharedKey))
            )
            // TODO delete(tmpKey);
        }
        return Promise.resolve(tes);
    }

    encryptTx(sender: SigningKey, amount: bigint) {
        let tmpKey = new SigningKey(this.eddsa);
        let output1 = this.notes[2]; // output notes 0
        let data = {
            from: sender.pubKey.pubKey,
            to: output1._owner.pubKey,
            amount: amount,
            assetId: output1.assetId
        }
        let sharedKey = tmpKey.makeSharedKey(sender.pubKey);
        let aes = new Aes256gcm(sharedKey);
        let cipher = aes.encrypt(JSON.stringify(prepareJson(data)));
        let txData = new TxData(tmpKey.pubKey, cipher);
        return txData.toString;
    }

    static decryptTx(content: String, sender: SigningKey) {
        let txData = TxData.toObj(content)
        let sharedKey = sender.makeSharedKey(txData.pubKey);
        let aes = new Aes256gcm(sharedKey);
        let data = aes.decrypt(txData.content);
        data = JSON.parse(data);
        return new Transaction.PlainTxData(data.from, data.to, data.assetId, data.amount);
    }

    static reEncryptTx(sender: SigningKey, oldSigningKey: SigningKey, oldTxList: Array<string>, eddsa: any) {
        let result = [];
        for (const otx of oldTxList) {
            try {
                let data = Transaction.decryptTx(otx, oldSigningKey);
                let tmpKey = new SigningKey(eddsa);
                let sharedKey = tmpKey.makeSharedKey(sender.pubKey);

                let aes = new Aes256gcm(sharedKey);
                let cipher = aes.encrypt(JSON.stringify(prepareJson(data)));
                result.push((new TxData(tmpKey.pubKey, cipher)).toString);
            } catch (e: any) {
                result.push("");
                console.log(`re-encrypt ${otx} error`, e);
            }
        }
        return result;
    }
}
