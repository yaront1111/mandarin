// server/routes/messageRoutes.js
const express = require("express")
const { User, Message } = require("../models")
const { protect, asyncHandler } = require("../middleware/auth")
const logger = require("../logger")
const mongoose = require("mongoose")
const router = express.Router()

// Rate limiting middleware for message endpoints
const rateLimit = require("express-rate-limit")

const messageRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    success: false,
    error: "Too many messages sent. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * Helper to validate MongoDB ObjectId
 * @param {string} id - ID to validate
 * @returns {boolean}
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id)
}

/**
 * Helper to sanitize text content
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
const sanitizeText = (text) => {
  if (!text) return ""
  return text.trim().replace(/[<>]/g, "").substr(0, 2000)
}

/**
 * @route   GET /api/messages/:userId
 * @desc    Get message history with a specific user
 * @access  Private
 */
router.get(
  "/:userId",
  protect,
  asyncHandler(async (req, res) => {
    logger.debug(`Fetching messages with user ${req.params.userId} for user ${req.user._id}`)

    try {
      if (!isValidObjectId(req.params.userId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid user ID format",
        })
      }

      const otherUser = await User.findById(req.params.userId).select("_id")
      if (!otherUser) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        })
      }

      const page = Number.parseInt(req.query.page) || 1
      const limit = Number.parseInt(req.query.limit) || 50
      const skip = (page - 1) * limit

      const query = {
        $or: [
          { sender: req.user._id, recipient: req.params.userId },
          { sender: req.params.userId, recipient: req.user._id },
        ],
      }

      if (req.query.since) {
        const since = new Date(req.query.since)
        if (!isNaN(since.getTime())) {
          query.createdAt = { $gte: since }
        }
      }

      if (req.query.type && ["text", "wink", "video"].includes(req.query.type)) {
        query.type = req.query.type
      }

      const messages = await Message.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()

      const total = await Message.countDocuments(query)

      // Mark received messages as read in the background
      Message.updateMany(
        { sender: req.params.userId, recipient: req.user._id, read: false },
        { read: true, readAt: new Date() },
      )
        .then((updateResult) => {
          if (updateResult.modifiedCount > 0) {
            logger.debug(`Marked ${updateResult.modifiedCount} messages as read`)
          }
        })
        .catch((err) => {
          logger.error(`Error marking messages as read: ${err.message}`)
        })

      res.status(200).json({
        success: true,
        data: messages,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      })
    } catch (err) {
      logger.error(`Error fetching messages: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error while fetching messages",
      })
    }
  }),
)

/**
 * @route   POST /api/messages
 * @desc    Send a new message (supports location messages)
 * @access  Private
 */
router.post(
  "/",
  protect,
  messageRateLimit,
  asyncHandler(async (req, res) => {
    const { recipient, type, content, metadata } = req.body

    logger.debug(`Sending ${type || "unknown"} message from ${req.user._id} to ${recipient}`)

    try {
      if (!recipient) {
        return res.status(400).json({
          success: false,
          error: "Recipient is required",
        })
      }
      if (!isValidObjectId(recipient)) {
        return res.status(400).json({
          success: false,
          error: "Invalid recipient ID format",
        })
      }

      const validTypes = ["text", "wink", "video", "location"]
      if (!type || !validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `Invalid message type. Must be one of: ${validTypes.join(", ")}`,
        })
      }

      if (type === "text" && (!content || content.trim().length === 0)) {
        return res.status(400).json({
          success: false,
          error: "Message content is required for text messages",
        })
      }

      if (type === "text" && content.length > 2000) {
        return res.status(400).json({
          success: false,
          error: "Message content must be 2000 characters or less",
        })
      }

      if (recipient === req.user._id.toString()) {
        return res.status(400).json({
          success: false,
          error: "Cannot send message to yourself",
        })
      }

      const recipientUser = await User.findById(recipient)
      if (!recipientUser) {
        return res.status(404).json({
          success: false,
          error: "Recipient not found",
        })
      }

      // Process message content based on type
      let processedContent = ""
      if (type === "text") {
        processedContent = sanitizeText(content)
      } else if (type === "wink") {
        processedContent = "😉"
      } else if (type === "video") {
        processedContent = "Video Call"
      } else if (type === "location") {
        // For location messages, validate metadata and convert coordinates to numbers
        if (
          !metadata ||
          !metadata.location ||
          !Array.isArray(metadata.location.coordinates) ||
          metadata.location.coordinates.length !== 2
        ) {
          return res.status(400).json({
            success: false,
            error: "Location messages require valid coordinates in metadata",
          })
        }
        // Convert coordinates to numbers
        const coords = metadata.location.coordinates.map((coord) => Number(coord))
        if (coords.some((coord) => isNaN(coord))) {
          return res.status(400).json({
            success: false,
            error: "Invalid coordinate values. Must be numeric.",
          })
        }
        const [longitude, latitude] = coords
        if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
          return res.status(400).json({
            success: false,
            error: "Invalid coordinates. Longitude must be between -180 and 180, latitude between -90 and 90",
          })
        }
        // Update metadata with converted coordinates
        metadata.location.coordinates = coords
        processedContent = content || "" // Content can be empty for location messages
      }

      const message = await Message.create({
        sender: req.user._id,
        recipient,
        type,
        content: processedContent,
        metadata: metadata || {},
        createdAt: new Date(),
      })

      const enhancedMessage = {
        ...message.toObject(),
        senderName: req.user.nickname,
      }

      logger.info(`Message sent: ${message._id} (${type})`)

      res.status(201).json({
        success: true,
        data: enhancedMessage,
      })
    } catch (err) {
      logger.error(`Error sending message: ${err.message}`)
      res.status(400).json({
        success: false,
        error: err.message || "Failed to send message",
      })
    }
  }),
)

/**
 * @route   PUT /api/messages/:id/read
 * @desc    Mark a message as read
 * @access  Private
 */
router.put(
  "/:id/read",
  protect,
  asyncHandler(async (req, res) => {
    logger.debug(`Marking message ${req.params.id} as read`)

    try {
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({
          success: false,
          error: "Invalid message ID format",
        })
      }

      const message = await Message.findOne({
        _id: req.params.id,
        recipient: req.user._id,
      })

      if (!message) {
        logger.warn(`Message ${req.params.id} not found or user not authorized`)
        return res.status(404).json({
          success: false,
          error: "Message not found or you are not authorized",
        })
      }

      if (!message.read) {
        message.read = true
        message.readAt = new Date()
        await message.save()
        logger.debug(`Message ${req.params.id} marked as read`)
      } else {
        logger.debug(`Message ${req.params.id} was already read`)
      }

      res.status(200).json({
        success: true,
        data: message,
      })
    } catch (err) {
      logger.error(`Error marking message as read: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error while marking message as read",
      })
    }
  }),
)

