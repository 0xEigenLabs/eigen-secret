import { expect, assert } from "chai";
import path = require("path");
import { test } from "../index";

describe("Test SMT Membership Query", function() {
    this.timeout(1000 * 1000);

    // runs circom compilation
    let circuit: any;
    before(async function () {
        let stateTree = path.join(__dirname, "../circuits", "state_tree.circom");
        circuit = await test.genTempMain(stateTree, "Membership", "", [20], {});
        await circuit.loadSymbols();
    });

    it("Test Membership", function() {

    });

    it("Test NonMembershipUpdate", function() {

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

