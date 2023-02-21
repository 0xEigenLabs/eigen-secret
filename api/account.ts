const { Sequelize, DataTypes, Model } = require('sequelize');
import sequelize from "./db";

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
