/**
 * transaction.ts
 * create tx encryption
 */
import { Note } from "./note";
import { SigningKey, EigenAddress } from "./account";

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

export class Transaction {
    notes: Array<Note>;
    sender: SigningKey;

    constructor(notes: Array<Note>, sender: SigningKey) {
        this.notes = notes;
        this.sender = sender;
    }

    async encrypt(eddsa: any, encryptByReceiver: boolean = true): Promise<Array<TxData>> {
        let tes = [];
        for (let note of this.notes) {
            let tmpKey = new SigningKey(eddsa);
            let sharedKey: any;
            if (encryptByReceiver) {
                // make proof
                sharedKey = tmpKey.makeSharedKey(note._owner);
            } else {
                // make transaction history
                sharedKey = tmpKey.makeSharedKey(this.sender.pubKey);
            }
            tes.push(
                new TxData(tmpKey.pubKey, note.encrypt(sharedKey))
            )
            // TODO delete(tmpKey);
        }
        return Promise.resolve(tes);
    }

    static async decrypt(content: Array<TxData>, sender: SigningKey): Promise<Array<Note>> {
        let result = [];
        for (let data of content) {
            let sharedKey = sender.makeSharedKey(data.pubKey);
            result.push(
                Note.decrypt(data.content, sharedKey)
            )
        }
        return result;
    }
}
