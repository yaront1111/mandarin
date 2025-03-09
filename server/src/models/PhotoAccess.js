const { Model, DataTypes } = require('sequelize');
const sequelize = require('../database');

class PhotoAccess extends Model {}

PhotoAccess.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    viewerId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'granted', 'rejected'),
      allowNull: false,
      defaultValue: 'pending'
    },
    message: {
      type: DataTypes.STRING,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'PhotoAccess'
  }
);

module.exports = PhotoAccess;
