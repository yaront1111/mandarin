import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import rateLimit from "express-rate-limit";

import { User, Message } from "../models/index.js"; // Adjust if needed
import { protect, asyncHandler } from "../middleware/auth.js";
import logger from "../logger.js";
import config from "../config.js";

const router = express.Router();

// Rate limiting middleware for message endpoints
const messageRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    success: false,
    error: "Too many messages sent. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Helper to validate MongoDB ObjectId
 * @param {string|mongoose.Types.ObjectId} id - ID to validate
 * @returns {boolean}
 */
const isValidObjectId = (id) => {
  if (!id) return false;

  // If it's already an ObjectId instance, it's valid by definition (if created correctly)
  if (id instanceof mongoose.Types.ObjectId) return true;

  // Convert potential objects with toString to string
  const idStr =
    typeof id === "object" && id !== null && typeof id.toString === "function"
      ? id.toString()
      : String(id);

  // Check format (24 hex characters) and Mongoose validity
  const isValid =
    mongoose.Types.ObjectId.isValid(idStr) && /^[0-9a-fA-F]{24}$/.test(idStr);
  if (!isValid) {
    logger.debug(`ObjectId validation failed: ${idStr}`);
  }
  return isValid;
};

/**
 * @route POST /api/messages/start
 * @desc  Start a new conversation (or reuse existing) and send the first message
 * @access Private
 */
router.post(
  '/start',
  protect,
  messageRateLimit,
  asyncHandler(async (req, res) => {
    const senderId = safeObjectId(req.user._id);
    const recipientId = safeObjectId(req.body.toUserId);

    if (!senderId) {
      return res.status(401).json({ success: false, error: 'Authentication invalid.' });
    }
    if (!recipientId) {
      return res.status(400).json({ success: false, error: 'Invalid recipient ID.' });
    }
    if (senderId.equals(recipientId)) {
      return res.status(400).json({ success: false, error: 'Cannot start a conversation with yourself.' });
    }

    // Make sure recipient actually exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, error: 'Recipient user not found.' });
    }

    // Validate and sanitize text
    const rawText = String(req.body.text || '').trim();
    if (!rawText) {
      return res.status(400).json({ success: false, error: 'Message text is required.' });
    }
    const content = sanitizeText(rawText);

    // 1️⃣ Find existing conversation…
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] }
    });

    // 2️⃣ …or create a new one
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, recipientId],
        createdAt: new Date()
      });
      logger.info(`New conversation ${conversation._id} created between ${senderId} and ${recipientId}`);
    }

    // 3️⃣ Create the first message
    const message = await Message.create({
      conversation: conversation._id,
      sender: senderId,
      recipient: recipientId,
      type: 'text',
      content,
      createdAt: new Date(),
      read: false
    });

    // Optionally, you can push the message into a messages[] array on Conversation:
    // conversation.messages = conversation.messages || [];
    // conversation.messages.push(message._id);
    // await conversation.save();

    logger.info(`Message ${message._id} sent in conversation ${conversation._id}`);

    return res.status(201).json({
      success: true,
      data: {
        conversation,
        message
      }
    });
  })
);
/**
 * Helper to safely convert any value to a MongoDB ObjectId
 * @param {any} id - ID to convert
 * @returns {mongoose.Types.ObjectId|null} - Mongoose ObjectId or null if invalid
 */
const safeObjectId = (id) => {
  try {
    if (!id) return null;

    // If already an ObjectId, return it
    if (id instanceof mongoose.Types.ObjectId) return id;

    // Convert to string
    const idStr = String(id);

    // Extract a potential ObjectId from string (handle corrupted formats)
    const match = idStr.match(/([0-9a-fA-F]{24})/);
    const cleanId = match ? match[1] : idStr;

    // Create and return ObjectId if valid according to Mongoose and format
    if (
      mongoose.Types.ObjectId.isValid(cleanId) &&
      /^[0-9a-fA-F]{24}$/.test(cleanId)
    ) {
      return new mongoose.Types.ObjectId(cleanId);
    }

    logger.warn(`Failed to safely convert to ObjectId: Invalid format or value - ${id}`);
    return null;
  } catch (err) {
    logger.error(`Exception during safeObjectId conversion for value: ${id}`, err);
    return null;
  }
};

