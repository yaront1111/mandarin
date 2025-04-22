// server/src/sockets/messaging.js

import { Message, User, Notification } from "../models/index.js";
import logger from "../logger.js";
import { safeObjectId } from "../utils/index.js";

// Professional logger fallback with consistent naming (production-ready)
const log = {
  info: (...args) => console.log("[socket:messaging]", ...args),
  error: (...args) => console.error("[socket:messaging]", ...args),
  warn: (...args) => console.warn("[socket:messaging]", ...args),
  debug: (...args) => console.debug("[socket:messaging]", ...args)
};

// Socket event names
const EVENTS = {
  SEND_MESSAGE:     "sendMessage",
  MESSAGE_SENT:     "messageSent",
  MESSAGE_RECEIVED: "messageReceived",
  MESSAGE_ERROR:    "messageError",
  TYPING:           "typing",
  USER_TYPING:      "userTyping",
  MESSAGE_READ:     "messageRead",
  MESSAGES_READ:    "messagesRead"
};

/**
 * Wrap a handler so that any thrown error is caught & logged
 * @param {Function} fn
 * @returns {Function}
 */
const safeListener = fn => async (data) => {
  try {
    await fn(data);
  } catch (err) {
    log.error("Handler error:", err);
  }
};

/**
 * Check whether `user.hasBlocked(otherId)` without throwing
 * @param {import("mongoose").Document} userDoc
 * @param {string} otherId
 */
async function isBlocked(userDoc, otherId) {
  return (
    typeof userDoc.hasBlocked === "function" &&
    userDoc.hasBlocked(otherId)
  );
}

/**
 * Send a message notification both via socket and DB
 */
async function sendMessageNotification(io, sender, recipient, message) {
  try {
    const recipientDoc = await User
      .findById(recipient._id)
      .select("settings socketId")
      .lean();

    if (!recipientDoc) return;

    if (await isBlocked(recipientDoc, sender._id)) {
      log.debug(`sendMessageNotification: ${recipient._id} blocked ${sender._id}`);
      return;
    }

    if (recipientDoc.settings?.notifications?.messages !== false) {
      // socket push
      if (recipientDoc.socketId) {
        io.to(recipientDoc.socketId).emit(EVENTS.MESSAGE_RECEIVED, {
          ...message,
          senderName: sender.nickname || sender.username || "User"
        });
      }
      // DB persist
      await Notification.create({
        recipient: recipient._id,
        type:      "message",
        sender:    sender._id,
        content:   message.content,
        reference: message._id
      });
    }
  } catch (err) {
    log.error("sendMessageNotification error:", err);
  }
}

/**
 * Send a like notification via all active sockets & DB
 * Renamed to prevent duplicate exports with notification.js
 */
async function sendLikeSocketNotification(io, sender, recipient, likeData, userConnections) {
  try {
    const recipientDoc = await User
      .findById(recipient._id)
      .select("settings")
      .lean();
    if (!recipientDoc) return;

    if (await isBlocked(recipientDoc, sender._id)) {
      log.debug(`sendLikeSocketNotification: ${recipient._id} blocked ${sender._id}`);
      return;
    }

    if (recipientDoc.settings?.notifications?.likes !== false) {
      const recId = recipient._id.toString();
      const sockets = userConnections.get(recId) || new Set();
      for (const sockId of sockets) {
        io.to(sockId).emit("newLike", {
          sender: {
            _id:      sender._id,
            nickname: sender.nickname,
            photos:   sender.photos
          },
          timestamp: Date.now(),
          ...likeData
        });
      }
      await Notification.create({
        recipient: recipient._id,
        type:      "like",
        sender:    sender._id,
        content:   `${sender.nickname} liked your profile`,
        reference: likeData._id
      });
    }
  } catch (err) {
    log.error("sendLikeSocketNotification error:", err);
  }
}

/**
 * Register all messaging‑related handlers on `socket`
 */
function registerMessagingHandlers(io, socket, userConnections, rateLimiters) {
  const { typingLimiter, messageLimiter } = rateLimiters;

  socket.on(
    EVENTS.SEND_MESSAGE,
    safeListener(data => handleSendMessage(io, socket, userConnections, messageLimiter, data))
  );

  socket.on(
    EVENTS.TYPING,
    safeListener(data => handleTyping(io, socket, userConnections, typingLimiter, data))
  );

  socket.on(
    EVENTS.MESSAGE_READ,
    safeListener(data => handleMessageRead(io, socket, userConnections, data))
  );
}

/**
 * Handle a client "sendMessage" event
 */
