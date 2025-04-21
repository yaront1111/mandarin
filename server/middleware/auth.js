import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/index.js";
import config from "../config.js";
import logger from "../logger.js";

/**
 * Generate JWT token
 * @param {Object} payload - Data to encode
 * @param {string} expiresIn - Expiration time
 */
const generateToken = (payload, expiresIn = config.JWT_EXPIRE) => {
  const tokenPayload = {
    id: payload.id || payload._id,
    ...payload,
  };
  if (tokenPayload.id && tokenPayload._id) delete tokenPayload._id;
  return jwt.sign(tokenPayload, config.JWT_SECRET, { expiresIn });
};

/**
 * Generate a socket-specific token
 */
const generateSocketToken = (payload) => {
  const socketPayload = {
    id: payload.id || payload._id,
    ...payload,
    purpose: "socket",
    iat: Math.floor(Date.now() / 1000),
  };
  if (socketPayload.id && socketPayload._id) delete socketPayload._id;
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
    if (!decoded || !decoded.id) {
      logger.debug(`Socket token missing user ID`);
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
  let userId = decoded.id || decoded.userId || (decoded.user && decoded.user._id);
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    logger.debug(`Socket auth invalid ID: ${userId}`);
    return { success: false, error: "Invalid token format", code: "INVALID_TOKEN_FORMAT" };
  }

  const user = await User.findById(userId).select("+version");
  if (!user) {
    logger.debug(`Socket auth user not found: ${userId}`);
    return { success: false, error: "User not found", code: "USER_NOT_FOUND" };
  }
  if (user.version && decoded.version && user.version !== decoded.version) {
    logger.debug(`Socket token version mismatch`);
    return { success: false, error: "Session no longer valid", code: "TOKEN_REVOKED" };
  }

  return {
    success: true,
    user: {
      _id: user._id.toString(),
      id: user._id.toString(),
      email: user.email,
      nickname: user.nickname || user.name,
      role: user.role,
    },
  };
};

/**
 * Protect routes - require auth
 */
const protect = async (req, res, next) => {
  let token;
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
    
    // Add debug information to help diagnose the issue
    logger.debug(`Request headers: ${JSON.stringify(req.headers || {})}`);
    
    return res.status(401).json({ success: false, error: "Authentication required" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      logger.debug(`Token expired: ${err.message}`);
      return res.status(401).json({ success: false, error: "Session expired", code: "TOKEN_EXPIRED" });
    }
    logger.debug(`Invalid token: ${err.message}`);
    return res.status(401).json({ success: false, error: "Invalid token", code: "INVALID_TOKEN" });
  }

  let userId = decoded.id || decoded.userId || (decoded.user && decoded.user._id);
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    logger.debug(`Token missing or invalid user ID`);
    return res.status(401).json({ success: false, error: "Invalid token format", code: "INVALID_TOKEN_FORMAT" });
  }

  const user = await User.findById(userId).select("+version");
  if (!user) {
    logger.debug(`User not found from token`);
    return res.status(401).json({ success: false, error: "User not found", code: "USER_NOT_FOUND" });
  }
  if (user.version && decoded.version && user.version !== decoded.version) {
    logger.debug(`Token version mismatch`);
    return res.status(401).json({ success: false, error: "Session no longer valid", code: "TOKEN_REVOKED" });
  }

  req.user = {
    _id: user._id.toString(),
    id: user._id.toString(),
    email: user.email,
    nickname: user.nickname,
    role: user.role,
    settings: user.settings,
  };

  logger.debug(`[AUTH] Authenticated user ${req.user._id} for ${req.method} ${req.originalUrl}`);
  next();
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
 * Optional auth (populate req.user if token valid, but don’t block)
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
    let userId = decoded.id || decoded.userId || (decoded.user && decoded.user._id);
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      const user = await User.findById(userId).select("+version");
      if (user && (!user.version || user.version === decoded.version)) {
        req.user = { _id: user._id.toString(), id: user._id.toString(), role: user.role };
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
