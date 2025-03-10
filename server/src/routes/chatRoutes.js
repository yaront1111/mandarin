const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const auth = require('../middlewares/auth');

/**
 * GET /api/chat/:matchId - Fetch messages for a match.
 */
router.get('/:matchId', auth, chatController.getMessages);

/**
 * POST /api/chat - Send a new message.
 */
router.post('/', auth, chatController.sendMessage);

module.exports = router;
