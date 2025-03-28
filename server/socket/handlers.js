import { User } from "../models/index.js";
import logger from "../logger.js";
import {
  registerMessagingHandlers,
  sendMessageNotification,
  sendLikeNotification
} from "./messaging.js";
import { registerCallHandlers } from "./call.js";
import {
  registerPermissionHandlers,
  sendPhotoPermissionRequestNotification,
  sendPhotoPermissionResponseNotification
} from "./permissions.js";

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
  // Save userConnections map to the io object for global access
  io.userConnectionsMap = userConnections;

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

export {
  registerSocketHandlers,
  handleUserDisconnect,
  sendLikeNotification,
  sendPhotoPermissionRequestNotification,
  sendPhotoPermissionResponseNotification
};
