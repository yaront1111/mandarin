// server/src/sockets/notification.js

import { Notification, User } from "../models/index.js";
import logger from "../logger.js";

// Simple logger fallback if logger.create doesn't exist
const log = {
  info: (...args) => console.log("[socket:notification]", ...args),
  error: (...args) => console.error("[socket:notification]", ...args),
  warn: (...args) => console.warn("[socket:notification]", ...args),
  debug: (...args) => console.debug("[socket:notification]", ...args)
};

// Socket event names
const EVENTS = {
  GET_SETTINGS:             "getNotificationSettings",
  SETTINGS:                 "notificationSettings",
  SETTINGS_ERROR:           "notificationSettingsError",
  UPDATE_SETTINGS:          "updateNotificationSettings",
  MARK_READ:                "markNotificationRead",
  MARK_ALL_READ:            "markAllNotificationsRead",
  NOTIFICATION_ERROR:       "notificationError",
  NOTIFICATION_READ:        "notificationRead",
  ALL_NOTIFICATIONS_READ:   "allNotificationsRead",
  EMIT_GENERIC:             "notification"
};

/**
 * Wraps async handlers to catch & log errors
 * @param {Function} fn
 * @returns {Function}
 */
const safeListener = fn => async (payload) => {
  try {
    await fn(payload);
  } catch (err) {
    log.error("Listener error:", err);
  }
};

/**
 * Send a payload to the socket, catching errors
 * @param {SocketIO.Socket} socket
 * @param {string} event
 * @param {any} data
 */
const safeEmit = (socket, event, data) => {
  try {
    socket.emit(event, data);
  } catch (err) {
    log.error(`Emit error [${event}]:`, err);
  }
};

/**
 * Load or initialize a user's notification settings
 * @param {string} userId
 * @returns {object}
 */
async function loadSettings(userId) {
  const user = await User.findById(userId).select("settings.notifications").lean();
  return user?.settings?.notifications ?? {
    messages: true,
    calls:    true,
    stories:  true,
    likes:    true,
    comments: true,
    photoRequests: true
  };
}

/**
 * Register all notification‑related socket handlers
 */
export function registerNotificationHandlers(io, socket, userConnections, rateLimiters) {
  // GET current settings
  socket.on(
    EVENTS.GET_SETTINGS,
    safeListener(async () => {
      if (!socket.user?.id) {
        return safeEmit(socket, EVENTS.SETTINGS_ERROR, { error: "Authentication required" });
      }
      const settings = await loadSettings(socket.user.id);
      safeEmit(socket, EVENTS.SETTINGS, { settings });
    })
  );

  // UPDATE settings
  socket.on(
    EVENTS.UPDATE_SETTINGS,
    safeListener(async (newSettings) => {
      if (!socket.user?.id) {
        return safeEmit(socket, EVENTS.SETTINGS_ERROR, { error: "Authentication required" });
      }
      if (typeof newSettings !== "object") {
        return safeEmit(socket, EVENTS.SETTINGS_ERROR, { error: "Invalid format" });
      }
      const user = await User.findById(socket.user.id);
      if (!user) {
        return safeEmit(socket, EVENTS.SETTINGS_ERROR, { error: "User not found" });
      }
      user.settings = user.settings || {};
      user.settings.notifications = {
        ...user.settings.notifications,
        ...newSettings
      };
      await user.save();
      log.info(`Notification settings updated for ${socket.user.id}`);
      safeEmit(socket, EVENTS.SETTINGS, { settings: user.settings.notifications });
    })
  );

  // MARK single as read
  socket.on(
    EVENTS.MARK_READ,
    safeListener(async (notificationId) => {
      if (!socket.user?.id) {
        return safeEmit(socket, EVENTS.NOTIFICATION_ERROR, { error: "Authentication required" });
      }
      const notif = await Notification.findOne({
        id: notificationId,
        recipient: socket.user.id
      });
      if (!notif) {
        return safeEmit(socket, EVENTS.NOTIFICATION_ERROR, { error: "Notification not found", notificationId });
      }
      if (!notif.read) {
        notif.read = true;
        notif.readAt = new Date();
        await notif.save();
        log.debug(`Notification ${notificationId} marked read by ${socket.user.id}`);
      }
      safeEmit(socket, EVENTS.NOTIFICATION_READ, { notificationId });
    })
  );

  // MARK all as read
  socket.on(
    EVENTS.MARK_ALL_READ,
    safeListener(async () => {
      if (!socket.user?.id) {
        return safeEmit(socket, EVENTS.NOTIFICATION_ERROR, { error: "Authentication required" });
      }
      const result = await Notification.updateMany(
        { recipient: socket.user.id, read: false },
        { read: true, readAt: new Date() }
      );
      log.debug(`User ${socket.user.id} marked ${result.modifiedCount} notifications as read`);
      safeEmit(socket, EVENTS.ALL_NOTIFICATIONS_READ, { count: result.modifiedCount });
    })
  );
}

/**
 * Send and (optionally) persist a notification
 * @param {SocketIO.Server} io
 * @param {object} notification   – must contain at least recipient, type
 * @param {boolean} saveToDB
 * @returns {Promise<Notification|null>}
 */
