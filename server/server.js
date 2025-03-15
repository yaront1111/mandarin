// Import required modules
const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const mongoose = require("mongoose")
const cors = require("cors")
const path = require("path")
const helmet = require("helmet")
const cookieParser = require("cookie-parser")
const fs = require("fs")
const logger = require("./logger")
const config = require("./config")
const routes = require("./routes")

// Initialize Express app
const app = express()

// Create HTTP server
const server = http.createServer(app)

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
)

// Body parser middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Cookie parser
app.use(cookieParser())

// Enable CORS
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true)

      // Allow all origins in development
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true)
      }

      // In production, check against allowed origins
      const allowedOrigins = [
        process.env.FRONTEND_URL || "https://yourdomain.com",
        // Add other allowed origins as needed
      ]

      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error("Not allowed by CORS"))
      }
    },
    credentials: true,
  }),
)

// Set static folder
app.use(express.static(path.join(__dirname, "public")))

// Ensure uploads directory exists
const uploadsPath = path.join(__dirname, "uploads")
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true })
  logger.info(`Created uploads directory: ${uploadsPath}`)
}

// Serve uploaded files
app.use("/uploads", express.static(uploadsPath))

// Add request ID to each request for better logging
app.use((req, res, next) => {
  req.id = Date.now().toString(36) + Math.random().toString(36).substr(2)
  next()
})

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
  })
  .catch((err) => {
    logger.error(`MongoDB connection error: ${err.message}`)
    process.exit(1)
  })

// Socket.IO setup
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
})

// Socket.IO connection handler
io.on("connection", (socket) => {
  logger.info(`Socket connected: ${socket.id}`)

  // Handle disconnection
  socket.on("disconnect", () => {
    logger.info(`Socket disconnected: ${socket.id}`)
  })
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
  logger.error(`Error [${req.id}]: ${err.message}`)
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === "production" ? "Server Error" : err.message,
  })
})

// Start server
const PORT = process.env.PORT || config.PORT || 5000
server.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`)
})

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`)
  // Don't crash the server in production
  if (process.env.NODE_ENV !== "production") {
    server.close(() => process.exit(1))
  }
})

module.exports = { app, server, io }
