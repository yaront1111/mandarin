// middleware/auth.js - Enhanced with ES modules, improved error handling, security and socket support
import jwt from "jsonwebtoken"
import { User } from "../models/index.js"
import config from "../config.js"
import logger from "../logger.js"

/**
 * Generate JWT token
 * @param {Object} payload - Data to encode in the token
 * @param {string} expiresIn - Token expiration time (e.g., '7d', '1h')
 * @returns {string} JWT token
 */
const generateToken = (payload, expiresIn = config.JWT_EXPIRE) => {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn })
}

/**
 * Generate a socket-specific token with shorter expiration
 * @param {Object} payload - Data to encode in the token
 * @returns {string} Socket JWT token
 */
const generateSocketToken = (payload) => {
  // Socket tokens should have a shorter lifespan, but not too short
  // This is a balance between security and usability
  const socketPayload = {
    ...payload,
    purpose: 'socket', // Mark this as a socket token for easier identification
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(socketPayload, config.JWT_SECRET, {
    expiresIn: config.SOCKET_TOKEN_EXPIRE || '24h'
  });
}

/**
 * Verify JWT token without throwing errors
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
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
 * Verify socket token with enhanced error handling
 * @param {string} token - JWT token to verify
 * @returns {Object} Object containing success status and data or error
 */
const verifySocketToken = (token) => {
  try {
    if (!token) {
      return {
        success: false,
        error: 'No token provided',
        code: 'NO_TOKEN'
      };
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);

    return {
      success: true,
      data: decoded
    };
  } catch (error) {
    // Handle specific JWT errors with appropriate responses
    if (error.name === 'TokenExpiredError') {
      logger.debug(`Socket token expired: ${error.message}`);
      return {
        success: false,
        error: 'Your session has expired',
        code: 'TOKEN_EXPIRED'
      };
    } else if (error.name === 'JsonWebTokenError') {
      logger.debug(`Invalid socket token: ${error.message}`);
      return {
        success: false,
        error: 'Invalid authentication token',
        code: 'INVALID_TOKEN'
      };
    } else {
      logger.error(`Socket token verification error: ${error.message}`);
      return {
        success: false,
        error: 'Authentication error',
        code: 'AUTH_ERROR'
      };
    }
  }
}

/**
 * Authenticate socket connection
 * @param {Object} socket - Socket.io socket object
 * @param {Object} data - Authentication data from client
 * @returns {Promise<Object>} Auth result with user if successful
 */
const authenticateSocket = async (socket, data) => {
  try {
    // Check for token in data or headers
    const token = data?.token || socket.handshake.auth?.token ||
                  socket.handshake.headers?.authorization?.split(' ')[1] || null;

    if (!token) {
      logger.debug(`Socket auth failed: No token provided`);
      return {
        success: false,
        error: 'Authentication required',
        code: 'NO_TOKEN'
      };
    }

    // Verify the token
    const verification = verifySocketToken(token);
    if (!verification.success) {
      return verification; // Just return the error result
    }

    const decoded = verification.data;
    let userId = decoded.id || decoded.userId || (decoded.user && decoded.user._id);

    if (!userId) {
      logger.debug(`Socket auth failed: No user ID in token`);
      return {
        success: false,
        error: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      };
    }

    // Find the user
    const user = await User.findById(userId).select('+version');

    if (!user) {
      logger.debug(`Socket auth failed: User not found - ID: ${userId}`);
      return {
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      };
    }

    // Check token version if available (for token invalidation)
    if (user.version && decoded.version && user.version !== decoded.version) {
      logger.debug(`Socket token version mismatch: ${decoded.version} vs ${user.version}`);
      return {
        success: false,
        error: 'Session is no longer valid',
        code: 'TOKEN_REVOKED'
      };
    }

    // Auth success
    return {
      success: true,
      user: {
        _id: user._id.toString(),
        id: user._id.toString(),
        email: user.email,
        nickname: user.nickname || user.name,
        role: user.role
      }
    };
  } catch (error) {
    logger.error(`Socket authentication error: ${error.message}`, { stack: error.stack });
    return {
      success: false,
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    };
  }
}

/**
 * Middleware to protect routes - requires authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const protect = async (req, res, next) => {
  let token

  try {
    // Get token from various possible locations
    // 1. Authorization header with Bearer scheme
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1]
    }
    // 2. x-auth-token header (legacy/alternative)
    else if (req.header("x-auth-token")) {
      token = req.header("x-auth-token")
    }
    // 3. Cookie (if using cookie-based auth)
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token
    }

    // Check if no token
    if (!token) {
      logger.debug(`Access denied: No token provided - ${req.method} ${req.originalUrl}`)
      return res.status(401).json({
        success: false,
        error: "Authentication required. Please log in.",
      })
    }

    // Verify token
    let decoded
    try {
      decoded = jwt.verify(token, config.JWT_SECRET)
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        logger.debug(`Token expired: ${jwtError.message}`)
        return res.status(401).json({
          success: false,
          error: "Your session has expired. Please log in again.",
          code: "TOKEN_EXPIRED",
        })
      } else {
        logger.debug(`Invalid token: ${jwtError.message}`)
        return res.status(401).json({
          success: false,
          error: "Invalid authentication token.",
          code: "INVALID_TOKEN",
        })
      }
    }

    // Set user in request
    if (decoded.id) {
      // If token contains user ID, look up the user
      const user = await User.findById(decoded.id).select("+version")

      if (!user) {
        logger.debug(`Token contained non-existent user ID: ${decoded.id}`)
        return res.status(401).json({
          success: false,
          error: "User not found. Please log in again.",
          code: "USER_NOT_FOUND",
        })
      }

      // Check if token version matches user version (for token invalidation)
      if (user.version && decoded.version && user.version !== decoded.version) {
        logger.debug(`Token version mismatch: token=${decoded.version}, user=${user.version}`)
        return res.status(401).json({
          success: false,
          error: "Your session is no longer valid. Please log in again.",
          code: "TOKEN_REVOKED",
        })
      }

      // Set user object on request
      req.user = user
      return next()
    } else if (decoded.user) {
      // If token contains user object, set it directly (for backwards compatibility)
      req.user = decoded.user
      return next()
    }

    // If we get here, token format is invalid
    logger.debug(`Token has invalid format: ${JSON.stringify(decoded)}`)
    return res.status(401).json({
      success: false,
      error: "Invalid token format",
      code: "INVALID_TOKEN_FORMAT",
    })
  } catch (err) {
    logger.error(`Auth middleware error: ${err.message}`, { stack: err.stack })
    return res.status(500).json({
      success: false,
      error: "Authentication error",
    })
  }
}

/**
 * Enhanced protection middleware that ensures consistent user ID handling
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const enhancedProtect = async (req, res, next) => {
  try {
    // First apply the standard protection middleware
    await protect(req, res, (err) => {
      if (err) return next(err)

      // Then enhance the user object with consistent ID handling
      if (req.user) {
        // Ensure _id is always a string
        if (req.user._id) {
          req.user._id = req.user._id.toString()
        }

        // Ensure id is always available and is a string
        if (!req.user.id && req.user._id) {
          req.user.id = req.user._id.toString()
        } else if (req.user.id) {
          req.user.id = req.user.id.toString()
        }
      }

      next()
    })
  } catch (err) {
    logger.error(`Enhanced auth middleware error: ${err.message}`, { stack: err.stack })
    return res.status(500).json({
      success: false,
      error: "Authentication error",
    })
  }
}

/**
 * Middleware to restrict access by role
 * @param {...string} roles - Roles allowed to access the route
 * @returns {Function} Middleware function
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      logger.error("restrictTo middleware used without protect middleware")
      return res.status(500).json({
        success: false,
        error: "Server configuration error",
      })
    }

    if (!roles.includes(req.user.role)) {
      logger.debug(`Access denied: User ${req.user._id} (role: ${req.user.role}) attempted to access restricted route`)
      return res.status(403).json({
        success: false,
        error: "You do not have permission to perform this action",
      })
    }

    next()
  }
}

/**
 * Async handler wrapper to handle promise rejections
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    logger.error(`Unhandled error in route handler: ${err.message}`, {
      stack: err.stack,
      path: req.path,
      method: req.method,
    })
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === "production" ? "Server error occurred" : err.message,
    })
  })
}

/**
 * Optional authentication middleware - doesn't require auth but will
 * populate req.user if a valid token is provided
 */
const optionalAuth = async (req, res, next) => {
  let token

  // Get token from header (check both x-auth-token and Authorization header)
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1]
  } else if (req.header("x-auth-token")) {
    token = req.header("x-auth-token")
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token
  }

  // If no token, continue without setting user
  if (!token) {
    return next()
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET, { ignoreExpiration: true })

    // Set user in request if found
    if (decoded.id) {
      const user = await User.findById(decoded.id)
      if (user) {
        req.user = user
      }
    }

    next()
  } catch (err) {
    // Token is invalid but we continue without auth
    next()
  }
}

// Export all functions
export {
  generateToken,
  generateSocketToken,
  verifyToken,
  verifySocketToken,
  authenticateSocket,
  protect,
  enhancedProtect,
  restrictTo,
  asyncHandler,
  optionalAuth,
}
