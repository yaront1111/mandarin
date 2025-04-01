// server/routes/notificationRoutes.js - Enhanced to support bundling and more notification types
import express from "express";
import mongoose from "mongoose";
import { protect, asyncHandler } from "../middleware/auth.js";
import logger from "../logger.js";
import { User, Notification } from "../models/index.js";

const router = express.Router();

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

      // Get filter conditions from query params
      const filter = { recipient: req.user._id };
      
      // Filter by type if provided
      if (req.query.type && ["message", "like", "match", "photoRequest", "photoResponse", "story", "comment", "system", "call"].includes(req.query.type)) {
        filter.type = req.query.type;
      }
      
      // Filter by read status if provided
      if (req.query.read === 'true') {
        filter.read = true;
      } else if (req.query.read === 'false') {
        filter.read = false;
      }
      
      // Filter by sender if provided
      if (req.query.sender && mongoose.Types.ObjectId.isValid(req.query.sender)) {
        filter.sender = req.query.sender;
      }
      
      // Find notifications with filtering and pagination
      const notifications = await Notification.find(filter)
        .sort({ updatedAt: -1, createdAt: -1 }) // Sort by updated first, then created
        .skip(skip)
        .limit(limit)
        .populate("sender", "nickname username photos avatar")
        .lean();

      // Get total count for pagination
      const total = await Notification.countDocuments(filter);
      
      // Get total unread count (for status badges)
      const unreadCount = await Notification.countDocuments({ 
        recipient: req.user._id,
        read: false
      });

      // Log the response
      logger.info(`Retrieved ${notifications.length} notifications for user ${req.user._id} (total: ${total}, unread: ${unreadCount})`);

      res.status(200).json({
        success: true,
        count: notifications.length,
        total,
        unreadCount,
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

      // Filter out invalid ObjectIDs to prevent MongoDB errors
      const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
      
      if (validIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No valid notification IDs provided",
        });
      }

      // Ensure we only update this user's notifications
      const result = await Notification.updateMany(
        { 
          _id: { $in: validIds }, 
          recipient: req.user._id,
          read: false // Only update unread ones
        },
        { 
          read: true,
          readAt: new Date()
        }
      );

      logger.info(`Marked ${result.modifiedCount} notifications as read for user ${req.user._id}`);

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
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark a single notification as read
 * @access  Private
 */
