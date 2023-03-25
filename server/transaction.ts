const { Sequelize, DataTypes, Model } = require("sequelize");
import sequelize from "../src/db";
import consola from "consola";
import * as utils from "../src/utils";
import { siblingsPad, WorldState, StateTree } from "../src/state_tree";
import { NoteModel, NoteState, updateDBNotes, getDBNotes } from "./note";

class TransactionModel extends Model {}
TransactionModel.init({
    // Model attributes are defined here
    alias: {
        type: DataTypes.STRING,
        allowNull: false
    },
    noteIndex: {
        type: DataTypes.STRING,
        allowNull: false
    },
    note2Index: {
        type: DataTypes.STRING,
        allowNull: false
    },
    proof: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    publicInput: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    status: {
        type: DataTypes.INTEGER, // 1: UNKNOWN; 2. CREATED, 3: AGGREGATING, 4. SETTLED
        allowNull: false
    }
}, {
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: "TransactionModel" // We need to choose the model name
});

export enum TransactionModelStatus {
    UNKNOWN = 1,
        CREATED = 2,
        AGGREGATING = 3,
        SETTLED = 4,
}

export async function createTx(req: any, res: any) {
    consola.log("create tx");
    const alias = req.body.alias;
    const pubKey = req.body.pubKey;
    const proof = req.body.proof;
    const publicInput = req.body.publicInput;
    const noteIndex = req.body.noteIndex;
    const note2Index = req.body.note2Index;
    const content = req.body.content;
    const content2 = req.body.content2;

    // context
    const ethAddress = req.body.ethAddress;
    const timestamp = req.body.timestamp;
    const rawMessage = req.body.message;
    const hexSignature = req.body.hexSignature;

    if (!utils.hasValue(alias) ||
        !utils.hasValue(pubKey) ||
        !utils.hasValue(noteIndex) ||
        !utils.hasValue(note2Index) ||
        !utils.hasValue(proof) ||
        !utils.hasValue(content) ||
        !utils.hasValue(content2) ||
        !utils.hasValue(publicInput)
    ) {
        consola.error("missing one or more arguments");
        return res.json(utils.err(utils.ErrCode.InvalidInput, "missing input"));
    }
    let validAdddr = await utils.verifyEOASignature(rawMessage, hexSignature, ethAddress, alias, timestamp);
    if (!validAdddr) {
        return res.json(utils.err(utils.ErrCode.InvalidInput, "Invalid EOA address"));
    }

    let transaction: any;
    try {
        transaction = await sequelize.transaction();
        let isAliasAvailable = await TransactionModel.findOne({ where: { alias: alias } } );
        console.log(isAliasAvailable);

        if (isAliasAvailable === null) {
            let result = await TransactionModel.create({
                alias: alias,
                noteIndex: noteIndex,
                note2Index: note2Index,
                proof: proof,
                publicInput: publicInput,
                status: TransactionModelStatus.CREATED
            }, { transaction });

            // update Notes
            let result2 = await updateDBNotes(
                [
                    {
                        alias: alias,
                        index: noteIndex,
                        pubKey: pubKey,
                        content: content,
                        state: NoteState.CREATING
                    },
                    {
                        alias: alias,
                        index: note2Index,
                        pubKey: pubKey,
                        content: content2,
                        state: NoteState.CREATING
                    }
                ],
                transaction
            );
            if (!result || !result2) {
                consola.log(
                    result,
                    result2
                );
                throw new Error("Update database error");
            }
            await transaction.commit();
            return res.json(utils.succ(result))
        }
        return res.json(utils.err(utils.ErrCode.DBCreateError, "Duplicated transaction found"));
    } catch (err: any) {
        if (transaction) {
            transaction.rollback();
        }
        return res.json(utils.err(utils.ErrCode.DBCreateError, err.toString()));
    }
}

export async function getTxByAlias(req: any, res: any) {
    const alias = req.params.alias;
    console.log(alias);
    let result: any;
    try {
        result = await TransactionModel.findAll({ where: { alias: alias } });
    } catch (err: any) {
        console.log(err)
        return res.json(utils.err(utils.ErrCode.DBCreateError, err.toString()));
    }
    return res.json(utils.succ(result));
}

export async function updateStateTree(req: any, res: any) {
    const alias = req.body.alias;
    const ethAddress = req.body.ethAddress;
    const timestamp = req.body.timestamp;
    const rawMessage = req.body.message;
    const hexSignature = req.body.hexSignature;
consola.log("11111");
    let validAdddr = await utils.verifyEOASignature(rawMessage, hexSignature, ethAddress, alias, timestamp);
    if (!validAdddr) {
        return res.json(utils.err(utils.ErrCode.InvalidInput, "Invalid EOA address"));
    }

    // TODO: once updated, must be synchonized with circuits on chain
    const newState = req.body.newStates;
consola.log("111", newState);
    let proof = await WorldState.updateStateTree(
        (newState[0]),
        (newState[1]),
        (newState[2]),
        (newState[3]),
        (newState[4])
    );
consola.log("111", proof);
    // TODO handle exception
    return res.json(utils.succ(proof));
}

export async function getNotes(req: any, res: any) {
    const alias = req.body.alias;
    const ethAddress = req.body.ethAddress;
    const timestamp = req.body.timestamp;
    const rawMessage = req.body.message;
    const hexSignature = req.body.hexSignature;

    let validAdddr = await utils.verifyEOASignature(rawMessage, hexSignature, ethAddress, alias, timestamp);
    if (!validAdddr) {
        return res.json(utils.err(utils.ErrCode.InvalidInput, "Invalid EOA address"));
    }

    // get the confirmed note list, TODO: handle exception
    let notes = await getDBNotes(alias, [NoteState.CREATING, NoteState.PROVED]);
    return res.json(utils.succ(notes));
}

export async function updateNotes(req: any, res: any) {
    const alias = req.body.alias;
    const ethAddress = req.body.ethAddress;
    const timestamp = req.body.timestamp;
    const rawMessage = req.body.message;
    const hexSignature = req.body.hexSignature;

    let validAdddr = await utils.verifyEOASignature(rawMessage, hexSignature, ethAddress, alias, timestamp);
    if (!validAdddr) {
        return res.json(utils.err(utils.ErrCode.InvalidInput, "Invalid EOA address"));
    }

    const notes = req.body.notes;
    // get the confirmed note list
    let insertings: Array<NoteModel> = [];
    notes.forEach((item: any) => {
        insertings.push({
            alias: alias,
            index: item.index,
            pubKey: item.pubKey,
            content: item.content,
            state: NoteState[item.state]
        })
    });

    let result: any;
    let transaction: any;
    try {
        transaction = await sequelize.transaction();
        result = await updateDBNotes(insertings, transaction);
        transaction.commit();
    } catch (err: any) {
        console.log(err)
        if (transaction) {
            transaction.rollback();
        }
        return res.json(utils.err(utils.ErrCode.InvalidInput, err.toString()));
    }
    return res.json(utils.succ(result));
}
