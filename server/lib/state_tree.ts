const { buildEddsa } = require("circomlibjs");
const consola = require("consola");
const { DataTypes } = require("sequelize");
import sequelize from "./db";
import { StateTree, N_LEVEL, siblingsPad } from "@eigen-secret/core/dist-node/state_tree";

const _smtmodel = require("../models/smtmodel");
export const SMTModel = _smtmodel(sequelize, DataTypes);
const ROOT_INDEX = 1;

export class WorldState {
    static instance: StateTree;
    private constructor() {}

    public static async getInstance(): Promise<StateTree> {
        if (!WorldState.instance) {
            consola.log("creating");
            WorldState.instance = new StateTree();
            await WorldState.instance.init(SMTModel);
        }
        consola.log("resuing");
        return WorldState.instance;
    }

    public static async updateStateTree(
        outputNc1: bigint,
        nullifier1: bigint,
        outputNc2: bigint,
        nullifier2: bigint,
        acStateKey: bigint,
        padding: boolean = true
    ) {
        // consola.log("updateStateTree", outputNc1, nullifier1, outputNc2, nullifier2, acStateKey);
        const eddsa = await buildEddsa();
        const F = eddsa.F;
        let instance = await WorldState.getInstance();
        let siblings = [];
        // insert all first, then find
        if (outputNc1 > 0n) {
            let result = await instance.insert(outputNc1, nullifier1);
            consola.log(result);
        }

        if (outputNc2 > 0n) {
            let result = await instance.insert(outputNc2, nullifier2);
            consola.log(result);
        }

        // NOTE: DO NOT PAD here, cause the smart contract does not accept padding
        if (outputNc1 > 0n) {
            let sib = await instance.find(outputNc1)
            siblings.push(siblingsPad(sib.siblings, F, padding));
        }
        if (outputNc2 > 0n) {
            let sib = await instance.find(outputNc2)
            siblings.push(siblingsPad(sib.siblings, F, padding));
        }

        // pad siblings
        if (siblings.length < 2) {
            for (let i = siblings.length; i < 2; i ++) {
                siblings.push(
                    new Array(N_LEVEL).fill(0n)
                );
            }
        }

        let ac = await instance.find(acStateKey);
        let rt = F.toObject(instance.root());
        return {
            dataTreeRoot: rt,
            siblings: siblings,
            siblingsAC: siblingsPad(ac.siblings, F, padding)
        };
    }
}
