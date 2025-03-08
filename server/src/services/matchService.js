// src/services/matchService.js

const { Match, Like, User } = require('../models');
const { NotFoundError, ForbiddenError } = require('../utils/errors');
const { Op } = require('sequelize');

exports.likeUser = async (userId, targetId) => {
  if (userId === targetId) {
    throw new ForbiddenError('Cannot like yourself');
  }

  // Check if target user exists
  const targetUser = await User.findByPk(targetId);
  if (!targetUser) {
    throw new NotFoundError('User');
  }

  // Record the like
  const [like] = await Like.findOrCreate({
    where: { userId, targetId }
  });

  // Check for reciprocal like
  const reciprocalLike = await Like.findOne({
    where: { userId: targetId, targetId: userId }
  });

  let match = null;
  if (reciprocalLike) {
    // If there's no existing match, create one
    match = await Match.findOne({
      where: {
        [Op.or]: [
          { userAId: userId, userBId: targetId },
          { userAId: targetId, userBId: userId }
        ]
      }
    });
    if (!match) {
      match = await Match.create({ userAId: userId, userBId: targetId });
    }
  }

  return { like, match };
};

exports.getUserMatches = async (userId) => {
  // Example of fetching matches
  return Match.findAll({
    where: {
      [Op.or]: [
        { userAId: userId },
        { userBId: userId }
      ]
    },
    include: [
      { model: User, as: 'userA' },
      { model: User, as: 'userB' }
    ],
    order: [['createdAt', 'DESC']]
  });
};
