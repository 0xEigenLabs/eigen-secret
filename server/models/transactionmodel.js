'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class TransactionModel extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  TransactionModel.init({
    alias: {
        type: DataTypes.STRING,
        allowNull: false
    },
    txData: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    proof: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    operation: {
        type: DataTypes.STRING,
        allowNull: false
    },
    publicInput: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    status: {
        type: DataTypes.INTEGER, // 1: UNKNOWN; 2. CREATED, 3: AGGREGATING, 4. SETTLED
        allowNull: false
    }
  }, {
    sequelize,
    modelName: 'TransactionModel',
  });
  return TransactionModel;
};
