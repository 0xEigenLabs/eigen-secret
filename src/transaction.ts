/**
 * transaction.ts
 * create tx encryption
 */
import { Note } from "./note";
import { SigningKey, EigenAddress } from "./account";
const buildEddsa = require("circomlibjs").buildEddsa;

class Transaction {
    notes: Array<Note>;
    sender: SigningKey;

    constructor(notes: Array<Note>, sender: SigningKey) {
        this.notes = notes;
        this.sender = sender;
    }

    async create() {
        let eddsa = await buildEddsa();
        let tmpKey = await (new SigningKey()).newKey(undefined);
        for (let note of this.notes) {
            let sharedKey = tmpKey.makeSharedKey(eddsa, note._owner);
        }
    }
}
