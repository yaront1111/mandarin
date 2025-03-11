'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if the column already exists
    const tableInfo = await queryInterface.describeTable('Users');
    
    if (!tableInfo.lastActive) {
      // Add lastActive column if it doesn't exist
      await queryInterface.addColumn('Users', 'lastActive', {
        type: Sequelize.DATE,
        allowNull: true,
      });
      
      // Update existing users with current timestamp
      await queryInterface.sequelize.query(
        `UPDATE "Users" SET "lastActive" = CURRENT_TIMESTAMP`
      );
    }
  },

  async down(queryInterface, Sequelize) {
    // If needed, remove the column
    await queryInterface.removeColumn('Users', 'lastActive');
  }
};
