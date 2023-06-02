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
          type: Sequelize.STRING,
          allowNull: false
      },
      index: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
      },
      pubKey: {
          type: Sequelize.STRING,
          allowNull: false
      },
      content: {
          type: Sequelize.TEXT,
          allowNull: false,
          unique: true
      },
      state: {
          type: Sequelize.INTEGER,
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
