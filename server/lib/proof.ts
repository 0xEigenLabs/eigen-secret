const { DataTypes, Model } = require("sequelize");
import * as utils from "@eigen-secret/core/dist-node/utils";
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
    const alias = req.body.alias;
    const ethAddress = req.body.ethAddress;
    const timestamp = req.body.timestamp;
    const rawMessage = req.body.message;
    const hexSignature = req.body.hexSignature;

    let validAdddr = await utils.verifyEOASignature(rawMessage, hexSignature, ethAddress, alias, timestamp);
    if (!validAdddr) {
        return res.json(utils.err(utils.ErrCode.InvalidInput, "Invalid EOA address"));
    }

    const proofs = req.body.proofs;
    if (!Array.isArray(proofs)) {
        return res.json(utils.err(utils.ErrCode.InvalidInput, "Invalid Proofs"));
    }
    // get the confirmed note list
    let result: any;
    let transaction: any;
    try {
        transaction = await sequelize.transaction();
        result = await submitDBProof(alias, proofs, transaction);
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

export async function getProofs(req: any, res: any) {
    const alias = req.body.alias;
    const ethAddress = req.body.ethAddress;
    const timestamp = req.body.timestamp;
    const rawMessage = req.body.message;
    const hexSignature = req.body.hexSignature;
    let validAdddr = await utils.verifyEOASignature(rawMessage, hexSignature, ethAddress, alias, timestamp);
    if (!validAdddr) {
        return res.json(utils.err(utils.ErrCode.InvalidInput, "Invalid EOA address"));
    }

    let states = req.body.states;
    if (!Array.isArray(states)) {
        states = [states];
    }
    let result: any;
    try {
        result = await getDBProof(alias, states);
    } catch (err: any) {
        consola.log(err)
        return res.json(utils.err(utils.ErrCode.DBCreateError, err.toString()));
    }
    return res.json(utils.succ(result));
}
