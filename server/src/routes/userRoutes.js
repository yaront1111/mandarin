const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middlewares/auth');

// Protected routes for user profile
router.get('/me', auth, userController.getProfile);
router.get('/:id', auth, userController.getProfile);
router.put('/me', auth, userController.updateProfile);
router.delete('/me', auth, userController.deleteAccount);

module.exports = router;
