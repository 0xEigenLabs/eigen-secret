import sequelize from "../src/db";
const { Sequelize, DataTypes, Model } = require("sequelize");

class SMTModel extends Model {}

SMTModel.init({
    // Model attributes are defined here
    key: {
        type: DataTypes.STRING,
        allowNull: false
    },
    value: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: "SMTModel" // We need to choose the model name
});
export default SMTModel;
