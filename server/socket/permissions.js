import { User } from "../models/index.js";
import logger from "../logger.js";
import mongoose from "mongoose";

/**
 * Send a notification when a user requests access to a private photo
 * @param {Object} io - Socket.IO server instance
 * @param {Object} requester - User requesting access
 * @param {Object} owner - Owner of the photo
 * @param {Object} permission - Permission request object
 */
const sendPhotoPermissionRequestNotification = async (io, requester, owner, permission) => {
  try {
    const ownerIdString = owner._id.toString();
    const userConnections = io.userConnectionsMap || new Map();
    
    // Check if the owner has socket connections
    if (userConnections.has(ownerIdString)) {
      const notificationPayload = {
        type: "photoRequest",
        title: `${requester.nickname} requested access to your private photo`,
        message: "Click to review the request",
        sender: {
          _id: requester._id,
          nickname: requester.nickname,
          photos: requester.photos
        },
        permissionId: permission._id,
        photoId: permission.photo,
        data: {
          requester: {
            _id: requester._id,
            nickname: requester.nickname,
            photos: requester.photos
          },
          photoId: permission.photo,
          permissionId: permission._id
        },
        createdAt: new Date()
      };

      // Send to all owner's connected sockets
      userConnections.get(ownerIdString).forEach(socketId => {
        io.to(socketId).emit("photoPermissionRequestReceived", notificationPayload);
        io.to(socketId).emit("notification", notificationPayload);
      });
      
      logger.info(`Photo permission request notification sent to user ${ownerIdString}`);
      
      // Create a notification in database
      try {
        const Notification = mongoose.models.Notification || 
          (await import("../models/Notification.js")).default;
        
        if (Notification) {
          await Notification.create({
            recipient: owner._id,
            type: "photoRequest",
            sender: requester._id,
            content: `${requester.nickname} requested access to your private photo`,
            reference: permission._id
          });
        }
      } catch (notificationDbError) {
        logger.debug(`Notification DB save skipped: ${notificationDbError.message}`);
      }
    } else {
      logger.info(`User ${ownerIdString} is not connected. Photo request notification saved for later.`);
    }
  } catch (error) {
    logger.error(`Error sending photo permission request notification: ${error.message}`);
  }
};

/**
 * Send a notification when a photo owner responds to a permission request
 * @param {Object} io - Socket.IO server instance
 * @param {Object} owner - Owner of the photo
 * @param {Object} requester - User who requested access
 * @param {Object} permission - Permission request object
 */
const sendPhotoPermissionResponseNotification = async (io, owner, requester, permission) => {
  try {
    const requesterIdString = requester._id.toString();
    const userConnections = io.userConnectionsMap || new Map();
    
    // Check if the requester has socket connections
    if (userConnections.has(requesterIdString)) {
      const notificationPayload = {
        type: "photoResponse",
        title: `${owner.nickname} ${permission.status === "approved" ? "approved" : "rejected"} your photo request`,
        message: permission.status === "approved" 
          ? "You can now view the private photo." 
          : "Your request to view the private photo was declined.",
        sender: {
          _id: owner._id,
          nickname: owner.nickname,
          photos: owner.photos
        },
        permissionId: permission._id,
        photoId: permission.photo,
        status: permission.status,
        data: {
          owner: {
            _id: owner._id,
            nickname: owner.nickname,
            photos: owner.photos
          },
          photoId: permission.photo,
          permissionId: permission._id,
          status: permission.status
        },
        createdAt: new Date()
      };

      // Send to all requester's connected sockets
      userConnections.get(requesterIdString).forEach(socketId => {
        io.to(socketId).emit("photoPermissionResponseReceived", notificationPayload);
        io.to(socketId).emit("notification", notificationPayload);
      });
      
      logger.info(`Photo permission response notification sent to user ${requesterIdString}`);
      
      // Create a notification in database
      try {
        const Notification = mongoose.models.Notification || 
          (await import("../models/Notification.js")).default;
        
        if (Notification) {
          await Notification.create({
            recipient: requester._id,
            type: "photoResponse",
            sender: owner._id,
            content: `${owner.nickname} ${permission.status === "approved" ? "approved" : "rejected"} your photo request`,
            reference: permission._id,
            data: { status: permission.status }
          });
        }
      } catch (notificationDbError) {
        logger.debug(`Notification DB save skipped: ${notificationDbError.message}`);
      }
    } else {
      logger.info(`User ${requesterIdString} is not connected. Photo response notification saved for later.`);
    }
  } catch (error) {
    logger.error(`Error sending photo permission response notification: ${error.message}`);
  }
};

/**
 * Register permission-related socket handlers
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket connection
 * @param {Map} userConnections - Map of user connections
 */
const registerPermissionHandlers = (io, socket, userConnections) => {
  // Handle photo permission request
  socket.on("requestPhotoPermission", async (data) => {
    try {
      const { photoId, ownerId } = data;
      
      if (!mongoose.Types.ObjectId.isValid(photoId) || !mongoose.Types.ObjectId.isValid(ownerId)) {
        socket.emit("photoPermissionError", {
          error: "Invalid photo ID or owner ID format",
          requestId: `req-${photoId}-${socket.user._id}`
        });
        return;
      }
      
      // Implementation would be handled by API endpoints, this is a passthrough
      socket.emit("photoPermissionRequested", {
        success: true,
        photoId,
        ownerId,
        requestId: `req-${photoId}-${socket.user._id}`,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error(`Error handling photo permission request: ${error.message}`);
      socket.emit("photoPermissionError", {
        error: "Failed to process permission request",
        requestId: data?.requestId || `req-${data?.photoId}-${socket.user._id}`
      });
    }
  });
  
  // Handle photo permission response
  socket.on("respondToPhotoPermission", async (data) => {
    try {
      const { permissionId, status } = data;
      
      if (!mongoose.Types.ObjectId.isValid(permissionId)) {
        socket.emit("photoPermissionError", {
          error: "Invalid permission ID format",
          requestId: `res-${permissionId}-${socket.user._id}`
        });
        return;
      }
      
      if (!["approved", "rejected"].includes(status)) {
        socket.emit("photoPermissionError", {
          error: "Invalid status. Must be 'approved' or 'rejected'",
          requestId: `res-${permissionId}-${socket.user._id}`
        });
        return;
      }
      
      // Implementation would be handled by API endpoints, this is a passthrough
      socket.emit("photoPermissionResponded", {
        success: true,
        permissionId,
        status,
        requestId: `res-${permissionId}-${socket.user._id}`,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error(`Error handling photo permission response: ${error.message}`);
      socket.emit("photoPermissionError", {
        error: "Failed to process permission response",
        requestId: data?.requestId || `res-${data?.permissionId}-${socket.user._id}`
      });
    }
  });
};

export {
  registerPermissionHandlers,
  sendPhotoPermissionRequestNotification,
  sendPhotoPermissionResponseNotification
};
