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
import mongoose from "mongoose"; // Added mongoose import for ObjectId check in debug route
import logger, { requestLogger, gracefulShutdown as loggerGracefulShutdown } from "./logger.js"; // Renamed import
import config from "./config.js";
import { connectDB, closeConnection } from "./db.js";
import routes from "./routes/index.js"; // Assuming this imports the router from routes/index.js
import { initSubscriptionTasks } from "./cron/subscriptionTasks.js";
import { configureCors, corsErrorHandler } from "./middleware/cors.js";
import { protect } from "./middleware/auth.js"; // Import protect for debug route

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

// --- PeerJS Server Setup ---
try {
    const peerServer = PeerServer({
      port: 9000,
      path: "/peerjs",
      proxied: true, // Important if behind a proxy like Nginx
      // Consider adding ssl options if using HTTPS
      // ssl: {
      //   key: fs.readFileSync('/path/to/your/private.key'),
      //   cert: fs.readFileSync('/path/to/your/certificate.crt')
      // }
    });

    peerServer.on("connection", (client) => {
      logger.info(`PeerJS Client connected: ${client.getId()}`); // Use getId() method
    });

    peerServer.on("disconnect", (client) => {
      logger.info(`PeerJS Client disconnected: ${client.getId()}`);
    });

    peerServer.on("error", (error) => {
        logger.error(`PeerJS Server error: ${error.message}`, { type: error.type });
    });


    logger.info("PeerJS server configured to run on port 9000, path /peerjs");

} catch(peerError) {
    logger.error(`Failed to initialize PeerJS server: ${peerError.message}`, {stack: peerError.stack});
    // Decide if this is critical - process.exit(1)?
}


// --- Core Express Middleware ---

// Apply security middleware - Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // WARNING: Disable CSP - review and configure properly for production
    crossOriginEmbedderPolicy: false, // Might be needed depending on resource loading
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resource loading
  })
);

// Enable compression for responses
app.use(
  compression({
    level: 6, // Default compression level
    threshold: 1024, // Compress responses larger than 1KB
    filter: (req, res) => {
      // Don't compress if header suggests not applicable
      if (req.headers["x-no-compression"]) {
        return false;
      }
      // Use default filter otherwise
      return compression.filter(req, res);
    },
  })
);

// Apply MongoDB data sanitization to prevent NoSQL injection
app.use(mongoSanitize());

// Body parser middleware for JSON and URL-encoded data
app.use(express.json({ limit: config.BODY_LIMIT || "10mb" })); // Use config or default
app.use(express.urlencoded({ extended: true, limit: config.BODY_LIMIT || "10mb" }));

// Cookie parser middleware
app.use(cookieParser());

// Enable CORS using the configured middleware
app.use(configureCors());
app.use(corsErrorHandler); // Handle CORS errors specifically

// Add additional emergency CORS headers for all routes in case the regular middleware fails
app.use((req, res, next) => {
  // For non-OPTIONS requests, add CORS headers
  if (req.method !== 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, x-no-cache, x-auth-token');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  next();
});

// Special handler for OPTIONS preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, x-no-cache, x-auth-token');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.sendStatus(204); // No content needed for OPTIONS response
});

// Request logging middleware (after CORS and parsing, before routes)
app.use(requestLogger);

// --- Static File Serving ---

// Set static folder for public assets (e.g., default avatars)
app.use(express.static(path.join(__dirname, "public")));

// Define uploads base path and ensure required subdirectories exist
const uploadsBasePath = path.resolve(process.cwd(), config.FILE_UPLOAD_PATH || "uploads"); // Use config or default
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
logger.info(`Uploads base directory configured at: ${uploadsBasePath}`);


