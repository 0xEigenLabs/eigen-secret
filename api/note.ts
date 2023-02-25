const { Sequelize, DataTypes, Model } = require('sequelize');
import sequelize from "./db";

class NoteModel extends Model {}

NoteModel.init({
    // Model attributes are defined here
    nonce: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    assertId: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    accountId: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    val: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    ownerX: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    ownerY: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    index: {
        type: DataTypes.NUMBER,
        allowNull: true,
    }
}, {
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: 'NoteModel' // We need to choose the model name
});
