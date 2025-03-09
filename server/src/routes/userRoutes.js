// src/routes/userRoutes.js

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middlewares/auth');

/**
 * Protected routes for user profile.
 *
 * GET /users/me       -> get your own profile
 * GET /users/:id      -> get someone else's profile (requires auth)
 * PUT /users/me       -> update your profile
 * DELETE /users/me    -> delete your account
 */

router.get('/me', auth, userController.getProfile);
router.get('/stats', auth, userController.getUserStats);
router.get('/:id', auth, userController.getProfile);
router.put('/me', auth, userController.updateProfile);
router.delete('/me', auth, userController.deleteAccount);

module.exports = router;
