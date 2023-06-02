'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AssetModel extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  AssetModel.init({
    assetId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    contractAddress: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    latestPrice: {
      type: DataTypes.DOUBLE
    },
    latest24hPrice: {
      type: DataTypes.DOUBLE
    },
    symbol: {
      type: DataTypes.STRING
    }
  }, {
    sequelize,
    modelName: 'AssetModel',
  });
  return AssetModel;
};
