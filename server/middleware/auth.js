// Upgraded auth.js middleware with improved token handling and security
const jwt = require("jsonwebtoken")
const { promisify } = require("util")
const crypto = require("crypto")
const { User } = require("../models")
const config = require("../config")
const logger = require("../logger")

/**
 * Generate a JWT token
 * @param {Object} payload - Token payload
 * @param {string} expiresIn - Token expiration time
 * @returns {string} JWT token
 */
const generateToken = (payload, expiresIn = config.JWT_EXPIRES_IN) => {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn,
  })
}

/**
 * Verify a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded token or null if invalid
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.JWT_SECRET)
  } catch (error) {
    logger.debug(`Token verification failed: ${error.message}`)
    return null
  }
}

/**
 * Verify a socket token (used for socket.io authentication)
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded token or null if invalid
 */
const verifySocketToken = (token) => {
  try {
    return jwt.verify(token, config.JWT_SECRET)
  } catch (error) {
    logger.debug(`Socket token verification failed: ${error.message}`)
    return null
  }
}

/**
 * Generate a refresh token
 * @returns {string} Refresh token
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString("hex")
}

/**
 * Middleware to protect routes - requires authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const protect = async (req, res, next) => {
  try {
    let token

    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1]
    }
    // Get token from cookie (for web clients)
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token
    }

    // Check if token exists
    if (!token) {
      logger.debug(`Authentication failed: No token provided`)
      return res.status(401).json({
        success: false,
        error: "Not authorized to access this route",
      })
    }

    // Verify token
    const decoded = verifyToken(token)
    if (!decoded) {
      logger.debug(`Authentication failed: Invalid token`)
      return res.status(401).json({
        success: false,
        error: "Not authorized to access this route",
      })
    }

    // Check if user still exists
    const user = await User.findById(decoded.id).select("+password")
    if (!user) {
      logger.debug(`Authentication failed: User not found (ID: ${decoded.id})`)
      return res.status(401).json({
        success: false,
        error: "The user belonging to this token no longer exists",
      })
    }

    // Check if user changed password after token was issued
    if (user.passwordChangedAt && decoded.iat < user.passwordChangedAt.getTime() / 1000) {
      logger.debug(`Authentication failed: Password changed after token issued (User: ${user._id})`)
      return res.status(401).json({
        success: false,
        error: "User recently changed password. Please log in again",
      })
    }

    // Update last active timestamp
    user.lastActive = new Date()
    await user.save({ validateBeforeSave: false })

    // Set user in request object
    req.user = user
    next()
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`)
    res.status(401).json({
      success: false,
      error: "Not authorized to access this route",
    })
  }
}

/**
 * Middleware to restrict routes to specific roles
 * @param {...string} roles - Allowed roles
 * @returns {Function} Express middleware
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      })
    }

    if (!roles.includes(req.user.role)) {
      logger.debug(
        `Authorization failed: User ${req.user._id} (role: ${req.user.role}) attempted to access restricted route`,
      )
      return res.status(403).json({
        success: false,
        error: "You do not have permission to perform this action",
      })
    }

    next()
  }
}

/**
 * Wrapper for async route handlers to avoid try/catch blocks
 * @param {Function} fn - Async route handler
 * @returns {Function} Express middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

module.exports = {
  generateToken,
  verifyToken,
  verifySocketToken,
  generateRefreshToken,
  protect,
  restrictTo,
  asyncHandler,
}
