// src/controllers/matchController.js

const { catchAsync } = require('../utils/helpers');
const matchService = require('../services/matchService');
const logger = require('../utils/logger');

/**
 * Like a target user.
 * Expects req.body to contain a valid targetId.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.likeUser = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { targetId } = req.body;

  logger.info(`User ${userId} is liking user ${targetId}`);

  const result = await matchService.likeUser(userId, targetId);
  res.status(200).json({ success: true, data: result });
});

/**
 * Get all matches for the current user.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.getMatches = catchAsync(async (req, res) => {
  const userId = req.user.id;
  logger.info(`Fetching matches for user ${userId}`);
  const matches = await matchService.getUserMatches(userId);
  res.status(200).json({ success: true, data: matches });
});

/**
 * Get mutual matches for the current user.
 * Accepts an optional query parameter "limit" to limit the number of results.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.getMutualMatches = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { limit } = req.query;
  logger.info(`Fetching mutual matches for user ${userId} with limit ${limit}`);
  const matches = await matchService.getMutualMatches({ userId, limit });
  res.status(200).json({ success: true, data: matches });
});

/**
 * Get potential matches for the current user.
 * Accepts query filters (e.g., gender, ageMin, ageMax, etc.).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.getPotentialMatches = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const filters = req.query;
  logger.info(`Fetching potential matches for user ${userId} with filters: ${JSON.stringify(filters)}`);
  const potentialMatches = await matchService.getPotentialMatches(userId, filters);
  res.status(200).json({ success: true, data: potentialMatches });
});

/**
 * Unmatch a user.
 * Expects req.params.id to be the match ID to unmatch.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.unmatchUser = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const matchId = req.params.id;
  logger.info(`User ${userId} is unmatching match ${matchId}`);
  await matchService.unmatchUser(userId, matchId);
  res.status(200).json({ success: true, message: 'Unmatched successfully' });
});

/**
 * Block a user.
 * Expects req.body to contain targetId.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.blockUser = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { targetId } = req.body;
  logger.info(`User ${userId} is blocking user ${targetId}`);
  await matchService.blockUser(userId, targetId);
  res.status(200).json({ success: true, message: 'User blocked successfully' });
});

/**
 * Report a user.
 * Expects req.body to contain targetId, reason, and optional details.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.reportUser = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { targetId, reason, details } = req.body;
  logger.info(`User ${userId} is reporting user ${targetId} for reason: ${reason}`);
  await matchService.reportUser(userId, targetId, reason, details);
  res.status(200).json({ success: true, message: 'User reported successfully' });
});
