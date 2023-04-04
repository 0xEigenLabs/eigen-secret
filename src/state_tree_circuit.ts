import { randomBytes as _randomBytes } from "crypto";
const { newMemEmptyTrie, SMT, buildPoseidon, buildEddsa } = require("circomlibjs");
const { getCurveFromName } = require("ffjavascript");
const consola = require("consola");

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
