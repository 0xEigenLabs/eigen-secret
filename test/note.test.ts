import * as test from "./test";
import * as utils from "@eigen-secret/core/dist-node/utils";
import { Note } from "@eigen-secret/core/dist-node/note";
import { index } from "@eigen-secret/core/dist-node/utils";

const { buildEddsa, buildBabyjub } = require("circomlibjs");
import { SigningKey } from "@eigen-secret/core/dist-node/account";
/* globals describe, before, it */
describe("Test NoteCompressor", function() {
    let circuit: any;
    let eddsa: any;
    let babyJub: any;

    before(async () => {
        eddsa = await buildEddsa();
        babyJub = await buildBabyjub();
        circuit = await test.genTempMain("circuits/note_compressor.circom",
            "NoteCompressor", "", "", {});
    })

    it("Note compress test", async () => {
        let key = new SigningKey(eddsa);
        let note = new Note(1n, 2n, key.pubKey, 4, 5n, true, index());
        let wtns = await utils.executeCircuit(circuit, note.toCircuitInput(babyJub));
        await circuit.assertOut(wtns, { out: await note.compress(babyJub) });
    })
});
