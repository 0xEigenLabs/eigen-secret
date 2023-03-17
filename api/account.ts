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

export async function doCreateAccount(alias: string, ethAddress: string, message: any, hexSignature: string) {
    // check signature
    const message_ = JSON.parse(JSON.stringify(message));
    const message_encode = ethers.utils.solidityPack(["string", "string", "string"],
    [message_["protocol"], message_["message"], message_["timestamp"]]);
    let messageBinary = ethers.utils.arrayify(message_encode);
    let hash = ethers.utils.hashMessage(messageBinary);
    let signature = ethers.utils.splitSignature(hexSignature);
    let address = ethers.utils.recoverAddress(hash, signature);
    if (ethAddress == address) {
        consola.log("Signature is valid!");
    } else {
        consola.error("Signature is invalid!");
        return util.err(
            util.ErrCode.InvalidAuth,
            "User signature error!"
        );
    }
    // check timestamp + 60s > current timestamp
    const DURATION: number = 60; // seconds
    let expireAt = Math.floor(Date.now() / 1000);
    if (Number(message_["timestamp"])+DURATION <= expireAt) {
        consola.error("Signature acquisition timeout!");
        return util.err(
            util.ErrCode.InvalidAuth,
            "Please try again!"
        );
    }
    let res = await util.upsert(
        AccountModel,
        { alias, ethAddress, ethAddress2: "", ethAddress3: "" }, // new item
        { alias, ethAddress } // condition
    );
    consola.log("Upinset: ", res);
    if (!util.hasValue(res.item)) {
        return util.err(
            util.ErrCode.DBCreateError,
            "Create alias-ethAddress records error"
        );
    }
    // record user info
    return login(alias, ethAddress);
}

// add new key
export async function createAccount(req: any, res: any) {
  consola.log("crate account");
  const alias = req.body.alias;
  const ethAddress = req.body.ethAddress;
  const message = req.body.message;
  const hexSignature = req.body.hexSignature;
  if (!util.hasValue(alias) || !util.hasValue(ethAddress)) {
    consola.error("missing alias or ethAddress");
    return res.json(util.err(util.ErrCode.InvalidInput, "missing input"));
  }
  return doCreateAccount(alias, ethAddress, message, hexSignature);
}

