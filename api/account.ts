const { Sequelize, DataTypes, Model } = require("sequelize");
const { ethers } = require("ethers");
import sequelize from "./db";
import { login } from "./session";
import consola from "consola";
import * as util from "./util";

class AccountModel extends Model {}

AccountModel.init({
    // Model attributes are defined here
    alias: {
        type: DataTypes.STRING,
        allowNull: false
    },
    ethAddress: {
        type: DataTypes.STRING,
        allowNull: false
    },
    ethAddress2: { // backup
        type: DataTypes.STRING,
        allowNull: false
    },
    ethAddress3: { // backup no2
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: "AccountModel" // We need to choose the model name
});

class LoginMessage {
    protocol: string;
    message: string;
    timestamp: number;
    constructor(
        protocol: string,
        message: string,
        timestamp: number
    ) {
        this.protocol = protocol;
        this.message = message;
        this.timestamp = timestamp;
    }
}

// add new key
export async function createAccount(req: any, res: any) {
    consola.log("create account");
    const alias = req.body.alias;
    const ethAddress = req.params.ethAddress;
    const timestamp = req.body.timestamp; // json format
    const rawMessage = req.body.message; // json format
    const hexSignature = req.body.hexSignature;
    if (
        !util.hasValue(alias) ||
        !util.hasValue(hexSignature) ||
        !util.hasValue(rawMessage) ||
        !util.hasValue(timestamp) ||
        !util.hasValue(ethAddress)) {
        consola.log(alias, hexSignature, rawMessage, timestamp, ethAddress)
        return res.json(util.err(util.ErrCode.InvalidInput, "missing input"));
    }

    const strRawMessage = "\x19Ethereum Signed Message:\n" + rawMessage.length + rawMessage;
    let message = ethers.utils.toUtf8Bytes(strRawMessage);
    let messageHash = ethers.utils.hashMessage(message);
    let address = ethers.utils.recoverAddress(ethers.utils.arrayify(messageHash), hexSignature);
    if (address != ethAddress) {
        return res.json(util.err(util.ErrCode.InvalidInput, "Invalid EOA address"));
    }

    const DURATION: number = 60; // seconds
    let expireAt = Math.floor(Date.now() / 1000);

    if (Number(timestamp) + DURATION <= expireAt) {
        consola.error("Signature acquisition timeout!");
        return res.json(util.err(
            util.ErrCode.InvalidAuth,
            "Please try again!"
        ));
    }
    let transaction = await sequelize.transaction();

    try {
        let insertResult = await util.upsert(
            AccountModel,
            { alias, ethAddress, ethAddress2: "", ethAddress3: "" }, // new item
            { alias, ethAddress }, // condition
            { transaction },

        );
        consola.log("Upsert: ", insertResult);
        if (!util.hasValue(insertResult.item)) {
            return res.json(util.err(
                util.ErrCode.DBCreateError,
                "Create alias-ethAddress records error"
            ));
        }
        transaction.commit();
        let result = await login(alias, ethAddress);
        return res.json(util.succ(result));
    } catch (err: any) {
        consola.log(err)
        if (transaction) {
            transaction.rollback();
        }
    }
    return res.json(util.err(util.ErrCode.DBCreateError, ""));
}

