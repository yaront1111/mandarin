// server/middleware/auth.js

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const config = require('../config');
const logger = require('../logger');
const mongoose = require('mongoose');

// Cache for recently verified users to reduce DB lookups
const userCache = new Map();
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-memory token blacklist (for production, consider using Redis)
const tokenBlacklist = new Set();

/**
 * Periodically cleans expired entries from the user cache.
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of userCache.entries()) {
    if (now > entry.expires) {
      userCache.delete(key);
    }
  }
}, 60000); // Every minute

/**
 * Extracts JWT token from request headers or cookies.
 * @param {object} req - Express request object.
 * @returns {string|null} The extracted token or null if not found.
 */
const extractToken = (req) => {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  return token;
};

/**
 * Sanitizes headers for logging purposes.
 * @param {object} headers - Request headers.
 * @returns {object} Sanitized headers.
 */
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

/**
 * Authentication middleware to protect routes.
 * Verifies the JWT token, checks token blacklist, caches user data,
 * and attaches the user to the request object.
 */
exports.protect = async (req, res, next) => {
  try {
    // Log headers in development mode for debugging
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Auth request headers: ${JSON.stringify(sanitizeHeaders(req.headers))}`);
    }

    const token = extractToken(req);
    if (!token) {
      logger.warn(`Authentication failed: No token provided (IP: ${req.ip})`);
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NO_TOKEN'
      });
    }

    // Check token blacklist
    if (tokenBlacklist.has(token)) {
      logger.warn(`Authentication failed: Token blacklisted (IP: ${req.ip})`);
      return res.status(401).json({
        success: false,
        error: 'Invalid or revoked token',
        code: 'TOKEN_BLACKLISTED'
      });
    }

    // Verify token using HS256 algorithm
    let decoded;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
    } catch (verifyErr) {
      logger.error(`Token verification error: ${verifyErr.message}`);
      if (verifyErr.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Your session has expired. Please log in again.',
          code: 'TOKEN_EXPIRED'
        });
      }
      if (verifyErr.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid authentication token',
          code: 'INVALID_TOKEN'
        });
      }
      if (verifyErr.name === 'NotBeforeError') {
        return res.status(401).json({
          success: false,
          error: 'Token not yet valid',
          code: 'TOKEN_NOT_ACTIVE'
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        code: 'AUTH_ERROR'
      });
    }

    // Validate decoded token payload
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

    const cacheKey = decoded.id;
    let user;
    const cachedEntry = userCache.get(cacheKey);

    if (cachedEntry && Date.now() < cachedEntry.expires) {
      user = cachedEntry.data;
      logger.debug(`Using cached user for ID: ${decoded.id}`);
      // Optionally update lastActive in the background if needed
      const activeThreshold = 5 * 60 * 1000; // 5 minutes
      if (Date.now() - user.lastActive > activeThreshold) {
        User.findByIdAndUpdate(user._id, { lastActive: Date.now() }, { new: false })
          .catch(err => logger.error(`Background lastActive update failed: ${err.message}`));
      }
    } else {
      // Retrieve user from DB and select necessary fields
      user = await User.findById(decoded.id)
        .select('email nickname details accountStatus role permissions lastActive')
        .lean();
      if (!user) {
        logger.warn(`Authentication failed: User not found for ID ${decoded.id}`);
        return res.status(401).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Check account status
      if (user.accountStatus && user.accountStatus !== 'active') {
        logger.warn(`Authentication rejected: Account status ${user.accountStatus} for user ${decoded.id}`);
        return res.status(403).json({
          success: false,
          error: `Your account is ${user.accountStatus}. Please contact support.`,
          code: 'ACCOUNT_' + user.accountStatus.toUpperCase()
        });
      }

      // Update lastActive timestamp
      user.lastActive = Date.now();
      await User.updateOne({ _id: user._id }, { lastActive: user.lastActive });

      // Cache user data
      userCache.set(cacheKey, {
        data: user,
        expires: Date.now() + USER_CACHE_TTL
      });
    }

    // Attach user and token information to the request
    req.user = user;
    req.token = { raw: token, payload: decoded };
    next();
  } catch (err) {
    logger.error(`Unexpected authentication error: ${err.message}`);
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Role-based access control middleware.
 * Allows only users with specified roles.
 * @param {...string} roles - Allowed roles.
 * @returns {Function} Express middleware.
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
      logger.warn(`Access denied: User ${req.user._id} (role: ${req.user.role}) attempted to access restricted route (${roles.join(', ')})`);
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
 * Blacklists a token (for logout or security purposes).
 * For production, consider using a centralized store like Redis.
 * @param {string} token - JWT token to blacklist.
 * @returns {boolean} Success status.
 */
exports.blacklistToken = (token) => {
  if (!token) return false;
  try {
    tokenBlacklist.add(token);
    // Schedule removal from blacklist when token expires
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = (decoded.exp - now) * 1000;
        if (timeUntilExpiry > 0) {
          setTimeout(() => {
            tokenBlacklist.delete(token);
            logger.debug(`Token removed from blacklist after expiry`);
          }, timeUntilExpiry);
        } else {
          tokenBlacklist.delete(token);
        }
      }
    } catch (innerErr) {
      logger.error(`Error processing token for blacklist scheduling: ${innerErr.message}`);
    }
    return true;
  } catch (err) {
    logger.error(`Failed to blacklist token: ${err.message}`);
    return false;
  }
};

/**
 * Sends a token response along with setting appropriate cookies.
 * @param {object} user - User object.
 * @param {number} statusCode - HTTP status code.
 * @param {object} res - Express response object.
 * @param {boolean} [includeRefresh=false] - Whether to include a refresh token.
 */
exports.sendTokenResponse = (user, statusCode, res, includeRefresh = false) => {
  const token = user.getSignedJwtToken();
  const sanitizedUser = user.toObject();
  delete sanitizedUser.password;

  const cookieOptions = {
    expires: new Date(Date.now() + config.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  };

  logger.debug(`Generated token for user ${user._id}`);
  const responsePayload = { success: true, token };

  if (includeRefresh) {
    const refreshToken = user.getRefreshToken();
    responsePayload.refreshToken = refreshToken;
    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      expires: new Date(Date.now() + config.REFRESH_TOKEN_EXPIRE * 24 * 60 * 60 * 1000)
    });
  }
  res.cookie('token', token, cookieOptions);
  responsePayload.data = sanitizedUser;
  res.status(statusCode).json(responsePayload);
};

/**
 * Middleware to check if a user has access to a specific resource.
 * @param {string} paramIdField - Request parameter name containing the resource ID.
 * @param {string} ownerField - Field in the resource representing the owner ID.
 * @param {Function} getResource - Function to retrieve the resource from the database.
 * @returns {Function} Express middleware.
 */
exports.checkResourceAccess = (paramIdField, ownerField, getResource) => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[paramIdField];
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          error: 'Resource ID required',
          code: 'MISSING_RESOURCE_ID'
        });
      }
      if (!mongoose.Types.ObjectId.isValid(resourceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid resource ID format',
          code: 'INVALID_RESOURCE_ID'
        });
      }
      const resource = await getResource(resourceId);
      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found',
          code: 'RESOURCE_NOT_FOUND'
        });
      }
      const isOwner = resource[ownerField] && resource[ownerField].toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'admin';
      if (!isOwner && !isAdmin) {
        logger.warn(`Access denied: User ${req.user._id} attempted to access resource ${resourceId} owned by ${resource[ownerField]}`);
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to access this resource',
          code: 'RESOURCE_ACCESS_DENIED'
        });
      }
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
 * Wraps async route handlers for consistent error handling.
 * @param {Function} fn - Async route handler.
 * @returns {Function} Express middleware.
 */
exports.asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(err => {
    logger.error(`Route handler error: ${err.message}`);
    if (res.headersSent) return next(err);
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
      const field = Object.keys(err.keyValue)[0];
      return res.status(400).json({
        success: false,
        error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
        code: 'DUPLICATE_KEY'
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Server error',
      code: 'SERVER_ERROR'
    });
  });
};