/**
 * Helper to sanitize text content
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
const sanitizeText = (text) => {
  if (!text) return "";
  // Basic sanitization: trim, remove basic HTML tags, limit length
  return text.trim().replace(/<[^>]*>/g, "").substring(0, 2000);
};

// Configure multer storage for file uploads (attachments)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(
      process.cwd(),
      config.FILE_UPLOAD_PATH || "uploads",
      "messages"
    ); // Use config or default
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
    fileSize: config.MAX_FILE_UPLOAD_SIZE || 5 * 1024 * 1024, // Use config or default 5MB
    files: 1, // Limit to one file per request
  },
  fileFilter: (req, file, cb) => {
    // Define allowed MIME types in config or use defaults
    const allowedMimeTypes =
      config.ALLOWED_UPLOAD_MIMETYPES || [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "audio/mpeg",
        "audio/wav",
        "audio/ogg",
        "video/mp4",
        "video/quicktime",
        "video/webm",
      ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      return cb(null, true); // Accept file
    }
    // Reject file
    cb(
      new Error(
        `Invalid file type: ${file.mimetype}. Only specific image, document, audio, and video types are allowed.`
      )
    );
  },
});

/**
 * @route   POST /api/messages/attachments
 * @desc    Upload file attachment for messages
 * @access  Private
 */
router.post(
  "/attachments",
  protect,
  upload.single("file"), // Use multer middleware
  asyncHandler(async (req, res) => {
    logger.debug(`Processing message attachment upload for user ${req.user._id}`);
    let filePath = null; // Define filePath outside try block for access in finally
    let processingSuccessful = false;

    try {
      if (!req.file) {
        logger.warn("File upload failed: No file provided");
        return res.status(400).json({ success: false, error: "Please upload a file" });
      }

      // Validate recipient ID if provided in the request body
      if (req.body.recipient && !isValidObjectId(req.body.recipient)) {
        // Immediately delete the uploaded file if recipient ID is invalid
        fs.unlinkSync(req.file.path); // Use req.file.path provided by multer
        logger.warn(`Deleted uploaded file due to invalid recipient ID: ${req.file.filename}`);
        return res.status(400).json({ success: false, error: "Invalid recipient ID format" });
      }

      filePath = req.file.path; // Get full path from multer
      const fileBuffer = fs.readFileSync(filePath);

      // Verify file type using file-type library for more accuracy
      const fileTypeResult = await fileTypeFromBuffer(fileBuffer);
      // Use detected MIME type or fallback to multer's provided type
      const detectedMimeType = fileTypeResult ? fileTypeResult.mime : req.file.mimetype;

      const fileMetadata = {
        contentType: detectedMimeType,
        size: req.file.size,
      };

      // If the file is an image, get dimensions and create a thumbnail
      if (detectedMimeType.startsWith("image/")) {
        try {
          const image = sharp(filePath);
          const metadata = await image.metadata();
          fileMetadata.dimensions = { width: metadata.width, height: metadata.height };

          // Define thumbnail path relative to the original file
          const thumbnailFilename = `${req.file.filename}_thumb${path.extname(req.file.filename) || ".jpg"}`;
          const thumbnailPath = path.join(req.file.destination, thumbnailFilename);

          await image
            .resize(300, 300, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);

          // Store relative URL for thumbnail
          fileMetadata.thumbnail = `/uploads/messages/${thumbnailFilename}`;
          logger.debug(`Thumbnail created: ${thumbnailPath}`);
        } catch (processError) {
          logger.error(`Error processing image thumbnail: ${processError.message}`);
          // Continue without thumbnail if processing fails, don't block upload
        }
      }

      // Construct the relative URL for the main file
      const fileUrl = `/uploads/messages/${req.file.filename}`;
      processingSuccessful = true; // Mark as successful before sending response

      res.status(200).json({
        success: true,
        data: {
          url: fileUrl,
          mimeType: detectedMimeType,
          fileName: req.file.originalname, // Original name for display
          fileSize: req.file.size,
          metadata: fileMetadata,
        },
      });

      logger.info(
        `Message attachment uploaded: ${fileUrl} (${detectedMimeType}) by user ${req.user._id}`
      );
    } catch (err) {
      if (err instanceof multer.MulterError) {
        logger.warn(`Multer error during attachment upload: ${err.code} - ${err.message}`);
        return res.status(400).json({ success: false, error: `File upload error: ${err.message}` });
      }
      if (err.message.startsWith("Invalid file type")) {
        logger.warn(`Invalid file type rejected: ${err.message}`);
        return res.status(400).json({ success: false, error: err.message });
      }
      logger.error(`Error uploading message attachment: ${err.message}`, { stack: err.stack });
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({ success: false, error: err.message || "Failed to upload file" });
    } finally {
      if (!processingSuccessful && filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          const thumbnailFilename = `${path.basename(filePath, path.extname(filePath))}_thumb${path.extname(filePath) || ".jpg"}`;
          const thumbnailPath = path.join(path.dirname(filePath), thumbnailFilename);
          if (fs.existsSync(thumbnailPath)) {
            fs.unlinkSync(thumbnailPath);
          }
          logger.debug(`Cleaned up failed attachment file and potential thumbnail: ${filePath}`);
        } catch (unlinkErr) {
          logger.error(`Error during attachment file cleanup: ${unlinkErr.message}`);
        }
      }
    }
  })
);

