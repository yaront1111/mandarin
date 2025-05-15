// server/socket/enhanced/index.js
// Enhanced Socket.IO server implementation with improved reliability

import { Server } from "socket.io";
import mongoose from "mongoose";
import { User } from "../../models/index.js";
import logger from "../../logger.js";
import config from "../../config.js";
import { socketAuthMiddleware } from "../auth.js";
import { EnhancedMessagingService } from "./messaging.js";
import SocketMonitor from "./monitoring.js";
import backoffLimiters from "./backoff.js";
import MemoryManager from "./memory-manager.js";

// Create a logger instance for the socket server
const log = {
  info: (...args) => console.log("[socket:enhanced]", ...args),
  error: (...args) => console.error("[socket:enhanced]", ...args),
  warn: (...args) => console.warn("[socket:enhanced]", ...args),
  debug: (...args) => console.debug("[socket:enhanced]", ...args)
};

// Dynamic import Redis adapter if Redis is configured
async function loadRedisAdapter() {
  if (process.env.REDIS_URL) {
    try {
      const { createAdapter } = await import("@socket.io/redis-adapter");
      const { createClient } = await import("redis");
      log.info("Redis adapter modules loaded successfully");
      return { createAdapter, createClient };
    } catch (err) {
      log.error(`Failed to load Redis adapter: ${err.message}`);
      return null;
    }
  }
  return null;
}

/**
 * Initialize Socket.IO server with all enhanced features
 * @param {Object} server HTTP server instance
 * @returns {Object} Socket.IO server instance with enhanced features
 */
