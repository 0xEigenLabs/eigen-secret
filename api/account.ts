const { Sequelize, DataTypes, Model } = require("sequelize");
const { ethers } = require("ethers");
import sequelize from "./db";
import { login } from "./session";

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

export function createAccount(alias: string, ethAddress: string, message: string, hexSignature: string): any {
    // check signature
    let messageBytes = ethers.utils.arrayify(message);
    let signature = ethers.utils.splitSignature(hexSignature);
    let address = ethers.utils.verifyMessage({ messageBytes, signature });
    if (ethAddress == address){
        console.log("Signature is valid!");
    } else {
        console.log("Signature is invalid!");
    }
    // check timestamp + 60s > current timestamp
    //message: include...

    // check if
    login(alias, ethAddress);
}

module.exports = function (app: any) {
    app.post("/account", createAccount);
}