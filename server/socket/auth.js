// socketAuth.js
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import logger from '../logger.js';
import config from '../config.js';

const {
  JWT_SECRET,
  SOCKET_RATE_LIMIT_MAX = 100,
  SOCKET_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000,    // 15 min
  SOCKET_CLEANUP_INTERVAL_MS = 5  * 60 * 1000,     // 5 min
  INACTIVITY_THRESHOLD_MS = 10 * 60 * 1000,        // 10 min
} = config;

/**
 * Simple in‑memory sliding‑window rate limiter keyed by an identifier (e.g. IP).
 */
class RateLimiter {
  constructor({ maxAttempts, windowMs, cleanupIntervalMs }) {
    this.maxAttempts       = maxAttempts;
    this.windowMs           = windowMs;
    this.attempts           = new Map();
    this.cleanupIntervalMs = cleanupIntervalMs;

    // Periodic cleanup
    this._cleanupTimer = setInterval(
      () => this.cleanup(),
      this.cleanupIntervalMs
    ).unref();
  }

  /**
   * Record one attempt for `key`. Returns true if limit is exceeded.
   * @param {string} key
   * @returns {boolean}
   */
  isLimited(key) {
    const now = Date.now();
    let entry = this.attempts.get(key);

    if (!entry || entry.resetTime <= now) {
      entry = { count: 1, resetTime: now + this.windowMs };
    } else {
      entry.count += 1;
    }

    this.attempts.set(key, entry);
    return entry.count > this.maxAttempts;
  }

  /**
   * Remove expired entries.
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;
    for (const [key, { resetTime }] of this.attempts) {
      if (resetTime <= now) {
        this.attempts.delete(key);
        removed += 1;
      }
    }
    if (removed) {
      logger.debug(`RateLimiter: cleaned ${removed} entries`);
    }
  }
}

// Initialize a single global limiter
const ipLimiter = new RateLimiter({
  maxAttempts:       SOCKET_RATE_LIMIT_MAX,
  windowMs:          SOCKET_RATE_LIMIT_WINDOW_MS,
  cleanupIntervalMs: SOCKET_CLEANUP_INTERVAL_MS,
});

/**
 * Extract Bearer token from socket handshake.
 * @param {Object} socket
 * @returns {string|null}
 */
function extractToken(socket) {
  const { query, auth, headers } = socket.handshake;
  if (query?.token) return query.token;
  if (auth?.token)  return auth.token;
  if (headers?.authorization) {
    const parts = headers.authorization.split(' ');
    if (parts[0] === 'Bearer' && parts[1]) return parts[1];
  }
  return null;
}

/**
 * Socket.IO authentication middleware.
 * Verifies JWT, checks rate limit, and attaches `socket.user`.
 */
async function socketAuthMiddleware(socket, next) {
  try {
    const ip = socket.handshake.address || '0.0.0.0';

    // Rate-limit by IP
    if (ipLimiter.isLimited(ip)) {
      logger.warn(`Rate limit exceeded for IP ${ip}`);
      return next(new Error('Too many connection attempts; please try later'));
    }

    const token = extractToken(socket);
    if (!token) {
      logger.warn(`Socket ${socket.id} missing auth token`);
      return next(new Error('Authentication token required'));
    }

    if (!JWT_SECRET) {
      logger.error('JWT_SECRET not configured');
      return next(new Error('Server configuration error'));
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      logger.error(`JWT verify failed for socket ${socket.id}: ${err.name}: ${err.message}`);
      if (err.name === 'TokenExpiredError') {
        return next(new Error(`Token expired at ${err.expiredAt}`));
      }
      return next(new Error('Invalid authentication token'));
    }

    if (!payload.id) {
      logger.warn(`Socket ${socket.id} JWT missing user ID`);
      return next(new Error('Invalid token payload'));
    }

    // Load user
    const user = await User.findById(payload.id).select('-password').exec();
    if (!user) {
      logger.warn(`Socket ${socket.id} no user found for ID ${payload.id}`);
      return next(new Error('User not found'));
    }

    // Token version check
    if (payload.version && user.version && payload.version !== user.version) {
      logger.warn(`Socket ${socket.id} token version mismatch`);
      return next(new Error('Token has been revoked; please reauthenticate'));
    }

    // Attach user and update online status
    socket.user = user;
    user.socketId   = socket.id;
    user.isOnline   = true;
    user.lastActive = Date.now();
    user.lastLoginIp = ip;
    await user.save();

    logger.info(`Socket ${socket.id} authenticated as user ${user._id}`);
    next();
  } catch (err) {
    // Enhanced error logging with detailed context
    logger.error(`Socket auth error: ${err.message}`, {
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack
      },
      socket: {
        id: socket.id,
        address: socket.handshake.address,
        headers: socket.handshake.headers,
        query: socket.handshake.query,
        time: new Date().toISOString()
      }
    });
    
    // More descriptive error for client debugging
    next(new Error(`Authentication error: ${err.message}`));
  }
}

/**
 * Permission checker for socket actions.
 * @param {Object} socket
 * @param {string} permission
 * @returns {boolean}
 */
function checkSocketPermission(socket, permission) {
  if (!socket.user) return false;
  switch (permission) {
    case 'sendMessage':
      return typeof socket.user.canSendMessages === 'function'
        ? socket.user.canSendMessages()
        : true;
    case 'createStory':
      return typeof socket.user.canCreateStory === 'function'
        ? socket.user.canCreateStory()
        : true;
    case 'initiateCall':
      return true; // all authenticated users may call
    default:
      return true;
  }
}

/**
 * Disconnect sockets that have been inactive too long.
 * @param {import('socket.io').Server} io
 */
function setupSocketMonitoring(io) {
  setInterval(() => {
    const now = Date.now();
    for (const socket of io.sockets.sockets.values()) {
      if (
        socket.user &&
        socket.lastActivity &&
        now - socket.lastActivity > INACTIVITY_THRESHOLD_MS
      ) {
        logger.warn(`Disconnecting inactive socket ${socket.id}`);
        socket.disconnect(true);
      }
    }
  }, INACTIVITY_THRESHOLD_MS).unref();
}

/**
 * Middleware to track activity timestamp on each incoming event.
 * @param {Object} socket
 */
function trackSocketActivity(socket) {
  socket.use(([event, ...args], next) => {
    socket.lastActivity = Date.now();
    next();
  });
}

export {
  socketAuthMiddleware,
  checkSocketPermission,
  setupSocketMonitoring,
  trackSocketActivity,
};
