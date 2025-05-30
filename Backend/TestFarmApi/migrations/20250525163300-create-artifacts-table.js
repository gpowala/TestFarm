'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Artifacts', {
      Id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      ArtifactDefinitionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'ArtifactsDefinitions',
          key: 'Id'
        }
      },
      Name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      Repository: {
        type: Sequelize.STRING,
        allowNull: false
      },
      Branch: {
        type: Sequelize.STRING,
        allowNull: false
      },
      Revision: {
        type: Sequelize.STRING,
        allowNull: false
      },
      WorkItemUrl: {
        type: Sequelize.STRING,
        allowNull: true
      },
      BuildPageUrl: {
        type: Sequelize.STRING,
        allowNull: true
      },
      Tags: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      CreationTimestamp: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Artifacts');
  }
};