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

          // Get the latest user data to check privacy settings
          const user = await User.findById(userId);
          
          // Update online status
          user.isOnline = false;
          user.lastActive = Date.now();
          await user.save();

          // Only emit offline status if the user's settings allow it
          const showOnlineStatus = user.settings?.privacy?.showOnlineStatus !== false;
          
          if (showOnlineStatus) {
            io.emit("userOffline", { userId, timestamp: Date.now() });
            logger.info(`User ${userId} is now offline (no active connections) - status broadcast to others`);
          } else {
            logger.info(`User ${userId} is now offline (no active connections) - status hidden from others`);
          }
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
  
  // Handle privacy settings updates
  socket.on("updatePrivacySettings", async (data) => {
    try {
      if (!socket.user || !socket.user._id) {
        logger.warn(`Unauthenticated socket ${socket.id} tried to update privacy settings`);
        return;
      }
      
      logger.info(`Updating privacy settings for user ${socket.user._id}: ${JSON.stringify(data)}`);
      
      // Update the user's settings in the database
      const userId = socket.user._id;
      const currentUser = await User.findById(userId);
      
      if (!currentUser) {
        logger.warn(`User ${userId} not found when updating privacy settings`);
        return;
      }
      
      // Initialize settings object if it doesn't exist
      if (!currentUser.settings) {
        currentUser.settings = {};
      }
      if (!currentUser.settings.privacy) {
        currentUser.settings.privacy = {};
      }
      
      // Apply the updates
      if (data.showOnlineStatus !== undefined) {
        currentUser.settings.privacy.showOnlineStatus = data.showOnlineStatus;
      }
      if (data.showReadReceipts !== undefined) {
        currentUser.settings.privacy.showReadReceipts = data.showReadReceipts;
      }
      if (data.showLastSeen !== undefined) {
        currentUser.settings.privacy.showLastSeen = data.showLastSeen;
      }
      if (data.allowStoryReplies !== undefined) {
        currentUser.settings.privacy.allowStoryReplies = data.allowStoryReplies;
      }
      
      // Save the updated user
      await currentUser.save();
      logger.info(`Privacy settings updated for user ${userId}`);
      
      // If online status visibility was disabled, emit userOffline to other users
      if (data.showOnlineStatus === false) {
        io.emit("userOffline", { 
          userId: userId.toString(), 
          timestamp: Date.now() 
        });
        logger.info(`Emitted userOffline for ${userId} due to privacy setting change`);
      }
      // If online status visibility was enabled, emit userOnline to other users
      else if (data.showOnlineStatus === true) {
        io.emit("userOnline", { 
          userId: userId.toString(), 
          timestamp: Date.now() 
        });
        logger.info(`Emitted userOnline for ${userId} due to privacy setting change`);
      }
    } catch (error) {
      logger.error(`Error updating privacy settings: ${error.message}`);
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
     // Only emit userOnline if the user's privacy settings allow it
     const showOnlineStatus = socket.user.settings?.privacy?.showOnlineStatus !== false;
     
     if (showOnlineStatus) {
       io.emit("userOnline", {
         userId: socket.user._id.toString(),
         timestamp: Date.now(),
       });
       logger.info(`Socket handlers registered for user ${socket.user._id} (online status visible)`);
     } else {
       logger.info(`Socket handlers registered for user ${socket.user._id} (online status hidden)`);
     }
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
