const { DataTypes, Model } = require("sequelize");
import sequelize from "./db";
import { NoteState } from "@eigen-secret/core/dist-node/note";
import { __DEFAULT_ALIAS__ } from "@eigen-secret/core/dist-node/utils";

type NoteStateArray = Array<NoteState>;

const notemodel = require("../models/notemodel");
export const Note = notemodel(sequelize, DataTypes);

export async function getDBNotes(alias: string, state: NoteStateArray, indices: Array<string> = []) {
    let conds: any = {
        alias: [alias, __DEFAULT_ALIAS__],
        state: state
    }

    if (indices.length > 0) {
        conds.index = indices;
    }
    return await Note.findAll({ where: conds })
}