/**
 * @route   PUT /api/messages/conversation/:userId/read
 * @desc    Mark all messages from a user as read
 * @access  Private
 */
router.put(
  "/conversation/:userId/read",
  protect,
  asyncHandler(async (req, res) => {
    const { userId } = req.params
    logger.debug(`Marking all messages from user ${userId} as read`)

    try {
      if (!isValidObjectId(userId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid user ID format",
        })
      }

      const otherUser = await User.findById(userId)
      if (!otherUser) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        })
      }

      const result = await Message.updateMany(
        {
          sender: userId,
          recipient: req.user._id,
          read: false,
        },
        {
          read: true,
          readAt: new Date(),
        },
      )

      logger.debug(`Marked ${result.modifiedCount} messages as read`)
      res.status(200).json({
        success: true,
        count: result.modifiedCount,
      })
    } catch (err) {
      logger.error(`Error marking conversation as read: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error while marking conversation as read",
      })
    }
  }),
)

/**
 * @route   GET /api/messages/unread/count
 * @desc    Get count of unread messages
 * @access  Private
 */
router.get(
  "/unread/count",
  protect,
  asyncHandler(async (req, res) => {
    logger.debug(`Getting unread message count for user ${req.user._id}`)

    try {
      // Convert user ID to ObjectId
      const recipientId = new mongoose.Types.ObjectId(req.user._id)

      // Get total count of unread messages
      const count = await Message.countDocuments({
        recipient: recipientId,
        read: false,
      })

      // Get unread counts grouped by sender
      const unreadBySender = await Message.aggregate([
        {
          $match: {
            recipient: recipientId,
            read: false,
          },
        },
        {
          $group: {
            _id: "$sender",
            count: { $sum: 1 },
            lastMessage: { $max: "$createdAt" },
          },
        },
        {
          $sort: { lastMessage: -1 },
        },
      ])

      // Get sender details if unread messages exist
      let detailedUnread = []
      if (unreadBySender.length > 0) {
        const senderIds = unreadBySender.map((item) => item._id)
        const senders = await User.find({ _id: { $in: senderIds } }, { nickname: 1, photos: 1 }).lean()

        detailedUnread = unreadBySender.map((item) => {
          const sender = senders.find((s) => s._id.toString() === item._id.toString())
          return {
            senderId: item._id,
            senderName: sender ? sender.nickname : "Unknown",
            senderPhoto: sender && sender.photos && sender.photos.length > 0 ? sender.photos[0].url : null,
            count: item.count,
            lastMessage: item.lastMessage,
          }
        })
      }

      res.status(200).json({
        success: true,
        total: count,
        bySender: detailedUnread,
      })
    } catch (err) {
      logger.error(`Error getting unread message count: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error while getting unread message count",
      })
    }
  }),
)