/**
 * @route   GET /api/messages/conversations
 * @desc    Get all conversations (latest message per partner) for the current user
 * @access  Private
 */
router.get(
  "/conversations",
  protect,
  asyncHandler(async (req, res) => {
    logger.debug(
      `[CONVERSATIONS ROUTE] Entering GET /conversations handler. req.user: ${JSON.stringify(req.user)}`
    );
    const userId = req.user._id;
    const userObjectId = safeObjectId(userId);
    if (!userObjectId) {
      logger.error(
        `CRITICAL: Failed to convert req.user._id to ObjectId in /conversations handler. User ID: ${userId}`
      );
      return res.status(500).json({ success: false, error: "Internal server error processing user ID." });
    }
    logger.info(
      `[CONVERSATIONS ROUTE] Using userObjectId: ${userObjectId} (Type: ${userObjectId instanceof mongoose.Types.ObjectId ? 'ObjectId' : typeof userObjectId}) for aggregation.`
    );
    logger.debug(
      `[CONVERSATIONS ROUTE] About to execute aggregation with match: ${{ $or: [{ sender: userObjectId }, { recipient: userObjectId }] }}`
    );
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userObjectId }, { recipient: userObjectId }],
          $nor: [
            { $and: [{ sender: userObjectId }, { deletedBySender: true }] },
            { $and: [{ recipient: userObjectId }, { deletedByRecipient: true }] },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [{ $eq: ["$sender", userObjectId] }, "$recipient", "$sender"],
          },
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$recipient", userObjectId] },
                    { $eq: ["$read", false] },
                    { $ne: ["$deletedByRecipient", true] },
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
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          pipeline: [
            { $project: { _id: 1, nickname: 1, photos: { $slice: ["$photos", 1] }, isOnline: 1, lastActive: 1 } },
          ],
          as: "partnerInfo",
        },
      },
      { $unwind: { path: "$partnerInfo", preserveNullAndEmptyArrays: true } },
      { $match: { partnerInfo: { $ne: null } } },
      {
        $project: {
          _id: 0,
          user: {
            _id: "$partnerInfo._id",
            nickname: "$partnerInfo.nickname",
            photo: { $ifNull: [{ $arrayElemAt: ["$partnerInfo.photos.url", 0] }, null] },
            isOnline: "$partnerInfo.isOnline",
            lastActive: "$partnerInfo.lastActive",
          },
          lastMessage: "$lastMessage",
          unreadCount: "$unreadCount",
          updatedAt: "$lastMessage.createdAt",
        },
      },
      { $sort: { updatedAt: -1 } },
    ]);

    logger.info(`[CONVERSATIONS ROUTE] Found ${conversations.length} conversations for user ${userId}`);

    res.status(200).json({ success: true, data: conversations });
  })
);

