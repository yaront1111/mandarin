'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDefinition = await queryInterface.describeTable('Users');
    if (!tableDefinition.lastActive) {
      await queryInterface.addColumn('Users', 'lastActive', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    const tableDefinition = await queryInterface.describeTable('Users');
    if (tableDefinition.lastActive) {
      await queryInterface.removeColumn('Users', 'lastActive');
    }
  }
};
