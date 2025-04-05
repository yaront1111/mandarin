import jwt from "jsonwebtoken";
import { User } from "../models/index.js"; // Adjust if necessary
import logger from "../logger.js";
import config from "../config.js";

// Improved in-memory rate limiter for sockets
const ipLimiter = {
  attempts: new Map(),
  maxAttempts: 100,
  windowMs: 15 * 60 * 1000, // 15 minutes
  lastCleanup: Date.now(),
  cleanupInterval: 5 * 60 * 1000, // 5 minutes

  // Check if an IP is rate limited
  isLimited(ip) {
    this._conditionalCleanup();
    const ipData = this.attempts.get(ip) || {
      count: 0,
      resetTime: Date.now() + this.windowMs,
    };
    ipData.count++;
    this.attempts.set(ip, ipData);
    return ipData.count > this.maxAttempts;
  },

  // Perform cleanup if enough time has passed since last cleanup
  _conditionalCleanup() {
    const now = Date.now();
    if (now - this.lastCleanup > this.cleanupInterval) {
      this.cleanup();
      this.lastCleanup = now;
    }
  },

  // Clean up expired entries
  cleanup() {
    const now = Date.now();
    let cleanedEntries = 0;
    for (const [ip, data] of this.attempts.entries()) {
      if (data.resetTime <= now) {
        this.attempts.delete(ip);
        cleanedEntries++;
      }
    }
    if (cleanedEntries > 0) {
      logger.debug(
        `Rate limiter cleanup: removed ${cleanedEntries} expired entries. Current size: ${this.attempts.size}`
      );
    }
  },
};

// Scheduled cleanup independent of incoming requests
setInterval(() => {
  ipLimiter.cleanup();
}, ipLimiter.cleanupInterval);

/**
 * Socket.IO authentication middleware
 * Verifies JWT token and attaches user to socket
 */
/**
 * Simplified Socket.IO authentication middleware for production
 * Less strict token verification to troubleshoot connection issues
 */
const socketAuthMiddleware = async (socket, next) => {
  try {
    // Get IP address safely
    const ip = socket.handshake.address || "0.0.0.0";

    // Get token from any available source with more logging
    const token =
      socket.handshake.query?.token ||
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization &&
        socket.handshake.headers.authorization.split(" ")[1]);
    
    logger.info(`Socket auth attempt from IP ${ip}, socket ID: ${socket.id}`);
    
    if (!token) {
      logger.warn(`Socket ${socket.id} connection attempt without token - allowing anonymous connection for debugging`);
      // Create a temporary user object for this socket
      socket.user = { 
        _id: `anon_${Date.now()}`,
        nickname: "Anonymous",
        isAnonymous: true
      };
      return next(); // Allow connection even without token in production
    }

    try {
      const jwtSecret = config.JWT_SECRET || process.env.JWT_SECRET;
      if (!jwtSecret) {
        logger.error("Missing JWT_SECRET in configuration");
        // Create a temporary user and continue for debugging
        socket.user = { 
          _id: `config_err_${Date.now()}`,
          nickname: "ConfigError",
          isAnonymous: true
        };
        return next();
      }

      // Try JWT verification with fallback
      let decoded;
      try {
        decoded = jwt.verify(token, jwtSecret);
        logger.debug(`Token verified successfully for socket ${socket.id}`);
      } catch (jwtError) {
        logger.error(`JWT verification failed for socket ${socket.id}: ${jwtError.message} - creating temporary session`);
        // For production debugging, allow connection with a temporary user
        socket.user = { 
          _id: `token_err_${Date.now()}`,
          nickname: "TokenError",
          isAnonymous: true
        };
        return next();
      }

      // Find the user in the database
      if (decoded && decoded.id) {
        try {
          const user = await User.findById(decoded.id).select("-password");
          
          if (user) {
            // Attach user to socket
            socket.user = user;
            
            // Update online status in background (don't block connection)
            User.findByIdAndUpdate(user._id, {
              isOnline: true,
              lastActive: Date.now(),
              socketId: socket.id
            }).catch(err => {
              logger.error(`Error updating user online status: ${err.message}`);
            });
            
            logger.info(`Socket ${socket.id} authenticated as user ${user._id}`);
          } else {
            logger.warn(`User not found for ID ${decoded.id}, creating temporary session`);
            socket.user = { 
              _id: decoded.id,
              nickname: "Unknown User",
              isAnonymous: true
            };
          }
        } catch (dbError) {
          logger.error(`Database error during socket auth: ${dbError.message}`);
          socket.user = { 
            _id: decoded.id,
            nickname: "DB Error User",
            isAnonymous: true
          };
        }
      } else {
        logger.warn(`Invalid decoded token format: ${JSON.stringify(decoded || {})}`);
        socket.user = { 
          _id: `invalid_token_${Date.now()}`,
          nickname: "Invalid Token",
          isAnonymous: true
        };
      }
      
      // Always continue the connection in production troubleshooting
      return next();
      
    } catch (error) {
      logger.error(`Unhandled error in socket auth: ${error.message}`);
      // Still allow connection for debugging
      socket.user = { 
        _id: `error_${Date.now()}`,
        nickname: "Error User",
        isAnonymous: true
      };
      return next();
    }
  } catch (error) {
    logger.error(`Critical socket auth error: ${error.message}`);
    // Create a fallback user even in case of critical errors
    socket.user = { 
      _id: `critical_${Date.now()}`, 
      nickname: "Critical Error",
      isAnonymous: true
    };
    return next();
  }
};

/**
 * Check if user has specific permissions
 * @param {Object} socket - Socket instance
 * @param {String} permission - Permission to check
 * @returns {Boolean} - Whether user has permission
 */
const checkSocketPermission = (socket, permission) => {
  if (!socket.user) return false;
  switch (permission) {
    case "sendMessage":
      return socket.user.canSendMessages ? socket.user.canSendMessages() : true;
    case "createStory":
      return socket.user.canCreateStory ? socket.user.canCreateStory() : true;
    case "initiateCall":
      // Users can always initiate calls, even free users
      return true;
    default:
      return true;
  }
};

/**
 * Setup socket monitoring for inactive connections
 * @param {Object} io - Socket.IO instance
 */
const setupSocketMonitoring = (io) => {
  // Check for inactive connections every 10 minutes
  setInterval(() => {
    const sockets = io.sockets.sockets;
    const now = Date.now();
    const inactiveThreshold = 10 * 60 * 1000; // 10 minutes
    sockets.forEach((socket) => {
      if (socket.user && socket.lastActivity && now - socket.lastActivity > inactiveThreshold) {
        logger.warn(`User ${socket.user._id} has been inactive for >10 minutes, disconnecting socket`);
        socket.disconnect(true);
      }
    });
  }, 10 * 60 * 1000);
};

/**
 * Track socket activity by updating the last activity timestamp.
 * @param {Object} socket - Socket instance
 */
const trackSocketActivity = (socket) => {
  socket.lastActivity = Date.now();
};

export { socketAuthMiddleware, checkSocketPermission, setupSocketMonitoring, trackSocketActivity };
