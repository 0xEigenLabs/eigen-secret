const { DataTypes, Model } = require("sequelize");
import sequelize from "./db";
import consola from "consola";
import * as utils from "@eigen-secret/core/dist-node/utils";
import { AppError, ErrCode, succResp, errResp } from "@eigen-secret/core/dist-node/error";
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

// create account
export async function createAccount(req: any, res: any) {
    let ctx = Context.deserialize(req.body.context);
    const code = ctx.check();
    if (code !== ErrCode.Success) {
        return res.json(errResp(code, ErrCode[code]));
    }
    const alias = ctx.alias;
    if (alias === utils.__DEFAULT_ALIAS__) {
        return res.json(errResp(ErrCode.DBCreateError, `${utils.__DEFAULT_ALIAS__} is reserved by Eigen Secret`));
    }
    const ethAddress = ctx.ethAddress;
    let found: AppError = await getAccountInternal(alias, ethAddress);
    if (found.errno !== ErrCode.RecordNotExist) {
        return res.json(found);
    }
    // account is AccountModel or found is RecordNotExist
    const secretAccount = req.body.secretAccount;
    if (!utils.hasValue(secretAccount)) {
        return res.json(errResp(ErrCode.DBCreateError, "Invalid secret account"));
    }
    let newItem = { alias, ethAddress, secretAccount };

    let transaction: any;
    try {
        transaction = await sequelize.transaction();
        const item = await AccountModel.create(newItem, transaction);
        await transaction.commit();
        return res.json(succResp(item));
    } catch (err: any) {
        consola.log(err)
        if (transaction) {
            await transaction.rollback();
        }
        return res.json(errResp(ErrCode.DBCreateError, err.toString()));
    }
    return res.json(errResp(ErrCode.DBCreateError, "Unknown error"));
}

async function getAccountInternal(alias: string, ethAddress: string) {
    let found: AccountModel | null = await AccountModel.findOne({ where: { alias } });
    if (found) {
        if (found.ethAddress !== ethAddress) {
            return errResp(ErrCode.DuplicatedRecordError, "ETH Address not match");
        } else {
            return succResp(found);
        }
    }
    found = await AccountModel.findOne({ where: { ethAddress } });
    if (found) {
        if (alias === utils.__DEFAULT_ALIAS__) {
            // fetch account by eth address only
            return succResp(found);
        }
        return errResp(ErrCode.DuplicatedRecordError, "Duplicated record");
    }
    return errResp(ErrCode.RecordNotExist, "Record not exist");
}

// get account
export async function getAccount(req: any, res: any) {
    let ctx = Context.deserialize(req.body.context);
    const code = ctx.check();
    if (code !== ErrCode.Success) {
        return res.json(errResp(code, ErrCode[code]));
    }

    const alias = ctx.alias;
    const ethAddress = ctx.ethAddress;
    let found = await getAccountInternal(alias, ethAddress);
    return res.json(found);
}

export async function updateAccount(req: any, res: any) {
    let ctx = Context.deserialize(req.body.context);
    const secretAccount = req.body.secretAccount;
    let code = ctx.check();
    if (code !== ErrCode.Success) {
        return res.json(errResp(code, ErrCode[code]));
    }

    let condition = { alias: ctx.alias, ethAddress: ctx.ethAddress };
    let found: AccountModel | null = await AccountModel.findOne({ where: condition });
    if (found && found.ethAddress !== ctx.ethAddress) {
        return res.json(errResp(ErrCode.DuplicatedRecordError, "Alias duplicated"));
    }
    if (!utils.hasValue(secretAccount)) {
        return res.json(errResp(ErrCode.DBCreateError, "Invalid secret account"));
    }
    let transaction = await sequelize.transaction();
    try {
        await AccountModel.update(
            { secretAccount },
            { where: condition, plain: true },
            transaction
        );
        found = await AccountModel.findOne({ where: condition }, { transaction });
        await transaction.commit();
    } catch (err: any) {
        consola.log(err)
        if (transaction) {
            await transaction.rollback();
        }
        return res.json(errResp(ErrCode.DBCreateError, err.toString()));
    }
    return res.json(succResp(found));
}

