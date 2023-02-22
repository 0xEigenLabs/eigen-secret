const { Sequelize, DataTypes, Model } = require('sequelize');
import sequelize from "./db";

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
        allowNull: false,
    }
}, {
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: 'SessionModel' // We need to choose the model name
});

const DURATION: number = 10 * 60; // seconds

export function login(alias: string, ethAddress: string): any {
    // check if the record exists, updateOrAdd, 
    let expireAt = Math.floor(Date.now() / 1000);
    let value = {
        alias: alias,
        ethAddress: ethAddress,
        expireAt: expireAt + DURATION,
    };
    return SessionModel
        .findOne({ where: {alias: alias, ethAddress: ethAddress} )
        .then(function(obj: any) {
            // update
            if(obj)
                return obj.update(value);
            // insert
            return Model.create(value);
        })
}

export function logout(alias: string, ethAddress: string) {
    // check if the record exists, updateOrAdd, 
    let expireAt = Math.floor(Date.now() / 1000);
    let value = {
        alias: alias,
        ethAddress: ethAddress,
        expireAt: expireAt,
    };
    return SessionModel
        .findOne({ where: {alias: alias, ethAddress: ethAddress } )
        .then(function(obj: any) {
            if(obj)
                return obj.update(value);
        })
}