/**
 * @route   GET /api/messages/unread/count
 * @desc    Get count of unread messages for the current user
 * @access  Private
 */
router.get(
  "/unread/count",
  protect,
  asyncHandler(async (req, res) => {
    const userId = req.user._id;
    logger.debug(`Getting unread message count for user ${userId}`);

    const recipientObjectId = safeObjectId(userId);
    if (!recipientObjectId) {
      logger.error(`CRITICAL: Failed to convert req.user._id to ObjectId in /unread/count.`);
      return res.status(500).json({ success: false, error: "Internal server error processing user ID." });
    }

    const totalUnreadCount = await Message.countDocuments({ recipient: recipientObjectId, read: false });
    const unreadBySender = await Message.aggregate([
      { $match: { recipient: recipientObjectId, read: false } },
      {
        $group: {
          _id: "$sender",
          count: { $sum: 1 },
          lastMessageTimestamp: { $max: "$createdAt" },
        },
      },
      { $sort: { lastMessageTimestamp: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "senderInfo",
        },
      },
      { $unwind: { path: "$senderInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          senderId: "$_id",
          senderNickname: { $ifNull: ["$senderInfo.nickname", "Unknown User"] },
          senderPhoto: { $ifNull: [{ $arrayElemAt: ["$senderInfo.photos.url", 0] }, null] },
          count: "$count",
          lastMessageTimestamp: "$lastMessageTimestamp",
        },
      },
    ]);

    res.status(200).json({
      success: true,
      total: totalUnreadCount,
      bySender: unreadBySender,
    });
  })
);

/**
 * @route   GET /api/messages/search
 * @desc    Search messages (text content only) involving the current user
 * @access  Private
 */
