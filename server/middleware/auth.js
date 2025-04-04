// middleware/auth.js - Enhanced with ES modules, improved error handling, security and socket support
import jwt from "jsonwebtoken";
import mongoose from "mongoose"; // Import mongoose to check ObjectId instance
import { User } from "../models/index.js";
import config from "../config.js";
import logger from "../logger.js";

/**
 * Generate JWT token
 * @param {Object} payload - Data to encode in the token
 * @param {string} expiresIn - Token expiration time (e.g., '7d', '1h')
 * @returns {string} JWT token
 */
const generateToken = (payload, expiresIn = config.JWT_EXPIRE) => {
  // Ensure payload includes user ID consistently
  const tokenPayload = {
    id: payload.id || payload._id, // Prioritize 'id', fallback to '_id'
    ...payload,
  };
  // Remove _id if id exists to avoid confusion
  if (tokenPayload.id && tokenPayload._id) {
    delete tokenPayload._id;
  }
  return jwt.sign(tokenPayload, config.JWT_SECRET, { expiresIn });
};

/**
 * Generate a socket-specific token with shorter expiration
 * @param {Object} payload - Data to encode in the token
 * @returns {string} Socket JWT token
 */
const generateSocketToken = (payload) => {
  // Socket tokens should have a shorter lifespan, but not too short
  // This is a balance between security and usability
  const socketPayload = {
    id: payload.id || payload._id, // Ensure consistent ID field
    ...payload,
    purpose: 'socket', // Mark this as a socket token for easier identification
    iat: Math.floor(Date.now() / 1000)
  };
  if (socketPayload.id && socketPayload._id) {
    delete socketPayload._id;
  }

  return jwt.sign(socketPayload, config.JWT_SECRET, {
    expiresIn: config.SOCKET_TOKEN_EXPIRE || '24h'
  });
};

