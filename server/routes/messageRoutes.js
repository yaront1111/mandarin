// routes/messageRoutes.js
const express = require('express');
const { User, Message } = require('../models');
const { protect, asyncHandler } = require('../middleware/auth');
const logger = require('../logger');
const mongoose = require('mongoose');
const router = express.Router();

// Rate limiting middleware for message endpoints
const rateLimit = require('express-rate-limit');

const messageRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 60, // 60 requests per minute
  message: {
    success: false,
    error: 'Too many messages sent. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Helper to validate MongoDB ObjectId
 * @param {string} id - ID to validate
 * @returns {boolean} - Whether ID is valid
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Helper to sanitize text content
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
const sanitizeText = (text) => {
  if (!text) return '';
  // Remove any potentially harmful characters or patterns
  return text.trim()
    .replace(/[<>]/g, '') // Basic HTML tag prevention
    .substr(0, 2000); // Limit length
};

/**
 * @route   GET /api/messages/:userId
 * @desc    Get message history with a specific user
 * @access  Private
 */
router.get('/:userId', protect, asyncHandler(async (req, res) => {
  logger.debug(`Fetching messages with user ${req.params.userId} for user ${req.user._id}`);

  try {
    // Validate user ID
    if (!isValidObjectId(req.params.userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }

    // Check if the user exists
    const otherUser = await User.findById(req.params.userId).select('_id');
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Build query to find conversation messages
    const query = {
      $or: [
        { sender: req.user._id, recipient: req.params.userId },
        { sender: req.params.userId, recipient: req.user._id }
      ]
    };

    // Allow date filtering
    if (req.query.since) {
      // Validate date format
      const since = new Date(req.query.since);
      if (!isNaN(since.getTime())) {
        query.createdAt = { $gte: since };
      }
    }

    // Allow message type filtering
    if (req.query.type && ['text', 'wink', 'video'].includes(req.query.type)) {
      query.type = req.query.type;
    }

    // Find messages with pagination and populate sender name
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get message count for pagination
    const total = await Message.countDocuments(query);

    // Mark received messages as read in a background task
    // This avoids waiting for the update to complete before sending response
    Message.updateMany(
      { sender: req.params.userId, recipient: req.user._id, read: false },
      { read: true }
    ).then(updateResult => {
      if (updateResult.modifiedCount > 0) {
        logger.debug(`Marked ${updateResult.modifiedCount} messages as read`);
      }
    }).catch(err => {
      logger.error(`Error marking messages as read: ${err.message}`);
    });

    res.status(200).json({
      success: true,
      data: messages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    logger.error(`Error fetching messages: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching messages'
    });
  }
}));

/**
 * @route   POST /api/messages
 * @desc    Send a new message
 * @access  Private
 */
router.post('/', protect, messageRateLimit, asyncHandler(async (req, res) => {
  const { recipient, type, content } = req.body;

  logger.debug(`Sending ${type || 'unknown'} message from ${req.user._id} to ${recipient}`);

  try {
    // Validate required fields
    if (!recipient) {
      return res.status(400).json({
        success: false,
        error: 'Recipient is required'
      });
    }

    // Validate recipient ID format
    if (!isValidObjectId(recipient)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid recipient ID format'
      });
    }

    // Validate message type
    const validTypes = ['text', 'wink', 'video'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid message type. Must be one of: text, wink, video'
      });
    }

    // Validate message content based on type
    if (type === 'text' && (!content || content.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required for text messages'
      });
    }

    // Validate content length
    if (type === 'text' && content.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Message content must be 2000 characters or less'
      });
    }

    // Make sure sender isn't sending a message to themselves
    if (recipient === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'Cannot send message to yourself'
      });
    }

    // Validate recipient exists
    const recipientUser = await User.findById(recipient);
    if (!recipientUser) {
      return res.status(404).json({
        success: false,
        error: 'Recipient not found'
      });
    }

    // Check if users are blocked (if you have a blocking system)
    // This would be a good place to check if either user has blocked the other

    // Process content based on type
    let processedContent = '';
    if (type === 'text') {
      processedContent = sanitizeText(content);
    } else if (type === 'wink') {
      processedContent = '😉';
    } else if (type === 'video') {
      processedContent = 'Video Call';
    }

    // Create message
    const message = await Message.create({
      sender: req.user._id,
      recipient,
      type,
      content: processedContent,
      createdAt: new Date()
    });

    // Enhance response with sender info
    const enhancedMessage = {
      ...message.toObject(),
      senderName: req.user.nickname
    };

    logger.info(`Message sent: ${message._id} (${type})`);

    res.status(201).json({
      success: true,
      data: enhancedMessage
    });
  } catch (err) {
    logger.error(`Error sending message: ${err.message}`);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to send message'
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
    // Validate message ID
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid message ID format'
      });
    }

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

    // Only update if not already read
    if (!message.read) {
      // Update read status
      message.read = true;
      message.readAt = new Date();
      await message.save();

      logger.debug(`Message ${req.params.id} marked as read`);
    } else {
      logger.debug(`Message ${req.params.id} was already read`);
    }

    res.status(200).json({
      success: true,
      data: message
    });
  } catch (err) {
    logger.error(`Error marking message as read: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error while marking message as read'
    });
  }
}));

/**
 * @route   PUT /api/messages/conversation/:userId/read
 * @desc    Mark all messages from a user as read
 * @access  Private
 */
router.put('/conversation/:userId/read', protect, asyncHandler(async (req, res) => {
  const { userId } = req.params;

  logger.debug(`Marking all messages from user ${userId} as read`);

  try {
    // Validate user ID
    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }

    // Check if the user exists
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update all unread messages
    const result = await Message.updateMany(
      {
        sender: userId,
        recipient: req.user._id,
        read: false
      },
      {
        read: true,
        readAt: new Date()
      }
    );

    logger.debug(`Marked ${result.modifiedCount} messages as read`);

    res.status(200).json({
      success: true,
      count: result.modifiedCount
    });
  } catch (err) {
    logger.error(`Error marking conversation as read: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error while marking conversation as read'
    });
  }
}));

/**
 * @route   GET /api/messages/unread/count
 * @desc    Get count of unread messages
 * @access  Private
 */
router.get('/unread/count', protect, asyncHandler(async (req, res) => {
  logger.debug(`Getting unread message count for user ${req.user._id}`);

  try {
    // Count all unread messages for this user
    const count = await Message.countDocuments({
      recipient: req.user._id,
      read: false
    });

    // Get count by sender for detailed info
    const unreadBySender = await Message.aggregate([
      {
        $match: {
          recipient: mongoose.Types.ObjectId(req.user._id),
          read: false
        }
      },
      {
        $group: {
          _id: '$sender',
          count: { $sum: 1 },
          lastMessage: { $max: '$createdAt' }
        }
      },
      {
        $sort: { lastMessage: -1 }
      }
    ]);

    // Get sender names
    const senderIds = unreadBySender.map(item => item._id);
    const senders = await User.find(
      { _id: { $in: senderIds } },
      { nickname: 1 }
    );

    // Map sender names to results
    const detailedUnread = unreadBySender.map(item => {
      const sender = senders.find(s => s._id.toString() === item._id.toString());
      return {
        senderId: item._id,
        senderName: sender ? sender.nickname : 'Unknown',
        count: item.count,
        lastMessage: item.lastMessage
      };
    });

    res.status(200).json({
      success: true,
      total: count,
      bySender: detailedUnread
    });
  } catch (err) {
    logger.error(`Error getting unread message count: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error while getting unread message count'
    });
  }
}));

/**
 * @route   DELETE /api/messages/:id
 * @desc    Delete a message
 * @access  Private
 */
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  logger.debug(`Deleting message ${req.params.id}`);

  try {
    // Validate message ID
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid message ID format'
      });
    }

    // Find message and ensure the user is either sender or recipient
    const message = await Message.findOne({
      _id: req.params.id,
      $or: [
        { sender: req.user._id },
        { recipient: req.user._id }
      ]
    });

    if (!message) {
      logger.warn(`Message ${req.params.id} not found or user not authorized`);
      return res.status(404).json({
        success: false,
        error: 'Message not found or you are not authorized'
      });
    }

    // Handle different delete modes based on if user is sender or recipient
    const isSender = message.sender.toString() === req.user._id.toString();
    const isRecipient = message.recipient.toString() === req.user._id.toString();

    // Check for delete mode from query param
    const deleteMode = req.query.mode || 'self';

    // Handle different delete modes
    if (deleteMode === 'self') {
      // Mark as deleted for this user only
      if (isSender) {
        message.deletedBySender = true;
      } else if (isRecipient) {
        message.deletedByRecipient = true;
      }

      // If both users have deleted it, actually remove it
      if (message.deletedBySender && message.deletedByRecipient) {
        await message.remove();
        logger.info(`Message ${req.params.id} permanently deleted`);
      } else {
        await message.save();
        logger.info(`Message ${req.params.id} marked as deleted for ${isSender ? 'sender' : 'recipient'}`);
      }
    } else if (deleteMode === 'both' && isSender) {
      // Only senders can delete for both users
      // Permanently delete the message
      await message.remove();
      logger.info(`Message ${req.params.id} permanently deleted by sender for both users`);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid delete mode or you are not authorized for this action'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message deleted'
    });
  } catch (err) {
    logger.error(`Error deleting message: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting message'
    });
  }
}));

/**
 * @route   GET /api/messages/search
 * @desc    Search messages with text content
 * @access  Private
 */
router.get('/search', protect, asyncHandler(async (req, res) => {
  const { query, with: conversationPartner } = req.query;

  logger.debug(`Searching messages with query "${query}" for user ${req.user._id}`);

  try {
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    // Build search query
    const searchQuery = {
      $and: [
        { type: 'text' }, // Only search text messages
        { content: { $regex: query, $options: 'i' } }, // Case-insensitive search
        {
          $or: [
            { sender: req.user._id }, // Messages sent by current user
            { recipient: req.user._id } // Messages received by current user
          ]
        }
      ]
    };

    // If conversation partner specified, limit to that conversation
    if (conversationPartner && isValidObjectId(conversationPartner)) {
      searchQuery.$and.push({
        $or: [
          { sender: conversationPartner, recipient: req.user._id },
          { sender: req.user._id, recipient: conversationPartner }
        ]
      });
    }

    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Execute search with pagination
    const messages = await Message.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await Message.countDocuments(searchQuery);

    // Enhance messages with conversation partner info
    const uniqueUserIds = new Set();
    messages.forEach(msg => {
      if (msg.sender.toString() !== req.user._id.toString()) {
        uniqueUserIds.add(msg.sender.toString());
      }
      if (msg.recipient.toString() !== req.user._id.toString()) {
        uniqueUserIds.add(msg.recipient.toString());
      }
    });

    // Get user info for all conversation partners
    const users = await User.find(
      { _id: { $in: Array.from(uniqueUserIds) } },
      { nickname: 1 }
    );

    // Map user info to messages
    const enhancedMessages = messages.map(msg => {
      const otherUserId = msg.sender.toString() === req.user._id.toString()
        ? msg.recipient.toString()
        : msg.sender.toString();

      const otherUser = users.find(u => u._id.toString() === otherUserId);

      return {
        ...msg,
        conversationWith: {
          _id: otherUserId,
          nickname: otherUser ? otherUser.nickname : 'Unknown'
        }
      };
    });

    res.status(200).json({
      success: true,
      data: enhancedMessages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    logger.error(`Error searching messages: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error while searching messages'
    });
  }
}));

module.exports = router;
