/**
 * transaction.ts
 * create tx encryption
 */
import { Note } from "./note";
import { SigningKey, EigenAddress } from "./account";
const buildEddsa = require("circomlibjs").buildEddsa;

class TxData {
    pubKey: EigenAddress;
    content: Buffer;
    constructor(pk: EigenAddress, cd: Buffer) {
        this.pubKey = pk;
        this.content = cd;
    }
}

class Transaction {
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
