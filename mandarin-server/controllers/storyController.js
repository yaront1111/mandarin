const Story = require('../models/Story');

/**
 * GET /api/stories
 * Returns all stories.
 * In real usage, add filters or pagination if needed.
 */
exports.fetchStories = async (req, res) => {
  try {
    const stories = await Story.find().populate('owner', 'username');
    res.json(stories);
  } catch (error) {
    console.error('fetchStories Error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/stories
 * Body: (Multer) => file upload
 * Creates a new story for the authenticated user.
 */
exports.uploadStory = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const story = await Story.create({
      owner: req.user.id,
      url: req.file.path
    });

    res.status(201).json(story);
  } catch (error) {
    console.error('uploadStory Error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/stories/:id/reply
 * Dummy: add a reply to a story. Implementation may vary.
 */
exports.replyToStory = async (req, res) => {
  try {
    // You might store replies in a separate model or an array in Story
    res.status(200).json({ message: 'Reply sent (dummy implementation).' });
  } catch (error) {
    console.error('replyToStory Error:', error);
    res.status(500).json({ message: error.message });
  }
};
