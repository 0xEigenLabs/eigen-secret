const { DataTypes } = require("sequelize");
import sequelize from "./db";
import { ErrCode, succResp, errResp } from "@eigen-secret/core/dist-node/error";
import { Context } from "@eigen-secret/core/dist-node/context";
import { WorldState } from "./state_tree";
import { Note, getDBNotes } from "./note";
import { TransactionModelStatus } from "@eigen-secret/core/dist-node/transaction";
import { Mutex } from "async-mutex";

const transactionmodel = require("../models/transactionmodel");
const Transaction = transactionmodel(sequelize, DataTypes);

// all the db transaction should obtain the mutex.
const txMutex = new Mutex();
const smtMutex = new Mutex();

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
            operation: inp.operation,
            txData: inp.txData,
            proof: inp.proof,
            publicInput: inp.publicInput,
            status: TransactionModelStatus.CONFIRMED
        });
    } );

    let insertNotes: Array<any> = [];
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
    const release = await txMutex.acquire();
    let ret: any;
    try {
        await sequelize.transaction(async (t: any) => {
            if (insertTxs.length > 0) {
                result = await Transaction.bulkCreate(insertTxs, { transaction: t, updateOnDuplicate: ["txData"] });
            }
            if (insertNotes.length > 0) {
                result2 = await Note.bulkCreate(insertNotes, { transaction: t, updateOnDuplicate: ["state", "alias"] });
            }
        });
        ret = res.json(succResp([result, result2], true))
    } catch (err: any) {
        console.log(err)
        ret = res.json(errResp(ErrCode.DBCreateError, err.toString()));
    } finally {
        release();
    }
    return ret;
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
    // Acquire the lock
    const release = await smtMutex.acquire();
    let result: any;
    try {
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
        result = res.json(succResp(proof, true));
    } catch (err: any) {
        result = res.json(errResp(ErrCode.DBCreateError, err.toString()))
    } finally {
        release();
    }
    return result;
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
    const { count, rows } = await Transaction.findAndCountAll({
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
