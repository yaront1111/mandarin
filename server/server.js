// Upgraded server.js with improved error handling and security
const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const mongoose = require("mongoose")
const cors = require("cors")
const path = require("path")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const mongoSanitize = require("express-mongo-sanitize")
const xss = require("xss-clean")
const hpp = require("hpp")
const compression = require("compression")
const cookieParser = require("cookie-parser")
const { createAdapter } = require("@socket.io/mongo-adapter")

const config = require("./config")
const logger = require("./logger")
const routes = require("./routes")
const { User } = require("./models")
const { verifySocketToken } = require("./middleware/auth")

// Initialize Express app
const app = express()

// Create HTTP server
const server = http.createServer(app)

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "wss:", "ws:"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
)

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again after 15 minutes",
})

// Apply rate limiting to API routes
app.use("/api/", apiLimiter)

// Body parser middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Cookie parser
app.use(cookieParser())

// Data sanitization against NoSQL query injection
app.use(mongoSanitize())

// Data sanitization against XSS
app.use(xss())

// Prevent parameter pollution
app.use(hpp())

// Enable CORS
app.use(cors(config.CORS_OPTIONS))

// Compression middleware
app.use(compression())

// Set static folder
app.use(express.static(path.join(__dirname, "public")))

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, config.FILE_UPLOAD_PATH)))

// API routes
app.use("/api", routes)

// Connect to MongoDB
mongoose
  .connect(config.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    logger.info(`MongoDB Connected: ${mongoose.connection.host}`)

    // Create MongoDB collection for Socket.IO adapter
    const mongoCollection = mongoose.connection.collection("socket.io-adapter-events")
    mongoCollection
      .createIndexes([{ key: { createdAt: 1 }, expireAfterSeconds: 3600 }])
      .then(() => {
        logger.info("Socket.IO MongoDB adapter collection initialized")
      })
      .catch((err) => {
        logger.error(`Error creating Socket.IO adapter indexes: ${err.message}`)
      })
  })
  .catch((err) => {
    logger.error(`MongoDB connection error: ${err.message}`)
    process.exit(1)
  })

// Socket.IO setup
const io = socketIo(server, {
  cors: config.CORS_OPTIONS,
  pingTimeout: 60000,
  connectTimeout: 30000,
  maxHttpBufferSize: 1e6, // 1MB
})

// Socket.IO MongoDB adapter
mongoose.connection.once("open", () => {
  const mongoCollection = mongoose.connection.collection("socket.io-adapter-events")
  io.adapter(createAdapter(mongoCollection))
  logger.info("Socket.IO MongoDB adapter connected")
})

// Socket.IO middleware for authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.query.token
    if (!token) {
      return next(new Error("Authentication error"))
    }

    const decoded = verifySocketToken(token)
    if (!decoded) {
      return next(new Error("Authentication error"))
    }

    const user = await User.findById(decoded.id)
    if (!user) {
      return next(new Error("User not found"))
    }

    socket.userId = user._id.toString()
    socket.user = {
      _id: user._id.toString(),
      nickname: user.nickname,
    }

    logger.debug(`Socket authenticated: ${socket.userId}`)
    next()
  } catch (error) {
    logger.error(`Socket authentication error: ${error.message}`)
    next(new Error("Authentication error"))
  }
})

