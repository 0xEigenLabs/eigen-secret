/**
 * transaction.ts
 * create tx encryption
 */
import { Note } from "./note";
import { SigningKey, EigenAddress } from "./account";
const buildEddsa = require("circomlibjs").buildEddsa;

export class TxData {
    pubKey: EigenAddress;
    content: string;
    constructor(pk: EigenAddress, cd: string) {
        this.pubKey = pk;
        this.content = cd;
    }

    get toString(): string {
        console.log("content", this.content);
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

    async encrypt(): Promise<Array<TxData>> {
        let eddsa = await buildEddsa();
        let tmpKey = await (new SigningKey()).newKey(undefined);
        let tes = [];
        for (let note of this.notes) {
            console.log(note._owner);
            let sharedKey = tmpKey.makeSharedKey(eddsa, note._owner);
            tes.push(
                new TxData(tmpKey.pubKey, note.encrypt(sharedKey))
            )
        }
        return Promise.resolve(tes);
    }

    async decrypt(content: Array<TxData>): Promise<Array<Note>> {
        let result = [];
        let eddsa = await buildEddsa();
        for (let data of content) {
            let sharedKey = this.sender.makeSharedKey(eddsa, data.pubKey);
            result.push(
                Note.decrypt(data.content, sharedKey)
            )
        }
        return result;
    }
}