export async function sendNotification(io, notification, saveToDB = true) {
  try {
    if (!notification.recipient || !notification.type) {
      log.error("sendNotification: missing recipient or type");
      return null;
    }

    let saved = null;
    if (saveToDB) {
      // createWithBundling should handle count/bundle logic
      saved = await Notification.createWithBundling(notification);
    }

    const recipientId = notification.recipient.toString();
    const socketIds = io.userConnectionsMap?.get(recipientId) ?? new Set();

    if (socketIds.size > 0) {
      // populate sender if needed
      let payload = saved ?? notification;
      if (notification.sender && typeof notification.sender !== "object") {
        try {
          const populated = await Notification.findById(saved?.id)
            .populate("sender", "nickname username photos avatar")
            .lean();
          payload = populated ?? payload;
        } catch (err) {
          log.error("Failed to populate sender:", err);
        }
      }

      // determine event name
      const typeToEvent = {
        message:         "newMessage",
        like:            "newLike",
        match:           "newLike",
        story:           "newStory",
        photoRequest:    "photoPermissionRequestReceived",
        photoResponse:   "photoPermissionResponseReceived",
        comment:         "newComment",
        call:            "incomingCall"
      };
      const eventName = typeToEvent[notification.type] ?? "notification";

      // emit to each socket
      for (const sid of socketIds) {
        io.to(sid).emit(eventName, payload);
        if (eventName !== EVENTS.EMIT_GENERIC) {
          io.to(sid).emit(EVENTS.EMIT_GENERIC, payload);
        }
      }
      log.info(`Sent "${notification.type}" to ${socketIds.size} socket(s) of user ${recipientId}`);
    } else {
      log.debug(`User ${recipientId} offline—notification saved only`);
    }

    return saved;
  } catch (err) {
    log.error("sendNotification error:", err);
    return null;
  }
}

/**
 * Shortcut: send a message notification
 */
export async function sendMessageNotification(io, sender, recipient, message) {
  if (!sender?.id || !recipient?.id || !message) {
    log.error("sendMessageNotification: missing params");
    return null;
  }
  return sendNotification(io, {
    recipient: recipient.id,
    sender:    sender.id,
    type:      "message",
    title:     `New message from ${sender.nickname || "Someone"}`,
    content:   message.content,
    reference: message.id,
    data:      { message }
  });
}

/**
 * Shortcut: send a like or match notification
 */
export async function sendLikeNotification(io, sender, recipient, likeData) {
  if (!sender?.id || !recipient?.id) {
    log.error("sendLikeNotification: missing params");
    return null;
  }
  const isMatch = Boolean(likeData.isMatch);
  return sendNotification(io, {
    recipient: recipient.id,
    sender:    sender.id,
    type:      isMatch ? "match" : "like",
    title:     isMatch
                 ? `You matched with ${sender.nickname || "Someone"}!`
                 : `${sender.nickname || "Someone"} liked you`,
    content:   isMatch
                 ? "You both liked each other. Start chatting!"
                 : "Someone just liked your profile",
    reference: likeData.id,
    data:      likeData
  });
}

/**
 * Shortcut: send a photo permission request notification
 */
export async function sendPhotoPermissionRequestNotification(io, requester, owner, permission) {
  if (!requester?.id || !owner?.id || !permission?.id) {
    log.error("sendPhotoPermissionRequestNotification: missing params");
    return null;
  }
  return sendNotification(io, {
    recipient: owner.id,
    sender:    requester.id,
    type:      "photoRequest",
    title:     `${requester.nickname || "Someone"} requested access to your photo`,
    content:   "Review their request",
    reference: permission.id,
    data:      { permissionId: permission.id, photoId: permission.photo }
  });
}

/**
 * Shortcut: send a photo permission response notification
 */
export async function sendPhotoPermissionResponseNotification(io, owner, requester, permission) {
  if (!owner?.id || !requester?.id || !permission?.id) {
    log.error("sendPhotoPermissionResponseNotification: missing params");
    return null;
  }
  const approved = permission.status === "approved";
  return sendNotification(io, {
    recipient: requester.id,
    sender:    owner.id,
    type:      "photoResponse",
    title:     approved
                 ? `${owner.nickname || "Someone"} approved your photo request`
                 : `${owner.nickname || "Someone"} declined your photo request`,
    content:   approved
                 ? "You can now view their private photo"
                 : "Your request was declined",
    reference: permission.id,
    data:      { permissionId: permission.id, status: permission.status }
  });
}

/**
 * Shortcut: send a comment notification
 */
export async function sendCommentNotification(io, commenter, owner, commentData) {
  if (!commenter?.id || !owner?.id || !commentData?.id) {
    log.error("sendCommentNotification: missing params");
    return null;
  }
  return sendNotification(io, {
    recipient: owner.id,
    sender:    commenter.id,
    type:      "comment",
    title:     `${commenter.nickname || "Someone"} commented on your post`,
    content:   commentData.content,
    reference: commentData.id,
    data:      { commentId: commentData.id, postId: commentData.postId }
  });
}

export default {
  registerNotificationHandlers,
  sendNotification,
  sendMessageNotification,
  sendLikeNotification,
  sendPhotoPermissionRequestNotification,
  sendPhotoPermissionResponseNotification,
  sendCommentNotification
};
