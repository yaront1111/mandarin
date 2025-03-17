// server/socket/socketAuth.js
const jwt = require("jsonwebtoken")
const { User } = require("../models")
const logger = require("../logger")

// Simple in-memory rate limiter for sockets
const ipLimiter = {
  // Map to store connection attempts by IP
  attempts: new Map(),
  // Maximum number of attempts per 15 minutes
  maxAttempts: 100,
  // Window size in milliseconds (15 minutes)
  windowMs: 15 * 60 * 1000,

  // Check if an IP is rate limited
  isLimited(ip) {
    // Clean up expired entries
    this.cleanup();

    // Get attempts for this IP
    const ipData = this.attempts.get(ip) || { count: 0, resetTime: Date.now() + this.windowMs };

    // Update attempt count
    ipData.count++;
    this.attempts.set(ip, ipData);

    // Return true if rate limited
    return ipData.count > this.maxAttempts;
  },

  // Clean up expired entries
  cleanup() {
    const now = Date.now();
    for (const [ip, data] of this.attempts.entries()) {
      if (data.resetTime <= now) {
        this.attempts.delete(ip);
      }
    }
  }
};

/**
 * Socket.IO authentication middleware
 * Verifies JWT token and attaches user to socket
 */
const socketAuthMiddleware = async (socket, next) => {
  try {
    // Get IP address safely
    const ip = socket.handshake.address || '0.0.0.0';

    // Check rate limiting
    if (ipLimiter.isLimited(ip)) {
      logger.warn(`Socket rate limit exceeded for IP: ${ip}`);
      return next(new Error("Too many connection attempts, please try again later"));
    }

    // Get token from handshake query, auth, or headers
    const token =
      socket.handshake.query?.token ||
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization &&
        socket.handshake.headers.authorization.split(" ")[1]);

    if (!token) {
      logger.warn(`Socket ${socket.id} connection attempt without token`);
      return next(new Error("Authentication token is required"));
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (!decoded || !decoded.id) {
        logger.warn(`Socket ${socket.id} provided invalid token`);
        return next(new Error("Invalid authentication token"));
      }

      // Find user - IMPORTANT: Do not filter by active field
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        logger.warn(`Socket ${socket.id} token has valid format but user not found: ${decoded.id}`);
        return next(new Error("User not found"));
      }

      // Check token version to handle revoked tokens
      if (decoded.version && user.version && decoded.version !== user.version) {
        logger.warn(`Socket ${socket.id} token is outdated for user ${user._id}`);
        return next(new Error("Token has been revoked. Please log in again."));
      }

      // Attach user to socket
      socket.user = user;

      // Store socket ID with user for efficient lookups
      user.socketId = socket.id;

      // Update user's online status
      await User.findByIdAndUpdate(user._id, {
        isOnline: true,
        lastActive: Date.now(),
        socketId: socket.id,
        lastLoginIp: ip // Store last IP for security monitoring
      });

      logger.info(`Socket ${socket.id} authenticated as user ${user._id}`);

      // Proceed with connection
      next();
    } catch (jwtError) {
      logger.error(`Socket ${socket.id} JWT verification error: ${jwtError.message}`);
      return next(new Error("Invalid authentication token"));
    }
  } catch (error) {
    logger.error(`Socket auth error: ${error.message}`);
    return next(new Error("Authentication error"));
  }
};

/**
 * Socket disconnect handler
 * Updates user's online status when socket disconnects
 */
const handleSocketDisconnect = async (socket) => {
  try {
    if (socket.user && socket.user._id) {
      logger.info(`Socket ${socket.id} disconnected: User ${socket.user._id}`);

      // Add a small delay to handle reconnects
      setTimeout(async () => {
        try {
          // Check if user has reconnected with a different socket
          const user = await User.findById(socket.user._id);

          if (!user) {
            logger.warn(`User ${socket.user._id} not found during disconnect cleanup`);
            return;
          }

          if (user.socketId === socket.id) {
            // Only update if this was the last active socket for this user
            await User.findByIdAndUpdate(socket.user._id, {
              isOnline: false,
              lastActive: Date.now(),
              socketId: null
            });
            logger.info(`User ${socket.user._id} is now offline (no active connections)`);
          } else {
            logger.info(`User ${socket.user._id} has another active connection: ${user.socketId}`);
          }
        } catch (err) {
          logger.error(`Error during disconnect cleanup for user ${socket.user._id}: ${err.message}`);
        }
      }, 5000); // 5 second delay
    }
  } catch (error) {
    logger.error(`Socket disconnect error: ${error.message}`);
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
    case 'sendMessage':
      return socket.user.canSendMessages ? socket.user.canSendMessages() : true;
    case 'createStory':
      return socket.user.canCreateStory ? socket.user.canCreateStory() : true;
    case 'initiateCall':
      // Users can always initiate calls, even free users
      return true;
    default:
      return true;
  }
};

/**
 * Setup socket monitoring for inactive connections
 * @param {Object} io - Socket.io instance
 */
const setupSocketMonitoring = (io) => {
  // Check for inactive connections every 10 minutes
  setInterval(() => {
    const sockets = io.sockets.sockets;
    const now = Date.now();
    const inactiveThreshold = 10 * 60 * 1000; // 10 minutes

    sockets.forEach(socket => {
      if (socket.user && socket.lastActivity && (now - socket.lastActivity) > inactiveThreshold) {
        logger.warn(`User ${socket.user._id} has inactive connection for >10 minutes, cleaning up`);
        socket.disconnect(true);
      }
    });
  }, 10 * 60 * 1000); // Run every 10 minutes
};

/**
 * Track socket activity
 * @param {Object} socket - Socket instance
 */
const trackSocketActivity = (socket) => {
  socket.lastActivity = Date.now();
};

module.exports = {
  socketAuthMiddleware,
  handleSocketDisconnect,
  checkSocketPermission,
  setupSocketMonitoring,
  trackSocketActivity
};
