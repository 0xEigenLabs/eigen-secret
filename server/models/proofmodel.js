'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProofModel extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ProofModel.init({
    alias: {
        type: DataTypes.STRING,
        allowNull: false
    },
    proof: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true
    },
    state: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
  }, {
    sequelize,
    modelName: 'ProofModel',
  });
  return ProofModel;
};