/**
 * @route   DELETE /api/messages/:id
 * @desc    Delete a message
 * @access  Private
 */
router.delete(
  "/:id",
  protect,
  asyncHandler(async (req, res) => {
    logger.debug(`Deleting message ${req.params.id}`)

    try {
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({
          success: false,
          error: "Invalid message ID format",
        })
      }

      const message = await Message.findOne({
        _id: req.params.id,
        $or: [{ sender: req.user._id }, { recipient: req.user._id }],
      })

      if (!message) {
        logger.warn(`Message ${req.params.id} not found or user not authorized`)
        return res.status(404).json({
          success: false,
          error: "Message not found or you are not authorized",
        })
      }

      const isSender = message.sender.toString() === req.user._id.toString()
      const isRecipient = message.recipient.toString() === req.user._id.toString()
      const deleteMode = req.query.mode || "self"

      if (deleteMode === "self") {
        if (isSender) {
          message.deletedBySender = true
        } else if (isRecipient) {
          message.deletedByRecipient = true
        }
        if (message.deletedBySender && message.deletedByRecipient) {
          await Message.deleteOne({ _id: message._id })
          logger.info(`Message ${req.params.id} permanently deleted`)
        } else {
          await message.save()
          logger.info(`Message ${req.params.id} marked as deleted for ${isSender ? "sender" : "recipient"}`)
        }
      } else if (deleteMode === "both" && isSender) {
        await Message.deleteOne({ _id: message._id })
        logger.info(`Message ${req.params.id} permanently deleted by sender for both users`)
      } else {
        return res.status(400).json({
          success: false,
          error: "Invalid delete mode or you are not authorized for this action",
        })
      }

      res.status(200).json({
        success: true,
        message: "Message deleted",
      })
    } catch (err) {
      logger.error(`Error deleting message: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error while deleting message",
      })
    }
  }),
)

/**
 * @route   GET /api/messages/search
 * @desc    Search messages with text content
 * @access  Private
 */
router.get(
  "/search",
  protect,
  asyncHandler(async (req, res) => {
    const { query, with: conversationPartner } = req.query
    logger.debug(`Searching messages with query "${query}" for user ${req.user._id}`)

    try {
      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: "Search query must be at least 2 characters",
        })
      }

      const searchQuery = {
        $and: [
          { type: "text" },
          { content: { $regex: query, $options: "i" } },
          {
            $or: [{ sender: req.user._id }, { recipient: req.user._id }],
          },
        ],
      }

      if (conversationPartner && isValidObjectId(conversationPartner)) {
        searchQuery.$and.push({
          $or: [
            { sender: conversationPartner, recipient: req.user._id },
            { sender: req.user._id, recipient: conversationPartner },
          ],
        })
      }

      const page = Number.parseInt(req.query.page) || 1
      const limit = Number.parseInt(req.query.limit) || 20
      const skip = (page - 1) * limit

      const messages = await Message.find(searchQuery).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()

      const total = await Message.countDocuments(searchQuery)

      const uniqueUserIds = new Set()
      messages.forEach((msg) => {
        if (msg.sender.toString() !== req.user._id.toString()) {
          uniqueUserIds.add(msg.sender.toString())
        }
        if (msg.recipient.toString() !== req.user._id.toString()) {
          uniqueUserIds.add(msg.recipient.toString())
        }
      })

      const users = await User.find({ _id: { $in: Array.from(uniqueUserIds) } }, { nickname: 1 })

      const enhancedMessages = messages.map((msg) => {
        const otherUserId =
          msg.sender.toString() === req.user._id.toString() ? msg.recipient.toString() : msg.sender.toString()
        const otherUser = users.find((u) => u._id.toString() === otherUserId)
        return {
          ...msg,
          conversationWith: {
            _id: otherUserId,
            nickname: otherUser ? otherUser.nickname : "Unknown",
          },
        }
      })

      res.status(200).json({
        success: true,
        data: enhancedMessages,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      })
    } catch (err) {
      logger.error(`Error searching messages: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error while searching messages",
      })
    }
  }),
)

