import { Server } from "socket.io";
import { socketAuthMiddleware } from "./auth.js";
import { registerSocketHandlers } from "./handlers.js";
import { RateLimiterMemory } from "rate-limiter-flexible";
import logger from "../logger.js";
import { User } from "../models/index.js";
import config from "../config.js";

// Simple logger fallback if logger doesn't have create method
const log = {
  info: (...args) => console.log("[socket:main]", ...args),
  error: (...args) => console.error("[socket:main]", ...args),
  warn: (...args) => console.warn("[socket:main]", ...args),
  debug: (...args) => console.debug("[socket:main]", ...args)
};

// Dynamically import Redis adapter and client if REDIS_URL is provided
let redisAdapter;
if (process.env.REDIS_URL) {
  try {
    const { createAdapter } = await import("@socket.io/redis-adapter");
    const { createClient } = await import("redis");
    redisAdapter = { createAdapter, createClient };
    log.info("Redis adapter module loaded successfully");
  } catch (err) {
    log.error(`Failed to load Redis adapter: ${err.message}`);
    redisAdapter = null;
  }
}

/**
 * Validates users who are marked as online but have no active connections
 * @param {Object} io - Socket.IO server instance
 * @param {Map} userConnections - Map of user connections
 */
const validateOnlineUsers = async (io, userConnections) => {
  try {
    // Find all users currently marked as online in database
    const onlineUsers = await User.find({ isOnline: true }).select('_id lastActive');

    let updatedCount = 0;
    const now = Date.now();

    // Check each online user
    for (const user of onlineUsers) {
      const userId = user._id.toString();

      // If user has no socket connections OR hasn't been active recently
      if (!userConnections.has(userId) || (now - user.lastActive > 10 * 60 * 1000)) {
        // Update them to offline
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastActive: now
        });

        // Notify other users
        io.emit("userOffline", { userId, timestamp: now });
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      log.info(`Fixed ${updatedCount} users who were incorrectly marked as online`);
    }
  } catch (error) {
    log.error(`Error validating online users: ${error.message}`);
  }
};

/**
 * Initialize Socket.IO server with all handlers and middleware
 * @param {Object} server - HTTP server instance
 * @returns {Object} - Socket.IO server instance
 */
