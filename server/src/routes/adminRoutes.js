const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middlewares/auth');

// Only for admin users
router.get('/users', auth, adminController.getAllUsers);
router.post('/ban', auth, adminController.banUser);

module.exports = router;
