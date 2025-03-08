// src/models/Call.js
const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Call = sequelize.define('Call', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  matchId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  callerId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  receiverId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('initiated', 'connected', 'missed', 'declined', 'ended'),
    defaultValue: 'initiated'
  },
  startedAt: DataTypes.DATE,
  endedAt: DataTypes.DATE,
  duration: DataTypes.INTEGER,
  callType: {
    type: DataTypes.ENUM('audio', 'video'),
    defaultValue: 'video'
  }
}, { timestamps: true });

module.exports = Call;
