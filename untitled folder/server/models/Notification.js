// models/Notification.js - Enhanced with bundling support and more notification types
import mongoose from "mongoose";
import logger from "../logger.js";

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: [
      "message",
      "like",
      "match",
      "photoRequest",
      "photoResponse",
      "story",
      "comment",
      "system",
      "call"
    ],
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true
  },
  content: {
    type: String,
    trim: true
  },
  title: {
    type: String,
    trim: true
  },
  reference: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "referenceModel"
  },
  referenceModel: {
    type: String,
    enum: ["Message", "Like", "Photo", "Story", "Comment"]
  },
  // For storing additional structured data about the notification
  data: mongoose.Schema.Types.Mixed,
  // Fields for notification status
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date
  },
  // Fields for notification bundling
  count: {
    type: Number,
    default: 1,
    min: 1
  },
  bundleKey: {
    type: String,
    index: true
  },
  parentNotification: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Notification"
  },
  // Tracking when notifications were created/updated
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create compound indexes for efficient querying
notificationSchema.index({ recipient: 1, type: 1, read: 1 });
notificationSchema.index({ recipient: 1, sender: 1, type: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

// Pre-save hook to generate bundle key and update timestamps
notificationSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('sender') || this.isModified('type')) {
    // Generate a bundle key for grouping similar notifications
    if (this.sender && this.type) {
      this.bundleKey = `${this.recipient.toString()}:${this.sender.toString()}:${this.type}`;
    }
  }

  // Update timestamps
  if (this.isNew) {
    this.createdAt = Date.now();
  }
  this.updatedAt = Date.now();

  // Set readAt when marked as read
  if (this.isModified('read') && this.read && !this.readAt) {
    this.readAt = Date.now();
  }

  next();
});

/**
 * Static method to find recent similar notifications (for bundling)
 * @param {Object} notification - The notification to find similar ones for
 * @param {number} timeframeMs - Timeframe in milliseconds to consider for bundling
 * @returns {Promise<Object|null>} - Existing notification that can be bundled, or null
 */
notificationSchema.statics.findSimilarForBundling = async function(notification, timeframeMs = 3600000) {
  if (!notification.sender || !notification.type || !notification.recipient) {
    return null;
  }

  try {
    const cutoffTime = new Date(Date.now() - timeframeMs);

    // Find similar notifications from the same sender, of the same type, to the same recipient
    return await this.findOne({
      recipient: notification.recipient,
      sender: notification.sender,
      type: notification.type,
      createdAt: { $gte: cutoffTime },
      // Don't bundle with notifications that are already bundles
      parentNotification: { $exists: false }
    }).sort({ createdAt: -1 });
  } catch (err) {
    logger.error(`Error finding similar notifications: ${err.message}`);
    return null;
  }
};

/**
 * Static method to create a notification with automatic bundling
 * @param {Object} data - Notification data
 * @param {boolean} enableBundling - Whether to enable bundling
 * @returns {Promise<Object>} - Created or updated notification
 */
notificationSchema.statics.createWithBundling = async function(data, enableBundling = true) {
  try {
    // Validate required fields
    if (!data.recipient || !data.type) {
      throw new Error("Recipient and type are required for notifications");
    }

    // If bundling is disabled or there's no sender, just create a new notification
    if (!enableBundling || !data.sender) {
      const notification = new this(data);
      await notification.save();
      return notification;
    }

    // Look for similar notifications to bundle with
    const existingNotification = await this.findSimilarForBundling(data);

    if (existingNotification) {
      // Update the existing notification
      existingNotification.count += 1;
      existingNotification.read = false; // Mark as unread since there's new activity
      existingNotification.updatedAt = Date.now();

      // Update content if provided
      if (data.content) {
        existingNotification.content = data.content;
      }

      // Merge data objects if both exist
      if (data.data && existingNotification.data) {
        existingNotification.data = {
          ...existingNotification.data,
          ...data.data,
          bundled: true,
          count: existingNotification.count
        };
      }

      await existingNotification.save();
      return existingNotification;
    } else {
      // Create a new notification
      const notification = new this(data);
      await notification.save();
      return notification;
    }
  } catch (err) {
    logger.error(`Error creating bundled notification: ${err.message}`);
    throw err;
  }
};

/**
 * Mark notification as read
 */
notificationSchema.methods.markAsRead = async function() {
  if (this.read) return this;

  this.read = true;
  this.readAt = new Date();
  return this.save();
};

// Create the model
const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