async function handleSendMessage(io, socket, userConnections, messageLimiter, data) {
  const { recipientId, type, content, metadata, tempMessageId } = data;
  const senderId = socket.user?._id?.toString();

  if (!senderId) {
    socket.emit(EVENTS.MESSAGE_ERROR, { error: "Not authenticated", tempMessageId });
    return;
  }

  log.debug(`sendMessage from ${senderId} to ${recipientId}: ${type}`);

  // rate limit
  try {
    await messageLimiter.consume(senderId);
  } catch {
    socket.emit(EVENTS.MESSAGE_ERROR, {
      error: "Rate limit exceeded",
      tempMessageId
    });
    return;
  }

  const recOid = safeObjectId(recipientId);
  if (!recOid) {
    socket.emit(EVENTS.MESSAGE_ERROR, { error: "Invalid recipient", tempMessageId });
    return;
  }

  const [recipientDoc, senderDoc] = await Promise.all([
    User.findById(recOid),
    User.findById(senderId)
  ]);
  if (!recipientDoc) {
    socket.emit(EVENTS.MESSAGE_ERROR, { error: "Recipient not found", tempMessageId });
    return;
  }
  if (await isBlocked(recipientDoc, senderId)) {
    socket.emit(EVENTS.MESSAGE_ERROR, { error: "You are blocked", tempMessageId });
    return;
  }
  if (await isBlocked(senderDoc, recipientId)) {
    socket.emit(EVENTS.MESSAGE_ERROR, { error: "You have blocked this user", tempMessageId });
    return;
  }

  // enforce account tier restrictions
  if (
    type !== "wink" &&
    (senderDoc.accountTier === "FREE" || (typeof senderDoc.canSendMessages === "function" && !senderDoc.canSendMessages()))
  ) {
    socket.emit(EVENTS.MESSAGE_ERROR, {
      error: "Upgrade to send messages",
      tempMessageId
    });
    return;
  }

  // save message
  const msg = await new Message({
    sender:    senderId,
    recipient: recOid,
    type,
    content,
    metadata,
    read:      false,
    createdAt: new Date()
  }).save();

  const response = {
    _id:      msg._id.toString(),
    sender:   senderId,
    recipient: recOid.toString(),
    type,
    content,
    metadata,
    createdAt: msg.createdAt,
    read:      false,
    tempMessageId
  };

  socket.emit(EVENTS.MESSAGE_SENT, response);
  log.info(`Message ${msg._id} sent`);

  // forward to recipient sockets
  const recSet = userConnections.get(recOid.toString()) || new Set();
  for (const sockId of recSet) {
    io.to(sockId).emit(EVENTS.MESSAGE_RECEIVED, response);
  }

  // async notification (no await)
  sendMessageNotification(io, socket.user, recipientDoc, response);
}

/**
 * Handle a client "typing" event
 */
async function handleTyping(io, socket, userConnections, typingLimiter, data) {
  const senderId = socket.user?._id?.toString();
  if (!senderId) return;

  try {
    await typingLimiter.consume(senderId);
  } catch {
    return;
  }

  const recOid = safeObjectId(data.recipientId);
  if (!recOid) return;

  const recSet = userConnections.get(recOid.toString()) || new Set();
  for (const sockId of recSet) {
    io.to(sockId).emit(EVENTS.USER_TYPING, {
      userId:    senderId,
      timestamp: Date.now()
    });
  }
}

/**
 * Handle a client "messageRead" event
 */
async function handleMessageRead(io, socket, userConnections, data) {
  const { messageIds = [], sender } = data;
  if (!Array.isArray(messageIds) || messageIds.length === 0) return;

  const senderOid = safeObjectId(sender);
  const readerOid = safeObjectId(socket.user?._id);
  if (!senderOid || !readerOid) return;

  const validIds = messageIds
    .map(safeObjectId)
    .filter(id => id !== null);

  if (validIds.length === 0) return;

  await Message.updateMany(
    { _id: { $in: validIds }, sender: senderOid, recipient: readerOid },
    { $set: { read: true, readAt: new Date() } }
  );

  // notify original sender
  const senderSet = userConnections.get(senderOid.toString()) || new Set();
  for (const sockId of senderSet) {
    io.to(sockId).emit(EVENTS.MESSAGES_READ, {
      reader:     readerOid.toString(),
      messageIds: validIds.map(id => id.toString()),
      timestamp:  Date.now()
    });
  }
}

// Export only the functions needed, avoid duplicate exports
export { registerMessagingHandlers, sendMessageNotification, sendLikeSocketNotification };
