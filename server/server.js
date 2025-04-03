// server.js
import express from "express";
import http from "http";
import path from "path";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import fs from "fs";
import compression from "compression";
import { fileURLToPath } from "url";
import mongoSanitize from "express-mongo-sanitize";
import logger, { requestLogger, gracefulShutdown } from "./logger.js";
import config from "./config.js";
import { connectDB, closeConnection } from "./db.js";
import routes from "./routes/index.js";
import { initSubscriptionTasks } from "./cron/subscriptionTasks.js";
import { configureCors, corsErrorHandler } from "./middleware/cors.js";

// Import PeerServer from the peer package
import { PeerServer } from "peer";

// Get directory name in ES modules context
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Express app
const app = express();

// Trust proxy (fixes rate limiter issues with proxies)
app.set("trust proxy", 1);

// Create HTTP server
const server = http.createServer(app);

// Create a PeerJS server on port 9000 with path /peerjs
const peerServer = PeerServer({
  port: 9000,
  path: "/peerjs",
  proxied: true
});

peerServer.on("connection", (client) => {
  console.log("Client connected to peer server:", client.id);
});

peerServer.on("disconnect", (client) => {
  console.log("Client disconnected from peer server:", client.id);
});

console.log("PeerJS server running on port 9000");

// Apply security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Adjust in production
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Enable compression for responses
app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (
        req.headers["accept"]?.includes("text/html") ||
        req.headers["accept"]?.includes("application/json") ||
        req.headers["accept"]?.includes("text/")
      ) {
        return true;
      }
      if (req.url.match(/\.(jpg|jpeg|png|gif|webp|zip|mp4|webm|woff|woff2)$/)) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);

// Apply MongoDB data sanitization
app.use(mongoSanitize());

// Body parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Cookie parser
app.use(cookieParser());

// Enable CORS
app.use(configureCors());
app.use(corsErrorHandler);

// Request logging
app.use(requestLogger);

// Set static folder for public assets
app.use(express.static(path.join(__dirname, "public")));

// Define uploads base path and ensure directories exist
const uploadsBasePath = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsBasePath)) {
  fs.mkdirSync(uploadsBasePath, { recursive: true });
  logger.info(`Created uploads directory: ${uploadsBasePath}`);
}
const requiredDirs = ["images", "photos", "videos", "messages", "profiles", "stories", "temp", "deleted"];
requiredDirs.forEach((dir) => {
  const dirPath = path.join(uploadsBasePath, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.info(`Created uploads subdirectory: ${dirPath}`);
  }
});
logger.info(`Main uploads directory: ${uploadsBasePath}`);
requiredDirs.forEach((dir) => {
  logger.info(`  - ${dir} directory: ${path.join(uploadsBasePath, dir)}`);
});

// Serve static files for uploads - with better error handling
app.use(
  "/uploads",
  (req, res, next) => {
    logger.debug(`Upload request for: ${req.path}`);
    
    // Get the full file path
    const fullPath = path.join(uploadsBasePath, req.path);
    
    // Check if the path is attempting directory traversal
    if (!fullPath.startsWith(uploadsBasePath)) {
      logger.warn(`Blocked potential path traversal attempt: ${req.path}`);
      return res.status(403).sendFile(path.join(__dirname, "public", "default-avatar.png"));
    }
    
    // Add a CORS header for images specifically to fix 403 issues when accessed directly
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Check if the file exists before attempting to serve it
    fs.stat(fullPath, (err, stats) => {
      if (err || !stats.isFile()) {
        logger.debug(`File not found: ${fullPath}`);
        // For missing profile images, return the default avatar instead of 404
        if (req.path.includes('/images/') || req.path.includes('/photos/')) {
          return res.sendFile(path.join(__dirname, "public", "default-avatar.png"));
        }
      }
      // Continue to static file middleware
      next();
    });
  },
  express.static(uploadsBasePath, {
    maxAge: "1d",
    etag: true,
    lastModified: true,
    index: false,
    dotfiles: "ignore",
    fallthrough: true,
    setHeaders: (res) => {
      // Add CORS headers for all static files in uploads directory
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  })
);

// Diagnostic endpoint to check file existence
app.get("/api/check-file", (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ success: false, error: "No file path provided" });
  }
  const fullPath = path.join(uploadsBasePath, filePath);
  if (!fullPath.startsWith(uploadsBasePath)) {
    return res.status(403).json({ success: false, error: "Invalid file path" });
  }
  fs.stat(fullPath, (err, stats) => {
    if (err) {
      return res.json({
        success: false,
        error: err.message,
        exists: false,
        requestedPath: filePath,
        fullPath: fullPath,
      });
    }
    return res.json({
      success: true,
      exists: true,
      isDirectory: stats.isDirectory(),
      size: stats.size,
      requestedPath: filePath,
      fullPath: fullPath,
    });
  });
});

// Add request ID to each request for logging
app.use((req, res, next) => {
  req.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  next();
});

// API routes with prefix
const API_PREFIX = "/api";
app.use(API_PREFIX, routes);

// Global error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  logger.error(`Global error handler: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
    status: statusCode,
    requestId: req.id,
  });
  const errorMessage =
    process.env.NODE_ENV === "production" && statusCode === 500
      ? "Internal server error"
      : err.message;
  res.status(statusCode).json({
    success: false,
    error: errorMessage,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// Handle 404 routes
app.use((req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: "Resource not found",
  });
});

// Initialize application: connect to DB, start server, setup Socket.IO, etc.
const initializeApp = async () => {
  try {
    await connectDB();
    const PORT = process.env.PORT || config.PORT || 5000;
    server.listen(PORT, async () => {
      logger.info(`Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
      try {
        const { default: initSocketServer } = await import("./socket/index.js");
        const io = await initSocketServer(server);
        app.set("io", io);
        logger.info("Socket.IO server initialized successfully");
      } catch (err) {
        logger.error(`Failed to initialize Socket.IO: ${err.message}`);
      }
      initSubscriptionTasks();
      logger.info("Server initialization complete");
    });
  } catch (err) {
    logger.error(`Server initialization failed: ${err.message}`);
    process.exit(1);
  }
};

// Graceful shutdown handler
const shutdownHandler = async (signal) => {
  logger.info(`${signal} signal received: Starting graceful shutdown`);
  server.close(async () => {
    logger.info("HTTP server closed");
    try {
      await closeConnection();
      await gracefulShutdown();
      logger.info("All connections closed gracefully");
      process.exit(0);
    } catch (err) {
      logger.error(`Error during shutdown: ${err.message}`);
      process.exit(1);
    }
  });
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
};

process.on("SIGTERM", () => shutdownHandler("SIGTERM"));
process.on("SIGINT", () => shutdownHandler("SIGINT"));

process.on("unhandledRejection", (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`, { stack: err.stack });
  if (process.env.NODE_ENV !== "production") {
    server.close(() => process.exit(1));
  }
});

process.on("uncaughtException", (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  shutdownHandler("uncaughtException");
});

initializeApp();

export { app, server };
