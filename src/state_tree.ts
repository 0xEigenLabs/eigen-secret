const { SMT, buildPoseidon } = require("circomlibjs");
const { SMTDb } = require("./smt_db");
const { getCurveFromName }  = require("ffjavascript");

export const N_LEVEL = 20;
export class StateTreeCircuitInput {
    fnc: number[] = new Array(2);
    oldRoot: any;
    newRoot: any;
    siblings: any[] = new Array(N_LEVEL);
    oldKey: any;
    oldValue: any;
    isOld0: number = 0;
    newKey: any;
    newValue: any;

    public constructor(tree: any, fnc: number[], res: any, siblings: any[], key: any, value: any) {
        this.fnc = fnc;
        this.oldRoot = tree.F.toObject(res.oldRoot);
        this.newRoot = tree.F.toObject(tree.root);
        this.siblings = siblings;
        this.oldKey = res.isOld0 ? 0 : tree.F.toObject(res.oldKey);
        this.oldValue = res.isOld0 ? 0 : tree.F.toObject(res.oldValue);
        this.isOld0 = res.isOld0 ? 1 : 0;
        this.newKey = tree.F.toObject(key);
        this.newValue = tree.F.toObject(value);
    }

    toNonMembershipUpdateInput(trere: any): any {
        return {
            oldRoot: this.oldRoot,
            newRoot: this.newRoot,
            siblings: this.siblings,
            oldKey: this.oldKey,
            oldValue: this.oldValue,
            isOld0: this.isOld0,
            newKey: this.newKey,
            newValue: this.newValue
        };
    }
}

export class StateTree {
    tree: any;
    F: any;

    constructor() { }
    async init() {
        this.tree = await newMemEmptyTrie();
        this.F = this.tree.F;
    }

    root(): any {
        return this.tree.root;
    }

    async find(_key: any) {
        let key = this.tree.F.e(_key);
        let res = await this.tree.find(key);
        return res;
    }

    async insert(_key: any, _value: any): Promise<StateTreeCircuitInput> {
        const key = this.tree.F.e(_key);
        const value = this.tree.F.e(_value)
        const res = await this.tree.insert(key, value);
        let siblings = res.siblings;
        for (let i = 0; i < siblings.length; i++) siblings[i] = this.tree.F.toObject(siblings[i]);
        while (siblings.length < N_LEVEL) siblings.push(0);

        return new StateTreeCircuitInput(this.tree, [1, 0], res, siblings, key, value);
    }

    async delete(_key: any): Promise<StateTreeCircuitInput> {
        const key = this.tree.F.e(_key);
        const res = await this.tree.delete(key);
        let siblings = res.siblings;
        for (let i = 0; i < siblings.length; i++) siblings[i] = this.tree.F.toObject(siblings[i]);
        while (siblings.length < N_LEVEL) siblings.push(0);
        return new StateTreeCircuitInput(this.tree, [1, 1], res, siblings, res.delKey, res.delValue);
    }

    async update(_key: any, _newValue: any): Promise<StateTreeCircuitInput> {
        const key = this.tree.F.e(_key);
        const newValue = this.tree.F.e(_newValue);
        const res = await this.tree.update(key, newValue);
        let siblings = res.siblings;
        for (let i = 0; i < siblings.length; i++) siblings[i] = this.tree.F.toObject(siblings[i]);
        while (siblings.length < N_LEVEL) siblings.push(0);
        return new StateTreeCircuitInput(this.tree, [0, 1], res, siblings, res.newKey, res.newValue);
    }
}

export default async function getHashes() {
    const bn128 = await getCurveFromName("bn128", true);
    const poseidon = await buildPoseidon();
    return {
        hash0: function (left: any, right: any) {
            return poseidon([left, right]);
        },
        hash1: function(key: any, value: any) {
            return poseidon([key, value, bn128.Fr.one]);
        },
        F: bn128.Fr
    }
}

export async function newMemEmptyTrie() {
    const {hash0, hash1,F} = await getHashes();
    const db = new SMTDb(F);
    await db.init();
    const rt = await db.getRoot();
    const smt = new SMT(db, rt, hash0, hash1, F);
    return smt;
}