/**
 * Verify JWT token without throwing errors
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch (error) {
    logger.debug(`Token verification failed: ${error.message}`);
    return null;
  }
};

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

    // Check if decoded payload contains necessary user identifier
    if (!decoded || (!decoded.id && !decoded.userId && !(decoded.user && decoded.user._id))) {
        logger.debug(`Socket token verification failed: Missing user identifier in payload`);
        return { success: false, error: 'Invalid token payload', code: 'INVALID_TOKEN_PAYLOAD' };
    }


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
};

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
    // Prioritize 'id' from token payload
    let userId = decoded.id || decoded.userId || (decoded.user && decoded.user._id);

    if (!userId) {
      logger.debug(`Socket auth failed: No user ID in token`);
      return {
        success: false,
        error: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      };
    }

    // Ensure userId is a string for database lookup
    userId = String(userId);

    // Validate ID format before hitting DB
     if (!mongoose.Types.ObjectId.isValid(userId)) {
        logger.debug(`Socket auth failed: Invalid user ID format in token - ${userId}`);
        return { success: false, error: 'Invalid user ID in token', code: 'INVALID_USER_ID_FORMAT' };
    }


    // Find the user
    const user = await User.findById(userId).select('+version'); // Include version for token check

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

    // Auth success - return consistent user object
    return {
      success: true,
      user: {
        _id: user._id.toString(), // Ensure string format
        id: user._id.toString(),   // Ensure string format and 'id' field
        email: user.email,
        nickname: user.nickname || user.name,
        role: user.role
        // Add other necessary non-sensitive fields
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
};


/**
 * Middleware to protect routes - requires authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const protect = async (req, res, next) => {
  let token;

  try {
    // Get token from various possible locations
    // 1. Authorization header with Bearer scheme
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }
    // 2. x-auth-token header (legacy/alternative)
    else if (req.header("x-auth-token")) {
      token = req.header("x-auth-token");
    }
    // 3. Cookie (if using cookie-based auth)
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // Check if no token
    if (!token) {
      logger.debug(`Access denied: No token provided - ${req.method} ${req.originalUrl}`);
      return res.status(401).json({
        success: false,
        error: "Authentication required. Please log in.",
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        logger.debug(`Token expired: ${jwtError.message}`);
        return res.status(401).json({
          success: false,
          error: "Your session has expired. Please log in again.",
          code: "TOKEN_EXPIRED",
        });
      } else {
        logger.debug(`Invalid token: ${jwtError.message}`);
        return res.status(401).json({
          success: false,
          error: "Invalid authentication token.",
          code: "INVALID_TOKEN",
        });
      }
    }

    // --- User Lookup and Validation ---
    let userIdFromToken = decoded.id || decoded.userId || (decoded.user && decoded.user._id);

    if (!userIdFromToken) {
        logger.debug(`Token has invalid format (missing ID): ${JSON.stringify(decoded)}`);
        return res.status(401).json({
            success: false,
            error: "Invalid token format",
            code: "INVALID_TOKEN_FORMAT",
        });
    }

    // Ensure userId is a string and validate format before DB lookup
    userIdFromToken = String(userIdFromToken);
    if (!mongoose.Types.ObjectId.isValid(userIdFromToken) || !/^[0-9a-fA-F]{24}$/.test(userIdFromToken)) {
        logger.error(`User ID from token has invalid format: ${userIdFromToken}`);
        return res.status(401).json({
            success: false,
            error: "Invalid user ID format in token. Please log in again.",
            code: "INVALID_USER_ID_FORMAT",
        });
    }


    // If token contains user ID, look up the user
    const user = await User.findById(userIdFromToken).select("+version"); // Select version for check

    if (!user) {
      logger.debug(`Token contained non-existent user ID: ${userIdFromToken}`);
      return res.status(401).json({
        success: false,
        error: "User not found. Please log in again.",
        code: "USER_NOT_FOUND",
      });
    }

    // Check if token version matches user version (for token invalidation)
    if (user.version && decoded.version && user.version !== decoded.version) {
      logger.debug(`Token version mismatch: token=${decoded.version}, user=${user.version}`);
      return res.status(401).json({
        success: false,
        error: "Your session is no longer valid. Please log in again.",
        code: "TOKEN_REVOKED",
      });
    }

    // --- Attach User to Request ---
    // Create a plain object to attach to req.user to avoid potential Mongoose object issues downstream
    const userToAttach = {
        _id: user._id.toString(), // Ensure string format
        id: user._id.toString(),   // Ensure string format and 'id' field
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        // Add other fields needed by subsequent middleware/routes, excluding sensitive ones
        settings: user.settings, // Example: include settings if needed
        // DO NOT include password hash or other sensitive fields
    };


    req.user = userToAttach;

    // --- ADDED LOGGING ---
    logger.debug(`[AUTH MIDDLEWARE] User authenticated and attached to req.user`, {
        userId: req.user._id,
        userIdType: typeof req.user._id,
        userNickname: req.user.nickname,
        userRole: req.user.role,
        requestPath: req.originalUrl,
        requestMethod: req.method
    });
    // --- END ADDED LOGGING ---

    return next(); // Proceed to the next middleware/route handler

  } catch (err) {
    logger.error(`Auth middleware error: ${err.message}`, { stack: err.stack });
    return res.status(500).json({
      success: false,
      error: "Authentication error", // Generic error for security
    });
  }
};


/**
 * Enhanced protection middleware that ensures consistent user ID handling
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const enhancedProtect = async (req, res, next) => {
  try {
    // First apply the standard protection middleware
    await new Promise((resolve, reject) => {
        protect(req, res, (err) => {
            if (err) {
                // If protect calls next() with an error, reject the promise
                return reject(err);
            }
            // If protect calls next() without an error, resolve the promise
            resolve();
        });
    });


    // If protect middleware successfully authenticated and called next(), req.user should be populated
    if (req.user) {
      // Ensure _id is always a string (already done in protect, but double-check)
      if (req.user._id) {
        req.user._id = req.user._id.toString();
      }

      // Ensure id is always available and is a string
      if (!req.user.id && req.user._id) {
        req.user.id = req.user._id.toString();
      } else if (req.user.id) {
        req.user.id = req.user.id.toString();
      }
       // Log enhancement if needed
       // logger.debug('[Enhanced Protect] Ensured consistent ID format on req.user');
    } else {
         // This case should ideally not happen if protect is working correctly
         logger.warn('[Enhanced Protect] req.user not found after protect middleware.');
         // Depending on requirements, you might want to return an error here
         // return res.status(401).json({ success: false, error: "Authentication failed unexpectedly." });
    }


    next(); // Proceed after enhancement
  } catch (err) {
    // Handle errors that might occur during protect or enhancement
     logger.error(`Enhanced auth middleware error: ${err.message}`, { stack: err.stack });
     // If the error came from protect (e.g., 401), it might already have sent a response.
     // Check if response has been sent before sending another one.
     if (!res.headersSent) {
        // If protect middleware rejected (e.g., due to auth failure),
        // it might not have sent a response yet. Send a generic error.
        return res.status(err.status || 500).json({
            success: false,
            error: err.message || "Authentication enhancement error",
        });
     }
     // If headers were already sent, we can't send another response.
     // The error is logged, which might be sufficient.
  }
};

/**
 * Middleware to restrict access by role
 * @param {...string} roles - Roles allowed to access the route
 * @returns {Function} Middleware function
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      // This should ideally be caught by 'protect' middleware first
      logger.error("restrictTo middleware used without user context. Ensure 'protect' runs first.");
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    if (!req.user.role) {
         logger.warn(`User ${req.user._id} has no role defined. Access denied.`);
         return res.status(403).json({
            success: false,
            error: "Access denied. User role not defined.",
         });
    }


    if (!roles.includes(req.user.role)) {
      logger.debug(`Access denied: User ${req.user._id} (role: ${req.user.role}) attempted to access restricted route requiring roles: ${roles.join(', ')}`);
      return res.status(403).json({
        success: false,
        error: "You do not have permission to perform this action",
      });
    }

    next(); // User has the required role
  };
};

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
      requestId: req.id, // Include request ID if available
    });

     // Avoid sending response if headers already sent (e.g., by protect middleware)
     if (res.headersSent) {
        return next(err); // Pass error to next error handler if response already started
     }

    // Determine status code, default to 500
     const statusCode = err.statusCode || err.status || 500;


    res.status(statusCode).json({
      success: false,
      error: process.env.NODE_ENV === "production" && statusCode === 500
        ? "An unexpected server error occurred" // More generic in production for 500s
        : err.message || "Server error occurred", // Provide message otherwise
       // Optionally include code if available on the error object
       ...(err.code && { code: err.code }),
       // Only include stack in non-production environments
       ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    });
  });
};

/**
 * Optional authentication middleware - doesn't require auth but will
 * populate req.user if a valid token is provided
 */
