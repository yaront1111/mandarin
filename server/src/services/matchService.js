// src/services/matchService.js

const { Match, Like, User, Profile, Photo } = require('../models');
const { NotFoundError, ForbiddenError } = require('../utils/errors');
const { Op } = require('sequelize');

exports.likeUser = async (userId, targetId) => {
  if (userId === targetId) {
    throw new ForbiddenError('Cannot like yourself');
  }

  // Check if target user exists - using findOne instead of findByPk for more flexibility with ID formats
  const targetUser = await User.findOne({
    where: { id: targetId }
  });

  if (!targetUser) {
    throw new NotFoundError('User not found');
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
  return Match.findAll({
    where: {
      [Op.or]: [
        { userAId: userId },
        { userBId: userId }
      ]
    },
    include: [
      {
        model: User,
        as: 'userA',
        attributes: ['id', 'firstName', 'nickname', 'gender'],
        include: [
          {
            model: Photo,
            attributes: ['id', 'url', 'isPrivate'],
            limit: 1,
            where: { isPrivate: false },
            required: false
          }
        ]
      },
      {
        model: User,
        as: 'userB',
        attributes: ['id', 'firstName', 'nickname', 'gender'],
        include: [
          {
            model: Photo,
            attributes: ['id', 'url', 'isPrivate'],
            limit: 1,
            where: { isPrivate: false },
            required: false
          }
        ]
      }
    ],
    order: [['createdAt', 'DESC']]
  });
};

exports.getMutualMatches = async ({ userId, limit = 20 }) => {
  // Find mutual matches (where both users have liked each other)
  return Match.findAll({
    where: {
      [Op.or]: [
        { userAId: userId },
        { userBId: userId }
      ]
    },
    include: [
      {
        model: User,
        as: 'userA',
        attributes: ['id', 'firstName', 'nickname', 'gender', 'birthDate'],
        include: [
          {
            model: Photo,
            attributes: ['id', 'url', 'isPrivate'],
            limit: 1,
            where: { isPrivate: false },
            required: false
          },
          {
            model: Profile,
            attributes: ['bio', 'interests']
          }
        ]
      },
      {
        model: User,
        as: 'userB',
        attributes: ['id', 'firstName', 'nickname', 'gender', 'birthDate'],
        include: [
          {
            model: Photo,
            attributes: ['id', 'url', 'isPrivate'],
            limit: 1,
            where: { isPrivate: false },
            required: false
          },
          {
            model: Profile,
            attributes: ['bio', 'interests']
          }
        ]
      }
    ],
    limit: parseInt(limit),
    order: [['createdAt', 'DESC']]
  });
};

exports.getPotentialMatches = async (userId, filters = {}) => {
  // Build the where clause based on user's preferences
  const whereClause = {
    id: { [Op.ne]: userId }, // Exclude current user
    accountStatus: 'active'
  };

  // Add gender filter if provided
  if (filters.gender) {
    whereClause.gender = filters.gender;
  }

  // Find users who the current user hasn't liked yet
  const userLikes = await Like.findAll({
    where: { userId },
    attributes: ['targetId']
  });

  const likedUserIds = userLikes.map(like => like.targetId);

  // Exclude users already liked
  if (likedUserIds.length > 0) {
    whereClause.id = {
      [Op.and]: [
        { [Op.ne]: userId },
        { [Op.notIn]: likedUserIds }
      ]
    };
  }

  return User.findAll({
    where: whereClause,
    attributes: ['id', 'firstName', 'nickname', 'gender', 'birthDate'],
    include: [
      {
        model: Photo,
        attributes: ['id', 'url'],
        where: { isPrivate: false },
        required: false
      },
      {
        model: Profile,
        attributes: ['bio', 'interests']
      }
    ],
    limit: 10,
    order: [['lastActive', 'DESC']]
  });
};
