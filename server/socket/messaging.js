import { Message, User } from "../models/index.js";
import logger from "../logger.js";
import mongoose from "mongoose";

/**
 * Send a message notification
 * @param {Object} io - Socket.IO server instance
 * @param {Object} sender - Sender user object
 * @param {Object} recipient - Recipient user object
 * @param {Object} message - Message object
 */
const sendMessageNotification = async (io, sender, recipient, message) => {
  try {
    const recipientUser = await User.findById(recipient._id).select("settings socketId");

    // Check if recipient has message notifications enabled
    if (recipientUser?.settings?.notifications?.messages !== false) {
      // Send socket notification if user is online
      if (recipientUser?.socketId) {
        io.to(recipientUser.socketId).emit("messageReceived", {
          ...message,
          senderName: sender.nickname || sender.username || "User"
        });
      }

      // Attempt to store a notification in the database if the model exists
      try {
        // Use the Notification model if it exists; otherwise, dynamically import it.
        const Notification = mongoose.models.Notification || (await import("../models/Notification.js")).default;

        if (Notification) {
          await Notification.create({
            recipient: recipient._id,
            type: "message",
            sender: sender._id,
            content: message.content,
            reference: message._id,
          });
        }
      } catch (notificationError) {
        logger.debug(`Notification saving skipped: ${notificationError.message}`);
      }
    }
  } catch (error) {
    logger.error(`Error sending message notification: ${error.message}`);
  }
};

/**
 * Send a like notification
 * @param {Object} io - Socket.IO server instance
 * @param {Object} sender - Sender user object
 * @param {Object} recipient - Recipient user object
 * @param {Object} likeData - Like data
 * @param {Map} userConnections - User connections map
 */
const sendLikeNotification = async (io, sender, recipient, likeData, userConnections) => {
  try {
    const recipientUser = await User.findById(recipient._id).select("settings");

    // Check if recipient has like notifications enabled
    if (recipientUser?.settings?.notifications?.likes !== false) {
      // Send socket notification if user is online
      if (userConnections.has(recipient._id.toString())) {
        userConnections.get(recipient._id.toString()).forEach((socketId) => {
          io.to(socketId).emit("newLike", {
            sender: {
              _id: sender._id,
              nickname: sender.nickname,
              photos: sender.photos,
            },
            timestamp: new Date(),
            ...likeData,
          });
        });
      }

      // Attempt to store a notification in the database if the model exists
      try {
        const Notification = mongoose.models.Notification || (await import("../models/Notification.js")).default;

        if (Notification) {
          await Notification.create({
            recipient: recipient._id,
            type: "like",
            sender: sender._id,
            content: `${sender.nickname} liked your profile`,
            reference: likeData._id,
          });
        }
      } catch (notificationError) {
        logger.debug(`Notification saving skipped: ${notificationError.message}`);
      }
    }
  } catch (error) {
    logger.error(`Error sending like notification: ${error.message}`);
  }
};

/**
 * Register messaging-related socket handlers
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket connection
 * @param {Map} userConnections - Map of user connections
 * @param {Object} rateLimiters - Rate limiters
 */
