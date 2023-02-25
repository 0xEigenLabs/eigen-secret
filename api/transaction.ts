const { Sequelize, DataTypes, Model } = require("sequelize");
import sequelize from "./db";

class TransactionModel extends Model {}

TransactionModel.init({
    // Model attributes are defined here
    inputNote1Id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    inputNote2Id: {
        type: DataTypes.INTEGER
        // allowNull defaults to true
    }

}, {
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: "TransactionModel" // We need to choose the model name
});
