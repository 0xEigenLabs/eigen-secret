/**
 * transaction.ts
 * create tx encryption
 */
import { Note } from "./note";
import { SigningKey, EigenAddress } from "./account";

class Transaction {
    notes: Array<Note>;
    sender: SigningKey;

    constructor(notes: Array<Note>, sender: SigningKey) {
        this.notes = notes;
        this.sender = sender;
    }

    async create() {
        let tmpKey = await (new SigningKey()).newKey(undefined);
        for (let note of this.notes) {
            let sharedKey = tmpKey.makeSharedKey(note.owner);

        }
    }
}