const registerMessagingHandlers = (io, socket, userConnections, rateLimiters) => {
  const { typingLimiter, messageLimiter } = rateLimiters;

  // Handle sending messages
  socket.on("sendMessage", async (data) => {
    try {
      const { recipientId, type, content, metadata, tempMessageId } = data;

      logger.debug(`Socket message received: ${type} from ${socket.user._id} to ${recipientId}`);

      // Apply rate limiting
      try {
        await messageLimiter.consume(socket.user._id.toString());
      } catch (rateLimitError) {
        logger.warn(`Rate limit exceeded for message sending by user ${socket.user._id}`);
        socket.emit("messageError", {
          error: "Rate limit exceeded. Please try again later.",
          tempMessageId,
        });
        return;
      }

      // Validate recipient ID
      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        logger.error(`Invalid recipient ID format: ${recipientId}`);
        socket.emit("messageError", {
          error: "Invalid recipient ID",
          tempMessageId,
        });
        return;
      }

      // Check if recipient exists
      const recipient = await User.findById(recipientId);
      if (!recipient) {
        logger.error(`Recipient not found: ${recipientId}`);
        socket.emit("messageError", {
          error: "Recipient not found",
          tempMessageId,
        });
        return;
      }

      // Get full user object to check permissions
      const user = await User.findById(socket.user._id);

      // Check if user can send this type of message
      // First, safely check if the method exists, then call it if it does
      if (type !== "wink" &&
          (user.accountTier === "FREE" ||
           (typeof user.canSendMessages === 'function' && !user.canSendMessages()))) {
        logger.warn(`Free user ${socket.user._id} attempted to send non-wink message`);
        socket.emit("messageError", {
          error: "Free accounts can only send winks. Upgrade to send messages.",
          tempMessageId,
        });
        return;
      }

      // Create and save message
      const message = new Message({
        sender: socket.user._id,
        recipient: recipientId,
        type,
        content,
        metadata,
        read: false,
        createdAt: new Date(),
      });

      await message.save();
      logger.info(`Message saved to database: ${message._id}`);

      // Format message for response
      const messageResponse = {
        _id: message._id,
        sender: socket.user._id,
        recipient: recipientId,
        type,
        content,
        metadata,
        createdAt: message.createdAt,
        read: false,
        tempMessageId,
      };

      // Send message to sender for confirmation
      socket.emit("messageSent", messageResponse);
      logger.debug(`Message sent confirmation emitted: ${message._id} (tempId: ${tempMessageId})`);

      // Send message to recipient if they're online
      if (userConnections.has(recipientId)) {
        const connectedSockets = userConnections.get(recipientId);
        logger.debug(`Recipient ${recipientId} has ${connectedSockets.size} active connections`);

        connectedSockets.forEach((recipientSocketId) => {
          io.to(recipientSocketId).emit("messageReceived", messageResponse);
          logger.debug(`Message forwarded to recipient socket: ${recipientSocketId}`);
        });
      } else {
        logger.debug(`Recipient ${recipientId} is not currently connected`);
      }

      // Send message notification
      sendMessageNotification(io, socket.user, recipient, messageResponse);

      logger.info(`Message sent successfully from ${socket.user._id} to ${recipientId}`);
    } catch (error) {
      logger.error(`Error sending message: ${error.message}`, error);
      socket.emit("messageError", {
        error: "Failed to send message: " + (error.message || "Unknown error"),
        tempMessageId: data?.tempMessageId,
      });
    }
  });

  // Handle typing indicator
  socket.on("typing", async (data) => {
    try {
      const { recipientId } = data;
      try {
        await typingLimiter.consume(socket.user._id.toString());
      } catch (rateLimitError) {
        return;
      }
      if (!mongoose.Types.ObjectId.isValid(recipientId)) return;

      if (userConnections.has(recipientId)) {
        userConnections.get(recipientId).forEach((recipientSocketId) => {
          io.to(recipientSocketId).emit("userTyping", {
            userId: socket.user._id,
            timestamp: Date.now(),
          });
        });
      }
    } catch (error) {
      logger.error(`Error handling typing indicator: ${error.message}`);
    }
  });

  // Mark messages as read handler
  socket.on("messageRead", async (data) => {
    try {
      const { messageIds, sender } = data;

      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(sender)) {
        return;
      }

      // Update messages in database
      await Message.updateMany(
        { _id: { $in: messageIds }, sender, recipient: socket.user._id },
        { $set: { read: true, readAt: new Date() } }
      );

      // Notify sender if they're online
      if (userConnections.has(sender)) {
        userConnections.get(sender).forEach((senderSocketId) => {
          io.to(senderSocketId).emit("messagesRead", {
            reader: socket.user._id,
            messageIds,
            timestamp: Date.now(),
          });
        });
      }
    } catch (error) {
      logger.error(`Error handling read receipts: ${error.message}`);
    }
  });
};

export {
  registerMessagingHandlers,
  sendMessageNotification,
  sendLikeNotification,
};
