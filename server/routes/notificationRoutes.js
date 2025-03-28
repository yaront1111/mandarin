import express from "express";
import mongoose from "mongoose";
import { protect, asyncHandler } from "../middleware/auth.js";
import logger from "../logger.js";

const router = express.Router();

// We'll try to use the Notification model if it exists, otherwise we'll create a basic schema
let Notification;
try {
  Notification = mongoose.model("Notification");
} catch (err) {
  // Define a basic notification schema if not already defined
  const notificationSchema = new mongoose.Schema({
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["message", "like", "match", "story", "system"],
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    content: String,
    reference: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "type",
    },
    read: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  });

  Notification = mongoose.model("Notification", notificationSchema);
  logger.info("Created Notification model schema");
}

/**
 * @route   GET /api/notifications
 * @desc    Get notifications for the current user
 * @access  Private
 */
router.get(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    try {
      const page = Number.parseInt(req.query.page, 10) || 1;
      const limit = Number.parseInt(req.query.limit, 10) || 20;
      const skip = (page - 1) * limit;

      const notifications = await Notification.find({ recipient: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("sender", "nickname username photos avatar")
        .lean();

      const total = await Notification.countDocuments({ recipient: req.user._id });

      res.status(200).json({
        success: true,
        count: notifications.length,
        total,
        page,
        pages: Math.ceil(total / limit),
        data: notifications,
      });
    } catch (err) {
      logger.error(`Error fetching notifications: ${err.message}`);
      res.status(500).json({
        success: false,
        error: "Server error while fetching notifications",
      });
    }
  })
);

/**
 * @route   PUT /api/notifications/read
 * @desc    Mark notifications as read
 * @access  Private
 */
router.put(
  "/read",
  protect,
  asyncHandler(async (req, res) => {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Notification IDs array is required",
        });
      }

      const result = await Notification.updateMany(
        { _id: { $in: ids }, recipient: req.user._id },
        { read: true }
      );

      res.status(200).json({
        success: true,
        count: result.modifiedCount,
      });
    } catch (err) {
      logger.error(`Error marking notifications as read: ${err.message}`);
      res.status(500).json({
        success: false,
        error: "Server error while marking notifications as read",
      });
    }
  })
);
/**
 * @route   POST /api/notifications/create-test
 * @desc    Create a test notification for development
 * @access  Private
 */
router.post(
  "/create-test",
  protect,
  asyncHandler(async (req, res) => {
    try {
      const { type = "system" } = req.body;

      // Validate type is allowed
      if (!["message", "like", "match", "photoRequest", "photoResponse", "story", "system"].includes(type)) {
        return res.status(400).json({
          success: false,
          error: "Invalid notification type"
        });
      }

      // Create a new notification
      const notification = new Notification({
        recipient: req.user._id,
        type: type,
        sender: req.user._id, // self-reference for test
        content: `Test ${type} notification created at ${new Date().toLocaleTimeString()}`,
        read: false,
        createdAt: new Date()
      });

      await notification.save();
      logger.info(`Created test notification (${type}) for user ${req.user._id}`);

      // If socket server is available, emit the notification
      if (req.app.io) {
        const userConnections = req.app.io.userConnectionsMap;
        const userId = req.user._id.toString();

        if (userConnections && userConnections.has(userId)) {
          const notificationPayload = {
            _id: notification._id,
            type: notification.type,
            title: `Test ${type} Notification`,
            message: notification.content,
            sender: {
              _id: req.user._id,
              nickname: req.user.nickname || "Test User"
            },
            read: false,
            createdAt: notification.createdAt
          };

          userConnections.get(userId).forEach(socketId => {
            req.app.io.to(socketId).emit("notification", notificationPayload);
          });

          logger.info(`Emitted test notification to ${userConnections.get(userId).size} socket(s)`);
        }
      }

      res.status(201).json({
        success: true,
        data: notification
      });
    } catch (err) {
      logger.error(`Error creating test notification: ${err.message}`);
      res.status(500).json({
        success: false,
        error: "Server error while creating test notification",
        details: err.message
      });
    }
  })
);

/**
 * @route   GET /api/notifications/debug
 * @desc    Get debug info about notifications
 * @access  Private
 */
router.get(
  "/debug",
  protect,
  asyncHandler(async (req, res) => {
    try {
      // Check overall notification counts
      const totalNotifications = await Notification.countDocuments();
      const userNotifications = await Notification.countDocuments({ recipient: req.user._id });

      // Get notification model info
      const modelInfo = Notification.schema.obj;
      const modelName = Notification.modelName;

      // Sample notification if any exist
      let sampleNotification = null;
      if (userNotifications > 0) {
        sampleNotification = await Notification.findOne({ recipient: req.user._id }).lean();
      }

      // Socket info
      const socketInfo = {
        ioAvailable: !!req.app.io,
        userConnections: req.app.io ?
          (req.app.io.userConnectionsMap?.has(req.user._id.toString()) ?
            req.app.io.userConnectionsMap.get(req.user._id.toString()).size : 0) :
          'No socket available'
      };

      res.status(200).json({
        success: true,
        debug: {
          totalNotifications,
          userNotifications,
          modelInfo,
          modelName,
          sampleNotification,
          socketInfo,
          user: {
            id: req.user._id,
            hasSettings: !!req.user.settings
          }
        }
      });
    } catch (err) {
      logger.error(`Error getting notification debug info: ${err.message}`);
      res.status(500).json({
        success: false,
        error: "Server error while getting notification debug info",
        details: err.message
      });
    }
  })
);
/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all notifications as read for the current user
 * @access  Private
 */
router.put(
  "/read-all",
  protect,
  asyncHandler(async (req, res) => {
    try {
      const result = await Notification.updateMany(
        { recipient: req.user._id, read: false },
        { read: true }
      );

      res.status(200).json({
        success: true,
        count: result.modifiedCount,
      });
    } catch (err) {
      logger.error(`Error marking all notifications as read: ${err.message}`);
      res.status(500).json({
        success: false,
        error: "Server error while marking all notifications as read",
      });
    }
  })
);

export default router;
