'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AssetModels', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      assetId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      contractAddress: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      symbol: {
        type: Sequelize.STRING
      },
      latestPrice: {
        type: Sequelize.DOUBLE,
        allowNull: true,
        unique: false
      },
      latest24hPrice: {
        type: Sequelize.DOUBLE,
        allowNull: true,
        unique: false
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
    await queryInterface.dropTable('AssetModels');
  }
};
