// routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const { getConversations, getConversation, sendMessage } = require('../controllers/messageController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/conversations', protect, getConversations);
router.get('/conversations/:id', protect, getConversation);
router.post('/conversations/:id', protect, sendMessage);

module.exports = router;
