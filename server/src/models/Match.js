const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Match = sequelize.define('Match', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userAId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  userBId: {
    type: DataTypes.UUID,
    allowNull: false
  }
}, {
  timestamps: true
});

module.exports = Match;
