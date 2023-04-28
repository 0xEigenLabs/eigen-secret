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

    async encrypt(eddsa: any): Promise<Array<TxData>> {
        let tmpKey = new SigningKey(eddsa);
        let tes = [];
        for (let note of this.notes) {
            let sharedKey = tmpKey.makeSharedKey(note._owner);
            tes.push(
                new TxData(tmpKey.pubKey, note.encrypt(sharedKey))
            )
        }
        return Promise.resolve(tes);
    }

    async decrypt(content: Array<TxData>): Promise<Array<Note>> {
        let result = [];
        for (let data of content) {
            let sharedKey = this.sender.makeSharedKey(data.pubKey);
            result.push(
                Note.decrypt(data.content, sharedKey)
            )
        }
        return result;
    }
}
