const { DataTypes, Model } = require("sequelize");
import sequelize from "./db";
import consola from "consola";
import * as utils from "@eigen-secret/core/dist-node/utils";
import { Context } from "@eigen-secret/core/dist-node/context";

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
    let ctx = Context.deserialize(req.body.context);
    const secretAccount = req.body.secretAccount;
    const code = ctx.check();
    if (code !== utils.ErrCode.Success || !utils.hasValue(secretAccount)) {
        return res.json(utils.err(code, utils.ErrCode[code]));
    }

    const alias = ctx.alias;
    const ethAddress = ctx.ethAddress;
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
    let ctx = Context.deserialize(req.body.context);
    const secretAccount = req.body.secretAccount;
    let code = ctx.check();
    if (code !== utils.ErrCode.Success || !utils.hasValue(secretAccount)) {
        return res.json(utils.err(code, utils.ErrCode[code]));
    }

    let condition = { alias: ctx.alias, ethAddress: ctx.ethAddress };
    let found: AccountModel | null = await AccountModel.findOne({ where: condition });
    if (found && found.ethAddress !== ctx.ethAddress) {
        return res.json(utils.err(utils.ErrCode.DuplicatedRecordError, "alias duplicated"));
    }

    let transaction = await sequelize.transaction();
    try {
        await AccountModel.update(
            { secretAccount },
            { where: condition, returning: true, plain: true },
            transaction
        );
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

