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

// Associations
// Photo and PhotoAccess association
Photo.hasMany(PhotoAccess, { foreignKey: 'photoId', onDelete: 'CASCADE' });
PhotoAccess.belongsTo(Photo, { foreignKey: 'photoId' });

// Remove this individual sync call - it's causing the error
// PhotoAccess.sync() <- REMOVE THIS LINE

// Other associations (unchanged)
User.hasOne(Profile, { foreignKey: 'userId', onDelete: 'CASCADE' });
Profile.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Photo, { foreignKey: 'userId', onDelete: 'CASCADE' });
Photo.belongsTo(User, { foreignKey: 'userId' });

// New associations for Kink & KinkPreference:
User.hasMany(KinkPreference, { foreignKey: 'userId', onDelete: 'CASCADE' });
KinkPreference.belongsTo(User, { foreignKey: 'userId' });

Kink.hasMany(KinkPreference, { foreignKey: 'kinkId', onDelete: 'CASCADE' });
KinkPreference.belongsTo(Kink, { foreignKey: 'kinkId' });

// Match: userAId, userBId -> each is a foreign key to User
User.belongsToMany(User, {
  through: Match,
  as: 'Matches',
  foreignKey: 'userAId',
  otherKey: 'userBId'
});

// For the Match model, we can keep direct references:
Match.belongsTo(User, { as: 'userA', foreignKey: 'userAId' });
Match.belongsTo(User, { as: 'userB', foreignKey: 'userBId' });

// Message
Match.hasMany(Message, { foreignKey: 'matchId', onDelete: 'CASCADE' });
Message.belongsTo(Match, { foreignKey: 'matchId' });

User.hasMany(Message, { foreignKey: 'senderId', onDelete: 'CASCADE' });
Message.belongsTo(User, { foreignKey: 'senderId' });

// Call
Match.hasMany(Call, { foreignKey: 'matchId', onDelete: 'CASCADE' });
Call.belongsTo(Match, { foreignKey: 'matchId' });

//story
User.hasMany(Story, { foreignKey: 'userId', onDelete: 'CASCADE' });
Story.belongsTo(User, { foreignKey: 'userId' });

// Like
User.hasMany(Like, { foreignKey: 'userId' });
Like.belongsTo(User, { foreignKey: 'userId' });

// Sync all models at once
sequelize.sync({ alter: false }) // set to true to auto-update tables
  .then(() => console.log('✅ All models synced.'))
  .catch(err => console.error('❌ Model sync error:', err));

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
