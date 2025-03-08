// src/models/Kink.js
const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Kink = sequelize.define('Kink', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT
  },
  category: {
    type: DataTypes.STRING
  }
}, {
  timestamps: true
});

module.exports = Kink;
