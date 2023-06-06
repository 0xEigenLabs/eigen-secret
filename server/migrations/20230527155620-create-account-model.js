'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AccountModels', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      alias: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
      },
      ethAddress: {
          type: Sequelize.STRING,
          allowNull: false
      },
      accountKeyPubKey: {
        type: Sequelize.STRING,
        allowNull: false
    },
      secretAccount: {
          type: Sequelize.TEXT,
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
    await queryInterface.dropTable('AccountModels');
  }
};
