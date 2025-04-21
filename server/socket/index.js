import { Server } from "socket.io";
import { socketAuthMiddleware } from "./auth.js";
import { registerSocketHandlers } from "./handlers.js";
import { RateLimiterMemory } from "rate-limiter-flexible";
import logger from "../logger.js";
import { User } from "../models/index.js";
import config from "../config.js";

// Dynamically import Redis adapter and client if REDIS_URL is provided
let redisAdapter;
if (process.env.REDIS_URL) {
  try {
    const { createAdapter } = await import("@socket.io/redis-adapter");
    const { createClient } = await import("redis");
    redisAdapter = { createAdapter, createClient };
    logger.info("Redis adapter module loaded successfully");
  } catch (err) {
    logger.error(`Failed to load Redis adapter: ${err.message}`);
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
      logger.info(`Fixed ${updatedCount} users who were incorrectly marked as online`);
    }
  } catch (error) {
    logger.error(`Error validating online users: ${error.message}`);
  }
};

/**
 * Initialize Socket.IO server with all handlers and middleware
 * @param {Object} server - HTTP server instance
 * @returns {Object} - Socket.IO server instance
 */
const initSocketServer = async (server) => {
  const isDev = process.env.NODE_ENV !== "production";

  const allowedOrigins = isDev
    ? ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"]
    : process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : [process.env.FRONTEND_URL || "https://yourdomain.com"];

  logger.info(`Socket.IO configured with allowed origins: ${JSON.stringify(allowedOrigins)}`);

  // Initialize Redis clients if Redis is configured
  let pubClient, subClient;
  if (redisAdapter && process.env.REDIS_URL) {
    try {
      pubClient = redisAdapter.createClient({ url: process.env.REDIS_URL });
      subClient = pubClient.duplicate();

      await Promise.all([
        pubClient.connect().then(() => logger.info("Redis pub client connected")),
        subClient.connect().then(() => logger.info("Redis sub client connected")),
      ]);

      pubClient.on("error", (err) => logger.error(`Redis pub client error: ${err.message}`));
      subClient.on("error", (err) => logger.error(`Redis sub client error: ${err.message}`));

      logger.info("Redis clients initialized successfully");
    } catch (err) {
      logger.error(`Failed to initialize Redis clients: ${err.message}`);
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

  // Configure Socket.IO options
  const ioOptions = {
    cors: {
      origin: (origin, callback) => {
        // Log the origin for debugging
        logger.debug(`Socket connection request from origin: ${origin || 'no origin'}`);
        
        // In production, check against allowed origins
        if (process.env.NODE_ENV === 'production') {
          // If no origin (like for same-site requests), allow it
          if (!origin) {
            logger.debug("Socket connection with no origin allowed");
            return callback(null, true);
          }
          
          // If origin is in allowed list, allow it
          if (allowedOrigins.includes(origin)) {
            logger.debug(`Socket.IO CORS allowed for origin: ${origin}`);
            return callback(null, true);
          }
          
          // Special case: If using the main domain but with varying protocols/subdomains
          const mainDomain = 'flirtss.com';
          if (origin && origin.includes(mainDomain)) {
            logger.debug(`Socket.IO CORS allowed for ${mainDomain} subdomain: ${origin}`);
            return callback(null, true);
          }
          
          // Reject other origins
          logger.warn(`Socket.IO CORS rejected for origin: ${origin}`);
          return callback(new Error("Not allowed by CORS"), false);
        } else {
          // In development, allow all origins
          logger.debug("Development mode: allowing all origins");
          return callback(null, true);
        }
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    },
    transports: ["polling", "websocket"], // Try polling first for better reliability
    pingTimeout: 30000,     // Reduced ping timeout to match more common client defaults
    pingInterval: 15000,    // Ping more frequently for better connection monitoring
    connectTimeout: 30000,  // Reduced connect timeout
    maxHttpBufferSize: 1e6, // 1MB max buffer size
    path: "/socket.io",
    allowEIO3: true,        // Allow Engine.IO v3 clients for better compatibility
  };

  // Add Redis adapter if available
  if (pubClient && subClient && redisAdapter) {
    ioOptions.adapter = redisAdapter.createAdapter(pubClient, subClient);
    logger.info("Redis adapter configured for Socket.IO");
  } else {
    logger.info("Using default in-memory adapter for Socket.IO");
  }

  logger.info(`Creating Socket.IO server with path: ${ioOptions.path}, transports: ${ioOptions.transports.join(", ")}`);
  const io = new Server(server, ioOptions);

  // Enhanced connection logging with detailed error tracking
  io.engine.on("initial_headers", (headers, req) => {
    logger.debug(`Socket.IO initial headers: ${JSON.stringify(headers)}`);
  });
  
  io.engine.on("headers", (headers, req) => {
    logger.debug(`Socket.IO headers: ${JSON.stringify(headers)}`);
    
    // Add custom header to help debug client-side issues
    headers["X-Socket-Debug"] = "true";
    headers["Access-Control-Allow-Origin"] = "*"; // Ensure CORS headers are present
  });
  
  io.engine.on("connection_error", (err) => {
    // Extended error logging with all available properties
    logger.error(`Socket.IO connection error: ${err.code} - ${err.message} - ${err.context || "No context"}`);
    logger.error(`Error details: ${JSON.stringify({
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
      logger.error(`Failed connection attempt from: ${req.connection.remoteAddress}`);
      logger.error(`Request headers: ${JSON.stringify(req.headers || {})}`);
    }
  });

  // Set up rate limiters with higher thresholds to reduce connection issues
  const typingLimiter = new RateLimiterMemory({ points: 50, duration: 3, blockDuration: 1 });
  const messageLimiter = new RateLimiterMemory({ points: 100, duration: 10, blockDuration: 15 });
  const callLimiter = new RateLimiterMemory({ points: 30, duration: 60, blockDuration: 60 });
  const rateLimiters = { typingLimiter, messageLimiter, callLimiter };
  const userConnections = new Map();

  // Register authentication middleware for sockets
  logger.info("Registering Socket.IO authentication middleware");
  io.use((socket, next) => {
    logger.debug(`Socket auth middleware processing for socket: ${socket.id}`);
    socketAuthMiddleware(socket, next);
  });

  // Socket connection handler
  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.user?._id || "unknown"})`);

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
      logger.warn(`Socket ${socket.id} connected without valid user, disconnecting`);
      socket.disconnect(true);
    }
  });

  // Run the online user validation immediately at server startup
  logger.info("Running initial online status validation...");
  await validateOnlineUsers(io, userConnections);

  // Periodic cleanup for inactive connections
  setInterval(() => {
    const now = Date.now();
    for (const [userId, socketIds] of userConnections.entries()) {
      User.findById(userId)
        .select("lastActive")
        .then((user) => {
          if (user && now - user.lastActive > 10 * 60 * 1000) {
            logger.warn(`User ${userId} has inactive connections for >10 minutes, cleaning up`);
            for (const socketId of socketIds) {
              const socket = io.sockets.sockets.get(socketId);
              if (socket) {
                socket.disconnect(true);
              }
            }
            userConnections.delete(userId);
            User.findByIdAndUpdate(userId, { isOnline: false, lastActive: now }).catch((err) =>
              logger.error(`Error updating inactive user status: ${err.message}`)
            );
            io.emit("userOffline", { userId, timestamp: now });
          }
        })
        .catch((err) => logger.error(`Error during cleanup for user ${userId}: ${err.message}`));
    }
  }, 5 * 60 * 1000);

  // Periodic validation of online status (every 15 minutes)
  setInterval(() => {
    logger.info("Running periodic online status validation...");
    validateOnlineUsers(io, userConnections);
  }, 15 * 60 * 1000); // Every 15 minutes

  return io;
};

// Export the initSocketServer function as default
export default initSocketServer;
export { registerSocketHandlers };
