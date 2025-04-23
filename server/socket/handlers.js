// server/socket/handlers.js

import { User } from "../models/index.js";
import logger from "../logger.js";
import { registerCallHandlers } from "./call.js";
import {
  registerPermissionHandlers,
  sendPhotoPermissionRequestNotification,
} from "./permissions.js";
import {
  registerMessagingHandlers,
  sendMessageNotification,
  sendLikeSocketNotification
} from "./messaging.js";
import { registerNotificationHandlers } from "./notification.js";

// Simple logger fallback with consistent naming
const log = {
  info: (...args) => console.log("[socket:handlers]", ...args),
  error: (...args) => console.error("[socket:handlers]", ...args),
  warn: (...args) => console.warn("[socket:handlers]", ...args),
  debug: (...args) => console.debug("[socket:handlers]", ...args)
};

// --- Socket event constants ---
const EVENTS = {
  PING: "ping",
  PONG: "pong",
  UPDATE_PRIVACY: "updatePrivacySettings",
  DISCONNECT: "disconnect",
  USER_ONLINE: "userOnline",
  USER_OFFLINE: "userOffline"
};

// --- Which privacy fields we accept ---
const PRIVACY_FIELDS = [
  "showOnlineStatus",
  "showReadReceipts",
  "showLastSeen",
  "allowStoryReplies"
];

/**
 * Wraps a listener to catch & log any errors
 * @param {(data: any) => Promise<void>} fn
 * @returns {(data: any) => void}
 */
const safeListener = fn => data => {
  Promise.resolve(fn(data)).catch(err => {
    log.error("Listener error:", err);
  });
};

/**
 * Broadcast user presence (online/offline) if allowed by their privacy
 * @param {import("socket.io").Server} io
 * @param {string} eventName one of EVENTS.USER_ONLINE | EVENTS.USER_OFFLINE
 * @param {string} userId
 */
async function emitPresence(io, eventName, userId) {
  try {
    const user = await User.findById(userId).select("settings.privacy");
    const show = user?.settings?.privacy?.showOnlineStatus !== false;
    if (!show) {
      log.info(`Privacy hides presence for ${userId}`);
      return;
    }
    io.emit(eventName, { userId, timestamp: Date.now() });
    log.info(`Emitted ${eventName} for ${userId}`);
  } catch (err) {
    log.error(`Failed to emit presence for ${userId}:`, err);
  }
}

/**
 * Handles cleanup and status update when a socket disconnects
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 * @param {Map<string, Set<string>>} userConnections
 */
export const handleUserDisconnect = async (io, socket, userConnections) => {
  log.info(`Socket ${socket.id} disconnected`);
  const userId = socket.user?.id?.toString();
  if (!userId || !userConnections.has(userId)) return;

  // Remove this socket from the user's connection set
  const conns = userConnections.get(userId);
  conns.delete(socket.id);

  // If no more sockets, mark offline
  if (conns.size === 0) {
    userConnections.delete(userId);
    try {
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastActive: Date.now()
      });
      await emitPresence(io, EVENTS.USER_OFFLINE, userId);
    } catch (err) {
      log.error(`Error updating offline status for ${userId}:`, err);
    }
  } else {
    log.info(`User ${userId} still has ${conns.size} connection(s)`);
  }
};

/**
 * Apply allowed privacy updates onto a user document
 * @param {import("mongoose").Document & { settings?: any }} user
 * @param {object} data
 */
function applyPrivacyUpdates(user, data) {
  user.settings = user.settings || {};
  user.settings.privacy = user.settings.privacy || {};
  PRIVACY_FIELDS.forEach(field => {
    if (data[field] !== undefined) {
      user.settings.privacy[field] = data[field];
    }
  });
}

/**
 * Register all socket event handlers for a new connection
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 * @param {Map<string, Set<string>>} userConnections
 * @param {object} rateLimiters
 */
export const registerSocketHandlers = (io, socket, userConnections, rateLimiters) => {
  // Save map for global access if needed
  io.userConnectionsMap = userConnections;

  // Pong reply
  socket.on(EVENTS.PING, safeListener(() => socket.emit(EVENTS.PONG)));

  // Update privacy settings
  socket.on(EVENTS.UPDATE_PRIVACY, safeListener(async data => {
    const userId = socket.user?.id;
    if (!userId) {
      log.warn(`Unauthenticated socket ${socket.id} tried to update privacy`);
      return;
    }

    log.info(`Privacy update request from ${userId}: ${JSON.stringify(data)}`);
    const user = await User.findById(userId);
    if (!user) {
      log.warn(`User ${userId} not found`);
      return;
    }

    applyPrivacyUpdates(user, data);
    await user.save();

    // Broadcast presence change if they toggled showOnlineStatus
    if (data.showOnlineStatus === false) {
      await emitPresence(io, EVENTS.USER_OFFLINE, userId.toString());
    } else if (data.showOnlineStatus === true) {
      await emitPresence(io, EVENTS.USER_ONLINE, userId.toString());
    }
  }));

  // Clean up on disconnect
  socket.on(EVENTS.DISCONNECT, safeListener(reason => {
    log.debug(`Disconnect reason: ${reason}`);
    return handleUserDisconnect(io, socket, userConnections);
  }));

  // Delegate to feature modules
  registerMessagingHandlers(io, socket, userConnections, rateLimiters);
  registerCallHandlers(io, socket, userConnections, rateLimiters);
  registerPermissionHandlers(io, socket, userConnections);
  registerNotificationHandlers(io, socket, userConnections, rateLimiters);

  // On initial connect, broadcast userOnline if allowed
  const userId = socket.user?.id?.toString();
  if (userId) {
    emitPresence(io, EVENTS.USER_ONLINE, userId);
  } else {
    log.warn(`Socket ${socket.id} connected without user context`);
  }
};

// No re-exports to avoid duplicate export errors
