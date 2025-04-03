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

// Serve static files for uploads - with enhanced error handling and caching
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
    
    // Add comprehensive CORS headers to fix 403 issues when accessed directly from browser
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cross-Origin-Embedder-Policy', 'credentialless');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
    
    // For preflight OPTIONS requests, respond immediately with success
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    
    // Check if the file exists before attempting to serve it
    fs.stat(fullPath, (err, stats) => {
      if (err || !stats.isFile()) {
        logger.debug(`File not found: ${fullPath}`);
        // For missing profile images, return the default avatar instead of 404
        if (req.path.includes('/images/') || req.path.includes('/photos/')) {
          // Set cache headers for default avatar too
          res.set('Cache-Control', 'public, max-age=86400'); // 1 day
          res.set('Expires', new Date(Date.now() + 86400000).toUTCString());
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
    setHeaders: (res, path) => {
      // Add CORS headers for all static files in uploads directory
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      res.set('Cross-Origin-Embedder-Policy', 'credentialless');
      
      // Set cache headers based on file type
      if (path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        // Longer cache for images
        res.set('Cache-Control', 'public, max-age=86400'); // 1 day
        res.set('Expires', new Date(Date.now() + 86400000).toUTCString());
      } else {
        // Shorter cache for other files
        res.set('Cache-Control', 'public, max-age=3600'); // 1 hour
        res.set('Expires', new Date(Date.now() + 3600000).toUTCString());
      }
    }
  })
);

// Enhanced diagnostic endpoint to check file existence
app.get("/api/check-file", (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ success: false, error: "No file path provided" });
  }
  
  // Add CORS headers to ensure this endpoint is accessible
  res.set('Access-Control-Allow-Origin', '*');
  
  // Process absolute paths (starting with /) differently
  let fullPath;
  if (filePath.startsWith('/uploads/')) {
    // This is likely a URL path from client
    fullPath = path.join(process.cwd(), filePath);
  } else {
    // Assume it's a relative path within uploads
    fullPath = path.join(uploadsBasePath, filePath);
  }
  
  // Prevent directory traversal
  if (!fullPath.startsWith(process.cwd())) {
    return res.status(403).json({ success: false, error: "Invalid file path" });
  }
  
  fs.stat(fullPath, (err, stats) => {
    if (err) {
      // Try to handle common client-side URL formats
      if (filePath.includes('/api/avatar/')) {
        // This is an avatar URL, extract the ID
        const idMatch = filePath.match(/\/api\/avatar[s]?\/([^/]+)/);
        const userId = idMatch ? idMatch[1] : null;
        
        return res.json({
          success: false,
          error: err.message,
          exists: false,
          requestedPath: filePath,
          fullPath: fullPath,
          suggestion: userId ? 
            `This appears to be an avatar URL. Try accessing /api/avatar/${userId} directly.` :
            "This appears to be an avatar URL. Check the user ID in the URL."
        });
      } else if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        // This is an image file, might be in a different location
        const filename = path.basename(filePath);
        return res.json({
          success: false,
          error: err.message,
          exists: false,
          requestedPath: filePath,
          fullPath: fullPath,
          suggestion: `This appears to be an image file. It might be in a different location or have a different filename. The filename ${filename} was not found at the specified path.`
        });
      } else {
        return res.json({
          success: false,
          error: err.message,
          exists: false,
          requestedPath: filePath,
          fullPath: fullPath
        });
      }
    }
    
    // File exists - return more detailed info
    let mime = "application/octet-stream"; // Default MIME type
    const ext = path.extname(fullPath).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
    else if (ext === '.png') mime = 'image/png';
    else if (ext === '.gif') mime = 'image/gif';
    else if (ext === '.webp') mime = 'image/webp';
    else if (ext === '.svg') mime = 'image/svg+xml';
    
    // Create a direct URL that should work to access this file
    let directUrl = "";
    if (fullPath.includes('/uploads/')) {
      const uploadsMatch = fullPath.match(/\/uploads\/(.+)$/);
      if (uploadsMatch) {
        directUrl = `/uploads/${uploadsMatch[1]}`;
      }
    }
    
    return res.json({
      success: true,
      exists: true,
      isDirectory: stats.isDirectory(),
      size: stats.size,
      lastModified: stats.mtime,
      created: stats.birthtime,
      mime: mime,
      requestedPath: filePath,
      fullPath: fullPath,
      directUrl: directUrl,
      corsUrl: `/api/avatar/file/${path.basename(fullPath)}` // Special CORS-enabled URL
    });
  });
});

// Add a diagnostic image access endpoint that always adds correct CORS headers
app.get("/api/image-access/:filename", (req, res) => {
  const filename = req.params.filename;
  
  // Set comprehensive CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Cross-Origin-Embedder-Policy', 'credentialless');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  
  // Handle OPTIONS requests for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  // Set cache headers
  res.set('Cache-Control', 'public, max-age=86400'); // 1 day
  res.set('Expires', new Date(Date.now() + 86400000).toUTCString());
  
  if (!filename) {
    return res.status(400).json({ success: false, error: "No filename provided" });
  }
  
  // Try to find the file in various image directories
  const possiblePaths = [
    path.join(uploadsBasePath, "images", filename),
    path.join(uploadsBasePath, "photos", filename),
    path.join(uploadsBasePath, "profiles", filename),
    path.join(uploadsBasePath, "stories", filename)
  ];
  
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      // Set appropriate content type based on file extension
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.jpg' || ext === '.jpeg') {
        res.set('Content-Type', 'image/jpeg');
      } else if (ext === '.png') {
        res.set('Content-Type', 'image/png');
      } else if (ext === '.gif') {
        res.set('Content-Type', 'image/gif');
      } else if (ext === '.webp') {
        res.set('Content-Type', 'image/webp');
      } else if (ext === '.svg') {
        res.set('Content-Type', 'image/svg+xml');
      }
      
      logger.debug(`Serving image via diagnostic endpoint: ${filePath}`);
      return res.sendFile(filePath);
    }
  }
  
  // If file not found, return the default avatar
  logger.warn(`Image not found in diagnostic endpoint: ${filename}`);
  return res.sendFile(path.join(__dirname, "public", "default-avatar.png"));
});

// Special diagnostic endpoint for conversations
app.get("/api/diagnostic/conversations", (req, res) => {
  // Extract token from authorization header
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  
  logger.info('Diagnostic conversations endpoint called', { 
    hasToken: !!token,
    userAgent: req.headers['user-agent'] || 'unknown'
  });
  
  // Return mock conversations data for testing
  return res.status(200).json({
    success: true,
    message: "This is a diagnostic endpoint to test if conversations API is accessible",
    data: [
      {
        user: {
          _id: "diagnostic1",
          nickname: "Test User 1",
          photo: null,
          isOnline: true,
          lastActive: new Date()
        },
        lastMessage: {
          _id: "msg1",
          sender: "diagnostic1",
          recipient: "current-user",
          type: "text",
          content: "Hello, this is a test message from diagnostics",
          createdAt: new Date()
        },
        unreadCount: 1,
        updatedAt: new Date()
      }
    ]
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
