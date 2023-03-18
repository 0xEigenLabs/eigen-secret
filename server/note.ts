const { Sequelize, DataTypes, Model } = require("sequelize");
import sequelize from "../src/db";
const consola = require("consola");
import { StateTree } from "../src/state_tree";

class NoteModel extends Model {}

NoteModel.init({
    // Model attributes are defined here
    cmt: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    alias: {
        type: DataTypes.STRING,
        allowNull: false
    },
    index: {
        type: DataTypes.BIGINT,
        allowNull: true
    }
}, {
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: "NoteModel" // We need to choose the model name
});

export async function getIndices(cmt: Array<bigint>, alias: string) {
    let indices = new Array(cmt.length).map(() => StateTree.index);
    let transaction = sequelize.transaction();
    try {
        for (let i = 0; i < cmt.length; i ++) {
            await NoteModel.create({
                index: indices[i],
                alias: alias,
                cmt: cmt[i]
            });
        }
        transaction.commit();
        return indices;
    } catch (err: any) {
        consola.log(err);
        if (transaction) {
            transaction.rollback();
        }
    }
    return null;
}
