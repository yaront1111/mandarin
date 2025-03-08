const express = require('express');
const router = express.Router();
const {
  fetchStories,
  uploadStory,
  replyToStory
} = require('../controllers/storyController');
const { protect } = require('../middlewares/authMiddleware');

// GET /api/stories
router.get('/', protect, fetchStories);

// POST /api/stories
// If you need file uploads, add Multer middleware here. Example:
// router.post('/', protect, upload.single('storyFile'), uploadStory);
router.post('/', protect, uploadStory);

// POST /api/stories/:storyOwnerId/reply
router.post('/:storyOwnerId/reply', protect, replyToStory);

module.exports = router;
