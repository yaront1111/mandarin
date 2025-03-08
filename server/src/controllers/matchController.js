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
  // Optionally you can put this logic in matchService as well
  const matches = await matchService.getUserMatches(userId);
  res.json({ success: true, data: matches });
});
