'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('NoteModels', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
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
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('NoteModels');
  }
};