const optionalAuth = async (req, res, next) => {
  let token;

  // Get token from header (check both x-auth-token and Authorization header)
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.header("x-auth-token")) {
    token = req.header("x-auth-token");
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // If no token, continue without setting user
  if (!token) {
    return next();
  }

  try {
    // Verify token - ignore expiration for optional auth? Decide based on requirements.
    // If expired token should still clear user, use ignoreExpiration: false (default)
    // If expired token should be ignored completely, use ignoreExpiration: true
    const decoded = jwt.verify(token, config.JWT_SECRET /*, { ignoreExpiration: true } */);

    // Set user in request if found and token is valid
     let userIdFromToken = decoded.id || decoded.userId || (decoded.user && decoded.user._id);
     if (userIdFromToken) {
        userIdFromToken = String(userIdFromToken);
        if (mongoose.Types.ObjectId.isValid(userIdFromToken)) {
            const user = await User.findById(userIdFromToken).select("+version"); // Fetch version for consistency
            if (user) {
                 // Basic check for token version mismatch if applicable
                 if (!user.version || !decoded.version || user.version === decoded.version) {
                    // Attach simplified user object
                    req.user = {
                        _id: user._id.toString(),
                        id: user._id.toString(),
                        role: user.role
                        // Add other minimal necessary fields if needed
                    };
                    logger.debug(`[Optional Auth] User context set for ID: ${req.user._id}`);
                 } else {
                     logger.debug(`[Optional Auth] Token version mismatch for user ${userIdFromToken}`);
                 }
            } else {
                 logger.debug(`[Optional Auth] User not found for ID in token: ${userIdFromToken}`);
            }
        } else {
             logger.debug(`[Optional Auth] Invalid user ID format in token: ${userIdFromToken}`);
        }
     } else {
         logger.debug(`[Optional Auth] No user ID found in token payload.`);
     }


    next(); // Continue regardless of auth success/failure
  } catch (err) {
    // Token is invalid (or expired if not ignored), log it but continue without auth
    logger.debug(`[Optional Auth] Token verification failed: ${err.message}. Continuing without user context.`);
    next();
  }
};


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
};