router.get(
  "/search",
  protect,
  asyncHandler(async (req, res) => {
    const { query: searchTerm, with: partnerIdParam } = req.query;
    const userId = req.user._id;
    logger.debug(
      `Searching messages with query "${searchTerm}" for user ${userId}${partnerIdParam ? ` with partner ${partnerIdParam}` : ""}`
    );

    if (!searchTerm || typeof searchTerm !== "string" || searchTerm.trim().length < 2) {
      return res
        .status(400)
        .json({ success: false, error: "Search query must be a string of at least 2 characters." });
    }

    const userObjectId = safeObjectId(userId);
    if (!userObjectId) {
      logger.error(`CRITICAL: Failed to convert req.user._id to ObjectId in /search.`);
      return res.status(500).json({ success: false, error: "Internal server error processing user ID." });
    }

    const searchQuery = {
      $and: [
        { type: "text" },
        { content: { $regex: searchTerm.trim(), $options: "i" } },
        { $or: [{ sender: userObjectId }, { recipient: userObjectId }] },
        { deletedBySender: { $ne: true }, deletedByRecipient: { $ne: true } },
      ],
    };

    if (partnerIdParam) {
      const partnerObjectId = safeObjectId(partnerIdParam);
      if (!partnerObjectId) {
        logger.warn(`Invalid partner ID format provided in search: ${partnerIdParam}`);
      } else {
        searchQuery.$and.push({
          $or: [
            { sender: partnerObjectId, recipient: userObjectId },
            { sender: userObjectId, recipient: partnerObjectId },
          ],
        });
        logger.debug(`Filtering search results for conversation with ${partnerObjectId}`);
      }
    }

    const page = Number.parseInt(req.query.page) || 1;
    const limit = Math.min(Number.parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const messages = await Message.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Message.countDocuments(searchQuery);

    let enhancedMessages = messages;
    if (!partnerIdParam) {
      const partnerIdsInResults = [
        ...new Set(
          messages.map((msg) => (msg.sender.equals(userObjectId) ? msg.recipient : msg.sender))
        ),
      ];
      const partners = await User.find({ _id: { $in: partnerIdsInResults } })
        .select("nickname")
        .lean();
      const partnerMap = new Map(partners.map((p) => [p._id.toString(), p.nickname]));

      enhancedMessages = messages.map((msg) => {
        const partnerId = msg.sender.equals(userObjectId)
          ? msg.recipient.toString()
          : msg.sender.toString();
        return {
          ...msg,
          conversationPartner: {
            _id: partnerId,
            nickname: partnerMap.get(partnerId) || "Unknown User",
          },
        };
      });
    }

    res.status(200).json({
      success: true,
      data: enhancedMessages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
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
    const partnerIdParam = req.params.userId;
    logger.debug(
      `Attempting to get message history with user: ${partnerIdParam} for user: ${req.user?._id}`
    );

    const senderObjectId = safeObjectId(req.user._id);
    if (!senderObjectId) {
      logger.error(
        `CRITICAL: Missing or invalid req.user._id in GET /messages/:userId after protect middleware.`
      );
      return res.status(401).json({ success: false, error: "Authentication invalid. Please log in again." });
    }

    const partnerObjectId = safeObjectId(partnerIdParam);
    if (!partnerObjectId) {
      logger.warn(`Invalid partner ID format requested: ${partnerIdParam}`);
      return res.status(400).json({ success: false, error: "Invalid user ID format provided in URL." });
    }

    if (senderObjectId.equals(partnerObjectId)) {
      logger.warn(`User ${senderObjectId} attempted to fetch messages with themselves.`);
      return res
        .status(400)
        .json({ success: false, error: "Cannot fetch message history with yourself." });
    }

    const partnerExists = await User.exists({ _id: partnerObjectId });
    if (!partnerExists) {
      logger.warn(`Attempted to fetch messages with non-existent user: ${partnerObjectId}`);
      return res.status(404).json({ success: false, error: "The specified user does not exist." });
    }

    const page = Number.parseInt(req.query.page) || 1;
    const limit = Math.min(Number.parseInt(req.query.limit) || 50, 200);
    const skip = (page - 1) * limit;

    const query = {
      $or: [
        { sender: senderObjectId, recipient: partnerObjectId },
        { sender: partnerObjectId, recipient: senderObjectId },
      ],
      ...(senderObjectId.equals(req.user._id)
        ? { deletedBySender: { $ne: true } }
        : {}),
      ...(partnerObjectId.equals(req.user._id)
        ? { deletedByRecipient: { $ne: true } }
        : {}),
    };

    if (req.query.since) {
      const sinceDate = new Date(req.query.since);
      if (!isNaN(sinceDate.getTime())) {
        query.createdAt = { $gte: sinceDate };
        logger.debug(`Filtering messages since: ${sinceDate.toISOString()}`);
      } else {
        logger.warn(`Invalid 'since' date format received: ${req.query.since}`);
      }
    }

    const validTypes = ["text", "wink", "video", "file"];
    if (req.query.type && validTypes.includes(req.query.type)) {
      query.type = req.query.type;
      logger.debug(`Filtering messages by type: ${req.query.type}`);
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Message.countDocuments(query);

    Message.updateMany(
      {
        sender: partnerObjectId,
        recipient: senderObjectId,
        read: false,
        _id: { $in: messages.map((m) => m._id) },
      },
      { $set: { read: true, readAt: new Date() } }
    )
      .exec()
      .then((updateResult) => {
        if (updateResult.modifiedCount > 0) {
          logger.debug(
            `Marked ${updateResult.modifiedCount} messages as read in conversation with ${partnerObjectId}`
          );
        }
      })
      .catch((err) => {
        logger.error(`Background error marking messages as read: ${err.message}`);
      });

    res.status(200).json({
      success: true,
      data: messages.reverse(),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  })
);

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
    const { recipient, type, content, metadata } = req.body;
    const senderObjectId = safeObjectId(req.user._id);
    if (!senderObjectId) {
      logger.error(
        `CRITICAL: Missing or invalid req.user._id in POST /messages after protect middleware.`
      );
      return res.status(401).json({ success: false, error: "Authentication invalid. Please log in again." });
    }

    logger.debug(`Attempting to send message from ${senderObjectId} to ${recipient}`);

    if (!recipient) {
      return res.status(400).json({ success: false, error: "Recipient is required." });
    }
    const recipientObjectId = safeObjectId(recipient);
    if (!recipientObjectId) {
      return res.status(400).json({ success: false, error: "Invalid recipient ID format." });
    }

    const validTypes = ["text", "wink", "video", "file"];
    if (!type || !validTypes.includes(type)) {
      return res
        .status(400)
        .json({ success: false, error: `Invalid message type. Must be one of: ${validTypes.join(", ")}` });
    }

    let processedContent = "";
    let validationError = null;

    if (type === "text") {
      if (!content || content.trim().length === 0) {
        validationError = "Message content is required for text messages.";
      } else if (content.length > 2000) {
        validationError = `Message content must be ${config.MAX_MESSAGE_LENGTH || 2000} characters or less.`;
      } else {
        processedContent = sanitizeText(content);
      }
    } else if (type === "wink") {
      processedContent = "😉";
    } else if (type === "video") {
      processedContent = "Video Call";
    } else if (type === "file") {
      if (!metadata?.url) {
        validationError = "File URL is required in metadata for file messages.";
      } else if (!metadata?.fileName) {
        validationError = "File name is required in metadata for file messages.";
      } else {
        processedContent = sanitizeText(metadata.fileName).substring(0, 255);
      }
    }

    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    if (recipientObjectId.equals(senderObjectId)) {
      return res.status(400).json({ success: false, error: "Cannot send message to yourself." });
    }

    const recipientUser = await User.exists({ _id: recipientObjectId });
    if (!recipientUser) {
      return res.status(404).json({ success: false, error: "Recipient user not found." });
    }

    const message = await Message.create({
      sender: senderObjectId,
      recipient: recipientObjectId,
      type,
      content: processedContent,
      metadata: metadata || {},
      createdAt: new Date(),
      read: false,
    });

    const senderDetails = await User.findById(senderObjectId).select("nickname photos").lean();

    const responseMessage = {
      ...message.toObject(),
      senderName: senderDetails?.nickname || "User",
    };

    logger.info(
      `Message sent: ${message._id} (Type: ${type}) from ${senderObjectId} to ${recipientObjectId}`
    );
    res.status(201).json({ success: true, data: responseMessage });
  })
);

/**
 * @route   PUT /api/messages/:id/read
 * @desc    Mark a specific message as read
 * @access  Private
 */
router.put(
  "/:id/read",
  protect,
  asyncHandler(async (req, res) => {
    const messageId = req.params.id;
    const userId = req.user._id;

    logger.debug(`Attempting to mark message ${messageId} as read for user ${userId}`);

    if (!isValidObjectId(messageId)) {
      return res.status(400).json({ success: false, error: "Invalid message ID format." });
    }

    const message = await Message.findOne({ _id: messageId, recipient: userId });

    if (!message) {
      logger.warn(`Message ${messageId} not found for recipient ${userId} or already marked/doesn't exist.`);
      return res
        .status(404)
        .json({ success: false, error: "Message not found or cannot be marked as read." });
    }

    if (!message.read) {
      message.read = true;
      message.readAt = new Date();
      await message.save();
      logger.debug(`Message ${messageId} marked as read successfully.`);
    } else {
      logger.debug(`Message ${messageId} was already marked as read.`);
    }

    res.status(200).json({ success: true, data: message.toObject() });
  })
);

/**
 * @route   POST /api/messages/read
 * @desc    Mark multiple messages (by ID list) as read
 * @access  Private
 */
router.post(
  "/read",
  protect,
  asyncHandler(async (req, res) => {
    const { messageIds } = req.body;
    const userId = req.user._id;

    logger.debug(`Attempting to mark multiple messages as read for user ${userId}`);

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "An array of 'messageIds' is required in the request body." });
    }

    const validMessageIds = messageIds.filter(isValidObjectId).map((id) => safeObjectId(id));
    const invalidIds = messageIds.filter((id) => !isValidObjectId(id));

    if (invalidIds.length > 0) {
      logger.warn(`Request contained invalid message ID formats: ${invalidIds.join(", ")}`);
      return res
        .status(400)
        .json({ success: false, error: `Invalid message ID format found: ${invalidIds.join(", ")}` });
    }

    if (validMessageIds.length === 0) {
      return res.status(400).json({ success: false, error: "No valid message IDs provided." });
    }

    const result = await Message.updateMany(
      { _id: { $in: validMessageIds }, recipient: userId, read: false },
      { $set: { read: true, readAt: new Date() } }
    );

    logger.debug(
      `Bulk mark as read: Matched ${result.matchedCount}, Modified ${result.modifiedCount} messages for user ${userId}.`
    );

    res.status(200).json({ success: true, count: result.modifiedCount });
  })
);

