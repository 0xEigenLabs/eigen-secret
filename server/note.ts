const { Sequelize, DataTypes, Model } = require("sequelize");
import sequelize from "../src/db";
const consola = require("consola");
import { StateTree } from "../src/state_tree";

export class NoteModel extends Model {}

export enum NoteState {
    CREATING = 1,
    PROVED,
    SPENT,
}

NoteModel.init({
    // Model attributes are defined here
    alias: {
        type: DataTypes.STRING,
        allowNull: false
    },
    index: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true
    },
    state: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: "NoteModel" // We need to choose the model name
});

export async function updateDBNotes(notes: Array<NoteModel>, transaction: any) {
    console.log("updateDBNotes", notes);
    return await NoteModel.bulkCreate(
        notes,
        {
            transaction: transaction,
            updateOnDuplicate: ["alias", "index"]
        }
    );
}

export async function getNotes(alias: string, state: Array<NoteModel>) {
    return await NoteModel.findAll({ where: { alias: alias, state: state } })
}
