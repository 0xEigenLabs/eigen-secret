const F1Field = require("ffjavascript").F1Field;
const Scalar = require("ffjavascript").Scalar;

const { newMemEmptyTrie, SMT, buildSMT } = require("circomlibjs");

const N_LEVEL = 20;
export class StateTreeCircuitInput {
    fnc: number[] = new Array(2);
    oldRoot: bigint = 0n;
    siblings: bigint[] = new Array(N_LEVEL);
    oldKey: bigint = 0n;
    oldValue: bigint = 0n;
    isOld0: number = 0;
    newKey: bigint = 0n;
    newValue: bigint = 0n;

    public constructor(tree: SMT, fuc: number[], res: any, siblings: bigint[], key: bigint, value: bigint) {
        this.fnc = fuc;
        this.oldRoot = tree.F.toObject(res.oldRoot);
        this.siblings = siblings;
        this.oldKey = res.isOld0 ? 0 : tree.F.toObject(res.oldKey),
        this.oldValue = res.isOld0 ? 0 : tree.F.toObject(res.oldValue),
        this.isOld0 = res.isOld0 ? 1 : 0,
        this.newKey = tree.F.toObject(key),
        this.newValue = tree.F.toObject(value)
    }
}

export class StateTree {
    tree: SMT;
    F: any;

    constructor() {
        this.tree = newMemEmptyTrie();
        this.F = this.tree.F;
    }

    async insert( _key: bigint, _value: bigint): Promise<StateTreeCircuitInput> {
        const key = this.tree.F.e(_key);
        const value = this.tree.F.e(_value)

        const res = await this.tree.insert(key,value);
        let siblings = res.siblings;
        for (let i=0; i<siblings.length; i++) siblings[i] = this.tree.F.toObject(siblings[i]);
        while (siblings.length<10) siblings.push(0);

        return new StateTreeCircuitInput(this.tree, [1, 0], res, siblings, _key, _value);
    }

    async delete(_key: bigint) : Promise<StateTreeCircuitInput>{
        const key = this.tree.F.e(_key);
        const res = await this.tree.delete(key);
        let siblings = res.siblings;
        for (let i=0; i<siblings.length; i++) siblings[i] = this.tree.F.toObject(siblings[i]);
        while (siblings.length<10) siblings.push(0);
        return new StateTreeCircuitInput(this.tree, [1, 1], res, siblings, res.delKey, res.delValue);
    }

    async update(_key: bigint, _newValue: bigint): Promise<StateTreeCircuitInput> {
        const key = this.tree.F.e(_key);
        const newValue = this.tree.F.e(_newValue);
        const res = await this.tree.update(key, newValue);
        let siblings = res.siblings;
        for (let i=0; i<siblings.length; i++) siblings[i] = this.tree.F.toObject(siblings[i]);
        while (siblings.length<10) siblings.push(0);
        return new StateTreeCircuitInput(this.tree, [0, 1], res, siblings, res.newKey, res.newValue);
    }
}
