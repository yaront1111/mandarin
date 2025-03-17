// server/socket/socketHandlers.js
const { Message, User } = require("../models")
const logger = require("../logger")
const mongoose = require("mongoose")

/**
 * Handle user disconnect
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket connection
 * @param {Map} userConnections - Map of user connections
 */
const handleUserDisconnect = async (io, socket, userConnections) => {
  try {
    logger.info(`Socket ${socket.id} disconnected`);

    if (socket.user && socket.user._id) {
      const userId = socket.user._id.toString();

      // Remove this socket from user connections
      if (userConnections.has(userId)) {
        userConnections.get(userId).delete(socket.id);

        // If this was the last connection for this user, update their status
        if (userConnections.get(userId).size === 0) {
          userConnections.delete(userId);

          // Update user status in database
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastActive: Date.now(),
          });

          // Notify other users
          io.emit("userOffline", { userId, timestamp: Date.now() });
          logger.info(`User ${userId} is now offline (no active connections)`);
        } else {
          logger.info(`User ${userId} still has ${userConnections.get(userId).size} active connections`);
        }
      }
    }
  } catch (error) {
    logger.error(`Error handling disconnect for ${socket.id}: ${error.message}`);
  }
};

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

      // Store notification in database if the model exists
      try {
        // Check if Notification model is available
        const Notification = mongoose.models.Notification ||
                            require("../models/Notification");

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
        // If Notification model doesn't exist or there's another error, just log it
        logger.debug(`Notification saving skipped: ${notificationError.message}`);
      }
    }
  } catch (error) {
    logger.error(`Error sending message notification: ${error.message}`);
  }
};

/**
 * Register all socket event handlers
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket connection
 * @param {Map} userConnections - Map of user connections
 * @param {Object} rateLimiters - Rate limiters
 */
const registerSocketHandlers = (io, socket, userConnections, rateLimiters) => {
  const { typingLimiter, messageLimiter, callLimiter } = rateLimiters;

  // Handle ping (heartbeat)
  socket.on("ping", () => {
    try {
      socket.emit("pong");
    } catch (error) {
      logger.error(`Error handling ping from ${socket.id}: ${error.message}`);
    }
  });

  // Handle disconnect using the consolidated function
  socket.on("disconnect", async (reason) => {
    try {
      await handleUserDisconnect(io, socket, userConnections);
      logger.debug(`Disconnect reason: ${reason}`);
    } catch (error) {
      logger.error(`Error in disconnect event: ${error.message}`);
    }
  });

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

      // Send message notification - pass io to the function
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

      // Apply rate limiting for typing events
      try {
        await typingLimiter.consume(socket.user._id.toString());
      } catch (rateLimitError) {
        // Silently fail rate limiting for typing indicators
        return;
      }

      // Validate recipient ID
      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        return;
      }

      // Forward typing indicator to recipient if online
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

  // Handle initiating calls
  socket.on("initiateCall", async (data) => {
    try {
      const { recipientId } = data;

      // Apply rate limiting
      try {
        await callLimiter.consume(socket.user._id.toString());
      } catch (rateLimitError) {
        socket.emit("callError", { error: "Rate limit exceeded. Please try again later." });
        return;
      }

      // Validate recipient ID
      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        socket.emit("callError", { error: "Invalid recipient ID" });
        return;
      }

      // Check if recipient exists
      const recipient = await User.findById(recipientId);
      if (!recipient) {
        socket.emit("callError", { error: "Recipient not found" });
        return;
      }

      // Check if recipient is online
      if (!userConnections.has(recipientId)) {
        socket.emit("callError", { error: "Recipient is offline" });
        return;
      }

      // Generate call data
      const callData = {
        callId: new mongoose.Types.ObjectId().toString(),
        caller: {
          userId: socket.user._id,
          name: socket.user.name,
          avatar: socket.user.avatar,
        },
        recipient: {
          userId: recipientId,
        },
        timestamp: Date.now(),
      };

      // Send call request to recipient
      userConnections.get(recipientId).forEach((recipientSocketId) => {
        io.to(recipientSocketId).emit("incomingCall", callData);
      });

      // Send confirmation to caller
      socket.emit("callInitiated", callData);

      logger.info(`Call initiated from ${socket.user._id} to ${recipientId}`);
    } catch (error) {
      logger.error(`Error initiating call: ${error.message}`);
      socket.emit("callError", { error: "Failed to initiate call" });
    }
  });

  // Handle answering calls
  socket.on("answerCall", async (data) => {
    try {
      const { callerId, accept } = data;

      // Validate caller ID
      if (!mongoose.Types.ObjectId.isValid(callerId)) {
        socket.emit("callError", { error: "Invalid caller ID" });
        return;
      }

      // Check if caller exists
      const caller = await User.findById(callerId);
      if (!caller) {
        socket.emit("callError", { error: "Caller not found" });
        return;
      }

      // Check if caller is online
      if (!userConnections.has(callerId)) {
        socket.emit("callError", { error: "Caller is no longer online" });
        return;
      }

      // Generate call response data
      const callData = {
        respondent: {
          userId: socket.user._id,
          name: socket.user.name,
          avatar: socket.user.avatar,
        },
        accepted: accept,
        timestamp: Date.now(),
      };

      // Send response to caller
      userConnections.get(callerId).forEach((callerSocketId) => {
        io.to(callerSocketId).emit("callAnswered", callData);
      });

      // Send confirmation to respondent
      socket.emit("callAnswered", callData);

      logger.info(`Call from ${callerId} ${accept ? "accepted" : "rejected"} by ${socket.user._id}`);
    } catch (error) {
      logger.error(`Error answering call: ${error.message}`);
      socket.emit("callError", { error: "Failed to answer call" });
    }
  });

  // Emit user online status when they connect
  io.emit("userOnline", {
    userId: socket.user._id.toString(),
    timestamp: Date.now(),
  });

  logger.info(`Socket handlers registered for user ${socket.user._id}`);
};

module.exports = {
  registerSocketHandlers,
  sendMessageNotification,
  handleUserDisconnect
};
