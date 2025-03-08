// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/:id', protect, getProfile);
router.put('/:id', protect, updateProfile);

// Additional endpoints for likeUser, getMatches, etc.

module.exports = router;
