// server/routes/messageRoutes.js
const express = require("express")
const { User, Message } = require("../models")
const { protect, asyncHandler } = require("../middleware/auth")
const logger = require("../logger")
const mongoose = require("mongoose")
const router = express.Router()
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { fileTypeFromBuffer } = require('file-type');
const sharp = require('sharp');

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

// Configure multer storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), config.FILE_UPLOAD_PATH, 'messages');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const fileExt = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;
    cb(null, uniqueName);
  },
});

// Configure multer upload with file type filtering
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      // Documents
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      // Audio
      'audio/mpeg', 'audio/wav',
      // Video
      'video/mp4', 'video/quicktime'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type. Only images, documents, audio, and videos are allowed.'));
  },
});

/**
 * @route   POST /api/messages/attachments
 * @desc    Upload file attachment for messages
 * @access  Private
 */
router.post(
  '/attachments',
  protect,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    logger.debug(`Processing message attachment upload for user ${req.user._id}`);
    let filePath = null;

    try {
      if (!req.file) {
        logger.warn("File upload failed: No file provided");
        return res.status(400).json({ success: false, error: "Please upload a file" });
      }

      // Validate recipient ID if provided
      if (req.body.recipient && !isValidObjectId(req.body.recipient)) {
        // Remove the uploaded file
        fs.unlinkSync(path.join(req.file.destination, req.file.filename));
        return res.status(400).json({
          success: false,
          error: "Invalid recipient ID format",
        });
      }

      filePath = path.join(req.file.destination, req.file.filename);
      const fileBuffer = fs.readFileSync(filePath);

      // Verify file type
      const fileType = await fileTypeFromBuffer(fileBuffer);
      if (!fileType) {
        fs.unlinkSync(filePath);
        return res.status(400).json({
          success: false,
          error: "File type could not be determined"
        });
      }

      let fileMetadata = {
        contentType: fileType.mime,
        size: req.file.size,
      };

      // If it's an image, get dimensions and create thumbnail
      if (fileType.mime.startsWith('image/')) {
        // Process image and create thumbnail
        try {
          const image = sharp(filePath);
          const metadata = await image.metadata();

          fileMetadata.dimensions = {
            width: metadata.width,
            height: metadata.height
          };

          // Create thumbnail for images
          const thumbnailPath = filePath + '_thumb';
          await image
            .resize(300, 300, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .toFile(thumbnailPath);

          fileMetadata.thumbnail = `/uploads/messages/${req.file.filename}_thumb`;
        } catch (processError) {
          logger.error(`Error processing image: ${processError.message}`);
          // Continue without thumbnail if processing fails
        }
      }

      // Construct the file URL
      const fileUrl = `/uploads/messages/${req.file.filename}`;

      // Return success response
      res.status(200).json({
        success: true,
        data: {
          url: fileUrl,
          mimeType: fileType.mime,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          metadata: fileMetadata
        }
      });

      logger.info(`Message attachment uploaded: ${fileUrl} (${fileType.mime})`);
    } catch (err) {
      logger.error(`Error uploading message attachment: ${err.message}`);

      // Clean up file on error
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);

          // Also remove thumbnail if it exists
          const thumbnailPath = filePath + '_thumb';
          if (fs.existsSync(thumbnailPath)) {
            fs.unlinkSync(thumbnailPath);
          }
        } catch (unlinkErr) {
          logger.error(`Error deleting uploaded file after error: ${unlinkErr.message}`);
        }
      }

      res.status(400).json({
        success: false,
        error: err.message || "Failed to upload file"
      });
    }
  })
);

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

      if (req.query.type && ["text", "wink", "video", "file"].includes(req.query.type)) {
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
 * @desc    Send a new message
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

      // Update valid types to include 'file'
      const validTypes = ["text", "wink", "video", "file", "location"]
      if (!type || !validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `Invalid message type. Must be one of: ${validTypes.join(", ")}`,
        })
      }

      // Type-specific validation
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

      // Add validation for file messages
      if (type === "file") {
        if (!metadata || !metadata.fileUrl) {
          return res.status(400).json({
            success: false,
            error: "File URL is required for file messages",
          })
        }

        if (!metadata.fileName) {
          return res.status(400).json({
            success: false,
            error: "File name is required for file messages",
          })
        }
      }

      // Location validation
      if (type === "location") {
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
      } else if (type === "file") {
        processedContent = metadata.fileName || "File"
      } else if (type === "location") {
        processedContent = content || "Location" // Content can be empty for location messages
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
 * @route   POST /api/messages/read
 * @desc    Mark multiple messages as read
 * @access  Private
 */
router.post(
  "/read",
  protect,
  asyncHandler(async (req, res) => {
    const { messageIds } = req.body;
    logger.debug(`Marking multiple messages as read for user ${req.user._id}`);

    try {
      if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Message IDs array is required",
        });
      }

      // Validate all IDs
      const invalidIds = messageIds.filter(id => !isValidObjectId(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid message ID format: ${invalidIds.join(', ')}`,
        });
      }

      // Update messages
      const result = await Message.updateMany(
        {
          _id: { $in: messageIds },
          recipient: req.user._id,
          read: false,
        },
        {
          read: true,
          readAt: new Date(),
        }
      );

      logger.debug(`Marked ${result.modifiedCount} of ${messageIds.length} messages as read`);

      res.status(200).json({
        success: true,
        count: result.modifiedCount,
      });
    } catch (err) {
      logger.error(`Error marking messages as read: ${err.message}`);
      res.status(500).json({
        success: false,
        error: "Server error while marking messages as read",
      });
    }
  })
);

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

      // If message is a file type, potentially delete the file
      if (message.type === "file" && isSender && (deleteMode === "both" || (message.deletedByRecipient && deleteMode === "self"))) {
        try {
          // Extract file URL from metadata
          if (message.metadata && message.metadata.fileUrl) {
            const fileUrl = message.metadata.fileUrl;
            // Convert URL to file path
            const filePath = path.join(
              process.cwd(),
              fileUrl.replace(/^\/uploads/, config.FILE_UPLOAD_PATH)
            );

            // Delete file if it exists
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              logger.info(`Deleted file: ${filePath}`);

              // Delete thumbnail if it exists
              const thumbnailPath = filePath + '_thumb';
              if (fs.existsSync(thumbnailPath)) {
                fs.unlinkSync(thumbnailPath);
                logger.info(`Deleted thumbnail: ${thumbnailPath}`);
              }
            }
          }
        } catch (fileErr) {
          logger.error(`Error deleting file for message ${req.params.id}: ${fileErr.message}`);
          // Continue with message deletion even if file deletion fails
        }
      }

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
 * @route   GET /api/messages/conversations
 * @desc    Get all conversations for the current user
 * @access  Private
 */
router.get(
  "/conversations",
  protect,
  asyncHandler(async (req, res) => {
    logger.debug(`Getting conversations for user ${req.user._id}`)

    try {
      // Get most recent message with each user
      const conversations = await Message.aggregate([
        {
          $match: {
            $or: [{ sender: mongoose.Types.ObjectId(req.user._id) }, { recipient: mongoose.Types.ObjectId(req.user._id) }],
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ["$sender", mongoose.Types.ObjectId(req.user._id)] },
                "$recipient",
                "$sender",
              ],
            },
            lastMessage: { $first: "$$ROOT" },
            unreadCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$recipient", mongoose.Types.ObjectId(req.user._id)] },
                      { $eq: ["$read", false] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $sort: { "lastMessage.createdAt": -1 },
        },
      ])

      // Get user details for each conversation
      const userIds = conversations.map((conv) => conv._id)
      const users = await User.find({ _id: { $in: userIds } }).select("nickname photos isOnline lastActive")

      // Combine conversation data with user data
      const result = conversations.map((conv) => {
        const user = users.find((u) => u._id.toString() === conv._id.toString())
        if (!user) {
          // Skip conversations with users who no longer exist
          return null
        }
        return {
          user: {
            _id: user._id,
            nickname: user.nickname,
            photo: user.photos && user.photos.length > 0 ? user.photos[0].url : null,
            isOnline: user.isOnline,
            lastActive: user.lastActive,
          },
          lastMessage: conv.lastMessage,
          unreadCount: conv.unreadCount,
          updatedAt: conv.lastMessage.createdAt,
        }
      }).filter(Boolean) // Remove any null entries (where user not found)

      res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      logger.error(`Error getting conversations: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error while getting conversations",
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
