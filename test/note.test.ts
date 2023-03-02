import { test, utils } from "../index";
import { Note } from "../src/note";
import { assert, expect } from "chai";
import { ethers } from "ethers";

const { buildEddsa, buildBabyjub } = require("circomlibjs");

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
        const msg = F.e(123411111111111n);
        let prvKey = ethers.utils.randomBytes(31);
        let pubKey = eddsa.prv2pub(prvKey);
        let note = new Note(1n, 2n, [F.toObject(pubKey[0]), F.toObject(pubKey[1])], 4, 5n, true);
        let wtns = await utils.executeCircuit(circuit, note.toCircuitInput());
        await circuit.assertOut(wtns, { out: await note.compress() });
    })
});
