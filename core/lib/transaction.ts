/**
 * transaction.ts
 * create tx encryption
 */
import { UpdateStatusInput } from "./update_state";
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
    input: UpdateStatusInput;
    eddsa: any;

    constructor(input: any, eddsa: any) {
        this.input = input;
        this.eddsa = eddsa;
    }

    async encryptNote(): Promise<Array<TxData>> {
        let tes = [];
        let notes = this.input.inputNotes.concat(this.input.outputNotes);
        for (let note of notes) {
            let tmpKey = new SigningKey(this.eddsa);
            let sharedKey = tmpKey.makeSharedKey(note._owner);
            tes.push(
                new TxData(tmpKey.pubKey, note.encrypt(sharedKey))
            )
            // TODO delete(tmpKey);
        }
        return Promise.resolve(tes);
    }

    encryptTx(sender: SigningKey) {
        let output1 = this.input.outputNotes[0];
        let tmpKey = new SigningKey(this.eddsa);
        let data = {
            from: sender.pubKey.pubKey,
            to: output1._owner.pubKey,
            amount: output1.val,
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
        return aes.decrypt(txData.content);
    }
}
