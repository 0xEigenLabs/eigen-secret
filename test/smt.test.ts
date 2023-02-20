import { expect, assert } from "chai";
import path = require("path");
import { test } from "../index";
import { StateTree, StateTreeCircuitInput } from "../src/state_tree";

describe("Test SMT Membership Query", function() {
    this.timeout(1000 * 1000);

    // runs circom compilation
    let circuit: any;
    let tree;
    let Fr;
    before(async function () {
        let stateTree = path.join(__dirname, "../circuits", "state_tree.circom");
        circuit = await test.genTempMain(stateTree, "Membership", "", [20], {});
        await circuit.loadSymbols();
        tree = new StateTree();
        Fr = tree.F;
    });

    it("Test Membership", function() {
        const key = Fr.e(333);
        const value = Fr.e(444);

        let res:StateTreeCircuitInput = await tree.insert(key, value);
    });
});

describe("Test SMT Membership Update", function() {
    this.timeout(1000 * 1000);

    // runs circom compilation
    let circuit: any;
    before(async function () {
        let stateTree = path.join(__dirname, "../circuits", "state_tree.circom");
        circuit = await test.genTempMain(stateTree, "NonMembershipUpdate", "", [20], {});
        await circuit.loadSymbols();
    });

    it("Test NonMembershipUpdate", function() {

    });
});

