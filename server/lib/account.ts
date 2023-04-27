const { DataTypes, Model } = require("sequelize");
import sequelize from "./db";
import consola from "consola";
import * as utils from "@eigen-secret/core/dist-node/utils"

class AccountModel extends Model {}

AccountModel.init({
    // Model attributes are defined here
    alias: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    ethAddress: {
        type: DataTypes.STRING,
        allowNull: false
    },
    secretAccount: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: "AccountModel" // We need to choose the model name
});

// add new key
export async function createAccount(req: any, res: any) {
    const alias = req.body.alias;
    const ethAddress = req.body.ethAddress;
    const timestamp = req.body.timestamp;
    const rawMessage = req.body.message;
    const secretAccount = req.body.secretAccount;
    const hexSignature = req.body.hexSignature;

    let code = utils.checkSignature(alias, hexSignature, rawMessage, timestamp, ethAddress);
    if (code !== utils.ErrCode.Success) {
        return res.json(utils.err(code, utils.ErrCode[code]));
    }

    let newItem = { alias, ethAddress, secretAccount };
    const found: AccountModel | null = await AccountModel.findOne({ where: { alias } });
    if (found) {
        if (found.ethAddress !== ethAddress) {
            return res.json(utils.err(utils.ErrCode.DuplicatedRecordError, "alias duplicated"));
        } else {
            return res.json(utils.succ(found));
        }
    }

    let transaction = await sequelize.transaction();
    try {
        const item = await AccountModel.create(newItem, transaction);
        transaction.commit();
        return res.json(utils.succ(item));
    } catch (err: any) {
        consola.log(err)
        if (transaction) {
            transaction.rollback();
        }
    }
    return res.json(utils.err(utils.ErrCode.DBCreateError, "Unknown error"));
}

export async function updateAccount(req: any, res: any) {
    const alias = req.body.alias;
    const ethAddress = req.body.ethAddress;
    const timestamp = req.body.timestamp;
    const rawMessage = req.body.message;
    const secretAccount = req.body.secretAccount;
    const hexSignature = req.body.hexSignature;

    let code = utils.checkSignature(alias, hexSignature, rawMessage, timestamp, ethAddress);
    if (code !== utils.ErrCode.Success) {
        return res.json(utils.err(code, utils.ErrCode[code]));
    }

    let condition = { alias, ethAddress };
    let found: AccountModel | null = await AccountModel.findOne({ where: condition });
    if (found && found.ethAddress !== ethAddress) {
        return res.json(utils.err(utils.ErrCode.DuplicatedRecordError, "alias duplicated"));
    }

    let transaction = await sequelize.transaction();
    try {
        await AccountModel.update(
            { secretAccount },
            { where: condition, returning: true, plain: true },
            transaction);
        transaction.commit();
    } catch (err: any) {
        consola.log(err)
        if (transaction) {
            transaction.rollback();
        }
    }
    found = await AccountModel.findOne({ where: condition });
    return res.json(utils.succ(found));
}

