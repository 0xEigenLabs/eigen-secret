'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AccountModel extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  AccountModel.init({
    alias: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    ethAddress: {
        type: DataTypes.STRING,
        allowNull: false
    },
    secretAccount: {
        type: DataTypes.TEXT,
        allowNull: false
    }
  }, {
    sequelize,
    modelName: 'AccountModel',
  });
  return AccountModel;
};