const initSocketServer = async (server) => {
  const isDev = process.env.NODE_ENV !== "production";

  // Define allowed origins based on environment
  const devOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ];

  const prodOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : [process.env.FRONTEND_URL || "https://flirtss.com"];

  // Always include the main production domains
  prodOrigins.push("https://flirtss.com");
  prodOrigins.push("https://www.flirtss.com");

  // Use different origins based on environment
  const allowedOrigins = isDev
    ? [...devOrigins, ...prodOrigins]  // In dev, allow both dev and prod origins
    : prodOrigins;                     // In prod, only allow prod origins

  log.info(`Socket.IO configured with allowed origins: ${JSON.stringify(allowedOrigins)}`);

  // Initialize Redis clients if Redis is configured
  let pubClient, subClient;
  if (redisAdapter && process.env.REDIS_URL) {
    try {
      pubClient = redisAdapter.createClient({ url: process.env.REDIS_URL });
      subClient = pubClient.duplicate();

      await Promise.all([
        pubClient.connect().then(() => log.info("Redis pub client connected")),
        subClient.connect().then(() => log.info("Redis sub client connected")),
      ]);

      pubClient.on("error", (err) => log.error(`Redis pub client error: ${err.message}`));
      subClient.on("error", (err) => log.error(`Redis sub client error: ${err.message}`));

      log.info("Redis clients initialized successfully");
    } catch (err) {
      log.error(`Failed to initialize Redis clients: ${err.message}`);
      if (pubClient) {
        try {
          await pubClient.quit();
        } catch (e) { /* ignore */ }
      }
      if (subClient) {
        try {
          await subClient.quit();
        } catch (e) { /* ignore */ }
      }
      pubClient = subClient = null;
    }
  }

  // Configure Socket.IO options with proper CORS handling
  const ioOptions = {
    cors: {
      origin: (origin, callback) => {
        // Log the origin for debugging
        log.debug(`Socket connection request from origin: ${origin || 'no origin'}`);

        // Allow requests with no origin (like mobile apps, curl, etc.)
        if (!origin) {
          return callback(null, true);
        }

        // Check if origin is in our allowed list
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // Special case for subdomains of main domain
        const mainDomain = 'flirtss.com';
        if (origin && origin.includes(mainDomain)) {
          log.debug(`Allowing ${mainDomain} subdomain: ${origin}`);
          return callback(null, true);
        }

        // In development, we can be more permissive
        if (isDev) {
          log.debug(`Allowing origin in dev mode: ${origin}`);
          return callback(null, true);
        }

        // Log rejected origins
        log.warn(`Rejecting socket connection from origin: ${origin}`);
        return callback(null, true); // Allow for now while troubleshooting
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Cache-Control",
        "x-no-cache",
        "x-auth-token",
        "x-connection-type"  // Add this to fix the CORS error
      ],
    },
    transports: ["polling", "websocket"], // Try polling first for better reliability
    pingTimeout: 30000,     // Reduced ping timeout to match more common client defaults
    pingInterval: 15000,    // Ping more frequently for better connection monitoring
    connectTimeout: 30000,  // Reduced connect timeout
    maxHttpBufferSize: 1e6, // 1MB max buffer size
    allowEIO3: true,        // Allow Engine.IO v3 clients for better compatibility
  };

  // Add Redis adapter if available
  if (pubClient && subClient && redisAdapter) {
    ioOptions.adapter = redisAdapter.createAdapter(pubClient, subClient);
    log.info("Redis adapter configured for Socket.IO");
  } else {
    log.info("Using default in-memory adapter for Socket.IO");
  }

  log.info(`Creating Socket.IO server with transports: ${ioOptions.transports.join(", ")}`);
  log.info(`Socket.IO will be accessible at ${process.env.NODE_ENV === 'production' ? 'https://flirtss.com' : 'http://localhost:5000'}/socket.io/`);
  const io = new Server(server, ioOptions);
  
  // Log initialization status
  log.info(`Socket.IO initialized with path: ${ioOptions.path || '/socket.io/'}`);
  log.info(`CORS configuration: ${JSON.stringify(ioOptions.cors || 'No CORS config')}`);
  log.info(`Available transports: ${ioOptions.transports?.join(', ') || 'Default transports'}`);
  
  // Set up a simple health check for Socket.IO
  io.on("connection", (socket) => {
    // Add a simple health check ping/pong
    socket.on("ping", () => {
      socket.emit("pong", { time: Date.now() });
    });
  });

  // Enhanced connection logging with detailed error tracking
  io.engine.on("initial_headers", (headers, req) => {
    log.debug(`Socket.IO initial headers: ${JSON.stringify(headers)}`);
  });

  io.engine.on("headers", (headers, req) => {
    log.debug(`Socket.IO headers: ${JSON.stringify(headers)}`);

    // Add custom header to help debug client-side issues
    headers["X-Socket-Debug"] = "true";

    // Handle CORS headers correctly - don't use wildcard with credentials
    const origin = req.headers.origin;
    if (origin) {
      // Use the specific origin instead of wildcard when credentials are used
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Credentials"] = "true";
    }
  });

  io.engine.on("connection_error", (err) => {
    // Extended error logging with all available properties
    log.error(`Socket.IO connection error: ${err.code} - ${err.message} - ${err.context || "No context"}`);
    log.error(`Error details: ${JSON.stringify({
      code: err.code,
      message: err.message,
      context: err.context,
      type: err.type,
      stack: err.stack,
      time: new Date().toISOString()
    })}`);

    // Log connection attempt details when errors occur
    const req = err.req;
    if (req) {
      log.error(`Failed connection attempt from: ${req.connection.remoteAddress}`);
      log.error(`Request headers: ${JSON.stringify(req.headers || {})}`);
    }
  });

  // Set up rate limiters with higher thresholds to reduce connection issues
  const typingLimiter = new RateLimiterMemory({ points: 50, duration: 3, blockDuration: 1 });
  const messageLimiter = new RateLimiterMemory({ points: 100, duration: 10, blockDuration: 15 });
  const callLimiter = new RateLimiterMemory({ points: 30, duration: 60, blockDuration: 60 });
  const rateLimiters = { typingLimiter, messageLimiter, callLimiter };
  const userConnections = new Map();

  // Register authentication middleware for sockets
  log.info("Registering Socket.IO authentication middleware");
  io.use((socket, next) => {
    log.debug(`Socket auth middleware processing for socket: ${socket.id}`);
    socketAuthMiddleware(socket, next);
  });

  // Socket connection handler
  io.on("connection", (socket) => {
    log.info(`Socket connected: ${socket.id} (User: ${socket.user?._id || "unknown"})`);

    if (socket.user && socket.user._id) {
      const userIdStr = socket.user._id.toString();
      if (!userConnections.has(userIdStr)) {
        userConnections.set(userIdStr, new Set());
      }
      userConnections.get(userIdStr).add(socket.id);
      socket.join(userIdStr);

      // Register socket handlers
      registerSocketHandlers(io, socket, userConnections, rateLimiters);

      // Send a welcome event
      socket.emit("welcome", {
        userId: socket.user._id.toString(),
        timestamp: Date.now(),
        message: "Socket connection established successfully",
      });
    } else {
      log.warn(`Socket ${socket.id} connected without valid user, disconnecting`);
      socket.disconnect(true);
    }
  });

  // Run the online user validation immediately at server startup
  log.info("Running initial online status validation...");
  await validateOnlineUsers(io, userConnections);

  // Periodic cleanup for inactive connections
  setInterval(() => {
    const now = Date.now();
    for (const [userId, socketIds] of userConnections.entries()) {
      User.findById(userId)
        .select("lastActive")
        .then((user) => {
          if (user && now - user.lastActive > 10 * 60 * 1000) {
            log.warn(`User ${userId} has inactive connections for >10 minutes, cleaning up`);
            for (const socketId of socketIds) {
              const socket = io.sockets.sockets.get(socketId);
              if (socket) {
                socket.disconnect(true);
              }
            }
            userConnections.delete(userId);
            User.findByIdAndUpdate(userId, { isOnline: false, lastActive: now }).catch((err) =>
              log.error(`Error updating inactive user status: ${err.message}`)
            );
            io.emit("userOffline", { userId, timestamp: now });
          }
        })
        .catch((err) => log.error(`Error during cleanup for user ${userId}: ${err.message}`));
    }
  }, 5 * 60 * 1000);

  // Periodic validation of online status (every 15 minutes)
  setInterval(() => {
    log.info("Running periodic online status validation...");
    validateOnlineUsers(io, userConnections);
  }, 15 * 60 * 1000); // Every 15 minutes

  return io;
};

// Export the initSocketServer function as default
export default initSocketServer;
export { registerSocketHandlers };
