const { Sequelize, DataTypes, Model } = require('sequelize');
import sequelize from "./db";
import { login } from "./session";
import { Err, ErrCode, Succ, BaseResp } from "./util";

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
    modelName: 'AccountModel' // We need to choose the model name
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

export function createAccount(alias: string, ethAddres: string, message: string, hexSignature: string): any {
    // check signature, TODO

    // check timestamp + 60s > current timestamp

    // check if
    login(alias, ethAddres);
}
