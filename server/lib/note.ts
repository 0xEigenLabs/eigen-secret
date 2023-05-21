const { DataTypes, Model } = require("sequelize");
import sequelize from "./db";
import { NoteState } from "@eigen-secret/core/dist-node/note";
import { __DEFAULT_ALIAS__ } from "@eigen-secret/core/dist-node/utils";

type NoteStateArray = Array<NoteState>;

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

export async function getDBNotes(alias: string, state: NoteStateArray, indices: Array<string> = []) {
    let conds: any = {
        alias: [alias, __DEFAULT_ALIAS__],
        state: state
    }

    if (indices.length > 0) {
        conds.index = indices;
    }
    return await NoteModel.findAll({ where: conds })
}
