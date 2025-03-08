const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Profile = sequelize.define('Profile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  bio: {
    type: DataTypes.TEXT
  },
  interests: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  locationLat: {
    type: DataTypes.DECIMAL(10, 8)
  },
  locationLng: {
    type: DataTypes.DECIMAL(11, 8)
  },
  // More fields: orientation, kinks, etc.
}, {
  timestamps: true
});

module.exports = Profile;
