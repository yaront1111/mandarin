// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const config = require('../config');
const logger = require('../logger');

/**
 * Authentication middleware to protect routes
 * This middleware verifies the JWT token and attaches the user to the request
 */
exports.protect = async (req, res, next) => {
  let token;

  // Log headers for debugging
  logger.debug(`Auth request headers: ${JSON.stringify(req.headers)}`);

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
    logger.debug(`Token extracted from Authorization header: ${token ? token.substring(0, 15) + '...' : 'undefined'}`);
  }
  // Alternative check for token in cookies if using credentials
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
    logger.debug(`Token extracted from cookies: ${token.substring(0, 15)}...`);
  }

  if (!token) {
    logger.warn(`Authentication failed: No token provided (IP: ${req.ip})`);
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route - no token provided'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET);
    logger.debug(`Token verified for user ID: ${decoded.id}`);

    // Get user from database
    const user = await User.findById(decoded.id);

    if (!user) {
      logger.warn(`Authentication failed: User not found for ID ${decoded.id}`);
      return res.status(401).json({
        success: false,
        error: 'User not found for this token'
      });
    }

    // Update last active timestamp
    user.lastActive = Date.now();
    await user.save();

    // Attach user to request object
    req.user = user;
    next();
  } catch (err) {
    logger.error(`Token verification error: ${err.message}`);

    // Check if token expired
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired, please login again'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token'
    });
  }
};

/**
 * Helper to send token response
 * @param {Object} user - User object
 * @param {number} statusCode - HTTP status code
 * @param {Object} res - Express response object
 */
exports.sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();
  user.password = undefined; // Remove password from the output

  logger.debug(`Generated token for user ${user._id}: ${token.substring(0, 15)}...`);

  res.status(statusCode).json({
    success: true,
    token,
    data: user
  });
};

/**
 * Helper to wrap async route handlers
 * @param {Function} fn - Async route handler
 * @returns {Function} - Express middleware
 */
exports.asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
