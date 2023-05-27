'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('TransactionModels', {
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
      txData: {
          type: Sequelize.TEXT,
          allowNull: false
      },
      proof: {
          type: Sequelize.TEXT,
          allowNull: false
      },
      operation: {
          type: Sequelize.STRING,
          allowNull: false
      },
      publicInput: {
          type: Sequelize.TEXT,
          allowNull: false
      },
      status: {
          type: Sequelize.INTEGER, // 1: UNKNOWN; 2. CREATED, 3: AGGREGATING, 4. SETTLED
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
    await queryInterface.dropTable('TransactionModels');
  }
};
