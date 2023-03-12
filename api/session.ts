const { Sequelize, DataTypes, Model } = require("sequelize");
import * as util from "./util";
import sequelize from "./db";
import consola from "consola";

class SessionModel extends Model {}

SessionModel.init({
    // Model attributes are defined here
    alias: {
        type: DataTypes.STRING,
        allowNull: false
    },
    ethAddress: {
        type: DataTypes.STRING,
        allowNull: false
    },
    expireAt: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: "SessionModel" // We need to choose the model name
});

const DURATION: number = 10 * 60; // seconds

export async function login(alias: string, ethAddress: string): Promise<any> {
    // check if the record exists, updateOrAdd,
    await sequelize.sync();
    let expireAt = Math.floor(Date.now() / 1000);
    let value = {
        alias: alias,
        ethAddress: ethAddress,
        expireAt: expireAt + DURATION
    };

    let is_alias_available = await SessionModel.findOne({ where: { alias: alias } } );
    if (is_alias_available === null) {
        SessionModel.create(value);
        consola.log("User registered successfully");
        return util.succ("Registration succeeded!");
    } else {
        return SessionModel
        .findOne({ where: { alias: alias, ethAddress: ethAddress } } )
        .then(function(obj: any) {
            // update
            if (obj) {
                obj.update(value);
                consola.log("User login succeeded");
                return util.succ("Login succeeded!")
            }
            // insert
            consola.error("Alias already exists!");
            return util.err(util.ErrCode.InvalidAuth, "Alias already exists!");
        });
    }
}

export function logout(alias: string, ethAddress: string) {
    // check if the record exists, updateOrAdd,
    let expireAt = Math.floor(Date.now() / 1000);
    let value = {
        alias: alias,
        ethAddress: ethAddress,
        expireAt: expireAt
    };
    return SessionModel
        .findOne({ where: { alias: alias, ethAddress: ethAddress } } )
        .then(function(obj: any) {
            if (obj) {
return obj.update(value);
}
        })
}
