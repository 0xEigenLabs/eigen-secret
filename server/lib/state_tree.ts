const { buildEddsa } = require("circomlibjs");
const consola = require("consola");
const { DataTypes } = require("sequelize");
import sequelize from "./db";
import { StateTree, N_LEVEL, siblingsPad } from "@eigen-secret/core/dist-node/state_tree";
const _smtmodel = require("../models/smtmodel");
export const SMTModel = _smtmodel(sequelize, DataTypes);

export class WorldState {
    static instance: StateTree|undefined;
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

    // for debug, don't use it in production
    static async resetInstance() {
        if (WorldState.instance) {
            await WorldState.instance.reset();
            WorldState.instance = undefined;
        }
    }

    public static async updateStateTree(
        outputNc1: bigint,
        nullifier1: bigint,
        outputNc2: bigint,
        nullifier2: bigint,
        acStateKey: bigint,
        padding: boolean = true
    ) {
        let instance = await WorldState.getInstance();
        const eddsa = await buildEddsa();
        const F = eddsa.F;

        let transaction = await sequelize.transaction();
        try {
            let siblings = [];
            // insert all first, then find
            if (nullifier1 > 0n) {
                let result = await instance.insert(nullifier1, outputNc1, { transaction });
                consola.log(result);
            }

            if (nullifier2 > 0n) {
                let result = await instance.insert(nullifier2, outputNc2, { transaction });
                consola.log(result);
            }

            // NOTE: DO NOT PAD here, cause the smart contract does not accept padding
            if (nullifier1 > 0n) {
                let sib = await instance.find(nullifier1, { transaction })
                siblings.push(siblingsPad(sib.siblings, F, padding));
            }
            if (nullifier2 > 0n) {
                let sib = await instance.find(nullifier2, { transaction })
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

            let ac = await instance.find(acStateKey, { transaction });

            // If everything executes correctly, we commit the transaction.
            await transaction.commit();

            return {
                dataTreeRoot: F.toObject(instance.root()),
                siblings: siblings,
                siblingsAC: siblingsPad(ac.siblings, F, padding)
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
}
