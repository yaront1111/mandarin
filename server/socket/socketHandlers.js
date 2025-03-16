// server/socket/socketHandlers.js
const { User, Message, Story } = require("../models")
const mongoose = require("mongoose")
const logger = require("../logger")

// Helper to retrieve a socket by user ID from the io instance
const getSocketByUserId = (io, userId) => {
  for (const socket of io.sockets.sockets.values()) {
    if (socket.user && socket.user._id.toString() === userId) {
      return socket
    }
  }
  return null
}

const registerSocketHandlers = (io, socket, userConnections, rateLimiters) => {
  const { typingLimiter, messageLimiter, callLimiter } = rateLimiters

  // Handle joining rooms
  socket.on("join", async ({ userId, room }) => {
    if (userId !== socket.user._id.toString()) {
      logger.warn(`Unauthorized join attempt by ${socket.user._id} for user ${userId}`)
      socket.emit("error", { message: "Unauthorized join attempt" })
      return
    }
    if (room) {
      if (!/^[a-zA-Z0-9_-]+$/.test(room)) {
        socket.emit("error", { message: "Invalid room format" })
        return
      }
      const roomName = `${userId}:${room}`
      socket.join(roomName)
      logger.debug(`User ${userId} joined room ${roomName}`)
    }
    try {
      if (userConnections.get(userId).size === 1) {
        await User.findByIdAndUpdate(userId, { isOnline: true, lastActive: Date.now() })
        socket.broadcast.emit("userOnline", { userId, timestamp: Date.now() })
        logger.info(`User ${userId} is now online with ${userConnections.get(userId).size} connection(s)`)
      } else {
        logger.debug(`User ${userId} connected with ${userConnections.get(userId).size} active connections`)
      }
    } catch (err) {
      logger.error(`Error updating user online status: ${err.message}`)
      socket.emit("error", { message: "Failed to update online status" })
    }
  })

  // Heartbeat to keep the connection alive and revalidate token every 15 minutes
  const heartbeatInterval = setInterval(() => {
    socket.emit("heartbeat", { timestamp: Date.now() })
    const timeSinceAuth = Date.now() - socket.authTimestamp
    if (timeSinceAuth > 15 * 60 * 1000) { // 15 minutes
      const token =
        socket.handshake.query?.token ||
        (socket.handshake.headers.authorization?.startsWith("Bearer ")
          ? socket.handshake.headers.authorization.substring(7)
          : null)
      if (!token) {
        socket.emit("error", { message: "Session expired", code: "TOKEN_EXPIRED" })
        return socket.disconnect(true)
      }
      // Update the auth timestamp (or add extra validation if desired)
      socket.authTimestamp = Date.now()
    }
  }, 30000)

  socket.on("pong", (data) => {
    User.findByIdAndUpdate(socket.user._id, { lastActive: Date.now() })
      .catch((err) => logger.error(`Error updating last active time: ${err.message}`))
  })

  // Private message with rate limiting
  socket.on("privateMessage", async (message, callback) => {
    try {
      try {
        await messageLimiter.consume(socket.userId)
      } catch (err) {
        logger.warn(`Rate limit exceeded for messages by user ${socket.userId}`)
        if (callback)
          return callback({
            success: false,
            error: "Too many messages. Please slow down.",
            code: "RATE_LIMIT",
          })
      }

      if (message.sender !== socket.userId) {
        logger.warn(`Unauthorized message attempt by ${socket.user._id} for user ${message.sender}`)
        if (callback)
          return callback({ success: false, error: "Unauthorized sender", code: "UNAUTHORIZED" })
      }

      const validTypes = ["text", "wink", "video", "file"]
      if (!validTypes.includes(message.type)) {
        logger.warn(`Invalid message type: ${message.type}`)
        if (callback)
          return callback({
            success: false,
            error: `Invalid message type. Must be one of: ${validTypes.join(", ")}`,
            code: "INVALID_TYPE",
          })
      }

      if (message.type === "text") {
        if (!message.content || message.content.length === 0) {
          if (callback)
            return callback({
              success: false,
              error: "Message content is required",
              code: "EMPTY_CONTENT",
            })
        }
        if (message.content.length > 2000) {
          if (callback)
            return callback({
              success: false,
              error: "Message too long (max 2000 characters)",
              code: "CONTENT_TOO_LONG",
            })
        }
      }

      if (message.type === "file") {
        if (!message.metadata || !message.metadata.fileUrl) {
          if (callback)
            return callback({
              success: false,
              error: "File URL is required for file messages",
              code: "MISSING_FILE_URL",
            })
        }
        if (!message.metadata.fileName) {
          if (callback)
            return callback({
              success: false,
              error: "File name is required for file messages",
              code: "MISSING_FILE_NAME",
            })
        }
      }

      if (!mongoose.Types.ObjectId.isValid(message.recipient)) {
        logger.warn(`Invalid recipient ID format: ${message.recipient}`)
        if (callback)
          return callback({
            success: false,
            error: "Invalid recipient ID",
            code: "INVALID_RECIPIENT",
          })
      }

      const recipientUser = await User.findById(message.recipient)
      if (!recipientUser) {
        logger.warn(`Recipient not found: ${message.recipient}`)
        if (callback)
          return callback({
            success: false,
            error: "Recipient not found",
            code: "RECIPIENT_NOT_FOUND",
          })
      }

      const newMessage = new Message({
        sender: message.sender,
        recipient: message.recipient,
        type: message.type,
        content: message.type === "text" ? message.content.trim() : message.content || "",
        metadata: message.metadata || {},
      })

      await newMessage.save()

      const enrichedMessage = newMessage.toObject()
      enrichedMessage.senderName = socket.user.nickname

      io.to(message.recipient).emit("newMessage", enrichedMessage)
      logger.debug(`Message sent from ${message.sender} to ${message.recipient} (type: ${message.type})`)

      if (callback)
        callback({ success: true, message: enrichedMessage })
    } catch (err) {
      logger.error(`Error sending private message: ${err.message}`)
      if (callback)
        callback({ success: false, error: err.message || "Failed to send message", code: "SERVER_ERROR" })
    }
  })

  // Typing indicator event with rate limiting
  socket.on("typing", async ({ sender, recipient }) => {
    try {
      await typingLimiter.consume(sender)
    } catch (err) {
      logger.debug(`Typing event rate limited for user ${sender}`)
      return
    }
    if (sender !== socket.userId) {
      logger.warn(`Unauthorized typing indicator from ${socket.user._id} for user ${sender}`)
      return
    }
    if (!mongoose.Types.ObjectId.isValid(recipient)) {
      logger.warn(`Invalid recipient ID for typing event: ${recipient}`)
      return
    }
    io.to(recipient).emit("userTyping", {
      userId: sender,
      nickname: socket.user.nickname,
      timestamp: Date.now(),
    })
  })

  // Video call request event with rate limiting
  socket.on("videoCallRequest", async ({ caller, recipient }, callback) => {
    try {
      try {
        await callLimiter.consume(caller)
      } catch (err) {
        logger.warn(`Call rate limit exceeded for user ${caller}`)
        if (callback)
          return callback({
            success: false,
            error: "Too many call attempts. Please wait a moment.",
            code: "RATE_LIMIT",
          })
      }
      if (caller !== socket.userId) {
        logger.warn(`Unauthorized call request from ${socket.user._id} for user ${caller}`)
        if (callback)
          return callback({ success: false, error: "Unauthorized caller", code: "UNAUTHORIZED" })
      }
      if (!mongoose.Types.ObjectId.isValid(recipient)) {
        logger.warn(`Invalid recipient ID for call: ${recipient}`)
        if (callback)
          return callback({ success: false, error: "Invalid recipient ID", code: "INVALID_RECIPIENT" })
      }
      const recipientUser = await User.findById(recipient)
      if (!recipientUser) {
        logger.warn(`Call recipient not found: ${recipient}`)
        if (callback)
          return callback({ success: false, error: "Recipient not found", code: "RECIPIENT_NOT_FOUND" })
      }
      const isRecipientOnline = userConnections.has(recipient) && userConnections.get(recipient).size > 0
      if (!isRecipientOnline) {
        logger.warn(`Call recipient is offline: ${recipient}`)
        if (callback)
          return callback({ success: false, error: "Recipient is offline", code: "RECIPIENT_OFFLINE" })
      }
      io.to(recipient).emit("incomingCall", {
        userId: caller,
        nickname: socket.user.nickname,
        timestamp: Date.now(),
      })
      logger.info(`Video call initiated from ${caller} to ${recipient}`)
      const callMessage = await Message.create({
        sender: caller,
        recipient,
        type: "video",
        content: "Video call",
      })
      if (callback)
        callback({ success: true, callId: callMessage._id })
    } catch (err) {
      logger.error(`Error initiating video call: ${err.message}`)
      if (callback)
        callback({ success: false, error: "Failed to initiate call", code: "SERVER_ERROR" })
    }
  })

  // Video call answer event
  socket.on("videoCallAnswer", ({ caller, recipient, answer }, callback) => {
    if (recipient !== socket.userId) {
      logger.warn(`Unauthorized call answer from ${socket.user._id} for user ${recipient}`)
      if (callback)
        return callback({ success: false, error: "Unauthorized recipient", code: "UNAUTHORIZED" })
    }
    if (!mongoose.Types.ObjectId.isValid(caller)) {
      logger.warn(`Invalid caller ID for call answer: ${caller}`)
      if (callback)
        return callback({ success: false, error: "Invalid caller ID", code: "INVALID_CALLER" })
    }
    io.to(caller).emit("callAnswered", {
      userId: recipient,
      nickname: socket.user.nickname,
      answer,
      timestamp: Date.now(),
    })
    logger.info(`Call answered by ${recipient} to ${caller}: ${answer ? "accepted" : "declined"}`)
    if (callback) callback({ success: true })
  })

  // Message read receipt
  socket.on("messageRead", async ({ messageId, reader }, callback) => {
    try {
      if (reader !== socket.userId) {
        logger.warn(`Unauthorized read receipt from ${socket.user._id} for user ${reader}`)
        if (callback)
          return callback({ success: false, error: "Unauthorized reader", code: "UNAUTHORIZED" })
      }
      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        logger.warn(`Invalid message ID format: ${messageId}`)
        if (callback)
          return callback({ success: false, error: "Invalid message ID", code: "INVALID_MESSAGE_ID" })
      }
      const message = await Message.findOne({ _id: messageId, recipient: reader })
      if (!message) {
        logger.warn(`Message not found or user not authorized to mark as read: ${messageId}`)
        if (callback)
          return callback({ success: false, error: "Message not found", code: "MESSAGE_NOT_FOUND" })
      }
      if (!message.read) {
        message.read = true
        message.readAt = new Date()
        await message.save()
        io.to(message.sender.toString()).emit("messageReadReceipt", {
          messageId,
          readBy: reader,
          timestamp: Date.now(),
        })
        logger.debug(`Message ${messageId} marked as read by ${reader}`)
      }
      if (callback) callback({ success: true })
    } catch (err) {
      logger.error(`Error processing message read receipt: ${err.message}`)
      if (callback)
        callback({ success: false, error: "Failed to process read receipt", code: "SERVER_ERROR" })
    }
  })

  // Batch mark conversation as read
  socket.on("markConversationRead", async ({ conversationWith, reader }, callback) => {
    try {
      if (reader !== socket.userId) {
        logger.warn(`Unauthorized batch read from ${socket.user._id} for user ${reader}`)
        if (callback)
          return callback({ success: false, error: "Unauthorized reader", code: "UNAUTHORIZED" })
      }
      if (!mongoose.Types.ObjectId.isValid(conversationWith)) {
        logger.warn(`Invalid conversation partner ID: ${conversationWith}`)
        if (callback)
          return callback({ success: false, error: "Invalid ID", code: "INVALID_ID" })
      }
      const unreadMessages = await Message.find({
        sender: conversationWith,
        recipient: reader,
        read: false,
      })
      if (unreadMessages.length > 0) {
        await Message.updateMany(
          { sender: conversationWith, recipient: reader, read: false },
          { read: true, readAt: new Date() },
        )
        io.to(conversationWith).emit("conversationRead", {
          by: reader,
          messageIds: unreadMessages.map((msg) => msg._id),
          timestamp: Date.now(),
        })
        logger.debug(
          `${unreadMessages.length} messages marked as read for conversation between ${reader} and ${conversationWith}`,
        )
      }
      if (callback)
        callback({ success: true, count: unreadMessages.length })
    } catch (err) {
      logger.error(`Error marking conversation as read: ${err.message}`)
      if (callback)
        callback({ success: false, error: "Failed to mark conversation as read", code: "SERVER_ERROR" })
    }
  })

  // Story view event
  socket.on("viewStory", async ({ storyId, userId }) => {
    try {
      const story = await Story.findById(storyId)
      if (story) {
        await story.addViewer(userId)
        const ownerSocket = getSocketByUserId(io, story.user.toString())
        if (ownerSocket) {
          ownerSocket.emit("storyViewed", { storyId, viewerId: userId })
        }
      }
    } catch (error) {
      logger.error(`Socket viewStory error: ${error.message}`)
    }
  })

  // Create story event
  socket.on("createStory", async (storyData) => {
    try {
      const user = await User.findById(storyData.userId)
      if (user && user.followers && user.followers.length > 0) {
        user.followers.forEach((follower) => {
          const followerSocket = getSocketByUserId(io, follower.user.toString())
          if (followerSocket) {
            followerSocket.emit("newStoryAvailable", {
              userId: storyData.userId,
              username: user.username,
            })
          }
        })
      }
    } catch (error) {
      logger.error(`Socket createStory error: ${error.message}`)
    }
  })

  // Handle disconnection
  socket.on("disconnect", async () => {
    logger.info(`Socket disconnected: ${socket.id} (User: ${socket.user._id})`)
    try {
      const userId = socket.user._id.toString()
      if (userConnections.has(userId)) {
        userConnections.get(userId).delete(socket.id)
        if (userConnections.get(userId).size === 0) {
          userConnections.delete(userId)
          await User.findByIdAndUpdate(userId, { isOnline: false, lastActive: Date.now() })
          socket.broadcast.emit("userOffline", { userId, timestamp: Date.now() })
          logger.info(`User ${userId} is now offline (all connections closed)`)
        } else {
          logger.debug(`User ${userId} still has ${userConnections.get(userId).size} active connection(s)`)
        }
      }
    } catch (err) {
      logger.error(`Error updating user offline status: ${err.message}`)
    }
    clearInterval(heartbeatInterval)
  })

  // Global error handler for the socket
  socket.on("error", (error) => {
    logger.error(`Socket error for ${socket.id} (User: ${socket.user?._id}): ${error.message}`)
  })
}

module.exports = { registerSocketHandlers }
