// server/socket/permissions.js
import mongoose from 'mongoose';
import { User, PhotoPermission } from '../models/index.js';
import logger from '../logger.js';

/**
 * Send a photo permission request notification via Socket.IO
 */
const sendPhotoRequestNotification = (io, ownerId, permissionData, requesterInfo) => {
  try {
    io.to(ownerId.toString()).emit('photoPermissionRequestReceived', {
      requester: requesterInfo,
      photoId: permissionData.photo,
      permissionId: permissionData._id,
      timestamp: new Date(),
    });
    logger.info(`Photo permission request notification sent to user ${ownerId}`);
  } catch (error) {
    logger.error(`Error sending photo permission request socket notification: ${error.message}`);
  }
};

/**
 * Send a photo permission response notification via Socket.IO
 */
const sendPhotoResponseNotification = (io, requesterId, permissionData, ownerInfo) => {
  try {
    io.to(requesterId.toString()).emit('photoPermissionResponseReceived', {
      owner: ownerInfo,
      photoId: permissionData.photo,
      permissionId: permissionData._id,
      status: permissionData.status,
      timestamp: new Date(),
    });
    logger.info(`Photo permission response notification sent to user ${requesterId}`);
  } catch (error) {
    logger.error(`Error sending photo permission response socket notification: ${error.message}`);
  }
};

/**
 * Register photo permission related socket handlers
 */
const registerPermissionHandlers = (io, socket, userConnections) => {
  const userId = socket.user._id.toString();

  /**
   * Handle request photo permission event
   * data: { ownerId: string, photoId: string }
   */
  socket.on('requestPhotoPermission', async (data) => {
    const { ownerId, photoId } = data;
    const uniqueRequestId = `req-<span class="math-inline">\{photoId\}\-</span>{userId}`; // Simple ID for response tracking

    try {
      logger.debug(`User ${userId} requesting access to photo ${photoId} from owner ${ownerId}`);

      // Validate IDs
      if (!mongoose.Types.ObjectId.isValid(ownerId) || !mongoose.Types.ObjectId.isValid(photoId)) {
        socket.emit('photoPermissionError', { requestId: uniqueRequestId, error: 'Invalid ID format' });
        return;
      }

      // Find owner and photo
      const owner = await User.findById(ownerId).select('photos settings');
      if (!owner) {
        socket.emit('photoPermissionError', { requestId: uniqueRequestId, error: 'Owner not found' });
        return;
      }
      const photo = owner.photos.id(photoId);
      if (!photo) {
        socket.emit('photoPermissionError', { requestId: uniqueRequestId, error: 'Photo not found' });
        return;
      }
      if (!photo.isPrivate) {
        socket.emit('photoPermissionError', { requestId: uniqueRequestId, error: 'Photo is not private' });
        return;
      }
       if (ownerId === userId) {
         socket.emit('photoPermissionError', { requestId: uniqueRequestId, error: 'Cannot request access to your own photo' });
         return;
       }

      // Check for existing permission
      let permission = await PhotoPermission.findOne({ photo: photoId, requestedBy: userId });

      if (permission) {
        logger.info(`Permission request already exists for photo ${photoId} by user ${userId}`);
        socket.emit('photoPermissionRequested', {
          requestId: uniqueRequestId,
          success: true,
          status: permission.status, // Send current status
          message: 'Permission request already exists.',
          permissionId: permission._id
        });
        return; // Don't create a new one or notify again if pending
      }

      // Create new permission request
      permission = new PhotoPermission({
        photo: photoId,
        requestedBy: userId,
        photoOwnerId: ownerId, // Store owner ID for easier querying if needed
        status: 'pending',
      });
      await permission.save();

      // Respond to requester
      socket.emit('photoPermissionRequested', {
        requestId: uniqueRequestId,
        success: true,
        status: 'pending',
        message: 'Permission requested successfully.',
        permissionId: permission._id
      });

      // Notify the owner in real-time if they have notifications enabled
       const ownerSettings = owner.settings || {};
       if (ownerSettings.notifications?.photoRequests !== false) {
           const requesterInfo = {
               _id: socket.user._id,
               nickname: socket.user.nickname,
               photos: socket.user.photos, // Send necessary info
           };
           sendPhotoRequestNotification(io, ownerId, permission, requesterInfo);
       }

    } catch (error) {
      logger.error(`Error processing requestPhotoPermission: ${error.message}`);
      socket.emit('photoPermissionError', { requestId: uniqueRequestId, error: 'Server error processing request' });
    }
  });

  /**
   * Handle respond to photo permission event
   * data: { permissionId: string, status: 'approved' | 'rejected' }
   */
  socket.on('respondToPhotoPermission', async (data) => {
    const { permissionId, status } = data;
    const uniqueRequestId = `res-<span class="math-inline">\{permissionId\}\-</span>{userId}`;

    try {
      logger.debug(`User ${userId} responding to permission ${permissionId} with status ${status}`);

      if (!mongoose.Types.ObjectId.isValid(permissionId)) {
        socket.emit('photoPermissionError', { requestId: uniqueRequestId, error: 'Invalid permission ID' });
        return;
      }
      if (!['approved', 'rejected'].includes(status)) {
        socket.emit('photoPermissionError', { requestId: uniqueRequestId, error: 'Invalid status' });
        return;
      }

      const permission = await PhotoPermission.findById(permissionId);
      if (!permission) {
        socket.emit('photoPermissionError', { requestId: uniqueRequestId, error: 'Permission request not found' });
        return;
      }

      // Verify the current user owns the photo associated with the permission
      const owner = await User.findById(userId).select('_id photos');
      const photo = owner?.photos.id(permission.photo);

      if (!owner || !photo) {
        socket.emit('photoPermissionError', { requestId: uniqueRequestId, error: 'You do not own this photo' });
        return;
      }

      // Update permission status
      permission.status = status;
      permission.respondedAt = new Date();
      if (status === 'approved') {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30); // Default 30 days access
        permission.expiresAt = expiryDate;
      } else {
        permission.expiresAt = null;
      }
      await permission.save();

      // Respond to the owner (current socket)
      socket.emit('photoPermissionResponded', {
        requestId: uniqueRequestId,
        success: true,
        permissionId: permission._id,
        status: permission.status
      });

      // Notify the requester in real-time if they have notifications enabled
       const requester = await User.findById(permission.requestedBy).select('settings');
       if (requester?.settings?.notifications?.photoRequests !== false) {
           const ownerInfo = {
               _id: owner._id,
               nickname: owner.nickname,
               photos: owner.photos,
           };
           sendPhotoResponseNotification(io, permission.requestedBy, permission, ownerInfo);
       }

    } catch (error) {
      logger.error(`Error processing respondToPhotoPermission: ${error.message}`);
      socket.emit('photoPermissionError', { requestId: uniqueRequestId, error: 'Server error processing response' });
    }
  });
};

export { registerPermissionHandlers };
