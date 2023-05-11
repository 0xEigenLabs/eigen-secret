const { DataTypes, Model } = require("sequelize");
import { ErrCode, succResp, errResp } from "@eigen-secret/core/dist-node/error";
import { Context } from "@eigen-secret/core/dist-node/context";
import sequelize from "./db";
import { ProofState } from "@eigen-secret/core/dist-node/prover";

type ProofStateArray = Array<ProofState>;

const consola = require("consola");

export class ProofModel extends Model {}

ProofModel.init({
    // Model attributes are defined here
    alias: {
        type: DataTypes.STRING,
        allowNull: false
    },
    proof: {
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
    modelName: "ProofModel" // We need to choose the model name
});

export async function submitDBProof(alias: string, proofs: Array<string>, transaction: any) {
    let insData = proofs.map((proof, _) => ({ alias: alias, proof: proof, state: ProofState.NEW }));
    return await ProofModel.bulkCreate(
        insData,
        {
            transaction: transaction,
            updateOnDuplicate: ["state"]
        }
    );
}

export async function getDBProof(alias: string, state: ProofStateArray) {
    return await ProofModel.findAll({ where: { alias: alias, state: state } })
}

export async function submitProofs(req: any, res: any) {
    let ctx = Context.deserialize(req.body.context);
    let code = ctx.check();
    console.log("submitProof code", code)
    if (code !== ErrCode.Success) {
        return res.json(errResp(code, ErrCode[code]));
    }

    const proofs = req.body.proofs;
    if (!Array.isArray(proofs)) {
        return res.json(errResp(ErrCode.InvalidInput, "Invalid Proofs"));
    }
    const alias = ctx.alias;
    // get the confirmed note list
    let result: any;
    let transaction: any;
    try {
        transaction = await sequelize.transaction();
        result = await submitDBProof(alias, proofs, transaction);
        await transaction.commit();
    } catch (err: any) {
        consola.log(err)
        if (transaction) {
            await transaction.rollback();
        }
        return res.json(errResp(ErrCode.InvalidInput, err.toString()));
    }
    return res.json(succResp(result));
}

export async function getProofs(req: any, res: any) {
    let ctx = Context.deserialize(req.body.context);
    let code = ctx.check();
    if (code !== ErrCode.Success) {
        return res.json(errResp(code, ErrCode[code]));
    }
    const alias = ctx.alias;
    let states = req.body.states;
    if (!Array.isArray(states)) {
        states = [states];
    }
    let result: any;
    try {
        result = await getDBProof(alias, states);
    } catch (err: any) {
        consola.log(err)
        return res.json(errResp(ErrCode.DBCreateError, err.toString()));
    }
    return res.json(succResp(result));
}
