const { buildEddsa } = require("circomlibjs");
const consola = require("consola");
import { N_LEVEL, siblingsPad, StateTree } from "../src/state_tree";
const { DataTypes, Model } = require("sequelize");
import sequelize from "../server/db";

export class SMTModel extends Model {}

SMTModel.init({
    // Model attributes are defined here
    key: {
        type: DataTypes.STRING,
        allowNull: false
    },
    value: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: "SMTModel" // We need to choose the model name
});

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
        acStateKey: bigint
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

        if (outputNc1 > 0n) {
            let sib = await instance.find(outputNc1)
            siblings.push(siblingsPad(sib.siblings, F));
        }
        if (outputNc2 > 0n) {
            let sib = await instance.find(outputNc2)
            siblings.push(siblingsPad(sib.siblings, F));
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

        return {
            dataTreeRoot: F.toObject(instance.root()),
            siblings: siblings,
            siblingsAC: siblingsPad(ac.siblings, F)
        };
    }
}
