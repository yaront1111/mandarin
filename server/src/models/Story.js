const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Story = sequelize.define('Story', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('photo', 'text'),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT, // Photo URL or text
    allowNull: false
  },
  backgroundColor: {
    type: DataTypes.STRING,
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  // Track who viewed it
  viewers: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    defaultValue: []
  }
}, {
  timestamps: true,
  hooks: {
    beforeCreate: (story) => {
      // Expire in 24 hours by default
      if (!story.expiresAt) {
        story.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
    }
  }
});

module.exports = Story;
