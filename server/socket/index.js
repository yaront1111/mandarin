import { Server } from "socket.io";
import { socketAuthMiddleware } from "./auth.js";
import { registerSocketHandlers } from "./handlers.js";
import { RateLimiterMemory } from "rate-limiter-flexible";
import logger from "../logger.js";
import { User } from "../models/index.js";

/**
 * Initialize Socket.IO server with minimal configuration for maximum compatibility
 * @param {Object} server - HTTP server instance
 * @returns {Object} - Socket.IO server instance
 */
const initSocketServer = async (server) => {
  // Log the initialization
  logger.info("Initializing Socket.IO server with minimal configuration");
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
  logger.info(`Allowed origins: ${process.env.ALLOWED_ORIGINS || "*"}`);
  
  // Create Socket.IO server with permissive CORS configuration to fix 502 Bad Gateway issues
  const io = new Server(server, {
    cors: {
      origin: "*", // Allow all origins
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      credentials: true, // Enable CORS credentials
      allowedHeaders: ["Content-Type", "Authorization", "x-auth-token", "x-no-cache", "Cache-Control"]
    },
    // Additional configuration
    transports: ['websocket', 'polling'], // Support both WebSocket and long-polling
    allowEIO3: true, // Allow Engine.IO v3 clients (broader browser support)
    path: '/socket.io', // Default path, ensures consistent URL
    pingTimeout: 60000, // 60 seconds
    pingInterval: 25000, // 25 seconds
    cookie: false // Disable socket.io cookie for better compatibility
  });
  
  // Basic rate limiters
  const rateLimiters = {
    typingLimiter: new RateLimiterMemory({ points: 50, duration: 3 }),
    messageLimiter: new RateLimiterMemory({ points: 100, duration: 10 }),
    callLimiter: new RateLimiterMemory({ points: 30, duration: 60 })
  };
  
  // User connections map
  const userConnections = new Map();
  
  // Authentication middleware
  io.use((socket, next) => {
    logger.debug(`Authentication for socket: ${socket.id}`);
    socketAuthMiddleware(socket, next);
  });
  
  // Connection handler
  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.user?._id || "unknown"})`);
    
    if (socket.user && socket.user._id) {
      const userIdStr = socket.user._id.toString();
      
      // Save to connections map
      if (!userConnections.has(userIdStr)) {
        userConnections.set(userIdStr, new Set());
      }
      userConnections.get(userIdStr).add(socket.id);
      socket.join(userIdStr);
      
      // Register handlers
      registerSocketHandlers(io, socket, userConnections, rateLimiters);
      
      // Welcome event
      socket.emit("welcome", {
        userId: userIdStr,
        timestamp: Date.now(),
        message: "Socket connection established successfully",
      });
      
      // Update user online status
      User.findByIdAndUpdate(userIdStr, {
        isOnline: true,
        lastActive: Date.now()
      }).catch(err => {
        logger.error(`Error updating user online status: ${err.message}`);
      });
    } else {
      logger.warn(`Socket ${socket.id} has no valid user, disconnecting`);
      socket.disconnect(true);
    }
  });
  
  // Logging socket.io server details
  logger.info(`Socket.IO server initialized successfully`);
  logger.info(`Socket.IO path: ${io.path()}`);
  
  return io;
};

export default initSocketServer;
export { registerSocketHandlers };