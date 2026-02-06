'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Users', {
      Id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      Username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      Email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      PasswordHash: {
        type: Sequelize.STRING,
        allowNull: false
      },
      EmailConfirmed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      EmailConfirmationToken: {
        type: Sequelize.STRING,
        allowNull: true
      },
      CreationTimestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('GETDATE()')
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Users');
  }
};
