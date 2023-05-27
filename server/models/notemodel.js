'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class NoteModel extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  NoteModel.init({
    alias: {
        type: DataTypes.STRING,
        allowNull: false
    },
    index: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    pubKey: {
        type: DataTypes.STRING,
        allowNull: false
    },
    content: {
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
    modelName: 'NoteModel',
  });
  return NoteModel;
};
