// src/models/PhotoAccess.js
const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const PhotoAccess = sequelize.define('PhotoAccess', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  photoId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  grantedToId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  grantedById: {
    type: DataTypes.UUID,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'denied', 'revoked'),
    defaultValue: 'pending'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = PhotoAccess;