// Serve static files from the uploads directory
app.use(
  "/uploads",
  // 1. Middleware to add CORS headers and check for path traversal/existence
  (req, res, next) => {
    // logger.debug(`Static file request for: ${req.path}`); // Can be noisy

    // Construct the full path safely
    const requestedPath = path.normalize(req.path).replace(/^(\.\.[\/\\])+/, ''); // Prevent traversal
    const fullPath = path.join(uploadsBasePath, requestedPath);

    // Double-check against directory traversal
    if (!fullPath.startsWith(uploadsBasePath)) {
      logger.warn(`Blocked potential path traversal attempt: ${req.path}`);
      // Return a generic 403 Forbidden or a default image
      return res.status(403).json({ success: false, error: "Access denied." });
      // Or: return res.status(403).sendFile(path.join(__dirname, "public", "default-avatar.png"));
    }

    // Apply essential CORS headers for static files
    res.set('Access-Control-Allow-Origin', '*'); // Adjust if needed for specific origins
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');

    // Handle OPTIONS preflight requests for static files
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
      return res.status(204).end();
    }

    // Check file existence before passing to express.static (optional optimization)
    fs.access(fullPath, fs.constants.R_OK, (err) => {
      if (err) {
        // logger.debug(`Static file not found or not readable: ${fullPath}`);
        // Optionally return default avatar for specific paths if file not found
        if (req.path.includes('/images/') || req.path.includes('/photos/') || req.path.includes('/profiles/')) {
          res.set('Cache-Control', 'public, max-age=3600'); // Cache default avatar for 1 hour
          return res.status(404).sendFile(path.join(__dirname, "public", "default-avatar.png"));
        }
        // For other missing files, let express.static handle the 404 or pass to next middleware
        return next();
      }
      // File exists and is readable, let express.static handle serving
      next();
    });
  },
  // 2. Express static middleware
  express.static(uploadsBasePath, {
    maxAge: config.STATIC_CACHE_MAX_AGE || "1d", // Cache duration (e.g., 1 day)
    etag: true, // Enable ETag generation
    lastModified: true, // Enable Last-Modified header
    index: false, // Disable directory indexing
    dotfiles: "ignore", // Ignore dotfiles
    fallthrough: true, // Pass to next middleware if file not found (handled above now)
    setHeaders: (res, filePath) => {
        // Already set CORS headers in middleware above
        // Set cache control based on file type
        if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            res.set('Cache-Control', `public, max-age=${config.IMAGE_CACHE_MAX_AGE || 86400}`); // Default 1 day for images
        } else if (filePath.match(/\.(mp4|webm|mov)$/i)) {
            res.set('Cache-Control', `public, max-age=${config.VIDEO_CACHE_MAX_AGE || 604800}`); // Default 7 days for videos
        } else {
            res.set('Cache-Control', `public, max-age=${config.OTHER_STATIC_CACHE_MAX_AGE || 3600}`); // Default 1 hour for others
        }
    }
  })
);

// --- Diagnostic Endpoints (Keep or remove based on environment) ---

// Enhanced diagnostic endpoint to check file existence
app.get("/api/check-file", (req, res) => {
  // Consider adding 'protect' middleware if this reveals sensitive info
  const filePath = req.query.path;
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ success: false, error: "Valid 'path' query parameter is required." });
  }

  // Basic sanitization
  const sanitizedPath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
  let fullPath = path.resolve(uploadsBasePath, sanitizedPath); // Resolve against uploads base

  // Prevent directory traversal out of uploads
  if (!fullPath.startsWith(uploadsBasePath)) {
    return res.status(403).json({ success: false, error: "Access denied: Invalid file path." });
  }

  fs.stat(fullPath, (err, stats) => {
    res.set('Access-Control-Allow-Origin', '*'); // CORS for this diagnostic route
    if (err) {
      return res.status(404).json({
        success: false,
        exists: false,
        error: `File not found or inaccessible: ${err.code || err.message}`,
        requestedPath: sanitizedPath,
        resolvedPath: fullPath,
      });
    }

    // File exists
    return res.json({
      success: true,
      exists: true,
      isDirectory: stats.isDirectory(),
      size: stats.size,
      lastModified: stats.mtime,
      created: stats.birthtime,
      requestedPath: sanitizedPath,
      resolvedPath: fullPath,
      // Construct a relative URL if possible
      relativeUrl: fullPath.startsWith(uploadsBasePath) ? `/uploads${fullPath.substring(uploadsBasePath.length).replace(/\\/g, '/')}` : null,
    });
  });
});