/**
 * @route   POST /api/messages/:id/reaction
 * @desc    Add a reaction to a message
 * @access  Private
 */
router.post(
  "/:id/reaction",
  protect,
  asyncHandler(async (req, res) => {
    const { emoji } = req.body
    logger.debug(`Adding reaction ${emoji} to message ${req.params.id}`)

    try {
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({
          success: false,
          error: "Invalid message ID format",
        })
      }

      if (!emoji) {
        return res.status(400).json({
          success: false,
          error: "Emoji is required",
        })
      }

      // Validate emoji format (basic validation)
      if (emoji.length > 4) {
        return res.status(400).json({
          success: false,
          error: "Invalid emoji format",
        })
      }

      const message = await Message.findOne({
        _id: req.params.id,
        $or: [{ sender: req.user._id }, { recipient: req.user._id }],
      })

      if (!message) {
        logger.warn(`Message ${req.params.id} not found or user not authorized`)
        return res.status(404).json({
          success: false,
          error: "Message not found or you are not authorized",
        })
      }

      // Add reaction
      await message.addReaction(req.user._id, emoji)

      logger.info(`Reaction added to message ${req.params.id}`)
      res.status(200).json({
        success: true,
        data: message,
      })
    } catch (err) {
      logger.error(`Error adding reaction: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error while adding reaction",
      })
    }
  }),
)

/**
 * @route   DELETE /api/messages/:id/reaction/:reactionId
 * @desc    Remove a reaction from a message
 * @access  Private
 */
router.delete(
  "/:id/reaction/:reactionId",
  protect,
  asyncHandler(async (req, res) => {
    logger.debug(`Removing reaction ${req.params.reactionId} from message ${req.params.id}`)

    try {
      if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.reactionId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid ID format",
        })
      }

      const message = await Message.findOne({
        _id: req.params.id,
        $or: [{ sender: req.user._id }, { recipient: req.user._id }],
      })

      if (!message) {
        logger.warn(`Message ${req.params.id} not found or user not authorized`)
        return res.status(404).json({
          success: false,
          error: "Message not found or you are not authorized",
        })
      }

      // Check if the reaction exists and belongs to the user
      const reaction = message.reactions.id(req.params.reactionId)
      if (!reaction) {
        return res.status(404).json({
          success: false,
          error: "Reaction not found",
        })
      }

      if (reaction.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          error: "You can only remove your own reactions",
        })
      }

      // Remove reaction
      await message.removeReaction(req.user._id)

      logger.info(`Reaction removed from message ${req.params.id}`)
      res.status(200).json({
        success: true,
        data: message,
      })
    } catch (err) {
      logger.error(`Error removing reaction: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error while removing reaction",
      })
    }
  }),
)

module.exports = router
