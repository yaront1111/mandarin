// src/models/KinkPreference.js
const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const KinkPreference = sequelize.define('KinkPreference', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  kinkId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  interestLevel: {
    type: DataTypes.ENUM('curious', 'interested', 'experienced', 'expert'),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('dominant', 'submissive', 'switch', 'observer'),
    allowNull: true
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true
});

module.exports = KinkPreference;
