const Message = require('../models/Message');

/**
 * GET /api/messages
 * Return all messages (dummy).
 * In real usage, you'd want messages by conversation or user, etc.
 */
exports.getConversations = async (req, res) => {
  try {
    const messages = await Message.find().populate('sender', 'username');
    res.json(messages);
  } catch (error) {
    console.error('getConversations Error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/messages/:id
 * Return a specific conversation by ID (dummy).
 */
exports.getConversation = async (req, res) => {
  try {
    const conversation = await Message.findById(req.params.id).populate('sender', 'username');
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (error) {
    console.error('getConversation Error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/messages/:id
 * Create a new message in a conversation (dummy).
 * Assumes "sender" is taken from req.user.id (via auth middleware).
 */
exports.sendMessage = async (req, res) => {
  try {
    const newMessage = await Message.create({
      conversationId: req.params.id,
      content: req.body.content,
      sender: req.user.id
    });
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('sendMessage Error:', error);
    res.status(500).json({ message: error.message });
  }
};
