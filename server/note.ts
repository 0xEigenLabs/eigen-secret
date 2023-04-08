const { DataTypes, Model } = require("sequelize");
import sequelize from "../server/db";
const consola = require("consola");
import { NoteState } from "../src/note";

export class NoteModel extends Model {}

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
    //consola.log("updateDBNotes", notes);
    let tmpResult = await getDBNotes(notes[0].alias, [NoteState.CREATING, NoteState.PROVED, NoteState.SPENT])
    //consola.log(tmpResult)
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
