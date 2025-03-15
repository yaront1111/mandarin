// server/socket/index.js
const socketio = require("socket.io")
const jwt = require("jsonwebtoken")
const { User, Message, Story } = require("../models")
const config = require("../config")
const logger = require("../logger")
const mongoose = require("mongoose")
const { RateLimiterMemory } = require("rate-limiter-flexible")

/**
 * Initialize Socket.IO server
 * @param {Object} server - HTTP server instance
 * @returns {Object} Socket.IO server instance
 */
const initSocketServer = (server) => {
  // Define allowed origins based on environment
  const allowedOrigins =
    process.env.NODE_ENV === "production"
      ? process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",")
        : [process.env.FRONTEND_URL || "https://yourdomain.com"]
      : ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5000", "http://127.0.0.1:5000"]

  // Log configured origins for debugging
  logger.info(`Socket.IO configured with allowed origins: ${JSON.stringify(allowedOrigins)}`)

  // Create Socket.IO server with configuration
  const io = socketio(server, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, Postman)
        if (!origin) {
          logger.debug("Socket connection with no origin allowed")
          return callback(null, true)
        }

        // Check if origin is allowed or if we're in development
        if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
          logger.debug(`Socket.IO CORS allowed for origin: ${origin}`)
          return callback(null, true)
        }

        // Log rejected origins for debugging
        logger.warn(`Socket.IO CORS rejected for origin: ${origin}`)
        return callback(new Error("Not allowed by CORS"), false)
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true, // Enable credentials for auth scenarios
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    },
    // Additional Socket.IO configuration for production
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 30000,
    maxHttpBufferSize: 1e6, // 1MB
    // Add adapter if using multiple server instances
    adapter: process.env.REDIS_URL
      ? require("@socket.io/redis-adapter")({
          pubClient: require("redis").createClient(process.env.REDIS_URL),
          subClient: require("redis").createClient(process.env.REDIS_URL),
        })
      : undefined,
  })

  // Set up rate limiters for various actions
  const typingLimiter = new RateLimiterMemory({
    points: 5, // 5 typing events
    duration: 3, // per 3 seconds
    blockDuration: 2, // Block for 2 seconds if exceeded
  })

  const messageLimiter = new RateLimiterMemory({
    points: 10, // 10 messages
    duration: 10, // per 10 seconds
    blockDuration: 30, // Block for 30 seconds if exceeded
  })

  const callLimiter = new RateLimiterMemory({
    points: 3, // 3 call attempts
    duration: 60, // per minute
    blockDuration: 120, // Block for 2 minutes if exceeded
  })

  // Track active connections per user
  const userConnections = new Map() // userId -> Set of socket IDs

  // Helper function to check token expiration
  const isTokenExpired = (token) => {
    try {
      const decoded = jwt.decode(token)
      if (!decoded || !decoded.exp) return true

      // Add 5 seconds buffer to account for clock differences
      return decoded.exp < Math.floor(Date.now() / 1000) + 5
    } catch (err) {
      logger.error(`Error checking token expiration: ${err.message}`)
      return true
    }
  }

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      // Get token from query parameter or auth header
      const token =
        socket.handshake.query?.token ||
        (socket.handshake.headers.authorization?.startsWith("Bearer ")
          ? socket.handshake.headers.authorization.substring(7)
          : null)

      if (!token) {
        logger.warn(`Socket authentication failed: No token provided (IP: ${socket.handshake.address})`)
        return next(new Error("Authentication required"))
      }

      // Check if token is expired
      if (isTokenExpired(token)) {
        logger.warn(`Socket authentication failed: Token expired (IP: ${socket.handshake.address})`)
        return next(new Error("Token expired"))
      }

      // Verify token
      const decoded = jwt.verify(token, config.JWT_SECRET)

      // Validate MongoDB ObjectId format
      if (!mongoose.Types.ObjectId.isValid(decoded.id)) {
        logger.warn(`Socket authentication failed: Invalid user ID format (IP: ${socket.handshake.address})`)
        return next(new Error("Invalid user ID"))
      }

      // Check if user exists
      const user = await User.findById(decoded.id)

      if (!user) {
        logger.warn(`Socket authentication failed: User not found for ID ${decoded.id}`)
        return next(new Error("User not found"))
      }

      // Attach user data to socket
      socket.user = {
        _id: user._id,
        nickname: user.nickname,
      }

      // Store socket auth timestamp for periodic revalidation
      socket.authTimestamp = Date.now()

      // Set userId for easier access
      socket.userId = user._id.toString()

      logger.debug(`Socket ${socket.id} authenticated for user ${user.nickname} (${user._id})`)
      next()
    } catch (err) {
      logger.error(`Socket authentication error: ${err.message}`)
      next(new Error("Authentication failed"))
    }
  })

  // Function to get socket by user ID
  const getSocketByUserId = (userId) => {
    for (const socket of io.sockets.sockets.values()) {
      if (socket.user && socket.user._id.toString() === userId) {
        return socket
      }
    }
    return null
  }

  // Connection handler
  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.user._id})`)

    // Track user connections
    if (!userConnections.has(socket.user._id.toString())) {
      userConnections.set(socket.user._id.toString(), new Set())
    }
    userConnections.get(socket.user._id.toString()).add(socket.id)

    // Join user to their private room
    socket.join(socket.user._id.toString())

    // Add additional rooms for user
    socket.on("join", async ({ userId, room }) => {
      // Always verify the user can only join their own room or specific feature rooms
      if (userId !== socket.user._id.toString()) {
        logger.warn(`Unauthorized join attempt by ${socket.user._id} for user ${userId}`)
        socket.emit("error", { message: "Unauthorized join attempt" })
        return
      }

      // Handle optional room parameter for feature-specific rooms
      if (room) {
        // Validate room name format to prevent injection
        if (!/^[a-zA-Z0-9_-]+$/.test(room)) {
          socket.emit("error", { message: "Invalid room format" })
          return
        }

        const roomName = `${userId}:${room}`
        socket.join(roomName)
        logger.debug(`User ${userId} joined room ${roomName}`)
      }

      try {
        // Update user online status - only if this is their first connection
        if (userConnections.get(userId).size === 1) {
          await User.findByIdAndUpdate(userId, {
            isOnline: true,
            lastActive: Date.now(),
          })

          // Broadcast to all users that this user is online
          socket.broadcast.emit("userOnline", {
            userId,
            timestamp: Date.now(),
          })

          logger.info(`User ${userId} is now online with ${userConnections.get(userId).size} connection(s)`)
        } else {
          logger.debug(`User ${userId} connected with ${userConnections.get(userId).size} active connections`)
        }
      } catch (err) {
        logger.error(`Error updating user online status: ${err.message}`)
        socket.emit("error", { message: "Failed to update online status" })
      }
    })

    // Heartbeat to keep connection alive and verify token periodically
    const heartbeatInterval = setInterval(() => {
      socket.emit("heartbeat", { timestamp: Date.now() })

      // Revalidate token every 15 minutes
      const timeSinceAuth = Date.now() - socket.authTimestamp
      if (timeSinceAuth > 15 * 60 * 1000) {
        // 15 minutes
        // Get token from handshake
        const token =
          socket.handshake.query?.token ||
          (socket.handshake.headers.authorization?.startsWith("Bearer ")
            ? socket.handshake.headers.authorization.substring(7)
            : null)

        if (!token || isTokenExpired(token)) {
          logger.warn(`Token expired during session for user ${socket.user._id}`)
          socket.emit("error", { message: "Session expired", code: "TOKEN_EXPIRED" })
          socket.disconnect(true)
        } else {
          // Update auth timestamp
          socket.authTimestamp = Date.now()
        }
      }
    }, 30000) // 30 seconds

    // Handle client heartbeat responses
    socket.on("pong", (data) => {
      // Update last active timestamp
      User.findByIdAndUpdate(socket.user._id, {
        lastActive: Date.now(),
      }).catch((err) => {
        logger.error(`Error updating last active time: ${err.message}`)
      })
    })

    // Handle private messages with rate limiting and validation
    socket.on("privateMessage", async (message, callback) => {
      try {
        // Apply rate limiting
        try {
          await messageLimiter.consume(socket.userId)
        } catch (err) {
          logger.warn(`Rate limit exceeded for messages by user ${socket.userId}`)
          if (callback)
            callback({
              success: false,
              error: "Too many messages. Please slow down.",
              code: "RATE_LIMIT",
            })
          return
        }

        // Verify that the sender is the authenticated user
        if (message.sender !== socket.userId) {
          logger.warn(`Unauthorized message attempt by ${socket.user._id} for user ${message.sender}`)
          if (callback)
            callback({
              success: false,
              error: "Unauthorized sender",
              code: "UNAUTHORIZED",
            })
          return
        }

        // Validate message type
        const validTypes = ["text", "wink", "video", "file"]
        if (!validTypes.includes(message.type)) {
          logger.warn(`Invalid message type: ${message.type}`)
          if (callback)
            callback({
              success: false,
              error: `Invalid message type. Must be one of: ${validTypes.join(", ")}`,
              code: "INVALID_TYPE",
            })
          return
        }

        // Validate content based on type
        if (message.type === "text") {
          if (!message.content || message.content.length === 0) {
            if (callback)
              callback({
                success: false,
                error: "Message content is required",
                code: "EMPTY_CONTENT",
              })
            return
          }

          // Limit message length
          if (message.content.length > 2000) {
            if (callback)
              callback({
                success: false,
                error: "Message too long (max 2000 characters)",
                code: "CONTENT_TOO_LONG",
              })
            return
          }
        }

        // Add file-specific validation
        if (message.type === "file") {
          // Ensure metadata with file information exists
          if (!message.metadata || !message.metadata.fileUrl) {
            if (callback)
              callback({
                success: false,
                error: "File URL is required for file messages",
                code: "MISSING_FILE_URL",
              })
            return
          }

          // Validate file metadata
          if (!message.metadata.fileName) {
            if (callback)
              callback({
                success: false,
                error: "File name is required for file messages",
                code: "MISSING_FILE_NAME",
              })
            return
          }
        }

        // Validate recipient
        if (!mongoose.Types.ObjectId.isValid(message.recipient)) {
          logger.warn(`Invalid recipient ID format: ${message.recipient}`)
          if (callback)
            callback({
              success: false,
              error: "Invalid recipient ID",
              code: "INVALID_RECIPIENT",
            })
          return
        }

        // Check if recipient exists
        const recipientUser = await User.findById(message.recipient)
        if (!recipientUser) {
          logger.warn(`Recipient not found: ${message.recipient}`)
          if (callback)
            callback({
              success: false,
              error: "Recipient not found",
              code: "RECIPIENT_NOT_FOUND",
            })
          return
        }

        // Create message in database
        const newMessage = new Message({
          sender: message.sender,
          recipient: message.recipient,
          type: message.type,
          content: message.type === "text" ? message.content.trim() : message.content || "",
          metadata: message.metadata || {},
        })

        await newMessage.save()

        // Add sender name to outgoing message
        const enrichedMessage = newMessage.toObject()
        enrichedMessage.senderName = socket.user.nickname

        // Send to recipient's room
        io.to(message.recipient).emit("newMessage", enrichedMessage)

        logger.debug(`Message sent from ${message.sender} to ${message.recipient} (type: ${message.type})`)

        // Return success with the message object
        if (callback)
          callback({
            success: true,
            message: enrichedMessage,
          })
      } catch (err) {
        logger.error(`Error sending private message: ${err.message}`)
        if (callback)
          callback({
            success: false,
            error: err.message || "Failed to send message",
            code: "SERVER_ERROR",
          })
      }
    })

    // Typing indicator with rate limiting
    socket.on("typing", async ({ sender, recipient }) => {
      // Apply rate limiting to prevent flooding
      try {
        await typingLimiter.consume(sender)
      } catch (err) {
        logger.debug(`Typing event rate limited for user ${sender}`)
        return
      }

      // Verify sender is the authenticated user
      if (sender !== socket.userId) {
        logger.warn(`Unauthorized typing indicator from ${socket.user._id} for user ${sender}`)
        return
      }

      // Validate recipient
      if (!mongoose.Types.ObjectId.isValid(recipient)) {
        logger.warn(`Invalid recipient ID for typing event: ${recipient}`)
        return
      }

      // Emit typing event to recipient with additional metadata
      io.to(recipient).emit("userTyping", {
        userId: sender,
        nickname: socket.user.nickname,
        timestamp: Date.now(),
      })
    })

    // Video call request with rate limiting
    socket.on("videoCallRequest", async ({ caller, recipient }, callback) => {
      try {
        // Apply rate limiting
        try {
          await callLimiter.consume(caller)
        } catch (err) {
          logger.warn(`Call rate limit exceeded for user ${caller}`)
          if (callback)
            callback({
              success: false,
              error: "Too many call attempts. Please wait a moment.",
              code: "RATE_LIMIT",
            })
          return
        }

        // Verify caller is the authenticated user
        if (caller !== socket.userId) {
          logger.warn(`Unauthorized call request from ${socket.user._id} for user ${caller}`)
          if (callback)
            callback({
              success: false,
              error: "Unauthorized caller",
              code: "UNAUTHORIZED",
            })
          return
        }

        // Validate recipient
        if (!mongoose.Types.ObjectId.isValid(recipient)) {
          logger.warn(`Invalid recipient ID for call: ${recipient}`)
          if (callback)
            callback({
              success: false,
              error: "Invalid recipient ID",
              code: "INVALID_RECIPIENT",
            })
          return
        }

        // Check if recipient exists and is online
        const recipientUser = await User.findById(recipient)
        if (!recipientUser) {
          logger.warn(`Call recipient not found: ${recipient}`)
          if (callback)
            callback({
              success: false,
              error: "Recipient not found",
              code: "RECIPIENT_NOT_FOUND",
            })
          return
        }

        // Check if recipient is online by checking active connections
        const isRecipientOnline = userConnections.has(recipient) && userConnections.get(recipient).size > 0

        if (!isRecipientOnline) {
          logger.warn(`Call recipient is offline: ${recipient}`)
          if (callback)
            callback({
              success: false,
              error: "Recipient is offline",
              code: "RECIPIENT_OFFLINE",
            })
          return
        }

        // Emit call request to recipient
        io.to(recipient).emit("incomingCall", {
          userId: caller,
          nickname: socket.user.nickname,
          timestamp: Date.now(),
        })

        logger.info(`Video call initiated from ${caller} to ${recipient}`)

        // Also log this as a message in the database for history
        const callMessage = await Message.create({
          sender: caller,
          recipient,
          type: "video",
          content: "Video call",
        })

        if (callback)
          callback({
            success: true,
            callId: callMessage._id,
          })
      } catch (err) {
        logger.error(`Error initiating video call: ${err.message}`)
        if (callback)
          callback({
            success: false,
            error: "Failed to initiate call",
            code: "SERVER_ERROR",
          })
      }
    })

    // Video call answer with acknowledgments
    socket.on("videoCallAnswer", ({ caller, recipient, answer }, callback) => {
      // Verify recipient is the authenticated user
      if (recipient !== socket.userId) {
        logger.warn(`Unauthorized call answer from ${socket.user._id} for user ${recipient}`)
        if (callback)
          callback({
            success: false,
            error: "Unauthorized recipient",
            code: "UNAUTHORIZED",
          })
        return
      }

      // Validate caller ID
      if (!mongoose.Types.ObjectId.isValid(caller)) {
        logger.warn(`Invalid caller ID for call answer: ${caller}`)
        if (callback)
          callback({
            success: false,
            error: "Invalid caller ID",
            code: "INVALID_CALLER",
          })
        return
      }

      // Emit call answer to caller
      io.to(caller).emit("callAnswered", {
        userId: recipient,
        nickname: socket.user.nickname,
        answer,
        timestamp: Date.now(),
      })

      logger.info(`Call answered by ${recipient} to ${caller}: ${answer ? "accepted" : "declined"}`)

      if (callback) callback({ success: true })
    })

    // Read receipt for messages
    socket.on("messageRead", async ({ messageId, reader }, callback) => {
      try {
        // Verify reader is the authenticated user
        if (reader !== socket.userId) {
          logger.warn(`Unauthorized read receipt from ${socket.user._id} for user ${reader}`)
          if (callback)
            callback({
              success: false,
              error: "Unauthorized reader",
              code: "UNAUTHORIZED",
            })
          return
        }

        // Validate message ID
        if (!mongoose.Types.ObjectId.isValid(messageId)) {
          logger.warn(`Invalid message ID format: ${messageId}`)
          if (callback)
            callback({
              success: false,
              error: "Invalid message ID",
              code: "INVALID_MESSAGE_ID",
            })
          return
        }

        // Find message and update read status
        const message = await Message.findOne({
          _id: messageId,
          recipient: reader, // Ensure the reader is the recipient
        })

        if (!message) {
          logger.warn(`Message not found or user not authorized to mark as read: ${messageId}`)
          if (callback)
            callback({
              success: false,
              error: "Message not found",
              code: "MESSAGE_NOT_FOUND",
            })
          return
        }

        // Only update if not already read
        if (!message.read) {
          message.read = true
          message.readAt = new Date()
          await message.save()

          // Notify the sender that the message was read
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
          callback({
            success: false,
            error: "Failed to process read receipt",
            code: "SERVER_ERROR",
          })
      }
    })

    // Handle batch read receipts
    socket.on("markConversationRead", async ({ conversationWith, reader }, callback) => {
      try {
        // Verify reader is the authenticated user
        if (reader !== socket.userId) {
          logger.warn(`Unauthorized batch read from ${socket.user._id} for user ${reader}`)
          if (callback)
            callback({
              success: false,
              error: "Unauthorized reader",
              code: "UNAUTHORIZED",
            })
          return
        }

        // Validate conversation partner ID
        if (!mongoose.Types.ObjectId.isValid(conversationWith)) {
          logger.warn(`Invalid conversation partner ID: ${conversationWith}`)
          if (callback)
            callback({
              success: false,
              error: "Invalid ID",
              code: "INVALID_ID",
            })
          return
        }

        // Find all unread messages from conversation partner
        const unreadMessages = await Message.find({
          sender: conversationWith,
          recipient: reader,
          read: false,
        })

        // Update all messages as read
        if (unreadMessages.length > 0) {
          await Message.updateMany(
            {
              sender: conversationWith,
              recipient: reader,
              read: false,
            },
            { read: true, readAt: new Date() },
          )

          // Notify the conversation partner about batch read
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
          callback({
            success: true,
            count: unreadMessages.length,
          })
      } catch (err) {
        logger.error(`Error marking conversation as read: ${err.message}`)
        if (callback)
          callback({
            success: false,
            error: "Failed to mark conversation as read",
            code: "SERVER_ERROR",
          })
      }
    })

    // Story events
    socket.on("viewStory", async ({ storyId, userId }) => {
      try {
        const story = await Story.findById(storyId)
        if (story) {
          await story.addViewer(userId)
          // Notify the story owner that someone viewed their story
          const ownerSocket = getSocketByUserId(story.user.toString())
          if (ownerSocket) {
            ownerSocket.emit("storyViewed", {
              storyId,
              viewerId: userId,
            })
          }
        }
      } catch (error) {
        logger.error(`Socket viewStory error: ${error.message}`)
      }
    })

    socket.on("createStory", async (storyData) => {
      try {
        // Broadcast to followers that a new story is available
        const user = await User.findById(storyData.userId)
        if (user && user.followers && user.followers.length > 0) {
          user.followers.forEach((follower) => {
            const followerSocket = getSocketByUserId(follower.user.toString())
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
        // Remove from user connections tracking
        const userId = socket.user._id.toString()
        if (userConnections.has(userId)) {
          userConnections.get(userId).delete(socket.id)

          // If this was the last connection for this user, update online status
          if (userConnections.get(userId).size === 0) {
            userConnections.delete(userId)

            await User.findByIdAndUpdate(userId, {
              isOnline: false,
              lastActive: Date.now(),
            })

            // Broadcast user offline status
            socket.broadcast.emit("userOffline", {
              userId,
              timestamp: Date.now(),
            })

            logger.info(`User ${userId} is now offline (all connections closed)`)
          } else {
            logger.debug(`User ${userId} still has ${userConnections.get(userId).size} active connection(s)`)
          }
        }
      } catch (err) {
        logger.error(`Error updating user offline status: ${err.message}`)
      }

      // Clear intervals
      clearInterval(heartbeatInterval)
    })

    // Handle errors
    socket.on("error", (error) => {
      logger.error(`Socket error for ${socket.id} (User: ${socket.user?._id}): ${error.message}`)
    })
  })

  // Server-side error handling
  io.engine.on("connection_error", (err) => {
    logger.error(`Socket.IO connection error: ${err.code} - ${err.message}`)
  })

  // Periodic cleanup to check for zombie connections
  setInterval(
    () => {
      const now = Date.now()

      // Check each user's connections
      for (const [userId, socketIds] of userConnections.entries()) {
        // If user has connections but hasn't been active in 10 minutes, mark as offline
        const user = User.findById(userId).select("lastActive")
        if (user && now - user.lastActive > 10 * 60 * 1000) {
          logger.warn(`User ${userId} has inactive connections for >10 minutes, cleaning up`)

          // Disconnect each socket
          for (const socketId of socketIds) {
            const socket = io.sockets.sockets.get(socketId)
            if (socket) {
              socket.disconnect(true)
            }
          }

          // Clear from tracking
          userConnections.delete(userId)

          // Update user status
          User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastActive: now,
          }).catch((err) => {
            logger.error(`Error updating inactive user status: ${err.message}`)
          })

          // Broadcast offline status
          io.emit("userOffline", { userId, timestamp: now })
        }
      }
    },
    5 * 60 * 1000,
  ) // Check every 5 minutes

  return io
}

module.exports = initSocketServer
