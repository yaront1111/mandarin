// server/socket/main.jsx
const socketio = require("socket.io")
const { socketAuthMiddleware } = require("./socketAuth")
const { registerSocketHandlers, handleUserDisconnect } = require("./socketHandlers")
const { RateLimiterMemory } = require("rate-limiter-flexible")
const logger = require("../logger")
const { User } = require("../models")
const mongoose = require("mongoose")

// Import Redis client
let redisAdapter
if (process.env.REDIS_URL) {
  try {
    // Use a try-catch to handle potential Redis import errors
    const { createAdapter } = require("@socket.io/redis-adapter")
    const { createClient } = require("redis")

    // We'll initialize Redis clients later, before creating the Socket.IO server
    redisAdapter = { createAdapter, createClient }
    logger.info("Redis adapter module loaded successfully")
  } catch (err) {
    logger.error(`Failed to load Redis adapter: ${err.message}`)
    redisAdapter = null
  }
}

const initSocketServer = async (server) => {
  // Determine environment and allowed origins
  const isDev = process.env.NODE_ENV !== "production"

  const allowedOrigins = isDev
    ? ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5000", "http://127.0.0.1:5000"]
    : process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : [process.env.FRONTEND_URL || "https://yourdomain.com"]

  logger.info(`Socket.IO configured with allowed origins: ${JSON.stringify(allowedOrigins)}`)

  // Initialize Redis clients if Redis is configured
  let pubClient, subClient
  if (redisAdapter && process.env.REDIS_URL) {
    try {
      pubClient = redisAdapter.createClient({ url: process.env.REDIS_URL })
      subClient = pubClient.duplicate()

      // Connect to Redis (required in newer Redis client versions)
      await Promise.all([
        pubClient.connect().then(() => logger.info("Redis pub client connected")),
        subClient.connect().then(() => logger.info("Redis sub client connected")),
      ])

      // Handle Redis errors
      pubClient.on("error", (err) => logger.error(`Redis pub client error: ${err.message}`))
      subClient.on("error", (err) => logger.error(`Redis sub client error: ${err.message}`))

      logger.info("Redis clients initialized successfully")
    } catch (err) {
      logger.error(`Failed to initialize Redis clients: ${err.message}`)
      // Clean up if initialization failed
      if (pubClient) {
        try {
          await pubClient.quit()
        } catch (e) {
          /* ignore */
        }
      }
      if (subClient) {
        try {
          await subClient.quit()
        } catch (e) {
          /* ignore */
        }
      }
      pubClient = subClient = null
    }
  }

  // Configure Socket.IO with improved settings for reliability
  const ioOptions = {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
          logger.debug("Socket connection with no origin allowed")
          return callback(null, true)
        }

        // Check if origin is allowed
        if (allowedOrigins.includes(origin) || isDev) {
          logger.debug(`Socket.IO CORS allowed for origin: ${origin}`)
          return callback(null, true)
        }

        logger.warn(`Socket.IO CORS rejected for origin: ${origin}`)
        return callback(new Error("Not allowed by CORS"), false)
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,        // Increased ping timeout
    pingInterval: 25000,       // Ping every 25 seconds
    connectTimeout: 45000,     // Increased connect timeout
    maxHttpBufferSize: 1e6,    // 1MB max buffer size
    path: "/socket.io",        // Default Socket.IO path
    allowEIO3: true,           // Allow Engine.IO v3 clients for better compatibility
  }

  // Add Redis adapter if Redis clients are initialized
  if (pubClient && subClient && redisAdapter) {
    ioOptions.adapter = redisAdapter.createAdapter(pubClient, subClient)
    logger.info("Redis adapter configured for Socket.IO")
  } else {
    logger.info("Using default in-memory adapter for Socket.IO")
  }

  // Log detailed server connection info
  logger.info(`Creating Socket.IO server with path: ${ioOptions.path}, transports: ${ioOptions.transports.join(', ')}`)

  const io = socketio(server, ioOptions)

  // Add connection logging
  io.engine.on("initial_headers", (headers, req) => {
    logger.debug(`Socket.IO initial headers: ${JSON.stringify(headers)}`)
  })

  io.engine.on("headers", (headers, req) => {
    logger.debug(`Socket.IO headers: ${JSON.stringify(headers)}`)
  })

  io.engine.on("connection_error", (err) => {
    logger.error(`Socket.IO connection error: ${err.code} - ${err.message} - ${err.context || "No context"}`)
  })

  // Set up rate limiters
  const typingLimiter = new RateLimiterMemory({ points: 5, duration: 3, blockDuration: 2 })
  const messageLimiter = new RateLimiterMemory({ points: 10, duration: 10, blockDuration: 30 })
  const callLimiter = new RateLimiterMemory({ points: 3, duration: 60, blockDuration: 120 })

  const rateLimiters = { typingLimiter, messageLimiter, callLimiter }
  const userConnections = new Map()

  // Add explicit middleware timing log
  logger.info("Registering Socket.IO authentication middleware")
  io.use((socket, next) => {
    logger.debug(`Socket auth middleware processing for socket: ${socket.id}`)
    socketAuthMiddleware(socket, next)
  })

  // Connection handler
  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.user?._id || "unknown"})`)

    if (socket.user && socket.user._id) {
      if (!userConnections.has(socket.user._id.toString())) {
        userConnections.set(socket.user._id.toString(), new Set())
      }
      userConnections.get(socket.user._id.toString()).add(socket.id)
      socket.join(socket.user._id.toString())

      // Register handlers for this socket
      registerSocketHandlers(io, socket, userConnections, rateLimiters)

      // Emit a welcome event to confirm successful connection
      socket.emit("welcome", {
        userId: socket.user._id.toString(),
        timestamp: Date.now(),
        message: "Socket connection established successfully"
      })
    } else {
      logger.warn(`Socket ${socket.id} connected without valid user, disconnecting`)
      socket.disconnect(true)
    }
  })

  // Periodic cleanup for inactive (zombie) connections
  setInterval(
    () => {
      const now = Date.now()
      for (const [userId, socketIds] of userConnections.entries()) {
        User.findById(userId)
          .select("lastActive")
          .then((user) => {
            if (user && now - user.lastActive > 10 * 60 * 1000) {
              logger.warn(`User ${userId} has inactive connections for >10 minutes, cleaning up`)
              for (const socketId of socketIds) {
                const socket = io.sockets.sockets.get(socketId)
                if (socket) {
                  socket.disconnect(true)
                }
              }
              userConnections.delete(userId)
              User.findByIdAndUpdate(userId, { isOnline: false, lastActive: now }).catch((err) =>
                logger.error(`Error updating inactive user status: ${err.message}`),
              )
              io.emit("userOffline", { userId, timestamp: now })
            }
          })
          .catch((err) => logger.error(`Error during cleanup for user ${userId}: ${err.message}`))
      }
    },
    5 * 60 * 1000,
  )

  return io
}

module.exports = initSocketServer
