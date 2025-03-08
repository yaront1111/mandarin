const express = require('express');
const router = express.Router();
const {
  getConversations,
  getConversation,
  sendMessage
} = require('../controllers/messageController');
const { protect } = require('../middlewares/authMiddleware');

// GET /api/messages/conversations
router.get('/conversations', protect, getConversations);

// GET /api/messages/conversations/:id
router.get('/conversations/:id', protect, getConversation);

// POST /api/messages/conversations/:id
router.post('/conversations/:id', protect, sendMessage);

module.exports = router;
