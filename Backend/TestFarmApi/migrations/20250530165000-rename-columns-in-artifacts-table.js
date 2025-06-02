'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Artifacts', 'BuildId', {
      type: Sequelize.INTEGER,
      allowNull: false
    });
    await queryInterface.renameColumn('Artifacts', 'Name', 'BuildName');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Artifacts', 'BuildId');
    await queryInterface.renameColumn('Artifacts', 'BuildName', 'Name');
  }
};