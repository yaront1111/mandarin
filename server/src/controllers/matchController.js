// src/controllers/matchController.js

const { catchAsync } = require('../utils/helpers');
const matchService = require('../services/matchService');

exports.likeUser = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { targetId } = req.body;

  const result = await matchService.likeUser(userId, targetId);
  res.json({ success: true, data: result });
});

exports.getMatches = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const matches = await matchService.getUserMatches(userId);
  res.json({ success: true, data: matches });
});

exports.getMutualMatches = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { limit } = req.query;

  const matches = await matchService.getMutualMatches({ userId, limit });
  res.json({ success: true, data: matches });
});

exports.getPotentialMatches = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const filters = req.query; // e.g., gender, ageMin, ageMax, etc.

  const potentialMatches = await matchService.getPotentialMatches(userId, filters);
  res.json({ success: true, data: potentialMatches });
});

exports.unmatchUser = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const matchId = req.params.id;

  await matchService.unmatchUser(userId, matchId);
  res.json({ success: true, message: 'Unmatched successfully' });
});

exports.blockUser = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { targetId } = req.body;

  await matchService.blockUser(userId, targetId);
  res.json({ success: true, message: 'User blocked successfully' });
});

exports.reportUser = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { targetId, reason, details } = req.body;

  await matchService.reportUser(userId, targetId, reason, details);
  res.json({ success: true, message: 'User reported successfully' });
});