router.put(
  "/:id/read",
  protect,
  asyncHandler(async (req, res) => {
    try {
      const notificationId = req.params.id;
      
      if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid notification ID format",
        });
      }

      // Find the notification and ensure it belongs to this user
      const notification = await Notification.findOne({
        _id: notificationId,
        recipient: req.user._id
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          error: "Notification not found or does not belong to you",
        });
      }

      // Skip if already read
      if (notification.read) {
        return res.status(200).json({
          success: true,
          message: "Notification was already marked as read",
        });
      }

      // Mark as read
      notification.read = true;
      notification.readAt = new Date();
      await notification.save();

      logger.info(`Marked notification ${notificationId} as read for user ${req.user._id}`);

      res.status(200).json({
        success: true,
        data: notification,
      });
    } catch (err) {
      logger.error(`Error marking notification as read: ${err.message}`);
      res.status(500).json({
        success: false,
        error: "Server error while marking notification as read",
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
        { 
          recipient: req.user._id, 
          read: false 
        },
        { 
          read: true,
          readAt: new Date()
        }
      );

      logger.info(`Marked all ${result.modifiedCount} unread notifications as read for user ${req.user._id}`);

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

/**
 * @route   POST /api/notifications/create
 * @desc    Create a new notification
 * @access  Private (admin or system only)
 */
router.post(
  "/create",
  protect,
  asyncHandler(async (req, res) => {
    try {
      const { 
        recipientId, 
        type, 
        title, 
        content, 
        data = {}, 
        enableBundling = true 
      } = req.body;

      // Validate required fields
      if (!recipientId || !type) {
        return res.status(400).json({
          success: false,
          error: "Recipient ID and type are required",
        });
      }

      // Validate recipient ID
      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid recipient ID format",
        });
      }

      // Check if recipient exists
      const recipient = await User.findById(recipientId);
      if (!recipient) {
        return res.status(404).json({
          success: false,
          error: "Recipient user not found",
        });
      }

      // Create notification (using the bundling method if enabled)
      const notificationData = {
        recipient: recipientId,
        type,
        title,
        content,
        data,
        sender: req.user._id, // Current user as sender
      };

      let notification;
      if (enableBundling) {
        notification = await Notification.createWithBundling(notificationData);
      } else {
        notification = new Notification(notificationData);
        await notification.save();
      }

      // If we have socket.io, emit notification to recipient
      if (req.app.io) {
        const recipientStr = recipientId.toString();
        const userConnections = req.app.io.userConnectionsMap;
        
        if (userConnections && userConnections.has(recipientStr)) {
          const sockets = userConnections.get(recipientStr);
          
          if (sockets && sockets.size > 0) {
            // Populate sender data for notification
            const populatedNotification = await Notification.findById(notification._id)
              .populate("sender", "nickname username photos avatar")
              .lean();
            
            // Emit to all recipient's sockets
            sockets.forEach(socketId => {
              req.app.io.to(socketId).emit("notification", populatedNotification);
            });
            
            logger.info(`Notification emitted to ${sockets.size} socket(s) for user ${recipientId}`);
          }
        }
      }

      res.status(201).json({
        success: true,
        data: notification,
      });
    } catch (err) {
      logger.error(`Error creating notification: ${err.message}`);
      res.status(500).json({
        success: false,
        error: "Server error while creating notification",
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

      // Validate notification type
      const validTypes = [
        "message", "like", "match", "photoRequest", 
        "photoResponse", "story", "comment", "system", "call"
      ];
      
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `Invalid notification type. Must be one of: ${validTypes.join(", ")}`
        });
      }

      // Generate content based on type
      let title, content, data = {};
      
      switch (type) {
        case "message":
          title = "Test Message Notification";
          content = "This is a test message notification.";
          data = { messageId: new mongoose.Types.ObjectId() };
          break;
        case "like":
          title = "Test Like Notification";
          content = "Someone liked your profile.";
          data = { likeId: new mongoose.Types.ObjectId() };
          break;
        case "match":
          title = "Test Match Notification";
          content = "You have a new match!";
          data = { matchId: new mongoose.Types.ObjectId() };
          break;
        case "photoRequest":
          title = "Test Photo Request";
          content = "Someone requested access to your photo.";
          data = { photoId: new mongoose.Types.ObjectId() };
          break;
        case "photoResponse":
          title = "Test Photo Response";
          content = "Your photo request was approved.";
          data = { 
            photoId: new mongoose.Types.ObjectId(),
            status: Math.random() > 0.5 ? "approved" : "rejected"
          };
          break;
        case "story":
          title = "Test Story Notification";
          content = "Someone shared a new story.";
          data = { storyId: new mongoose.Types.ObjectId() };
          break;
        case "comment":
          title = "Test Comment Notification";
          content = "Someone commented on your post.";
          data = { commentId: new mongoose.Types.ObjectId() };
          break;
        case "call":
          title = "Test Call Notification";
          content = "You missed a call.";
          data = { callId: new mongoose.Types.ObjectId() };
          break;
        default:
          title = "Test System Notification";
          content = `Test ${type} notification created at ${new Date().toLocaleTimeString()}`;
      }

      // Create a new notification (self-reference for testing)
      const notification = new Notification({
        recipient: req.user._id,
        type: type,
        sender: req.user._id,
        title,
        content,
        data,
        read: false
      });

      await notification.save();
      logger.info(`Created test notification (${type}) for user ${req.user._id}`);

      // If socket server is available, emit the notification
      if (req.app.io) {
        const userConnections = req.app.io.userConnectionsMap;
        const userId = req.user._id.toString();

        if (userConnections && userConnections.has(userId)) {
          // Populate before sending
          const populatedNotification = await Notification.findById(notification._id)
            .populate("sender", "nickname username photos avatar")
            .lean();
            
          userConnections.get(userId).forEach(socketId => {
            req.app.io.to(socketId).emit("notification", populatedNotification);
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
 * @route   GET /api/notifications/count
 * @desc    Get notification count statistics
 * @access  Private
 */
router.get(
  "/count",
  protect,
  asyncHandler(async (req, res) => {
    try {
      // Get counts by type
      const counts = await Notification.aggregate([
        { $match: { recipient: req.user._id } },
        { 
          $group: { 
            _id: { 
              type: "$type", 
              read: "$read" 
            },
            count: { $sum: 1 }
          }
        },
        { 
          $group: {
            _id: "$_id.type",
            read: { $sum: { $cond: [{ $eq: ["$_id.read", true] }, "$count", 0] } },
            unread: { $sum: { $cond: [{ $eq: ["$_id.read", false] }, "$count", 0] } },
            total: { $sum: "$count" }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      
      // Get overall totals
      const totals = await Notification.aggregate([
        { $match: { recipient: req.user._id } },
        { 
          $group: { 
            _id: "$read",
            count: { $sum: 1 }
          }
        }
      ]);

      // Format totals into a cleaner structure
      const overallTotals = {
        read: 0,
        unread: 0,
        total: 0
      };

      totals.forEach(item => {
        if (item._id === true) {
          overallTotals.read = item.count;
        } else {
          overallTotals.unread = item.count;
        }
        overallTotals.total += item.count;
      });

      res.status(200).json({
        success: true,
        counts: {
          byType: counts,
          totals: overallTotals
        }
      });
    } catch (err) {
      logger.error(`Error fetching notification counts: ${err.message}`);
      res.status(500).json({
        success: false,
        error: "Server error while fetching notification counts",
      });
    }
  })
);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete(
  "/:id",
  protect,
  asyncHandler(async (req, res) => {
    try {
      const notificationId = req.params.id;
      
      if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid notification ID format",
        });
      }

      // Find and ensure it belongs to this user
      const notification = await Notification.findOne({
        _id: notificationId,
        recipient: req.user._id
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          error: "Notification not found or does not belong to you",
        });
      }

      // Delete the notification
      await notification.remove();

      logger.info(`Deleted notification ${notificationId} for user ${req.user._id}`);

      res.status(200).json({
        success: true,
        message: "Notification deleted successfully",
      });
    } catch (err) {
      logger.error(`Error deleting notification: ${err.message}`);
      res.status(500).json({
        success: false,
        error: "Server error while deleting notification",
      });
    }
  })
);

/**
 * @route   DELETE /api/notifications/clear-all
 * @desc    Clear all notifications for current user
 * @access  Private
 */
router.delete(
  "/clear-all",
  protect,
  asyncHandler(async (req, res) => {
    try {
      // Only allow deleting read notifications if specified
      const filter = { recipient: req.user._id };
      if (req.query.readOnly === 'true') {
        filter.read = true;
      }
      
      const result = await Notification.deleteMany(filter);

      logger.info(`Cleared ${result.deletedCount} notifications for user ${req.user._id}`);

      res.status(200).json({
        success: true,
        count: result.deletedCount,
        message: "Notifications cleared successfully",
      });
    } catch (err) {
      logger.error(`Error clearing notifications: ${err.message}`);
      res.status(500).json({
        success: false,
        error: "Server error while clearing notifications",
      });
    }
  })
);

export default router;
