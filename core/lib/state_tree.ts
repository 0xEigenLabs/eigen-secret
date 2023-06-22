const { buildPoseidon } = require("circomlibjs");
import { SMT } from "./smt";
const { getCurveFromName } = require("ffjavascript-browser");
const consola = require("consola");

export function siblingsPad(siblings: any, F: any, padding: boolean = true) {
  for (let i = 0; i < siblings.length; i++) siblings[i] = F.toObject(siblings[i]);
  if (padding) {
      return pad(siblings)
  }
  return siblings;
}

export function pad(_sib: any) {
    let siblings = Object.assign([], _sib);
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

    toNonMembershipUpdateInput(): any {
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

export async function getHashes() {
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
        const keyS = this.F.toString(k);
        return keyS;
    }

    _normalize(n: any, join: boolean = true) {
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
        let rt = F.zero;
        let maxIdRecord = await db.model.findOne({
            order: [["id", "DESC"]]
        });
        if (maxIdRecord != null) {
            rt = F.e(maxIdRecord.key);
        }
        consola.log("root: ", rt)
        this.tree = new SMT(db, rt, hash0, hash1, F);
        consola.log("success")
        this.F = F;
        // const rt = await db.getRoot();
        // this.tree = await newMemEmptyTrie();
    }

    root(): any {
        return this.tree.root;
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

    reset() {
        this.tree = null;
        this.F = null;
    }
}
