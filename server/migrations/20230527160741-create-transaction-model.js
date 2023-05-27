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