// Socket.IO connection handler
io.on("connection", async (socket) => {
  logger.info(`Socket connected: ${socket.id} (User: ${socket.userId})`)

  try {
    // Update user's online status
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      lastActive: new Date(),
      socketId: socket.id,
    })

    // Notify others that user is online
    socket.broadcast.emit("userOnline", { userId: socket.userId })

    // Join user's room for private messages
    socket.join(socket.userId)

    // Handle user joining
    socket.on("join", async (data) => {
      if (data.userId === socket.userId) {
        logger.debug(`User ${socket.userId} joined their room`)
      }
    })

    // Handle private messages
    socket.on("privateMessage", async (message, callback) => {
      try {
        if (message.sender !== socket.userId) {
          throw new Error("Sender ID does not match socket user")
        }

        // Create message in database
        const { Message } = require("./models")
        const newMessage = new Message({
          sender: message.sender,
          recipient: message.recipient,
          type: message.type,
          content: message.content,
        })

        await newMessage.save()

        // Send to recipient if online
        io.to(message.recipient).emit("newMessage", newMessage)

        // Acknowledge message receipt
        if (callback) callback({ success: true, messageId: newMessage._id })

        logger.debug(`Private message sent: ${newMessage._id}`)
      } catch (error) {
        logger.error(`Error sending private message: ${error.message}`)
        if (callback) callback({ success: false, error: error.message })
      }
    })

    // Handle typing indicator
    socket.on("typing", (data) => {
      if (data.sender !== socket.userId) return
      socket.to(data.recipient).emit("userTyping", {
        sender: data.sender,
        timestamp: Date.now(),
      })
    })

    // Handle video call requests
    socket.on("videoCallRequest", async (data, callback) => {
      try {
        if (data.caller !== socket.userId) {
          throw new Error("Caller ID does not match socket user")
        }

        // Check if recipient exists and is online
        const recipient = await User.findById(data.recipient).select("isOnline socketId")
        if (!recipient) {
          throw new Error("Recipient not found")
        }

        if (!recipient.isOnline || !recipient.socketId) {
          throw new Error("Recipient is offline")
        }

        // Send call request to recipient
        io.to(data.recipient).emit("incomingCall", {
          caller: data.caller,
          timestamp: Date.now(),
        })

        // Create a call record in the database
        const { Message } = require("./models")
        const callMessage = new Message({
          sender: data.caller,
          recipient: data.recipient,
          type: "video",
          content: "Video call",
        })

        await callMessage.save()

        if (callback) callback({ success: true, callId: callMessage._id })

        logger.debug(`Video call request sent: ${data.caller} -> ${data.recipient}`)
      } catch (error) {
        logger.error(`Error initiating video call: ${error.message}`)
        if (callback) callback({ success: false, error: error.message })
      }
    })

    // Handle video call answers
    socket.on("videoCallAnswer", (data, callback) => {
      try {
        if (data.recipient !== socket.userId) {
          throw new Error("Recipient ID does not match socket user")
        }

        // Send answer to caller
        io.to(data.caller).emit("callAnswered", {
          recipient: data.recipient,
          answer: data.answer,
          timestamp: Date.now(),
        })

        if (callback) callback({ success: true })

        logger.debug(`Video call ${data.answer ? "accepted" : "declined"}: ${data.caller} <- ${data.recipient}`)
      } catch (error) {
        logger.error(`Error answering video call: ${error.message}`)
        if (callback) callback({ success: false, error: error.message })
      }
    })

    // Handle ICE candidates for WebRTC
    socket.on("ice-candidate", (data) => {
      if (data.from !== socket.userId) return
      socket.to(data.to).emit("ice-candidate", {
        candidate: data.candidate,
        from: data.from,
      })
    })

    // Handle SDP offers/answers for WebRTC
    socket.on("sdp", (data) => {
      if (data.from !== socket.userId) return
      socket.to(data.to).emit("sdp", {
        sdp: data.sdp,
        from: data.from,
      })
    })

    // Handle read receipts
    socket.on("messageRead", async (data) => {
      try {
        if (data.reader !== socket.userId) return

        const { Message } = require("./models")
        await Message.updateMany(
          { _id: { $in: data.messageIds }, recipient: socket.userId },
          { $set: { read: true, readAt: new Date() } },
        )

        // Notify sender that messages were read
        if (data.sender) {
          socket.to(data.sender).emit("messagesRead", {
            reader: socket.userId,
            messageIds: data.messageIds,
          })
        }

        logger.debug(`Messages marked as read: ${data.messageIds.length} messages`)
      } catch (error) {
        logger.error(`Error marking messages as read: ${error.message}`)
      }
    })

    // Handle disconnection
    socket.on("disconnect", async () => {
      try {
        // Update user's online status
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastActive: new Date(),
          socketId: null,
        })

        // Notify others that user is offline
        socket.broadcast.emit("userOffline", { userId: socket.userId })

        logger.info(`Socket disconnected: ${socket.id} (User: ${socket.userId})`)
      } catch (error) {
        logger.error(`Error handling socket disconnect: ${error.message}`)
      }
    })
  } catch (error) {
    logger.error(`Error in socket connection handler: ${error.message}`)
    socket.disconnect(true)
  }
})

// Serve React app in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/build")))
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../client/build", "index.html"))
  })
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`)
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === "production" ? "Server Error" : err.message,
  })
})

// Start server
const PORT = process.env.PORT || config.PORT || 5000
server.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
})

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`)
  // Don't crash the server in production
  if (process.env.NODE_ENV !== "production") {
    server.close(() => process.exit(1))
  }
})

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error(`Uncaught Exception: ${err.message}`)
  // Don't crash the server in production
  if (process.env.NODE_ENV !== "production") {
    server.close(() => process.exit(1))
  }
})

module.exports = { app, server, io }
