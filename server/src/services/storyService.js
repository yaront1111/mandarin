const { Story, User, Match } = require('../models');
const { Op } = require('sequelize');
const { NotFoundError } = require('../utils/errors');

exports.createStory = async (userId, type, content, backgroundColor) => {
  // Possibly validate inputs
  const story = await Story.create({
    userId,
    type,
    content,
    backgroundColor
  });
  return story;
};

exports.viewStory = async (storyId, viewerId) => {
  const story = await Story.findByPk(storyId);
  if (!story) throw new NotFoundError('Story');

  // Mark viewer
  if (!story.viewers.includes(viewerId)) {
    story.viewers = [...story.viewers, viewerId];
    await story.save();
  }

  return story;
};

exports.getUserStories = async (userId) => {
  // Return stories that haven't expired
  const now = new Date();
  return Story.findAll({
    where: {
      userId,
      expiresAt: { [Op.gt]: now }
    },
    order: [['createdAt', 'DESC']]
  });
};

exports.getFeedStories = async (userId) => {
  // Find all matches for the user
  const matches = await Match.findAll({
    where: {
      [Op.or]: [
        { userAId: userId },
        { userBId: userId }
      ]
    }
  });

  // Extract matched user IDs
  const matchedIds = matches.map(m => (
    m.userAId === userId ? m.userBId : m.userAId
  ));

  return Story.findAll({
    where: {
      userId: { [Op.in]: matchedIds },
      expiresAt: { [Op.gt]: new Date() }
    },
    include: [{
      model: User,
      attributes: ['id', 'firstName', 'lastName']
    }],
    order: [['createdAt', 'DESC']]
  });
};

// Cleanup job to delete expired
exports.cleanupExpiredStories = async () => {
  await Story.destroy({
    where: { expiresAt: { [Op.lt]: new Date() } }
  });
};
