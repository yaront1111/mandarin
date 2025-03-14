// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const config = require('../config');
const logger = require('../logger');
const mongoose = require('mongoose');

// Cache for recently verified users to reduce DB lookups
const userCache = new Map();
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-memory token blacklist (for production, use Redis)
const tokenBlacklist = new Set();

/**
 * Clean expired entries from cache periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of userCache.entries()) {
    if (now > entry.expires) {
      userCache.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * Authentication middleware to protect routes
 * This middleware verifies the JWT token and attaches the user to the request
 */
exports.protect = async (req, res, next) => {
  let token;

  // Helper function to sanitize headers for logging
  const sanitizeHeaders = (headers) => {
    const sanitized = { ...headers };
    if (sanitized.authorization) {
      sanitized.authorization = sanitized.authorization.substring(0, 15) + '...';
    }
    if (sanitized.cookie) {
      sanitized.cookie = '[REDACTED]';
    }
    return sanitized;
  };

  // Log sanitized headers for debugging only in development
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`Auth request headers: ${JSON.stringify(sanitizeHeaders(req.headers))}`);
  }

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Token extracted from Authorization header: ${token ? token.substring(0, 15) + '...' : 'undefined'}`);
    }
  }
  // Alternative check for token in cookies if using credentials
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Token extracted from cookies: ${token.substring(0, 15)}...`);
    }
  }

  if (!token) {
    logger.warn(`Authentication failed: No token provided (IP: ${req.ip})`);
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_TOKEN'
    });
  }

  try {
    // First, check if the token is blacklisted
    if (tokenBlacklist.has(token)) {
      logger.warn(`Authentication failed: Token blacklisted (IP: ${req.ip})`);
      return res.status(401).json({
        success: false,
        error: 'Invalid or revoked token',
        code: 'TOKEN_BLACKLISTED'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ['HS256'] // Explicitly specify allowed algorithms
    });

    // Verify decoded token has required fields
    if (!decoded || !decoded.id) {
      logger.warn(`Authentication failed: Invalid token payload (IP: ${req.ip})`);
      return res.status(401).json({
        success: false,
        error: 'Invalid token format',
        code: 'INVALID_TOKEN'
      });
    }

    // Validate user ID format
    if (!mongoose.Types.ObjectId.isValid(decoded.id)) {
      logger.warn(`Authentication failed: Invalid user ID format in token (IP: ${req.ip})`);
      return res.status(401).json({
        success: false,
        error: 'Invalid token data',
        code: 'INVALID_USER_ID'
      });
    }

    // Check if user is in cache to avoid DB lookup
    const cacheKey = decoded.id;
    const cachedUser = userCache.get(cacheKey);
    let user;

    if (cachedUser && Date.now() < cachedUser.expires) {
      // Use cached user data
      user = cachedUser.data;
      logger.debug(`Using cached user for ID: ${decoded.id}`);

      // Update lastActive in the background without awaiting
      const activeThreshold = 5 * 60 * 1000; // 5 minutes
      if (Date.now() - user.lastActive > activeThreshold) {
        User.findByIdAndUpdate(
          user._id,
          { lastActive: Date.now() },
          { new: false } // Don't need the updated document
        ).catch(err => {
          logger.error(`Background lastActive update failed: ${err.message}`);
        });
      }
    } else {
      // Get user from database
      user = await User.findById(decoded.id)
        .select('+accountStatus +role +permissions -__v');  // Custom selection

      if (!user) {
        logger.warn(`Authentication failed: User not found for ID ${decoded.id}`);
        return res.status(401).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Check if user account is active/suspended/etc
      if (user.accountStatus && user.accountStatus !== 'active') {
        logger.warn(`Authentication rejected: Account status ${user.accountStatus} for user ${decoded.id}`);
        return res.status(403).json({
          success: false,
          error: `Your account is ${user.accountStatus}. Please contact support.`,
          code: 'ACCOUNT_' + user.accountStatus.toUpperCase()
        });
      }

      // Update lastActive timestamp
      // Update directly to avoid triggering middleware and hooks
      user.lastActive = Date.now();
      await User.updateOne({ _id: user._id }, { lastActive: user.lastActive });

      // Cache the user for future requests
      userCache.set(cacheKey, {
        data: user,
        expires: Date.now() + USER_CACHE_TTL
      });
    }

    // Attach user and token info to request object
    req.user = user;
    req.token = {
      raw: token,
      payload: decoded
    };

    next();
  } catch (err) {
    logger.error(`Token verification error: ${err.message}`);

    // Check for specific JWT errors and return appropriate responses
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Your session has expired. Please log in again.',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token',
        code: 'INVALID_TOKEN'
      });
    }

    if (err.name === 'NotBeforeError') {
      return res.status(401).json({
        success: false,
        error: 'Token not yet valid',
        code: 'TOKEN_NOT_ACTIVE'
      });
    }

    // For any other errors, return a generic error
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Role-based access control middleware
 * @param  {...string} roles - Roles allowed to access the route
 * @returns {Function} - Express middleware
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NO_USER'
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Access denied: User ${req.user._id} (role: ${req.user.role}) attempted to access route restricted to ${roles.join(', ')}`);
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to access this resource',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

/**
 * Blacklist a token (for logout or security purposes)
 * @param {string} token - JWT token to blacklist
 * @returns {boolean} - Success status
 */
exports.blacklistToken = (token) => {
  if (!token) return false;

  try {
    // Add to blacklist
    tokenBlacklist.add(token);

    // In production, you'd want this to persist and expire automatically (Redis)
    // For now, schedule removal based on token expiry
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = (decoded.exp - now) * 1000;

        // If token is already expired or expires soon, don't schedule removal
        if (timeUntilExpiry <= 0) {
          tokenBlacklist.delete(token);
          return true;
        }

        // Schedule removal when token expires
        setTimeout(() => {
          tokenBlacklist.delete(token);
          logger.debug(`Token removed from blacklist after expiry`);
        }, timeUntilExpiry);
      }
    } catch (err) {
      logger.error(`Error processing token for blacklist scheduling: ${err.message}`);
    }

    return true;
  } catch (err) {
    logger.error(`Failed to blacklist token: ${err.message}`);
    return false;
  }
};

/**
 * Helper to send token response with refresh token
 * @param {Object} user - User object
 * @param {number} statusCode - HTTP status code
 * @param {Object} res - Express response object
 * @param {boolean} includeRefresh - Whether to include refresh token
 */
exports.sendTokenResponse = (user, statusCode, res, includeRefresh = false) => {
  // Generate access token
  const token = user.getSignedJwtToken();

  // Remove sensitive fields
  const sanitizedUser = user.toObject();
  delete sanitizedUser.password;

  // Set secure cookie options
  const cookieOptions = {
    expires: new Date(Date.now() + config.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  };

  // Log token creation
  logger.debug(`Generated token for user ${user._id}`);

  // Build response
  const response = {
    success: true,
    token
  };

  // Include refresh token if requested
  if (includeRefresh) {
    const refreshToken = user.getRefreshToken();
    response.refreshToken = refreshToken;

    // Set refresh token in HTTP-only cookie for security
    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      expires: new Date(Date.now() + config.REFRESH_TOKEN_EXPIRE * 24 * 60 * 60 * 1000)
    });
  }

  // Set access token cookie
  res.cookie('token', token, cookieOptions);

  // Include user data in response
  response.data = sanitizedUser;

  res.status(statusCode).json(response);
};

/**
 * Middleware to check if user can access a specific resource
 * Useful for checking if a user can access a specific profile, message, etc.
 * @param {string} paramIdField - Request parameter name containing resource ID
 * @param {string} ownerField - Field in resource containing owner ID
 * @param {Function} getResource - Function to get resource from database
 * @returns {Function} - Express middleware
 */
exports.checkResourceAccess = (paramIdField, ownerField, getResource) => {
  return async (req, res, next) => {
    try {
      // Get resource ID from params
      const resourceId = req.params[paramIdField];
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          error: 'Resource ID required',
          code: 'MISSING_RESOURCE_ID'
        });
      }

      // Validate ID format
      if (!mongoose.Types.ObjectId.isValid(resourceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid resource ID format',
          code: 'INVALID_RESOURCE_ID'
        });
      }

      // Get resource
      const resource = await getResource(resourceId);
      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found',
          code: 'RESOURCE_NOT_FOUND'
        });
      }

      // Check if user is owner or admin
      const isOwner = (resource[ownerField] &&
        resource[ownerField].toString() === req.user._id.toString());
      const isAdmin = (req.user.role === 'admin');

      if (!isOwner && !isAdmin) {
        logger.warn(`Access denied: User ${req.user._id} attempted to access resource ${resourceId} owned by ${resource[ownerField]}`);
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to access this resource',
          code: 'RESOURCE_ACCESS_DENIED'
        });
      }

      // Attach resource to request
      req.resource = resource;
      next();
    } catch (err) {
      logger.error(`Resource access check error: ${err.message}`);
      return res.status(500).json({
        success: false,
        error: 'Server error checking resource access',
        code: 'SERVER_ERROR'
      });
    }
  };
};

/**
 * Helper to wrap async route handlers for consistent error handling
 * @param {Function} fn - Async route handler
 * @returns {Function} - Express middleware
 */
exports.asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(err => {
    logger.error(`Route handler error: ${err.message}`);

    // If headers already sent, pass to Express error handler
    if (res.headersSent) {
      return next(err);
    }

    // Handle specific known errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: err.message,
        errors: err.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Resource not found',
        code: 'INVALID_ID'
      });
    }

    if (err.code === 11000) {
      // Duplicate key error
      const field = Object.keys(err.keyValue)[0];
      return res.status(400).json({
        success: false,
        error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
        code: 'DUPLICATE_KEY'
      });
    }

    // Generic server error
    return res.status(500).json({
      success: false,
      error: 'Server error',
      code: 'SERVER_ERROR'
    });
  });
};
