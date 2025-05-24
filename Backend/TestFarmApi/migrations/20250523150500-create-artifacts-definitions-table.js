'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ArtifactsDefinitions', {
      Id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      Name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      InstallScript : {
        type: Sequelize.TEXT,
        allowNull: false
      },
      Tags: {
        type: Sequelize.TEXT,
        allowNull: true
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ArtifactsDefinitions');
  }
};
