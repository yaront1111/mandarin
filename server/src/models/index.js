const sequelize = require('../database');
const User = require('./User');
const Profile = require('./Profile');
const Photo = require('./Photo');
const Match = require('./Match');
const Message = require('./Message');
const Like = require('./Like');

// Associations
User.hasOne(Profile, { foreignKey: 'userId', onDelete: 'CASCADE' });
Profile.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Photo, { foreignKey: 'userId', onDelete: 'CASCADE' });
Photo.belongsTo(User, { foreignKey: 'userId' });

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

// Like
User.hasMany(Like, { foreignKey: 'userId' });
Like.belongsTo(User, { foreignKey: 'userId' });

// Typically you’d use migrations, but for a quick start:
sequelize.sync({ alter: false }) // set to true to auto-update tables
  .then(() => console.log('✅ All models synced.'))
  .catch(err => console.error('❌ Model sync error:', err));

module.exports = {
  sequelize,
  User,
  Profile,
  Photo,
  Match,
  Message,
  Like
};
