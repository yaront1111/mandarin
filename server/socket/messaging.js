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
        io.to(recipientUser.socketId).emit("new_message", {
          sender,
          message,
          timestamp: new Date(),
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
          io.to(socketId).emit("new_like", {
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
 * Send a photo permission request notification
 * @param {Object} io - Socket.IO server instance
 * @param {Object} requester - User requesting permission
 * @param {Object} owner - Photo owner
 * @param {Object} permissionData - Permission request data
 * @param {Map} userConnections - User connections map
 */
const sendPhotoPermissionRequestNotification = async (io, requester, owner, permissionData, userConnections) => {
  try {
    // Check if owner has photo request notifications enabled
    const photoOwner = await User.findById(owner._id).select("settings");

    if (photoOwner?.settings?.notifications?.photoRequests !== false) {
      // Send socket notification if user is online
      if (userConnections.has(owner._id.toString())) {
        userConnections.get(owner._id.toString()).forEach((socketId) => {
          io.to(socketId).emit("photo_permission_request", {
            requester: {
              _id: requester._id,
              nickname: requester.nickname,
              photos: requester.photos,
            },
            photoId: permissionData.photo,
            permissionId: permissionData._id,
            timestamp: new Date(),
          });
        });
      }

      // Attempt to store a notification in the database if the model exists
      try {
        const Notification = mongoose.models.Notification || (await import("../models/Notification.js")).default;

        if (Notification) {
          await Notification.create({
            recipient: owner._id,
            type: "photoRequest",
            sender: requester._id,
            content: `${requester.nickname} requested access to your private photo`,
            reference: permissionData._id,
          });
        }
      } catch (notificationError) {
        logger.debug(`Notification saving skipped: ${notificationError.message}`);
      }
    }
  } catch (error) {
    logger.error(`Error sending photo permission request notification: ${error.message}`);
  }
};

/**
 * Send a photo permission response notification
 * @param {Object} io - Socket.IO server instance
 * @param {Object} owner - Photo owner
 * @param {Object} requester - User who requested permission
 * @param {Object} permissionData - Permission response data
 * @param {Map} userConnections - User connections map
 */
const sendPhotoPermissionResponseNotification = async (io, owner, requester, permissionData, userConnections) => {
  try {
    // Check if requester has photo response notifications enabled
    const photoRequester = await User.findById(requester._id).select("settings");

    if (photoRequester?.settings?.notifications?.photoRequests !== false) {
      // Send socket notification if user is online
      if (userConnections.has(requester._id.toString())) {
        userConnections.get(requester._id.toString()).forEach((socketId) => {
          io.to(socketId).emit("photo_permission_response", {
            owner: {
              _id: owner._id,
              nickname: owner.nickname,
              photos: owner.photos,
            },
            photoId: permissionData.photo,
            permissionId: permissionData._id,
            status: permissionData.status,
            timestamp: new Date(),
          });
        });
      }

      // Attempt to store a notification in the database if the model exists
      try {
        const Notification = mongoose.models.Notification || (await import("../models/Notification.js")).default;

        if (Notification) {
          const action = permissionData.status === "approved" ? "approved" : "rejected";
          await Notification.create({
            recipient: requester._id,
            type: "photoResponse",
            sender: owner._id,
            content: `${owner.nickname} ${action} your photo request`,
            reference: permissionData._id,
          });
        }
      } catch (notificationError) {
        logger.debug(`Notification saving skipped: ${notificationError.message}`);
      }
    }
  } catch (error) {
    logger.error(`Error sending photo permission response notification: ${error.message}`);
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
        socket.emit("messageError", {
          error: "Invalid recipient ID",
          tempMessageId,
        });
        return;
      }

      // Check if recipient exists
      const recipient = await User.findById(recipientId);
      if (!recipient) {
        socket.emit("messageError", {
          error: "Recipient not found",
          tempMessageId,
        });
        return;
      }

      // Get full user object to check permissions
      const user = await User.findById(socket.user._id);

      // Check if user can send this type of message
      if (type !== "wink" && !user.canSendMessages()) {
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

      // Send message to recipient if they're online
      if (userConnections.has(recipientId)) {
        userConnections.get(recipientId).forEach((recipientSocketId) => {
          io.to(recipientSocketId).emit("messageReceived", messageResponse);
        });
      }

      // Send message notification
      sendMessageNotification(io, socket.user, recipient, messageResponse);

      logger.info(`Message sent from ${socket.user._id} to ${recipientId}`);
    } catch (error) {
      logger.error(`Error sending message: ${error.message}`);
      socket.emit("messageError", {
        error: "Failed to send message",
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
};

export {
  registerMessagingHandlers,
  sendMessageNotification,
  sendLikeNotification,
  sendPhotoPermissionRequestNotification,
  sendPhotoPermissionResponseNotification,
};
