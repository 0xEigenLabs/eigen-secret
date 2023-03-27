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
    pubKey: {
        type: DataTypes.STRING,
        allowNull: false
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
    let tmpResult = await getDBNotes(notes[0].alias, [NoteState.CREATING, NoteState.PROVED, NoteState.SPENT])
    console.log(tmpResult)
    return await NoteModel.bulkCreate(
        notes,
        {
            transaction: transaction,
            updateOnDuplicate: ["index", "content"]
        }
    );
}

export async function getDBNotes(alias: string, state: Array<NoteState>) {
    return await NoteModel.findAll({ where: { alias: alias, state: state } })
}
