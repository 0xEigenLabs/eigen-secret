const { Sequelize, DataTypes, Model } = require("sequelize");
import sequelize from "../src/db";
const consola = require("consola");
import { StateTree } from "../src/state_tree";

class NoteModel extends Model {}

NoteModel.init({
    // Model attributes are defined here
    cmt: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true
    },
    alias: {
        type: DataTypes.STRING,
        allowNull: false
    },
    index: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true
    }
}, {
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: "NoteModel" // We need to choose the model name
});

export async function getIndices(cmt: Array<bigint>, alias: string) {
    let inserts = new Array(cmt.length).fill({}).map(
        (v, i) => (
            {
                index: StateTree.index,
                alias: alias,
                cmt: cmt[i]
            }
        ));
    let transaction: any;
    try {
        transaction = await sequelize.transaction();
        let result = await NoteModel.bulkCreate(inserts, {transaction});
        transaction.commit();
        return inserts;
    } catch (err: any) {
        consola.log(err);
        if (transaction) {
            transaction.rollback();
        }
        return null;
    }
}
