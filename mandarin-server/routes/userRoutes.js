const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile
} = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');

// GET /api/users/:id
router.get('/:id', protect, getProfile);

// PUT /api/users/:id
router.put('/:id', protect, updateProfile);

// Additional endpoints (likeUser, getMatches, etc.) can be added here

module.exports = router;
