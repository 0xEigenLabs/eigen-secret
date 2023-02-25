import { expect, assert } from "chai";
import path = require("path");
import { test, utils } from "../index";
import { StateTree, StateTreeCircuitInput } from "../src/state_tree";

describe("Test SMT Membership Query", function () {
    this.timeout(1000 * 1000);

    // runs circom compilation
    let circuit: any;
    let tree: any;
    let Fr: any;
    before(async function () {
        let stateTree = path.join(__dirname, "../circuits", "state_tree.circom");
        circuit = await test.genTempMain(stateTree, "Membership", "", [20], {});
        await circuit.loadSymbols();
        tree = new StateTree();
        await tree.init();
        Fr = tree.F;
    });

    it("Test Membership", async function () {
        const key = Fr.e(333);
        const value = Fr.e(444);
        await tree.insert(key, value);
        console.log("root: ", tree.tree.root)
        let ci = await tree.find(key, value);

        let input = {
            key: Fr.toObject(key),
            value: ci.newValue,
            root: Fr.toObject(tree.root()),
            siblings: ci.siblings,
            enabled: 1,
        };
        await utils.executeCircuit(circuit, input)
    });
});

describe("Test SMT Membership Update", function () {
    this.timeout(1000 * 1000);

    // runs circom compilation
    let circuit: any;
    let tree: any;
    let Fr: any;
    before(async function () {
        let stateTree = path.join(__dirname, "../circuits", "state_tree.circom");
        circuit = await test.genTempMain(stateTree, "NonMembershipUpdate", "", [20], {});
        await circuit.loadSymbols();
        tree = new StateTree();
        await tree.init();
        Fr = tree.F;
    });

    it("Test NonMembershipUpdate", async function () {
        const key = Fr.e(333333);
        const value = Fr.e(444111);
        let ci = await tree.insert(key, value);
        let input = ci.toNonMembershipUpdateInput();
        await utils.executeCircuit(circuit, input)
    });

    it("Test NonMembershipUpdate 2", async function () {
        const key = Fr.e("17195092312975762537892237130737365903429674363577646686847513978084990105579");
        const value = Fr.e("19650379996168153643111744440707177573540245771926102415571667548153444658179");
        let ci = await tree.insert(key, value);
        let input = ci.toNonMembershipUpdateInput();
        await utils.executeCircuit(circuit, input)
    });
});

