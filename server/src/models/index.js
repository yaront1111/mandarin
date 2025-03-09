// server/src/models/index.js
const sequelize = require('../database');
const User = require('./User');
const Profile = require('./Profile');
const Photo = require('./Photo');
const PhotoAccess = require('./PhotoAccess');
const Match = require('./Match');
const Message = require('./Message');
const Like = require('./Like');
const Kink = require('./Kink');
const KinkPreference = require('./KinkPreference');
const Story = require('./Story');
const Call = require('./Call');

// ------------------
// Define Associations
// ------------------

// Profile and User
User.hasOne(Profile, { foreignKey: 'userId', onDelete: 'CASCADE' });
Profile.belongsTo(User, { foreignKey: 'userId' });

// Photo and PhotoAccess
Photo.hasMany(PhotoAccess, { foreignKey: 'photoId', onDelete: 'CASCADE' });
PhotoAccess.belongsTo(Photo, { foreignKey: 'photoId' });

// PhotoAccess associations with User
// This association defines the user who is requesting access.
User.hasMany(PhotoAccess, { foreignKey: 'viewerId', as: 'viewerAccesses' });
PhotoAccess.belongsTo(User, { foreignKey: 'viewerId', as: 'viewer' });

// This association defines the user who owns the photos.
User.hasMany(PhotoAccess, { foreignKey: 'ownerId', as: 'ownerAccesses' });
PhotoAccess.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

// Photo and User
User.hasMany(Photo, { foreignKey: 'userId', onDelete: 'CASCADE' });
Photo.belongsTo(User, { foreignKey: 'userId' });

// Kink & KinkPreference associations
User.hasMany(KinkPreference, { foreignKey: 'userId', onDelete: 'CASCADE' });
KinkPreference.belongsTo(User, { foreignKey: 'userId' });
Kink.hasMany(KinkPreference, { foreignKey: 'kinkId', onDelete: 'CASCADE' });
KinkPreference.belongsTo(Kink, { foreignKey: 'kinkId' });

// Match associations (Users matching with each other)
User.belongsToMany(User, {
  through: Match,
  as: 'Matches',
  foreignKey: 'userAId',
  otherKey: 'userBId'
});
Match.belongsTo(User, { as: 'userA', foreignKey: 'userAId' });
Match.belongsTo(User, { as: 'userB', foreignKey: 'userBId' });

// Message associations
Match.hasMany(Message, { foreignKey: 'matchId', onDelete: 'CASCADE' });
Message.belongsTo(Match, { foreignKey: 'matchId' });
User.hasMany(Message, { foreignKey: 'senderId', onDelete: 'CASCADE' });
Message.belongsTo(User, { foreignKey: 'senderId' });

// Call associations
Match.hasMany(Call, { foreignKey: 'matchId', onDelete: 'CASCADE' });
Call.belongsTo(Match, { foreignKey: 'matchId' });

// Story associations
User.hasMany(Story, { foreignKey: 'userId', onDelete: 'CASCADE' });
Story.belongsTo(User, { foreignKey: 'userId' });

// Like associations
User.hasMany(Like, { foreignKey: 'userId' });
Like.belongsTo(User, { foreignKey: 'userId' });

// ------------------
// Sync and Export
// ------------------
sequelize
  .sync({ alter: false }) // set to true to auto-update tables if needed
  .then(() => console.log('✅ All models synced.'))
  .catch((err) => console.error('❌ Model sync error:', err));

module.exports = {
  sequelize,
  User,
  Profile,
  Photo,
  PhotoAccess,
  Match,
  Message,
  Call,
  Like,
  Kink,
  KinkPreference,
  Story,
};
