import { buildSMT, TNode } from "./smt";
const { getCurveFromName } = require("ffjavascript-browser");

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
    node: TNode;
    newKey: bigint;
    newValue: bigint;

    public constructor(fnc: number[], node: TNode, key: bigint, value: bigint) {
        this.fnc = fnc;
        this.node = node;
        this.newKey = key;
        this.newValue = value;
    }

    toNonMembershipUpdateInput(tree: any): any {
        const F = tree.F;
        const node = this.node;
        const siblings = siblingsPad(node.siblings, F);
        const res = {
            oldRoot: F.toObject(node.oldRoot),
            newRoot: F.toObject(node.newRoot),
            siblings: siblings,
            oldKey: node.isOld0? 0: F.toObject(node.oldKey),
            oldValue: node.isOld0? 0: F.toObject(node.oldValue),
            isOld0: node.isOld0? 1: 0,
            newKey: this.newKey,
            newValue: this.newValue
        };
        return res;
    }
}

// NOTE: we never guarantee the atomic
export class SMTDB {
    root: any;
    F: any;
    model: any;
    constructor(F: any, model: any) {
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
            throw new Error(err)
        }
    }
}

export class StateTree {
    tree: any;
    F: any;

    constructor() { }
    async init(model: any) {
        const bn128 = await getCurveFromName("bn128", true);
        const F = bn128.Fr;
        const db = new SMTDB(F, model);
        let rt = F.zero;
        let maxIdRecord = await db.model.findOne({
            order: [["id", "DESC"]]
        });
        if (maxIdRecord != null) {
            rt = F.e(maxIdRecord.key);
        }
        this.tree = await buildSMT(db, rt);
        this.F = F;
    }

    root(): any {
        return this.tree.root;
    }

    async find(key: bigint, transaction:any) {
        let res = await this.tree.find(key, transaction);
        return res;
    }

    async insert(key: bigint, value: bigint, transaction:any): Promise<StateTreeCircuitInput> {
        const res = await this.tree.insert(key, value, transaction);
        return new StateTreeCircuitInput([1, 0], res, key, value);
    }

    async delete(key: bigint, transaction:any): Promise<StateTreeCircuitInput> {
        const res = await this.tree.delete(key, transaction);
        const F = this.tree.F;
        return new StateTreeCircuitInput([1, 1], res, F.toObject(res.delKey), F.toObject(res.delValue));
    }

    async update(key: bigint, newValue: bigint, transaction:any): Promise<StateTreeCircuitInput> {
        const res = await this.tree.update(key, newValue, transaction);
        const F = this.tree.F;
        return new StateTreeCircuitInput([0, 1], res, F.toObject(res.newKey), F.toObject(res.newValue));
    }

    reset() {
        this.tree = null;
        this.F = null;
    }
}
