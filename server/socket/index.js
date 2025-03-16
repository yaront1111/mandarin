// server/socket/index.js
const socketio = require("socket.io")
const { socketAuthMiddleware } = require("./socketAuth")
const { registerSocketHandlers } = require("./socketHandlers")
const { RateLimiterMemory } = require("rate-limiter-flexible")
const logger = require("../logger")
const { User } = require("../models")
const mongoose = require("mongoose")

const initSocketServer = (server) => {
  const allowedOrigins =
    process.env.NODE_ENV === "production"
      ? process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",")
        : [process.env.FRONTEND_URL || "https://yourdomain.com"]
      : ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5000", "http://127.0.0.1:5000"]

  logger.info(`Socket.IO configured with allowed origins: ${JSON.stringify(allowedOrigins)}`)

  const io = socketio(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) {
          logger.debug("Socket connection with no origin allowed")
          return callback(null, true)
        }
        if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
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
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 30000,
    maxHttpBufferSize: 1e6,
    adapter: process.env.REDIS_URL
      ? require("@socket.io/redis-adapter")({
          pubClient: require("redis").createClient(process.env.REDIS_URL),
          subClient: require("redis").createClient(process.env.REDIS_URL),
        })
      : undefined,
  })

  // Set up rate limiters
  const typingLimiter = new RateLimiterMemory({ points: 5, duration: 3, blockDuration: 2 })
  const messageLimiter = new RateLimiterMemory({ points: 10, duration: 10, blockDuration: 30 })
  const callLimiter = new RateLimiterMemory({ points: 3, duration: 60, blockDuration: 120 })

  const rateLimiters = { typingLimiter, messageLimiter, callLimiter }
  const userConnections = new Map()

  io.use(socketAuthMiddleware)

  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.user._id})`)

    if (!userConnections.has(socket.user._id.toString())) {
      userConnections.set(socket.user._id.toString(), new Set())
    }
    userConnections.get(socket.user._id.toString()).add(socket.id)
    socket.join(socket.user._id.toString())

    registerSocketHandlers(io, socket, userConnections, rateLimiters)
  })

  // Periodic cleanup for inactive (zombie) connections
  setInterval(() => {
    const now = Date.now()
    for (const [userId, socketIds] of userConnections.entries()) {
      User.findById(userId).select("lastActive")
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
            User.findByIdAndUpdate(userId, { isOnline: false, lastActive: now })
              .catch((err) => logger.error(`Error updating inactive user status: ${err.message}`))
            io.emit("userOffline", { userId, timestamp: now })
          }
        })
        .catch((err) => logger.error(`Error during cleanup for user ${userId}: ${err.message}`))
    }
  }, 5 * 60 * 1000)

  io.engine.on("connection_error", (err) => {
    logger.error(`Socket.IO connection error: ${err.code} - ${err.message}`)
  })

  return io
}

module.exports = initSocketServer
