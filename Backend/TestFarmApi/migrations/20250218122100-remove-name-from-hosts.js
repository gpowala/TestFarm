// 'use strict';

// /** @type {import('sequelize-cli').Migration} */
// module.exports = {
//   async up(queryInterface, Sequelize) {
//     await queryInterface.removeColumn('Hosts', 'Name');
//   },

//   async down(queryInterface, Sequelize) {
//     await queryInterface.addColumn('Hosts', 'Name', {
//       type: Sequelize.STRING,
//       allowNull: false,
//       unique: true
//     });
//   }
// }; 