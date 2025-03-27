import { User } from "../models/index.js";
import logger from "../logger.js";
// --- FIX: Attempt to import from where it might be defined (e.g., messaging.js) ---
import { registerMessagingHandlers /*, sendLikeNotification as sendMessagingLikeNotification */ } from "./messaging.js";
import { registerCallHandlers } from "./call.js";
import { registerPermissionHandlers } from "./permissions.js";

// --- FIX AREA 1 (Related): Ensure sendLikeNotification is defined/exported ---
/**
 * Sends a notification when a user likes another user.
 * This function needs to be defined OR imported correctly.
 * @param {object} io - Socket.IO server instance.
 * @param {object} senderUser - User object of the person who liked.
 * @param {object} targetUser - User object of the person who was liked.
 * @param {object} likeDetails - Details about the like (e.g., like._id, isMatch).
 */
const sendLikeNotification = async (io, senderUser, targetUser, likeDetails) => {
  // NOTE: This is an EXAMPLE implementation. The actual logic might live elsewhere (e.g., messaging.js)
  // You need to find the correct definition or implement it based on your needs.
  // It also needs access to `userConnections` which should be passed in or accessed globally.
  const userConnections = io.userConnectionsMap || new Map(); // Assuming userConnections is attached to io or globally accessible

  try {
    const targetUserIdString = targetUser._id.toString();
    const targetSocketIds = userConnections.get(targetUserIdString);

    if (targetSocketIds && targetSocketIds.size > 0) {
      const notificationPayload = {
        type: likeDetails.isMatch ? 'MATCH' : 'LIKE',
        message: likeDetails.isMatch
          ? `You matched with ${senderUser.nickname}!`
          : `${senderUser.nickname} liked you!`,
        sender: {
          _id: senderUser._id,
          nickname: senderUser.nickname,
          photos: senderUser.photos
        },
        likeId: likeDetails._id,
        createdAt: new Date()
      };

      targetSocketIds.forEach(socketId => {
        io.to(socketId).emit('notification', notificationPayload);
      });
      logger.info(`Sent ${notificationPayload.type} notification to user ${targetUserIdString}`);
    } else {
      logger.info(`User ${targetUserIdString} is not connected. Like/Match notification not sent in real-time.`);
      // Optionally: Save notification to DB for later retrieval
    }
  } catch (error) {
    logger.error(`Error sending socket notification for like ${likeDetails._id}: ${error.message}`);
  }
};
// --- End Definition/Placeholder ---


/**
 * Handle user disconnect
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket connection
 * @param {Map} userConnections - Map of user connections
 */
const handleUserDisconnect = async (io, socket, userConnections) => {
  try {
    logger.info(`Socket ${socket.id} disconnected`);

    if (socket.user && socket.user._id) {
      const userId = socket.user._id.toString();

      if (userConnections.has(userId)) {
        userConnections.get(userId).delete(socket.id);

        if (userConnections.get(userId).size === 0) {
          userConnections.delete(userId);

          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastActive: Date.now(),
          });

          io.emit("userOffline", { userId, timestamp: Date.now() });
          logger.info(`User ${userId} is now offline (no active connections)`);
        } else {
          logger.info(`User ${userId} still has ${userConnections.get(userId).size} active connections`);
        }
      }
    }
  } catch (error) {
    logger.error(`Error handling disconnect for ${socket.id}: ${error.message}`);
  }
};

/**
 * Register all socket event handlers
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket connection
 * @param {Map} userConnections - Map of user connections
 * @param {Object} rateLimiters - Rate limiters
 */
const registerSocketHandlers = (io, socket, userConnections, rateLimiters) => {
  socket.on("ping", () => {
    try {
      socket.emit("pong");
    } catch (error) {
      logger.error(`Error handling ping from ${socket.id}: ${error.message}`);
    }
  });

  socket.on("disconnect", async (reason) => {
    try {
      await handleUserDisconnect(io, socket, userConnections);
      logger.debug(`Disconnect reason: ${reason}`);
    } catch (error) {
      logger.error(`Error in disconnect event: ${error.message}`);
    }
  });

  registerMessagingHandlers(io, socket, userConnections, rateLimiters);
  registerCallHandlers(io, socket, userConnections, rateLimiters);
  registerPermissionHandlers(io, socket, userConnections);

  if (socket.user && socket.user._id) {
     io.emit("userOnline", {
       userId: socket.user._id.toString(),
       timestamp: Date.now(),
     });
     logger.info(`Socket handlers registered for user ${socket.user._id}`);
  } else {
     logger.warn(`Socket connected (${socket.id}) but user details are missing. Cannot emit userOnline.`);
  }
};

// --- FIX: Export sendLikeNotification if it's defined here ---
export { registerSocketHandlers, handleUserDisconnect, sendLikeNotification };
// If it was imported as sendMessagingLikeNotification, you might re-export it:
// export { registerSocketHandlers, handleUserDisconnect, sendMessagingLikeNotification as sendLikeNotification };