const initEnhancedSocketServer = async (server) => {
  const isDev = process.env.NODE_ENV !== "production";
  
  log.info(`Initializing enhanced Socket.IO server in ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
  
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

  // Initialize Redis for socket.io if configured
  const redisAdapter = await loadRedisAdapter();
  let pubClient, subClient;
  
  if (redisAdapter && process.env.REDIS_URL) {
    try {
      pubClient = redisAdapter.createClient({ 
        url: process.env.REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            // Exponential backoff: min 1s, max 30s
            return Math.min(retries * 1000, 30000);
          }
        }
      });
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
  
  // Configure Socket.IO options with proper CORS and performance settings
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
        return callback(new Error(`Origin ${origin} not allowed`), false);
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
        "Cache-Control",
        "x-no-cache",
        "x-auth-token",
        "x-connection-type"
      ],
    },
    // Advanced transport configuration for better reliability
    transports: ["polling", "websocket"],
    upgradeTimeout: 15000,      // 15s to upgrade to websocket (for slower connections)
    pingTimeout: 30000,         // 30s ping timeout
    pingInterval: 15000,        // 15s ping interval (increased)
    connectTimeout: 30000,      // 30s connection timeout
    maxHttpBufferSize: 1e6,     // 1MB max buffer size
    httpCompression: true,      // Enable HTTP compression
    allowEIO3: true,            // Allow Engine.IO v3 clients for compatibility
    cookie: {
      name: "mandarin.sid",
      httpOnly: true,
      secure: !isDev,
      maxAge: 86400000          // 24 hours (for session tracking)
    }
  };
  
  // Add Redis adapter if available
  if (pubClient && subClient && redisAdapter) {
    ioOptions.adapter = redisAdapter.createAdapter(pubClient, subClient);
    log.info("Redis adapter configured for Socket.IO");
  } else {
    log.info("Using default in-memory adapter for Socket.IO");
  }
  
  log.info(`Creating Socket.IO server with transports: ${ioOptions.transports.join(", ")}`);
  const io = new Server(server, ioOptions);
  
  // Detailed logging about socket.io configuration
  log.info(`Socket.IO initialized with path: ${ioOptions.path || '/socket.io/'}`);
  log.info(`CORS configuration enabled with ${ioOptions.cors.methods.length} methods`);
  log.info(`Available transports: ${ioOptions.transports.join(', ')}`);
  log.info(`Performance settings: pingInterval=${ioOptions.pingInterval}ms, pingTimeout=${ioOptions.pingTimeout}ms`);
  
  // Create memory-managed user connections with automatic cleanup
  const connectionManager = new MemoryManager({
    maxAge: 30 * 60 * 1000,      // 30 minutes
    maxSize: 10000,              // 10k users max
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
    useWeakRefs: false           // Need enumeration for connections
  });
  
  // Create wrapper for backward compatibility
  const userConnections = {
    has: (key) => connectionManager.get(key) !== undefined,
    get: (key) => connectionManager.get(key),
    set: (key, value) => connectionManager.set(key, value),
    delete: (key) => connectionManager.delete(key),
    get size() { return connectionManager.data.size; },
    entries: () => connectionManager.data.entries(),
    keys: () => connectionManager.data.keys(),
    values: () => connectionManager.data.values()
  };
  
  // Create rate limiters
  const connectionLimiter = backoffLimiters.createConnectionLimiter();
  const messageLimiter = backoffLimiters.createMessageLimiter();
  const callLimiter = backoffLimiters.createCallLimiter();
  const typingLimiter = new backoffLimiters.ExponentialBackoffLimiter({
    initialDelay: 100,    // 100ms initial delay
    maxDelay: 2000,       // 2 second max delay
    factor: 1.5,          // 1.5x growth
    jitter: 0.1,          // 10% jitter
    maxAttempts: 30,      // 30 typing events before cooldown
    cooldownTime: 60000,  // 1 minute cooldown
    name: "typing"
  });
  
  // Initialize messaging service
  const messagingService = new EnhancedMessagingService(io, userConnections, {
    useMessageQueue: true,
    enableBatching: true
  });
  
  // Initialize socket monitoring
  const socketMonitor = new SocketMonitor(io, userConnections, {
    healthCheckInterval: 60000,        // 1 minute health check
    dbValidationInterval: 5 * 60000,   // 5 minute DB validation
    metricsInterval: 5 * 60000,        // 5 minute metrics collection
    cleanGhostConnections: true        // Automatically clean ghost connections
  });
  
  // Register authentication middleware for sockets
  io.use((socket, next) => {
    // Apply connection rate limiting by IP
    const ip = socket.handshake.address || '0.0.0.0';
    const result = connectionLimiter.recordAttempt(ip);
    
    if (result.limited) {
      log.warn(`Rate limit exceeded for IP ${ip}, backoff delay: ${result.delay}ms`);
      return next(new Error(`Too many connection attempts; please wait ${Math.ceil(result.delay/1000)} seconds`));
    }
    
    // Authentication middleware
    socketAuthMiddleware(socket, next);
  });
  
  // Enhanced connection error handling
  io.engine.on("connection_error", (err) => {
    // Detailed error logging with all available properties
    log.error(`Socket.IO connection error: ${err.code} - ${err.message} - ${err.context || "No context"}`);
    
    const req = err.req;
    if (req) {
      const ip = req.connection.remoteAddress;
      
      // Record connection error for rate limiting
      if (ip) {
        connectionLimiter.recordAttempt(ip);
      }
      
      log.debug(`Failed connection from: ${ip}, headers: ${JSON.stringify(req.headers || {})}`);
    }
  });
  
  // Enhanced header manipulation
  io.engine.on("headers", (headers, req) => {
    // Add debugging headers
    headers["X-Socket-Debug"] = "true";
    headers["X-Socket-Version"] = "enhanced";
    
    // Handle CORS headers correctly
    const origin = req.headers.origin;
    if (origin) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Credentials"] = "true";
    }
  });
  
  // Socket connection handler
  io.on("connection", (socket) => {
    log.info(`Socket connected: ${socket.id} (User: ${socket.user?._id || "unknown"})`);
    
    // Skip if no valid user
    if (!socket.user || !socket.user._id) {
      log.warn(`Socket ${socket.id} connected without valid user, disconnecting`);
      socket.disconnect(true);
      return;
    }
    
    const userIdStr = socket.user._id.toString();
    
    // Add to connection map with memory management
    if (!userConnections.has(userIdStr)) {
      connectionManager.set(userIdStr, new Set(), {
        references: [socket.id]
      });
    }
    const userSocketSet = userConnections.get(userIdStr);
    userSocketSet.add(socket.id);
    connectionManager.set(userIdStr, userSocketSet, {
      references: Array.from(userSocketSet)
    });
    socket.join(userIdStr); // Join room with user ID for direct messages
    
    // Register socket with monitor
    socketMonitor.registerSocket(socket, socket.user);
    
    // Register messaging handlers
    messagingService.registerHandlers(socket, {
      typingLimiter,
      messageLimiter,
      callLimiter
    });
    
    // Register other handlers
    registerAdditionalHandlers(socket, io, userConnections);
    
    // Register disconnect handler
    socket.on("disconnect", async (reason) => {
      log.info(`Socket ${socket.id} disconnected: ${reason}`);
      
      // Remove from connection map
      if (userConnections.has(userIdStr)) {
        const userSocketSet = userConnections.get(userIdStr);
        userSocketSet.delete(socket.id);
        
        // If no more connections, mark user as offline
        if (userSocketSet.size === 0) {
          // Use memory manager's event-based cleanup
          connectionManager.handleDisconnect(userIdStr, [socket.id]);
          
          try {
            await User.findByIdAndUpdate(userIdStr, {
              isOnline: false,
              lastActive: Date.now()
            });
            
            // Notify other users if privacy settings allow
            const user = await User.findById(userIdStr).select("settings.privacy");
            if (user?.settings?.privacy?.showOnlineStatus !== false) {
              io.emit("userOffline", { userId: userIdStr, timestamp: Date.now() });
            }
          } catch (err) {
            log.error(`Error updating offline status: ${err.message}`);
          }
        } else {
          // Update references for remaining sockets
          connectionManager.set(userIdStr, userSocketSet, {
            references: Array.from(userSocketSet)
          });
        }
      }
    });
    
    // Send welcome message with diagnostic info
    socket.emit("welcome", {
      userId: userIdStr,
      socketId: socket.id,
      timestamp: Date.now(),
      server: "enhanced",
      message: "Enhanced socket connection established",
      transport: socket.conn?.transport?.name || "unknown",
      features: {
        queueing: true,
        batching: true,
        monitoring: true
      }
    });
    
    // Notify other users if this user came online
    notifyUserPresence(io, userIdStr, "userOnline");
  });
  
  // Expose services on the io instance for external access
  io.enhancedServices = {
    messagingService,
    socketMonitor,
    connectionLimiter,
    messageLimiter,
    callLimiter,
    typingLimiter
  };
  
  // Set up periodic metrics logging
  setInterval(() => {
    const numSockets = io.sockets.sockets.size;
    const numUsers = userConnections.size;
    
    const queueStats = messagingService.getQueueStats();
    const healthStats = socketMonitor.healthStatus;
    
    log.info(`Socket metrics: ${numSockets} connections, ${numUsers} users, ${queueStats.totalQueued} queued messages`);
    
    // Log more detailed stats if there are issues
    if (healthStats.unhealthySockets > 0 || queueStats.totalQueued > 50) {
      log.warn(`Health concerns: ${healthStats.unhealthySockets} unhealthy sockets, ${healthStats.zombieConnections} zombies, ${queueStats.totalQueued} queued messages`);
    }
  }, 5 * 60 * 1000).unref(); // Every 5 minutes
  
  // Set up periodic memory statistics logging
  setInterval(() => {
    const memStats = connectionManager.getStats();
    log.info(`Memory stats: ${memStats.size} connections, ${memStats.memoryUsage} bytes heap`);
    
    // Also cleanup rate limiters if they grow too large
    if (connectionLimiter.cleanupStale) {
      connectionLimiter.cleanupStale();
    }
    if (messageLimiter.cleanupStale) {
      messageLimiter.cleanupStale();
    }
    if (callLimiter.cleanupStale) {
      callLimiter.cleanupStale();
    }
    if (typingLimiter.cleanupStale) {
      typingLimiter.cleanupStale();
    }
  }, 10 * 60 * 1000).unref(); // Every 10 minutes
  
  return io;
};

/**
 * Register additional socket handlers (calls, permissions, etc.)
 * @param {Object} socket Socket.IO socket
 * @param {Object} io Socket.IO server
 * @param {Map} userConnections User connections map
 */
function registerAdditionalHandlers(socket, io, userConnections) {
  // Register simplified event handlers for compatibility
  
  // Add a simple health check ping/pong
  socket.on("ping", () => {
    socket.emit("pong", { time: Date.now() });
  });
  
  // Add user privacy settings update handler
  socket.on("updatePrivacySettings", async (data) => {
    try {
      const userId = socket.user?._id;
      if (!userId) return;
      
      log.debug(`Privacy update request from ${userId}: ${JSON.stringify(data)}`);
      
      const user = await User.findById(userId);
      if (!user) return;
      
      // Apply privacy updates
      user.settings = user.settings || {};
      user.settings.privacy = user.settings.privacy || {};
      
      // Only update allowed fields
      const allowedFields = [
        "showOnlineStatus",
        "showReadReceipts",
        "showLastSeen",
        "allowStoryReplies"
      ];
      
      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          user.settings.privacy[field] = data[field];
        }
      });
      
      await user.save();
      
      // If they toggled online status visibility, update presence broadcasts
      if (data.showOnlineStatus === false) {
        notifyUserPresence(io, userId.toString(), "userOffline");
      } else if (data.showOnlineStatus === true) {
        notifyUserPresence(io, userId.toString(), "userOnline");
      }
    } catch (err) {
      log.error(`Error handling privacy settings update: ${err.message}`);
    }
  });
  
  // Note: Additional handlers for calls, permissions, etc. would be registered here
  // For now we'll leave this as a stub for expansion
}

/**
 * Notify other users about a user's presence change if allowed by privacy settings
 * @param {Object} io Socket.IO server
 * @param {string} userId User ID
 * @param {string} eventName Event name (userOnline/userOffline)
 */
async function notifyUserPresence(io, userId, eventName) {
  try {
    const user = await User.findById(userId).select("settings.privacy");
    
    // Check if user allows showing online status
    const showStatus = user?.settings?.privacy?.showOnlineStatus !== false;
    
    if (showStatus) {
      io.emit(eventName, { userId, timestamp: Date.now() });
      log.debug(`Broadcast ${eventName} for ${userId}`);
    } else {
      log.debug(`Privacy settings prevent ${eventName} broadcast for ${userId}`);
    }
  } catch (err) {
    log.error(`Error in presence notification: ${err.message}`);
  }
}

export default initEnhancedSocketServer;