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

  // Allow all origins for Socket.io in development or if DEBUG_SOCKET is true
  const debugSocket = process.env.DEBUG_SOCKET === 'true';
  const allowedOrigins = process.env.ALLOWED_ORIGINS === '*' || debugSocket || isDev
    ? '*'  // Allow all origins
    : process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : [process.env.FRONTEND_URL || "https://flirtss.com"];

  logger.info(`Socket.IO configured with allowed origins: ${JSON.stringify(allowedOrigins)}`);
  
  // Log additional debug info if DEBUG_SOCKET is true
  if (debugSocket) {
    logger.info('Socket Debug - Environment:', process.env.NODE_ENV);
    logger.info(`Socket Debug - ALLOWED_ORIGINS: ${process.env.ALLOWED_ORIGINS}`);
    logger.info(`Socket Debug - FRONTEND_URL: ${process.env.FRONTEND_URL}`);
  }

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

  // Configure Socket.IO with VERY permissive settings to diagnose issues
  // Use environment variable for path, fallback to "/socket.io"
  const socketPath = process.env.SOCKET_PATH || "/socket.io"; 
  
  // Log critical path information
  logger.info(`Socket.IO initializing with path: "${socketPath}" (from env: ${process.env.SOCKET_PATH ? 'yes' : 'no'})`);
  
  const ioOptions = {
    cors: {
      origin: "*", // Allow all origins
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: "*", // Allow all headers
    },
    transports: ["websocket", "polling"], // Prefer WebSocket first for better performance
    pingTimeout: 60000, // Longer ping timeout
    pingInterval: 25000, // More frequent pings
    connectTimeout: 45000, // Longer connect timeout
    maxHttpBufferSize: 5e6, // 5MB buffer
    path: socketPath, // CRITICAL: Use value from env, ensures consistent configuration
    serveClient: false, // Don't serve client files
    allowEIO3: true, // Allow Engine.IO v3
    cookie: false, // Don't use cookies
    perMessageDeflate: false, // Disable WebSocket compression for reliability
  };
  
  // Log IP address of the server to help with debugging connection issues
  try {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    const ipAddresses = [];
    
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          ipAddresses.push(net.address);
        }
      }
    }
    
    logger.info(`Server IP addresses: ${ipAddresses.join(', ')}`);
  } catch (err) {
    logger.error(`Error getting IP addresses: ${err.message}`);
  }
  
  logger.info(`Socket.IO configured with maximum compatibility options`);

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
