const { DataTypes, Model } = require("sequelize");
import sequelize from "./db";
import consola from "consola";
import * as utils from "@eigen-secret/core/dist-node/utils"
import { upsert } from "./common";

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

export async function getAccount(req: any, res: any) {
    const alias = req.body.alias;
    const ethAddress = req.body.ethAddress;
    const timestamp = req.body.timestamp;
    const rawMessage = req.body.message;
    const hexSignature = req.body.hexSignature;
    if (
        !utils.hasValue(alias) ||
        !utils.hasValue(hexSignature) ||
        !utils.hasValue(rawMessage) ||
        !utils.hasValue(timestamp) ||
        !utils.hasValue(ethAddress)) {
        consola.log(alias, hexSignature, rawMessage, timestamp, ethAddress)
        return res.json(utils.err(utils.ErrCode.InvalidInput, "missing input"));
    }

    let validAdddr = await utils.verifyEOASignature(rawMessage, hexSignature, ethAddress, alias, timestamp);
    if (!validAdddr) {
        return res.json(utils.err(utils.ErrCode.InvalidInput, "Invalid EOA address"));
    }
    let result: any;
    try {
        result = await AccountModel.findAll({ where: { alias: alias, ethAddress: ethAddress } });
    } catch (err: any) {
        consola.log(err)
        return res.json(utils.err(utils.ErrCode.DBCreateError, err.toString()));
    }
    return res.json(utils.succ(result));
}

// add new key
export async function createAccount(req: any, res: any) {
    const alias = req.body.alias;
    const ethAddress = req.body.ethAddress;
    const timestamp = req.body.timestamp;
    const rawMessage = req.body.message;
    const secretAccount = req.body.secretAccount;
    const hexSignature = req.body.hexSignature;

    consola.log('createAccount: ', alias, hexSignature, rawMessage, timestamp, ethAddress)

    if (
        !utils.hasValue(alias) ||
        !utils.hasValue(hexSignature) ||
        !utils.hasValue(rawMessage) ||
        !utils.hasValue(timestamp) ||
        !utils.hasValue(ethAddress)) {
        consola.log(alias, hexSignature, rawMessage, timestamp, ethAddress)
        return res.json(utils.err(utils.ErrCode.InvalidInput, "missing input"));
    }

    let validAdddr = await utils.verifyEOASignature(rawMessage, hexSignature, ethAddress, alias, timestamp);
    if (!validAdddr) {
        return res.json(utils.err(utils.ErrCode.InvalidInput, "Invalid EOA address"));
    }

    const DURATION: number = 60; // seconds
    let expireAt = Math.floor(Date.now() / 1000);

    if (Number(timestamp) + DURATION <= expireAt) {
        return res.json(utils.err(
            utils.ErrCode.InvalidAuth,
            "Expired signature"
        ));
    }
    let transaction = await sequelize.transaction();

    try {
        let insertResult = await upsert(
            AccountModel,
            { alias, ethAddress, secretAccount }, // new item
            { alias, ethAddress }, // condition
            { transaction }

        );
        if (!utils.hasValue(insertResult.item)) {
            return res.json(utils.err(
                utils.ErrCode.DBCreateError,
                "Create alias-ethAddress record error"
            ));
        }
        transaction.commit();
        return res.json(utils.succ(insertResult.item));
    } catch (err: any) {
        consola.log(err)
        if (transaction) {
            transaction.rollback();
        }
    }
    return res.json(utils.err(utils.ErrCode.DBCreateError, "Unknown error"));
}