// Add a diagnostic image access endpoint (useful for CORS debugging)
app.get("/api/image-access/:filename", (req, res) => {
  // No 'protect' needed if images are public, add if needed
  const filename = req.params.filename;
  if (!filename || typeof filename !== 'string' || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ success: false, error: "Invalid filename format." });
  }

  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    return res.status(204).end();
  }

  // Set cache headers
  res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

  // Try to find the file in common image directories within uploads
  const possibleDirs = ["images", "photos", "profiles", "stories"];
  let foundPath = null;
  for (const dir of possibleDirs) {
    const testPath = path.join(uploadsBasePath, dir, filename);
    if (fs.existsSync(testPath)) {
      foundPath = testPath;
      break;
    }
  }

  if (foundPath) {
    logger.debug(`Serving image via diagnostic endpoint: ${foundPath}`);
    return res.sendFile(foundPath); // Express handles Content-Type based on extension
  } else {
    logger.warn(`Image not found via diagnostic endpoint: ${filename}`);
    // Return default avatar with 404 status
    return res.status(404).sendFile(path.join(__dirname, "public", "default-avatar.png"));
  }
});

// Special diagnostic endpoint for conversations (returns mock data)
app.get("/api/diagnostic/conversations", protect, (req, res) => { // Added protect
  logger.info(`Diagnostic conversations endpoint called by user ${req.user?._id}`);
  return res.status(200).json({
    success: true,
    message: "This is a diagnostic endpoint returning mock data.",
    data: [/* ... mock data from previous example ... */]
  });
});

// --- Request ID Middleware ---
app.use((req, res, next) => {
  // Simple request ID generator
  req.id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  res.setHeader('X-Request-ID', req.id); // Also send it back in header
  next();
});

// --- API Routes ---
const API_PREFIX = "/api";
// Mount the aggregated router from routes/index.js
app.use(API_PREFIX, routes);

// --- Catch-all for 404 API routes ---
app.use(API_PREFIX + '/*', (req, res) => {
    logger.warn(`API route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        error: `API endpoint not found: ${req.method} ${req.baseUrl}${req.path}`,
        code: "NOT_FOUND",
    });
});


// --- Global Error Handler ---
// IMPORTANT: Must be defined AFTER all other app.use() and routes calls
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;

  // Log the error with context
  logger.error(`Global error handler caught: ${err.message}`, {
    error: {
        message: err.message,
        stack: err.stack,
        code: err.code, // Include error code if available
        statusCode: statusCode,
    },
    request: {
        id: req.id, // Include request ID
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userId: req.user?._id || 'anonymous',
    }
  });

  // Avoid sending response if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  // Determine error message for client
  const clientErrorMessage =
    (process.env.NODE_ENV === "production" && statusCode === 500)
      ? "An unexpected internal server error occurred." // Generic message in prod for 500s
      : err.message || "An unexpected error occurred."; // More specific otherwise

  res.status(statusCode).json({
    success: false,
    error: clientErrorMessage,
    // Optionally include error code if present and safe to expose
    ...(err.code && !String(err.code).includes('INTERNAL') && { code: err.code }),
    // Only include stack trace in development environment
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// --- Fallback for non-API 404s (e.g., React Router handling) ---
// This should be placed after API routes and error handlers
// It assumes your client-side routing handles paths other than /api/* and static files
// If serving a Single Page App (SPA) like React:
if (process.env.NODE_ENV === 'production' || config.SERVE_CLIENT_BUILD) {
    const clientBuildPath = path.resolve(__dirname, '../client/dist'); // Adjust path to your client build directory
    if (fs.existsSync(clientBuildPath)) {
        logger.info(`Serving client build from: ${clientBuildPath}`);
        app.use(express.static(clientBuildPath));
        // Handle SPA routing: send index.html for any non-API, non-file request
        app.get('*', (req, res) => {
            // Avoid sending index.html for API-like paths that weren't caught earlier
            if (req.originalUrl.startsWith(API_PREFIX)) {
                return res.status(404).json({ success: false, error: "API endpoint not found." });
            }
            res.sendFile(path.resolve(clientBuildPath, 'index.html'));
        });
    } else {
         logger.warn(`Client build directory not found at ${clientBuildPath}. SPA fallback routing disabled.`);
         // Fallback 404 for any other route
         app.use((req, res) => {
            res.status(404).json({ success: false, error: "Resource not found." });
         });
    }
} else {
    // Development fallback 404
    app.use((req, res) => {
        logger.warn(`Route not found (dev): ${req.method} ${req.originalUrl}`);
        res.status(404).json({ success: false, error: "Resource not found (dev)." });
    });
}


// --- Initialize Application ---
const initializeApp = async () => {
  try {
    // Connect to Database
    await connectDB();

    // Start HTTP Server
    const PORT = process.env.PORT || config.PORT || 5000;
    server.listen(PORT, async () => {
      logger.info(`Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);

      // Initialize Socket.IO (after server is listening)
      try {
        // Dynamically import to potentially avoid issues if socket server is optional
        const { default: initSocketServer } = await import("./socket/index.js");
        const io = await initSocketServer(server); // Pass the HTTP server instance
        app.set("io", io); // Make io accessible in request handlers if needed (e.g., req.app.get('io'))
        logger.info("Socket.IO server initialized and attached successfully");
      } catch (socketErr) {
        logger.error(`Failed to initialize Socket.IO: ${socketErr.message}`, { stack: socketErr.stack });
        // Decide if this is critical - maybe server can run without sockets?
      }

      // Initialize Cron Jobs (if any)
      if (config.ENABLE_CRON_JOBS) {
          initSubscriptionTasks();
          logger.info("Subscription cron tasks initialized.");
      } else {
           logger.info("Cron jobs disabled via config.");
      }


      logger.info("Server initialization complete.");
    });
  } catch (err) {
    logger.error(`Server initialization failed: ${err.message}`, { stack: err.stack });
    process.exit(1); // Exit if essential initialization fails (like DB connection)
  }
};

