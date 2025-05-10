import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/index.js";
import config from "../config.js";
import logger from "../logger.js";
import { normalizeIdToString, normalizeIdToObjectId, extractUserIdFromToken, createStandardUserObject } from "../utils/idUtils.js";

/**
 * Generate JWT token
 * @param {Object} payload - Data to encode
 * @param {string} expiresIn - Expiration time
 */
const generateToken = (payload, expiresIn = config.JWT_EXPIRE) => {
  // Standardize the ID field in a consistent way
  const idString = normalizeIdToString(payload);
  
  // Ensure all ID fields are included for maximum compatibility
  const tokenPayload = {
    id: idString,      // Keep id for backward compatibility
    _id: idString,     // Keep _id for newer code
    userId: idString,  // Include userId as well
    ...payload,
  };

  return jwt.sign(tokenPayload, config.JWT_SECRET, { expiresIn });
};

/**
 * Generate a socket-specific token
 */
const generateSocketToken = (payload) => {
  // Standardize the ID field in a consistent way
  const idString = normalizeIdToString(payload);
  
  // Ensure all ID fields are included for maximum compatibility
  const socketPayload = {
    id: idString,      // Keep id for socket auth
    _id: idString,     // Keep _id for newer code
    userId: idString,  // Include userId as well
    ...payload,
    purpose: "socket",
    iat: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(socketPayload, config.JWT_SECRET, {
    expiresIn: config.SOCKET_TOKEN_EXPIRE || "24h",
  });
};

/**
 * Verify JWT without throwing
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch (err) {
    logger.debug(`Token verify failed: ${err.message}`);
    return null;
  }
};

/**
 * Verify socket token with error details
 */
const verifySocketToken = (token) => {
  try {
    if (!token) {
      return { success: false, error: "No token provided", code: "NO_TOKEN" };
    }
    const decoded = jwt.verify(token, config.JWT_SECRET);

    // Check for any variant of user ID field
    const userId = decoded.id || decoded._id || decoded.userId ||
                  (decoded.user && (decoded.user.id || decoded.user._id));

    if (!userId) {
      logger.debug(`Socket token missing user ID: ${JSON.stringify(decoded)}`);
      return { success: false, error: "Invalid token payload", code: "INVALID_TOKEN_PAYLOAD" };
    }
    return { success: true, data: decoded };
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      logger.debug(`Socket token expired: ${err.message}`);
      return { success: false, error: "Session expired", code: "TOKEN_EXPIRED" };
    } else if (err.name === "JsonWebTokenError") {
      logger.debug(`Invalid socket token: ${err.message}`);
      return { success: false, error: "Invalid token", code: "INVALID_TOKEN" };
    }
    logger.error(`Socket token error: ${err.message}`);
    return { success: false, error: "Auth error", code: "AUTH_ERROR" };
  }
};

/**
 * Authenticate a Socket.io connection
 */
const authenticateSocket = async (socket, data) => {
  const token =
    data?.token ||
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.split(" ")[1] ||
    null;

  if (!token) {
    logger.debug(`Socket auth failed: No token`);
    return { success: false, error: "Authentication required", code: "NO_TOKEN" };
  }

  const verification = verifySocketToken(token);
  if (!verification.success) return verification;

  const decoded = verification.data;
  // Use standardized extraction of user ID from token
  const userId = extractUserIdFromToken(decoded);
  const userObjectId = normalizeIdToObjectId(userId);

  if (!userObjectId) {
    logger.debug(`Socket auth invalid ID: ${userId}, decoded: ${JSON.stringify(decoded)}`);
    return { success: false, error: "Invalid token format", code: "INVALID_TOKEN_FORMAT" };
  }

  const user = await User.findById(userObjectId).select("+version");
  if (!user) {
    logger.debug(`Socket auth user not found: ${userId}`);
    return { success: false, error: "User not found", code: "USER_NOT_FOUND" };
  }
  if (user.version && decoded.version && user.version !== decoded.version) {
    logger.debug(`Socket token version mismatch`);
    return { success: false, error: "Session no longer valid", code: "TOKEN_REVOKED" };
  }

  // Create standardized user object for response
  const standardUser = {
    _id: normalizeIdToString(user._id),
    id: normalizeIdToString(user._id),
    userId: normalizeIdToString(user._id),
    email: user.email,
    nickname: user.nickname || user.name,
    role: user.role,
  };

  return {
    success: true,
    user: standardUser,
  };
};

/**
 * Protect routes - require auth
 */
