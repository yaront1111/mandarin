'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('PhotoAccesses', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.fn('uuid_generate_v4'), // or Sequelize.UUIDV4 if extension installed
        primaryKey: true
      },
      ownerId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      viewerId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'granted', 'rejected'),
        allowNull: false,
        defaultValue: 'pending'
      },
      message: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // Optional: Add indexes or constraints
    await queryInterface.addIndex('PhotoAccesses', ['ownerId']);
    await queryInterface.addIndex('PhotoAccesses', ['viewerId']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('PhotoAccesses');
  }
};
