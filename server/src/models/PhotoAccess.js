// server/src/models/photoaccess.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../database');

class PhotoAccess extends Model {
  static associate(models) {
    // This association lets you eager-load the user who is requesting access.
    PhotoAccess.belongsTo(models.User, {
      foreignKey: 'viewerId',
      as: 'viewer'
    });
    // This association lets you eager-load the user who owns the photos.
    PhotoAccess.belongsTo(models.User, {
      foreignKey: 'ownerId',
      as: 'owner'
    });
    // If you have a Photo model and a corresponding foreign key (e.g., photoId)
    // you can uncomment or add this association:
    // PhotoAccess.belongsTo(models.Photo, {
    //   foreignKey: 'photoId',
    //   as: 'photo'
    // });
  }
}

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
