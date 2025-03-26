import { User } from "../models/index.js";
import logger from "../logger.js";
import { registerMessagingHandlers } from "./messaging.js";
import { registerCallHandlers } from "./call.js";

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

      // Remove this socket from user connections
      if (userConnections.has(userId)) {
        userConnections.get(userId).delete(socket.id);

        // If this was the last connection for this user, update their status
        if (userConnections.get(userId).size === 0) {
          userConnections.delete(userId);

          // Update user status in database
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastActive: Date.now(),
          });

          // Notify other users
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
  // Handle ping (heartbeat)
  socket.on("ping", () => {
    try {
      socket.emit("pong");
    } catch (error) {
      logger.error(`Error handling ping from ${socket.id}: ${error.message}`);
    }
  });

  // Handle disconnect using the consolidated function
  socket.on("disconnect", async (reason) => {
    try {
      await handleUserDisconnect(io, socket, userConnections);
      logger.debug(`Disconnect reason: ${reason}`);
    } catch (error) {
      logger.error(`Error in disconnect event: ${error.message}`);
    }
  });

  // Register messaging handlers
  registerMessagingHandlers(io, socket, userConnections, rateLimiters);

  // Register call and video handlers
  registerCallHandlers(io, socket, userConnections, rateLimiters);

  // Emit user online status when they connect
  io.emit("userOnline", {
    userId: socket.user._id.toString(),
    timestamp: Date.now(),
  });

  logger.info(`Socket handlers registered for user ${socket.user._id}`);
};

export { registerSocketHandlers, handleUserDisconnect };
