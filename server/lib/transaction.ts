const { DataTypes, Model } = require("sequelize");
import sequelize from "./db";
import { ErrCode, succResp, errResp } from "@eigen-secret/core/dist-node/error";
import { Context } from "@eigen-secret/core/dist-node/context";
import { WorldState } from "./state_tree";
import { NoteModel, getDBNotes } from "./note";

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
    operation: {
        type: DataTypes.STRING,
        allowNull: false
    },
    /*
    txData: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    */
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
    CONFIRMED = 2, // tx confirmed on L2
    AGGREGATING = 3, // tx is being aggregated to BatchProof
    SETTLED = 4, // tx confirmed on L1
}

export async function createTx(req: any, res: any) {
    let ctx = Context.deserialize(req.body.context);
    let code = ctx.check();
    if (code !== ErrCode.Success) {
        return res.json(errResp(code, ErrCode[code]));
    }

    const inputs = req.body.inputs || [];
    const notes = req.body.notes || [];

    const alias = ctx.alias;
    let insertTxs : Array<any> = [];
    inputs.forEach( (inp: any) => {
        insertTxs.push({
            alias: alias,
            noteIndex: inp.noteIndex, // input 0 index
            note2Index: inp.note2Index, // input 1 index
            operation: inp.operation,
            // txData: inp.txData,
            proof: inp.proof,
            publicInput: inp.publicInput,
            status: TransactionModelStatus.CONFIRMED
        });
    } );

    let insertNotes: Array<NoteModel> = [];
    notes.forEach((item: any) => {
        insertNotes.push({
            alias: item.alias,
            index: item.index,
            pubKey: item.pubKey,
            content: item.content,
            state: item.state
        })
    });

    let result: Array<any> = [];
    let result2: Array<any> = [];
    try {
        await sequelize.transaction(async (t: any) => {
            if (insertTxs.length > 0) {
                result = await TransactionModel.bulkCreate(insertTxs, { transaction: t });
            }
            if (insertNotes.length > 0) {
                result2 = await NoteModel.bulkCreate(insertNotes, { transaction: t, updateOnDuplicate: ["state", "alias"] });
            }
        });
    } catch (err: any) {
        console.log(err)
        return res.json(errResp(ErrCode.DBCreateError, err.toString()));
    }
    return res.json(succResp([result, result2], true))
}

export async function getTxByAlias(req: any, res: any) {
    let ctx = Context.deserialize(req.body.context);
    let code = ctx.check();
    const page = Number(req.body.page || 0);
    const pageSize = Number(req.body.pageSize || 10);
    if (code !== ErrCode.Success) {
        return res.json(errResp(code, ErrCode[code]));
    }

    const alias = ctx.alias;
    let result: any;
    try {
        result = await search({ alias: alias }, page, pageSize);
    } catch (err: any) {
        console.log(err);
        return res.json(errResp(ErrCode.DBCreateError, err.toString()));
    }
    return res.json(succResp(result));
}

export async function updateStateTree(req: any, res: any) {
    let ctx = Context.deserialize(req.body.context);
    let code = ctx.check();
    const padding: boolean = req.body.padding;
    if (code !== ErrCode.Success) {
        return res.json(errResp(code, ErrCode[code]));
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
    return res.json(succResp(proof, true));
}

export async function getNotes(req: any, res: any) {
    let ctx = Context.deserialize(req.body.context);
    let code = ctx.check();
    if (code !== ErrCode.Success) {
        return res.json(errResp(code, ErrCode[code]));
    }
    const noteState = req.body.noteState || [];
    const indices = req.body.indices || [];
    let notes = await getDBNotes(ctx.alias, noteState, indices);
    return res.json(succResp(notes));
}

async function search(filterDict: any, page: any, pageSize: any) {
    let offset = page > 0? page - 1 : 0;
    const { count, rows } = await TransactionModel.findAndCountAll({
        where: filterDict,
        order: [["createdAt", "DESC"]],
        limit: pageSize,
        offset: offset * pageSize,
        raw: true
    });
    const totalPage = Math.ceil(count / pageSize);
    return {
        transactions: rows,
        totalPage
    };
}
