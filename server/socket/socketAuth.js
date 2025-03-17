// server/socket/socketAuth.js
const jwt = require("jsonwebtoken")
const { User } = require("../models")
const logger = require("../logger")
const config = require("../config")

// Improved in-memory rate limiter for sockets
const ipLimiter = {
  // Map to store connection attempts by IP
  attempts: new Map(),
  // Maximum number of attempts per 15 minutes
  maxAttempts: 100,
  // Window size in milliseconds (15 minutes)
  windowMs: 15 * 60 * 1000,
  // Last time the cleanup ran
  lastCleanup: Date.now(),
  // Cleanup interval (5 minutes)
  cleanupInterval: 5 * 60 * 1000,

  // Check if an IP is rate limited
  isLimited(ip) {
    // Run cleanup periodically instead of on every call
    this._conditionalCleanup();

    // Get attempts for this IP
    const ipData = this.attempts.get(ip) || {
      count: 0,
      resetTime: Date.now() + this.windowMs
    };

    // Update attempt count
    ipData.count++;
    this.attempts.set(ip, ipData);

    // Return true if rate limited
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
      logger.debug(`Rate limiter cleanup: removed ${cleanedEntries} expired entries. Current size: ${this.attempts.size}`);
    }
  }
};

// Add a scheduled cleanup independent of incoming requests
setInterval(() => {
  ipLimiter.cleanup();
}, ipLimiter.cleanupInterval);

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

    // Verify token with improved error handling
    try {
      // Use the JWT_SECRET from config
      const jwtSecret = config.JWT_SECRET || process.env.JWT_SECRET;

      if (!jwtSecret) {
        logger.error("Missing JWT_SECRET in configuration");
        return next(new Error("Server authentication configuration error"));
      }

      // Log token format without exposing full contents
      logger.debug(`Verifying socket token: ${token.substring(0, 10)}...`);

      const decoded = jwt.verify(token, jwtSecret);
      logger.debug(`Token verified successfully for socket ${socket.id}`);

      if (!decoded || !decoded.id) {
        logger.warn(`Socket ${socket.id} provided invalid token format`);
        return next(new Error("Invalid authentication token format"));
      }

      // Find user - do NOT filter by active field so we can catch inactive users
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
      // Store socket ID with user for potential presence checks
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
      // Provide more descriptive error based on type
      if (jwtError.name === 'TokenExpiredError') {
        logger.error(`Socket ${socket.id} JWT expired: ${jwtError.message}`);
        return next(new Error("Authentication token has expired"));
      } else if (jwtError.name === 'JsonWebTokenError') {
        logger.error(`Socket ${socket.id} JWT invalid: ${jwtError.message}`);
        return next(new Error("Invalid authentication token"));
      } else {
        logger.error(`Socket ${socket.id} JWT verification error: ${jwtError.message}`);
        return next(new Error("Authentication token verification failed"));
      }
    }
  } catch (error) {
    logger.error(`Socket auth error: ${error.message}`);
    return next(new Error("Authentication error"));
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
        logger.warn(`User ${socket.user._id} has been inactive for >10 minutes, disconnecting socket`);
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
  checkSocketPermission,
  setupSocketMonitoring,
  trackSocketActivity
};
