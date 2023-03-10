import { expect, assert } from "chai";
import path = require("path");
import { test, utils } from "../index";
const cls = require("circomlibjs");
import { StateTree, StateTreeCircuitInput } from "../src/state_tree";
const { ethers } = require("hardhat");

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

        const key2 = Fr.e("1");
        const value2 = Fr.e("2");
        let ci2 = await tree.insert(key2, value2);
        let input2 = ci2.toNonMembershipUpdateInput();
        await utils.executeCircuit(circuit, input)
        await utils.executeCircuit(circuit, input2)
    });
});

describe("Test SMT smart contract", () => {
    let contract: any;
    let poseidonContract2Inputs: any;
    let poseidonContract3Inputs: any;
    let signer;
    let circuit: any;
    let tree: any;
    let Fr: any;

    before(async () => {
        let stateTree = path.join(__dirname, "../circuits", "state_tree.circom");
        circuit = await test.genTempMain(stateTree, "Membership", "", [20], {});
        await circuit.loadSymbols();

        const [signer] = await ethers.getSigners();
        console.log("signer", signer.address);

        const CF1 = new ethers.ContractFactory(
            cls.poseidonContract.generateABI(2),
            cls.poseidonContract.createCode(2),
            signer
          );
        const CF2 = new ethers.ContractFactory(
            cls.poseidonContract.generateABI(3),
            cls.poseidonContract.createCode(3),
            signer
        );
        poseidonContract2Inputs = await CF1.deploy();
        console.log("poseidonContract2Inputs address:", poseidonContract2Inputs.address)
        poseidonContract3Inputs = await CF2.deploy();
        console.log("poseidonContract3Inputs address:", poseidonContract3Inputs.address)
        let F = await ethers.getContractFactory("SMT");
        contract = await F.deploy(poseidonContract2Inputs.address, poseidonContract3Inputs.address);
        await contract.deployed()
        console.log("contract address:", contract.address)
        tree = new StateTree();
        await tree.init();
        console.log("the original root is:", tree.root())
        Fr = tree.F;
    })

    it("Test contract and circuits", async () => {
        const oldKey = "0";
        const oldValue = "0";
        const key = Fr.e(333);
        const value = Fr.e(444);
        await tree.insert(key, value);
        console.log("root: ", tree.tree.root)
        let ci = await tree.find(key, value);
        console.log("the ci is:", ci)

        let input = {
            key: Fr.toObject(key),
            value: ci.newValue,
            root: Fr.toObject(tree.root()),
            siblings: ci.siblings,
            enabled: 1,
        };
        await utils.executeCircuit(circuit, input)

        const result = await contract.smtVerifier(
            ci.siblings, Fr.toObject(key),
            Fr.toObject(value), oldKey, oldValue, false, false, 20)
        console.log("the result is:", result);
        expect(result).to.eq(ci.newRoot);
    })
})
