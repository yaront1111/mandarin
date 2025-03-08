// controllers/storyController.js
const Story = require('../models/Story');

exports.fetchStories = async (req, res) => {
  try {
    const stories = await Story.find();
    res.json(stories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.uploadStory = async (req, res) => {
  try {
    // Assuming file upload handled by middleware (e.g., multer)
    const story = await Story.create({
      owner: req.user.id,
      url: req.file.path, // if using multer
      // add other metadata as needed
    });
    res.status(201).json(story);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.replyToStory = async (req, res) => {
  try {
    // Dummy implementation: add a reply to a story
    // In a real app, you might update a story document with a replies array
    res.status(200).json({ message: 'Reply sent' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
