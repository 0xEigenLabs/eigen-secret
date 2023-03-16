import { test, utils } from "../index";
import { Note } from "../src/note";
import { assert, expect } from "chai";
import { ethers } from "ethers";

const { buildEddsa, buildBabyjub } = require("circomlibjs");
import { SigningKey } from "../src/account";

describe("Test NoteCompressor", function () {

    let circuit: any;
    let eddsa: any;
    let babyJub: any;
    let F: any;

    before(async () => {
        eddsa = await buildEddsa();
        babyJub = await buildBabyjub();
        F = babyJub.F;
        circuit = await test.genTempMain("circuits/note_compressor.circom",
            "NoteCompressor", "", "", {});
    })

    it("Note compress test", async () => {
        let key = await (new SigningKey()).newKey(undefined);
        let note = new Note(1n, 2n, key.pubKey, 4, 5n, true);
        let wtns = await utils.executeCircuit(circuit, note.toCircuitInput(babyJub));
        await circuit.assertOut(wtns, { out: await note.compress(babyJub) });
    })
});
