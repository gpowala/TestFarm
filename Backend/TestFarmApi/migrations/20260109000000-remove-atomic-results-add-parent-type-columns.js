'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove AtomicResults column from TestsResults table
    await queryInterface.removeColumn('TestsResults', 'AtomicResults');

    // Add Parent column to Tests table
    await queryInterface.addColumn('Tests', 'Parent', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    });

    // Add Type column to Tests table
    await queryInterface.addColumn('Tests', 'Type', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'native'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Re-add AtomicResults column to TestsResults table
    await queryInterface.addColumn('TestsResults', 'AtomicResults', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    // Remove Parent column from Tests table
    await queryInterface.removeColumn('Tests', 'Parent');

    // Remove Type column from Tests table
    await queryInterface.removeColumn('Tests', 'Type');
  }
};