const protect = async (req, res, next) => {
  let token;

  // Extra debug logging for blocked users endpoint
  const isBlockedEndpoint = req.originalUrl.includes('/users/blocked');
  if (isBlockedEndpoint) {
    logger.debug(`[DEBUG] Blocked users request received`);
    logger.debug(`[DEBUG] Request headers: ${JSON.stringify(req.headers || {})}`);
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer")) {
    token = authHeader.split(" ")[1];
  } else if (req.header("x-auth-token")) {
    token = req.header("x-auth-token");
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    logger.debug(`No token provided for ${req.method} ${req.originalUrl}`);
    logger.debug(`Request headers: ${JSON.stringify(req.headers || {})}`);
    return res.status(401).json({ success: false, error: "Authentication required" });
  }

  if (isBlockedEndpoint) {
    logger.debug(`[DEBUG] Token found: ${token.substring(0, 10)}...`);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.JWT_SECRET);

    if (isBlockedEndpoint) {
      logger.debug(`[DEBUG] Token verified successfully: ${JSON.stringify(decoded || {})}`);
    }
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      logger.debug(`Token expired: ${err.message}`);
      return res.status(401).json({ success: false, error: "Session expired", code: "TOKEN_EXPIRED" });
    }
    logger.debug(`Invalid token: ${err.message}`);
    return res.status(401).json({ success: false, error: "Invalid token", code: "INVALID_TOKEN" });
  }

  // Use standardized extraction of user ID from token
  const userId = extractUserIdFromToken(decoded);
  const userObjectId = normalizeIdToObjectId(userId);

  if (!userObjectId) {
    logger.debug(`Token missing or invalid user ID: ${userId}`);
    return res.status(401).json({ success: false, error: "Invalid token format", code: "INVALID_TOKEN_FORMAT" });
  }

  try {
    if (isBlockedEndpoint) {
      logger.debug(`[DEBUG] User ID parsed: ${userObjectId}`);
    }

    const user = await User.findById(userObjectId).select("+version");
    if (!user) {
      logger.debug(`User not found from token, ID: ${userId}`);
      return res.status(401).json({ success: false, error: "User not found", code: "USER_NOT_FOUND" });
    }

    if (user.version && decoded.version && user.version !== decoded.version) {
      logger.debug(`Token version mismatch: ${user.version} vs ${decoded.version}`);
      return res.status(401).json({ success: false, error: "Session no longer valid", code: "TOKEN_REVOKED" });
    }

    // Create standardized user object with consistent ID fields
    req.user = {
      _id: normalizeIdToString(user._id),
      id: normalizeIdToString(user._id),
      userId: normalizeIdToString(user._id),
      email: user.email,
      nickname: user.nickname,
      role: user.role,
      settings: user.settings,
    };

    if (isBlockedEndpoint) {
      logger.debug(`[DEBUG] User object created: ${JSON.stringify(req.user)}`);
    }

    logger.debug(`[AUTH] Authenticated user ${req.user._id} for ${req.method} ${req.originalUrl}`);
    next();
  } catch (err) {
    logger.error(`Error in protect middleware: ${err.message}`, err);
    return res.status(500).json({ success: false, error: "Authentication error", code: "AUTH_ERROR" });
  }
};

/**
 * Enhanced protect that wraps protect for consistent req.user
 */
const enhancedProtect = async (req, res, next) => {
  try {
    await new Promise((resolve, reject) =>
      protect(req, res, (err) => (err ? reject(err) : resolve()))
    );
    if (req.user && req.user._id) {
      req.user._id = req.user._id.toString();
      // Make sure id and userId are also strings
      req.user.id = req.user._id;
      req.user.userId = req.user._id;
    }
    next();
  } catch (err) {
    if (!res.headersSent) {
      return res.status(err.status || 500).json({
        success: false,
        error: err.message || "Authentication enhancement error",
      });
    }
  }
};

/**
 * Restrict access by role
 */
const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user) {
    logger.error("restrictTo used without user context");
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  if (!roles.includes(req.user.role)) {
    logger.debug(`User ${req.user._id} role ${req.user.role} not in ${roles}`);
    return res.status(403).json({ success: false, error: "Access denied" });
  }
  next();
};

/**
 * Async handler wrapper
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    logger.error(`Route error: ${err.message}`, { stack: err.stack, path: req.path, method: req.method });
    if (!res.headersSent) {
      res.status(err.statusCode || 500).json({
        success: false,
        error:
          process.env.NODE_ENV === "production" && err.statusCode === 500
            ? "An unexpected error occurred"
            : err.message,
        ...(err.code && { code: err.code }),
        ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
      });
    } else {
      next(err);
    }
  });

/**
 * Optional auth (populate req.user if token valid, but don't block)
 */
const optionalAuth = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer")) {
    token = authHeader.split(" ")[1];
  } else if (req.header("x-auth-token")) {
    token = req.header("x-auth-token");
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    // Check all possible ID field names
    let userId = decoded.id || decoded._id || decoded.userId ||
                (decoded.user && (decoded.user.id || decoded.user._id));

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      const user = await User.findById(userId).select("+version");
      if (user && (!user.version || user.version === decoded.version)) {
        const userIdStr = user._id.toString();
        req.user = {
          _id: userIdStr,
          id: userIdStr,
          userId: userIdStr,
          role: user.role
        };
        logger.debug(`[OptionalAuth] Set user ${req.user._id}`);
      }
    }
  } catch (err) {
    logger.debug(`[OptionalAuth] Token invalid: ${err.message}`);
  }
  next();
};

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
