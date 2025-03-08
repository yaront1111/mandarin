// controllers/messageController.js
const Message = require('../models/Message');

exports.getConversations = async (req, res) => {
  try {
    // Dummy implementation: return all messages
    const messages = await Message.find();
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getConversation = async (req, res) => {
  try {
    // Find conversation by id (dummy)
    const conversation = await Message.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    // Create a new message for conversation (dummy implementation)
    const newMessage = await Message.create({
      conversationId: req.params.id,
      content: req.body.content,
      sender: req.user.id, // assuming auth middleware adds req.user
    });
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
