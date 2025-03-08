// src/controllers/storyController.js
const { catchAsync } = require('../utils/helpers');
const storyService = require('../services/storyService');
const { ValidationError } = require('../utils/errors');

exports.postStory = catchAsync(async (req, res) => {
  // E.g. req.body = { type: 'text', content: 'Hello world', backgroundColor: '#ffffff' }
  const { type, content, backgroundColor } = req.body;
  if (!type || !content) {
    throw new ValidationError('Type and content are required');
  }

  const story = await storyService.createStory(req.user.id, type, content, backgroundColor);
  res.status(201).json({ success: true, data: story });
});

exports.viewStory = catchAsync(async (req, res) => {
  const { storyId } = req.params;
  const story = await storyService.viewStory(storyId, req.user.id);
  res.json({ success: true, data: story });
});

exports.getMyStories = catchAsync(async (req, res) => {
  const stories = await storyService.getUserStories(req.user.id);
  res.json({ success: true, data: stories });
});
