// routes/storyRoutes.js
const express = require('express');
const router = express.Router();
const { fetchStories, uploadStory, replyToStory } = require('../controllers/storyController');
const { protect } = require('../middlewares/authMiddleware');

// For file uploads, you might need multer middleware here
router.get('/', protect, fetchStories);
router.post('/', protect, uploadStory);
router.post('/:storyOwnerId/reply', protect, replyToStory);

module.exports = router;
