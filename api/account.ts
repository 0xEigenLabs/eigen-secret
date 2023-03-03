const { Sequelize, DataTypes, Model } = require("sequelize");
const { ethers } = require("ethers");
import sequelize from "./db";
import { login } from "./session";
import consola from "consola";
import * as util from "./util";

class AccountModel extends Model {}

AccountModel.init({
    // Model attributes are defined here
    accountId: {
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

export function doCreateAccount(alias: string, ethAddress: string, message: string, hexSignature: string): any {
    // check signature
    let messageBinary = ethers.utils.arrayify(message);
    let hash = ethers.utils.hashMessage(messageBinary);
    let signature = ethers.utils.splitSignature(hexSignature);
    let address = ethers.utils.recoverAddress(hash,signature);
    if (ethAddress == address) {
        console.log("Signature is valid!");
    } else {
        console.log("Signature is invalid!");
    }
    // TODO: check timestamp + 60s > current timestamp
    // message: include...

    // TODO
    login(alias, ethAddress);
}

// add new key
export async function createAccount(req: any, res: any) {
  consola.log("crate account");
  const alias = req.body.alias;
  const ethAddress = req.body.ethAddress;
  const message = req.body.message; // TODO: should be structed object
  const hexSignature = req.body.hexSignature;
  if (!util.hasValue(alias) || !util.hasValue(ethAddress)) {
    consola.error("missing alias or ethAddress");
    return res.json(util.err(1, "missing input"));
  }

  const result = doCreateAccount(alias, ethAddress, message, hexSignature);
  res.json(util.succ(result));
}

