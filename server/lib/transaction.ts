const { DataTypes, Model } = require("sequelize");
import sequelize from "./db";
import consola from "consola";
import * as note from "@eigen-secret/core/dist/note";
import * as utils from "@eigen-secret/core/dist/utils";
import { WorldState } from "./state_tree";
import { NoteModel, updateDBNotes, getDBNotes } from "./note";

const { NoteState } = note;

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
    const alias = req.body.alias;
    const receiver_alias = req.body.receiver_alias;
    const pubKey = req.body.pubKey;
    const pubKey2 = req.body.pubKey2;
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
        !utils.hasValue(receiver_alias) ||
        !utils.hasValue(pubKey) ||
        !utils.hasValue(pubKey2) ||
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
        let isAliasAvailable = await TransactionModel.findOne(
            { where: { alias: alias, noteIndex: noteIndex, note2Index: note2Index } }
        );

        if (isAliasAvailable === null) {
            let result = await createTxInternal(
                alias, receiver_alias, pubKey, pubKey2, content, content2,
                noteIndex, note2Index, proof, publicInput, transaction
            );
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

export async function createTxInternal(
    alias: string,
    receiver_alias: string,
    pubKey: string,
    pubKey2: string,
    content: string,
    content2: string,
    noteIndex: string,
    note2Index: string,
    proof: any,
    publicInput: any,
    transaction: any
) {
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
                alias: receiver_alias,
                index: noteIndex,
                pubKey: pubKey,
                content: content,
                state: NoteState.CREATING
            },
            {
                alias: alias,
                index: note2Index,
                pubKey: pubKey2,
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
    return result;
}

export async function getTxByAlias(req: any, res: any) {
    const alias = req.params.alias;
    let result: any;
    try {
        result = await TransactionModel.findAll({ where: { alias: alias } });
    } catch (err: any) {
        consola.log(err)
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
    const padding: boolean = req.body.padding;
    consola.log("padding", padding);
    let validAdddr = await utils.verifyEOASignature(rawMessage, hexSignature, ethAddress, alias, timestamp);
    if (!validAdddr) {
        return res.json(utils.err(utils.ErrCode.InvalidInput, "Invalid EOA address"));
    }

    // TODO: once updated, must be synchonized with circuits on chain
    const newState = req.body.newStates;
    let proof = await WorldState.updateStateTree(
        BigInt(newState.outputNc1),
        BigInt(newState.nullifier1),
        BigInt(newState.outputNc2),
        BigInt(newState.nullifier2),
        BigInt(newState.acStateKey),
        padding
    );
    // TODO handle exception
    return res.json(utils.succ(proof));
}

export async function getNotes(req: any, res: any) {
    const alias = req.body.alias;
    const ethAddress = req.body.ethAddress;
    const timestamp = req.body.timestamp;
    const rawMessage = req.body.message;
    const hexSignature = req.body.hexSignature;
    const noteState = req.body.noteState;

    let validAdddr = await utils.verifyEOASignature(rawMessage, hexSignature, ethAddress, alias, timestamp);
    if (!validAdddr) {
        return res.json(utils.err(utils.ErrCode.InvalidInput, "Invalid EOA address"));
    }

    // get the confirmed note list, TODO: handle exception
    let notes = await getDBNotes(alias, noteState);
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
        console.log("item", item);
        insertings.push({
            alias: item.alias,
            index: item.index,
            pubKey: item.pubKey,
            content: item.content,
            state: item.state
        })
    });

    let result: any;
    let transaction: any;
    try {
        transaction = await sequelize.transaction();
        result = await updateDBNotes(insertings, transaction);
        transaction.commit();
    } catch (err: any) {
        consola.log(err)
        if (transaction) {
            transaction.rollback();
        }
        return res.json(utils.err(utils.ErrCode.InvalidInput, err.toString()));
    }
    return res.json(utils.succ(result));
}