// --- Graceful Shutdown Handler --- (Using the updated version)
const shutdownHandler = async (signal) => {
  logger.info(`${signal} signal received: Starting graceful shutdown`);

  // Close HTTP server first - prevents new requests
  server.close(async () => {
    logger.info("HTTP server closed"); // Log after server is closed

    try {
      // Close other resources like DB connection
      await closeConnection(); // Assuming this returns a promise or is async
      logger.info("MongoDB connection closed successfully"); // Log after DB connection closed

      // --- Log final messages BEFORE shutting down the logger ---
      logger.info("All primary connections closed gracefully. Shutting down logger...");

      // --- Call logger shutdown LAST ---
      await loggerGracefulShutdown(); // Wait for logger transports to close
      console.log("Logger shutdown complete. Exiting."); // Use console.log as logger might be closed
      process.exit(0); // Exit cleanly

    } catch (err) {
      // Log error during shutdown using console.error as logger might be closing/closed
      console.error(`Error during shutdown sequence: ${err.message}`);
      // Attempt logger shutdown even on error, then exit
      try {
        await loggerGracefulShutdown();
      } catch (logErr) {
        console.error(`Error shutting down logger: ${logErr.message}`);
      }
      process.exit(1); // Exit with error code
    }
  });

  // Force shutdown after a timeout if graceful shutdown hangs
  setTimeout(() => {
    logger.error("Graceful shutdown timed out. Forcing exit."); // This log might fail if logger is already closing
    console.error("Graceful shutdown timed out. Forcing exit."); // Fallback to console
    process.exit(1);
  }, 15000); // Reduced timeout to 15 seconds
};


// --- Process Event Listeners ---

// Register signal handlers for graceful shutdown
process.on("SIGTERM", () => shutdownHandler("SIGTERM"));
process.on("SIGINT", () => shutdownHandler("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error(`UNCAUGHT EXCEPTION: ${err.message}`, err.stack);
  try {
     logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  } catch (logErr) {
     console.error("Failed to log uncaught exception with Winston:", logErr);
  }
  // Important: According to Node.js docs, after an uncaught exception,
  // the process is in an undefined state and should be terminated.
  // Attempt graceful shutdown, but expect it might not fully complete.
  shutdownHandler("uncaughtException");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
    // Log the error using console first
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Try logging with Winston
    try {
        // If reason is an error object, log its stack
        const logReason = (reason instanceof Error) ? { message: reason.message, stack: reason.stack } : reason;
        logger.error(`Unhandled Rejection: ${logReason.message || 'No message'}`, { reason: logReason });
    } catch(logErr) {
        console.error("Failed to log unhandled rejection with Winston:", logErr);
    }

    // Optional: Consider exiting the process for unhandled rejections,
    // as they can leave the application in an unknown state.
    // However, Node's default behavior is changing, so maybe just log for now.
    // shutdownHandler('unhandledRejection'); // Or potentially just log and continue
});


// --- Start the Application ---
initializeApp();

// Export app and server (useful for testing or potential clustering)
export { app, server };
