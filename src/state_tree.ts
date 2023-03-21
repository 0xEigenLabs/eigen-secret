import { randomBytes as _randomBytes } from "crypto";
const { newMemEmptyTrie, SMT, buildPoseidon, buildEddsa } = require("circomlibjs");
const { getCurveFromName } = require("ffjavascript");
const consola = require("consola");
import SMTModel from "./state_tree_db";

export function siblingsPad(siblings: any, F: any) {
  for (let i = 0; i < siblings.length; i++) siblings[i] = F.toObject(siblings[i]);
  while (siblings.length < N_LEVEL) siblings.push(0);
  return siblings;
}

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

async function getHashes() {
    const bn128 = await getCurveFromName("bn128", true);
    const poseidon = await buildPoseidon();
    return {
        hash0: function(left: any, right: any) {
            return poseidon([left, right]);
        },
        hash1: function(key: any, value: any) {
            return poseidon([key, value, bn128.Fr.one]);
        },
        F: bn128.Fr
    }
}

// NOTE: we never guarantee the atomic
export default class SMTDB {
    // nodes: any;
    root: any;
    F: any;
    model: any;
    constructor(F: any, model: any) {
        // this.nodes = {};
        this.root = F.zero;
        this.F = F;
        this.model = model;
    }

    async getRoot() {
        return this.root;
    }

    _key2str(k: any) {
        const F = this.F;
        const keyS = this.F.toString(k);
        return keyS;
    }

    _normalize(n: any, join: boolean = true) {
        const F = this.F;
        if (join) {
            let nn = new Array(n.length);
            for (let i=0; i<nn.length; i++) {
                // NOTE: the value maybe Uint8Array, or Number
                nn[i] = ArrayBuffer.isView(n[i])? this.F.toObject(n[i]) : n[i];
            }
            return nn.join("|")
        } else {
            let splited = n.split("|");
            let nn = new Array(splited.length);
            for (let i=0; i<nn.length; i++) {
                nn[i] = this.F.e(splited[i]);
            }
            return nn;
        }
    }

    async get(key: any) {
        const keyS = this._key2str(key);
        // return this.nodes[keyS];
        let item = await this.model.findOne({ where: { key: keyS } });
        if (!item) {
            return undefined;
        }
        return this._normalize(item.value, false);
    }

    async multiGet(keys: any) {
        const promises = [];
        for (let i=0; i<keys.length; i++) {
            let res = await this.get(keys[i]);
            promises.push(this._normalize(res, false));
        }
        return await Promise.all(promises);
    }

    async setRoot(rt: any) {
        this.root = rt;
    }

    async multiIns(inserts: any) {
        try {
            let bulks = [];
            for (let i=0; i<inserts.length; i++) {
                const keyS = this._key2str(inserts[i][0]);
                // this.nodes[keyS] = inserts[i][1];
                let value = this._normalize(inserts[i][1]);
                bulks.push({ key: keyS, value: value });
            }
            await this.model.bulkCreate(bulks);
        } catch (err: any) {
            consola.log(err);
            throw new Error(err)
        }
    }

    async multiDel(dels: any) {
        try {
            let keys = [];
            for (let i=0; i<dels.length; i++) {
                const keyS = this._key2str(dels[i]);
                // delete this.nodes[keyS];
                keys.push(keyS);
            }
            if (keys.length > 0) {
                await this.model.destroy({ where: { key: keys } });
            }
        } catch (err: any) {
            consola.log(err);
            throw new Error(err)
        }
    }
}

export class StateTree {
    tree: any;
    F: any;

    constructor() { }
    async init(model: any) {
        const { hash0, hash1, F } = await getHashes();
        const db = new SMTDB(F, model);
        const rt = await db.getRoot();
        this.tree = new SMT(db, rt, hash0, hash1, F);
        // this.tree = await newMemEmptyTrie();
        this.F = this.tree.F;
    }

    root(): any {
        return this.tree.root;
    }

    static get index(): bigint {
        return BigInt("0x" + _randomBytes(31).toString("hex"))
    }

    async find(_key: bigint) {
        let key = this.tree.F.e(_key);
        let res = await this.tree.find(key);
        return res;
    }

    async insert(_key: bigint, _value: bigint): Promise<StateTreeCircuitInput> {
        const key = this.tree.F.e(_key);
        const value = this.tree.F.e(_value)
        const res = await this.tree.insert(key, value);
        const siblings = siblingsPad(res.siblings, this.tree.F);
        return new StateTreeCircuitInput(this.tree, [1, 0], res, siblings, key, value);
    }

    async delete(_key: bigint): Promise<StateTreeCircuitInput> {
        const key = this.tree.F.e(_key);
        const res = await this.tree.delete(key);
        const siblings = siblingsPad(res.siblings, this.tree.F);
        return new StateTreeCircuitInput(this.tree, [1, 1], res, siblings, res.delKey, res.delValue);
    }

    async update(_key: bigint, _newValue: bigint): Promise<StateTreeCircuitInput> {
        const key = this.tree.F.e(_key);
        const newValue = this.tree.F.e(_newValue);
        const res = await this.tree.update(key, newValue);
        const siblings = siblingsPad(res.siblings, this.tree.F);
        return new StateTreeCircuitInput(this.tree, [0, 1], res, siblings, res.newKey, res.newValue);
    }
}

export class WorldState {
    static instance: StateTree;
    private constructor() {}

    public static async getInstance(): Promise<StateTree> {
        if (!WorldState.instance) {
            console.log("creating");
            WorldState.instance = new StateTree();
            await WorldState.instance.init(SMTModel);
        }
        console.log("resuing");
        return WorldState.instance;
    }

    /*
    public static async updateStateTree(
        outputNc1: bigint,
        nullifier1: bigint,
        outputNc2: bigint,
        nullifier2: bigint,
        acStateKey: bigint
    ) {
        console.log("updateStateTree", outputNc1, nullifier1, outputNc2, nullifier2, acStateKey);
        const eddsa = await buildEddsa();
        const F = eddsa.F;
        let instance = await WorldState.getInstance();
        let siblings = [];
        // insert all first, then find
        if (outputNc1 > 0n) {
            let result = await instance.insert(outputNc1, nullifier1);
            siblings.push(result.siblings);
            console.log("insert", outputNc1, nullifier1, result);
            let sib = await instance.find(outputNc1)
            console.log("sib", sib);
        }

        if (outputNc2 > 0n) {
            let result = await instance.insert(outputNc2, nullifier2);
            siblings.push(result.siblings);
            console.log("insert 2", outputNc2, nullifier2, result);
            let sib = await instance.find(outputNc2)
            console.log("sib", sib);
        }

        let ac = await instance.find(acStateKey);

        return {
            dataTreeRoot: F.toObject(instance.root()),
            siblings: siblings,
            siblingsAC: siblingsPad(ac.siblings, F)
        };
    }
    */
}
