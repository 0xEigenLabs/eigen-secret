const { DataTypes, Model } = require("sequelize");
import sequelize from "./db";
import consola from "consola";
import * as utils from "@eigen-secret/core/dist-node/utils";
import { ErrCode, succResp, errResp } from "@eigen-secret/core/dist-node/error";
import { Context } from "@eigen-secret/core/dist-node/context";
import { WorldState } from "./state_tree";
import { NoteModel, updateDBNotes, getDBNotes } from "./note";

const tisdk = require("api")("@tokeninsight-api/v1.2.2#457nalf1vname");
const INSIGHT_KEY = process.env.INSIGHT_KEY as string

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
    let ctx = Context.deserialize(req.body.context);
    let code = ctx.check();
    const proof = req.body.proof;
    const publicInput = req.body.publicInput;
    const noteIndex = req.body.noteIndex;
    const note2Index = req.body.note2Index;

    if (!utils.hasValue(noteIndex) ||
        !utils.hasValue(note2Index) ||
        !utils.hasValue(proof) ||
        !utils.hasValue(publicInput)
    ) {
        consola.error("missing one or more arguments");
        return res.json(errResp(ErrCode.InvalidInput, "missing input"));
    }

    if (code !== ErrCode.Success) {
        return res.json(errResp(code, ErrCode[code]));
    }

    const alias = ctx.alias;
    let transaction: any;
    try {
        transaction = await sequelize.transaction();
        let isAliasAvailable = await TransactionModel.findOne(
            { where: { alias: alias, noteIndex: noteIndex, note2Index: note2Index } }
        );

        if (isAliasAvailable === null) {
            let result = await createTxInternal(
                alias, noteIndex, note2Index, proof, publicInput, transaction
            );
            await transaction.commit();
            return res.json(succResp(result))
        }
        return res.json(errResp(ErrCode.DBCreateError, "Duplicated transaction found"));
    } catch (err: any) {
        if (transaction) {
            transaction.rollback();
        }
        return res.json(errResp(ErrCode.DBCreateError, err.toString()));
    }
}

export async function createTxInternal(
    alias: string,
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

    if (!result) {
        consola.log(
            result
        );
        throw new Error("Update database error");
    }
    return result;
}

export async function getTxByAlias(req: any, res: any) {
    let ctx = Context.deserialize(req.body.context);
    let code = ctx.check();
    const page = req.body.page;
    const pageSize = req.body.pageSize;
    if (code !== ErrCode.Success) {
        return res.json(errResp(code, ErrCode[code]));
    }

    const alias = ctx.alias;
    let result: any;
    try {
        result = await search({ alias: alias }, page, pageSize);
    } catch (err: any) {
        consola.log(err)
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
    return res.json(succResp(proof));
}

export async function getNotes(req: any, res: any) {
    let ctx = Context.deserialize(req.body.context);
    let code = ctx.check();
    const noteState = req.body.noteState;
    if (code !== ErrCode.Success) {
        return res.json(errResp(code, ErrCode[code]));
    }

    // get the confirmed note list, TODO: handle exception
    let notes = await getDBNotes(ctx.alias, noteState);
    return res.json(succResp(notes));
}

export async function updateNotes(req: any, res: any) {
    let ctx = Context.deserialize(req.body.context);
    let code = ctx.check();
    if (code !== ErrCode.Success) {
        return res.json(errResp(code, ErrCode[code]));
    }

    const notes = req.body.notes;
    // get the confirmed note list
    let insertings: Array<NoteModel> = [];
    notes.forEach((item: any) => {
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
        return res.json(errResp(ErrCode.InvalidInput, err.toString()));
    }
    return res.json(succResp(result));
}

async function search(filterDict: any, page: any, pageSize: any) {
    if (page) {
      consola.log("page = ", page);
      consola.log("pageSize = ", pageSize);

      const { count, rows } = await TransactionModel.findAndCountAll({
        where: filterDict,
        order: [["createdAt", "DESC"]],
        limit: pageSize,
        offset: (page - 1) * pageSize,
        raw: true
      });
      consola.log("count = ", count);
      consola.log("rows = ", rows);
      const totalPage = Math.ceil(count / pageSize);
      return {
        transactions: rows,
        totalPage
      };
    } else {
      const list = await TransactionModel.findAll({
        where: filterDict,
        order: [["createdAt", "DESC"]],
        raw: true
      });
      return {
        transactions: list,
        totalPage: list.length
      };
    }
}

// TODO: convert all assetId to coinId
function getAllCoinIds() {
    return "bitcoin,ethereum,daidai"
}

export async function getTokenPrices(req: any, res: any) {
    let idsStr = getAllCoinIds();

    let result: any;
    try {
        tisdk.auth(INSIGHT_KEY);
        result = await tisdk.getSimplePrice({ ids: idsStr })
    } catch (err: any) {
        console.error(err)
        return res.json(errResp(ErrCode.Unknown, err));
    }
    let tokenPrices = []
    for (const token of result.data.data) {
        tokenPrices.push({ "coinId": token.id, "tokenPrice:": token.price[0].price_latest })
    }

    return res.json(succResp(tokenPrices));
}