/**
 * @route   PUT /api/messages/conversation/:userId/read
 * @desc    Mark all messages from a specific user to the current user as read
 * @access  Private
 */
router.put(
  "/conversation/:userId/read",
  protect,
  asyncHandler(async (req, res) => {
    const senderIdParam = req.params.userId;
    const recipientId = req.user._id;

    logger.debug(`Attempting to mark conversation from ${senderIdParam} as read for user ${recipientId}`);

    const senderObjectId = safeObjectId(senderIdParam);
    if (!senderObjectId) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid sender user ID format provided in URL." });
    }

    const result = await Message.updateMany(
      { sender: senderObjectId, recipient: recipientId, read: false },
      { $set: { read: true, readAt: new Date() } }
    );

    logger.debug(
      `Mark conversation as read: Matched ${result.matchedCount}, Modified ${result.modifiedCount} messages from ${senderObjectId} for user ${recipientId}.`
    );

    res.status(200).json({ success: true, count: result.modifiedCount });
  })
);

/**
 * @route   DELETE /api/messages/:id
 * @desc    Delete a message (for self or both)
 * @access  Private
 */
router.delete(
  "/:id",
  protect,
  asyncHandler(async (req, res) => {
    const messageId = req.params.id;
    const userId = req.user._id;
    const deleteMode = req.query.mode || "self";

    logger.debug(`Attempting to delete message ${messageId} with mode '${deleteMode}' for user ${userId}`);

    if (!isValidObjectId(messageId)) {
      return res.status(400).json({ success: false, error: "Invalid message ID format." });
    }

    const messageObjectId = safeObjectId(messageId);
    const userObjectId = safeObjectId(userId);

    const message = await Message.findOne({
      _id: messageObjectId,
      $or: [{ sender: userObjectId }, { recipient: userObjectId }],
    });

    if (!message) {
      logger.warn(`Delete failed: Message ${messageId} not found or user ${userId} not involved.`);
      return res
        .status(404)
        .json({ success: false, error: "Message not found or you are not authorized to delete it." });
    }

    const isSender = message.sender.equals(userObjectId);
    const isRecipient = message.recipient.equals(userObjectId);

    let deleteAction = null;

    if (deleteMode === "self") {
      if (isSender && !message.deletedBySender) {
        message.deletedBySender = true;
        deleteAction = "marked_sender";
      } else if (isRecipient && !message.deletedByRecipient) {
        message.deletedByRecipient = true;
        deleteAction = "marked_recipient";
      }

      if (message.deletedBySender && message.deletedByRecipient) {
        await Message.deleteOne({ _id: message._id });
        deleteAction = "deleted_permanently_both_marked";
        logger.info(`Message ${messageId} permanently deleted as both users marked it.`);
      } else if (deleteAction) {
        await message.save();
        logger.info(`Message ${messageId} marked as deleted for ${isSender ? "sender" : "recipient"}.`);
      } else {
        logger.debug(`Message ${messageId} already marked deleted for user ${userId}.`);
        deleteAction = "already_marked";
      }
    } else if (deleteMode === "both" && isSender) {
      await Message.deleteOne({ _id: message._id });
      deleteAction = "deleted_permanently_by_sender";
      logger.info(`Message ${messageId} permanently deleted by sender ${userId} for both users.`);
    } else if (deleteMode === "both" && !isSender) {
      logger.warn(`User ${userId} (recipient) attempted to delete message ${messageId} for both.`);
      return res
        .status(403)
        .json({ success: false, error: "Only the sender can delete a message for everyone." });
    } else {
      logger.warn(`Invalid delete mode '${deleteMode}' requested for message ${messageId}.`);
      return res
        .status(400)
        .json({ success: false, error: "Invalid delete mode specified. Use 'self' or 'both'." });
    }

    if (
      message.type === "file" &&
      (deleteAction === "deleted_permanently_both_marked" ||
        deleteAction === "deleted_permanently_by_sender")
    ) {
      if (message.metadata?.url) {
        try {
          const relativeFilePath = message.metadata.url.replace(/^\/uploads\//, "");
          const filePath = path.join(
            process.cwd(),
            config.FILE_UPLOAD_PATH || "uploads",
            relativeFilePath
          );
          const thumbnailPath = `${filePath}_thumb${path.extname(filePath) || ".jpg"}`;

          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logger.info(`Deleted associated file: ${filePath}`);
          }
          if (fs.existsSync(thumbnailPath)) {
            fs.unlinkSync(thumbnailPath);
            logger.info(`Deleted associated thumbnail: ${thumbnailPath}`);
          }
        } catch (fileErr) {
          logger.error(`Error deleting file(s) associated with message ${messageId}: ${fileErr.message}`);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Message ${deleteAction?.startsWith("deleted") ? "deleted" : "marked as deleted"}.`,
      action: deleteAction,
    });
  })
);

/**
 * @route   POST /api/messages/:id/reaction
 * @desc    Add a reaction to a message
 * @access  Private
 */
router.post(
  "/:id/reaction",
  protect,
  asyncHandler(async (req, res) => {
    const messageId = req.params.id;
    const { emoji } = req.body;
    const userId = req.user._id;

    logger.debug(`Attempting to add reaction '${emoji}' to message ${messageId} by user ${userId}`);

    if (!isValidObjectId(messageId)) {
      return res.status(400).json({ success: false, error: "Invalid message ID format." });
    }
    if (!emoji || typeof emoji !== "string" || emoji.length > 4 || emoji.length === 0) {
      return res.status(400).json({ success: false, error: "A valid emoji character is required." });
    }

    const messageObjectId = safeObjectId(messageId);
    const userObjectId = safeObjectId(userId);

    const message = await Message.findOne({
      _id: messageObjectId,
      $or: [{ sender: userObjectId }, { recipient: userObjectId }],
    });

    if (!message) {
      logger.warn(`Add reaction failed: Message ${messageId} not found or user ${userId} not involved.`);
      return res
        .status(404)
        .json({ success: false, error: "Message not found or you cannot react to it." });
    }

    await message.addReaction(userObjectId, emoji);
    logger.info(`Reaction '${emoji}' added/updated for message ${messageId} by user ${userId}`);

    res.status(200).json({ success: true, data: message.toObject() });
  })
);

/**
 * @route   DELETE /api/messages/:id/reaction
 * @desc    Remove the current user's reaction from a message
 * @access  Private
 */
router.delete(
  "/:id/reaction",
  protect,
  asyncHandler(async (req, res) => {
    const messageId = req.params.id;
    const userId = req.user._id;

    logger.debug(`Attempting to remove reaction from message ${messageId} by user ${userId}`);

    if (!isValidObjectId(messageId)) {
      return res.status(400).json({ success: false, error: "Invalid message ID format." });
    }

    const messageObjectId = safeObjectId(messageId);
    const userObjectId = safeObjectId(userId);

    const message = await Message.findOne({
      _id: messageObjectId,
      $or: [{ sender: userObjectId }, { recipient: userObjectId }],
    });

    if (!message) {
      logger.warn(`Remove reaction failed: Message ${messageId} not found or user ${userId} not involved.`);
      return res
        .status(404)
        .json({ success: false, error: "Message not found or you cannot modify its reactions." });
    }

    const modified = await message.removeReaction(userObjectId);

    if (modified) {
      logger.info(`Reaction removed from message ${messageId} by user ${userId}`);
    } else {
      logger.debug(`No reaction found for user ${userId} on message ${messageId} to remove.`);
    }

    res.status(200).json({ success: true, data: message.toObject() });
  })
);

export default router;
