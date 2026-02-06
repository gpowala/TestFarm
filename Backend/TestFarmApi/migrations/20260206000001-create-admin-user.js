'use strict';

const bcrypt = require('bcrypt');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const passwordHash = await bcrypt.hash('admin', 10);
    
    await queryInterface.bulkInsert('Users', [{
      Username: 'admin',
      Email: 'admin@testfarm.local',
      PasswordHash: passwordHash,
      EmailConfirmed: true,
      EmailConfirmationToken: null,
      CreationTimestamp: new Date()
    }], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Users', { Username: 'admin' }, {});
  }
};
