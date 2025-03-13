// routes/messageRoutes.js
const express = require('express');
const { User, Message } = require('../models');
const { protect, asyncHandler } = require('../middleware/auth');
const logger = require('../logger');
const router = express.Router();

/**
 * @route   GET /api/messages/:userId
 * @desc    Get message history with a specific user
 * @access  Private
 */
router.get('/:userId', protect, asyncHandler(async (req, res) => {
  logger.debug(`Fetching messages with user ${req.params.userId} for user ${req.user._id}`);

  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, recipient: req.params.userId },
        { sender: req.params.userId, recipient: req.user._id }
      ]
    }).sort({ createdAt: -1 });

    // Mark messages as read
    const updateResult = await Message.updateMany(
      { sender: req.params.userId, recipient: req.user._id, read: false },
      { read: true }
    );

    if (updateResult.modifiedCount > 0) {
      logger.debug(`Marked ${updateResult.modifiedCount} messages as read`);
    }

    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (err) {
    logger.error(`Error fetching messages: ${err.message}`);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}));

/**
 * @route   POST /api/messages
 * @desc    Send a new message
 * @access  Private
 */
router.post('/', protect, asyncHandler(async (req, res) => {
  const { recipient, type, content } = req.body;

  logger.debug(`Sending ${type} message from ${req.user._id} to ${recipient}`);

  try {
    // Validate recipient exists
    const recipientUser = await User.findById(recipient);
    if (!recipientUser) {
      logger.warn(`Message send failed: Recipient ${recipient} not found`);
      return res.status(404).json({
        success: false,
        error: 'Recipient not found'
      });
    }

    // Create message
    const message = await Message.create({
      sender: req.user._id,
      recipient,
      type,
      content
    });

    logger.info(`Message sent: ${message._id} (${type})`);

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (err) {
    logger.error(`Error sending message: ${err.message}`);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}));

/**
 * @route   PUT /api/messages/:id/read
 * @desc    Mark a message as read
 * @access  Private
 */
router.put('/:id/read', protect, asyncHandler(async (req, res) => {
  logger.debug(`Marking message ${req.params.id} as read`);

  try {
    // Find message and ensure recipient is current user
    const message = await Message.findOne({
      _id: req.params.id,
      recipient: req.user._id
    });

    if (!message) {
      logger.warn(`Message ${req.params.id} not found or user not authorized`);
      return res.status(404).json({
        success: false,
        error: 'Message not found or you are not authorized'
      });
    }

    // Update read status
    message.read = true;
    await message.save();

    logger.debug(`Message ${req.params.id} marked as read`);

    res.status(200).json({
      success: true,
      data: message
    });
  } catch (err) {
    logger.error(`Error marking message as read: ${err.message}`);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}));

module.exports = router;
