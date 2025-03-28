// server/socket/notification.js - Socket handlers for notifications
import { Notification, User } from "../models/index.js";
import logger from "../logger.js";

/**
 * Register notification handlers
 * @param {Object} io - Socket.IO instance
 * @param {Object} socket - User's socket
 * @param {Map} userConnections - Map of user connections
 * @param {Object} rateLimiters - Rate limiters
 */
export const registerNotificationHandlers = (io, socket, userConnections, rateLimiters) => {
  // Get notification settings from the user
  socket.on('getNotificationSettings', async () => {
    try {
      if (!socket.user || !socket.user._id) {
        return socket.emit('notificationSettingsError', { error: 'Authentication required' });
      }

      const user = await User.findById(socket.user._id);
      if (!user) {
        return socket.emit('notificationSettingsError', { error: 'User not found' });
      }

      // Extract notification settings from user
      const settings = user.settings?.notifications || {
        messages: true,
        calls: true,
        stories: true,
        likes: true,
        comments: true,
        photoRequests: true
      };

      socket.emit('notificationSettings', { settings });
    } catch (error) {
      logger.error(`Error fetching notification settings: ${error.message}`);
      socket.emit('notificationSettingsError', { error: 'Failed to fetch notification settings' });
    }
  });

  // Update notification settings
  socket.on('updateNotificationSettings', async (settings) => {
    try {
      if (!socket.user || !socket.user._id) {
        return socket.emit('notificationSettingsError', { error: 'Authentication required' });
      }

      // Validate settings object
      if (!settings || typeof settings !== 'object') {
        return socket.emit('notificationSettingsError', { error: 'Invalid settings format' });
      }

      const user = await User.findById(socket.user._id);
      if (!user) {
        return socket.emit('notificationSettingsError', { error: 'User not found' });
      }

      // Initialize settings object if it doesn't exist
      if (!user.settings) {
        user.settings = {};
      }

      // Initialize notifications object if it doesn't exist
      if (!user.settings.notifications) {
        user.settings.notifications = {};
      }

      // Update specific notification settings
      user.settings.notifications = {
        ...user.settings.notifications,
        ...settings
      };

      await user.save();
      socket.emit('notificationSettings', { settings: user.settings.notifications });
      logger.info(`Updated notification settings for user ${socket.user._id}`);
    } catch (error) {
      logger.error(`Error updating notification settings: ${error.message}`);
      socket.emit('notificationSettingsError', { error: 'Failed to update notification settings' });
    }
  });

  // Mark notification as read
  socket.on('markNotificationRead', async (notificationId) => {
    try {
      if (!socket.user || !socket.user._id) {
        return socket.emit('notificationError', { error: 'Authentication required' });
      }

      const notification = await Notification.findOne({
        _id: notificationId,
        recipient: socket.user._id
      });

      if (!notification) {
        return socket.emit('notificationError', {
          error: 'Notification not found',
          notificationId
        });
      }

      if (!notification.read) {
        notification.read = true;
        notification.readAt = new Date();
        await notification.save();
        logger.debug(`Socket marked notification ${notificationId} as read for user ${socket.user._id}`);
      }

      socket.emit('notificationRead', { notificationId });
    } catch (error) {
      logger.error(`Error marking notification as read: ${error.message}`);
      socket.emit('notificationError', {
        error: 'Failed to mark notification as read',
        notificationId
      });
    }
  });

  // Mark all notifications as read
  socket.on('markAllNotificationsRead', async () => {
    try {
      if (!socket.user || !socket.user._id) {
        return socket.emit('notificationError', { error: 'Authentication required' });
      }

      const result = await Notification.updateMany(
        {
          recipient: socket.user._id,
          read: false
        },
        {
          read: true,
          readAt: new Date()
        }
      );

      logger.debug(`Socket marked all notifications (${result.modifiedCount}) as read for user ${socket.user._id}`);
      socket.emit('allNotificationsRead', { count: result.modifiedCount });
    } catch (error) {
      logger.error(`Error marking all notifications as read: ${error.message}`);
      socket.emit('notificationError', { error: 'Failed to mark all notifications as read' });
    }
  });
};

/**
 * Send a notification to a user
 * @param {Object} io - Socket.IO instance
 * @param {Object} notification - Notification data
 * @param {boolean} saveToDB - Whether to save the notification to the database
 * @returns {Promise<Object|null>} - Created notification or null if error
 */
export const sendNotification = async (io, notification, saveToDB = true) => {
  try {
    // Validate required fields
    if (!notification.recipient || !notification.type) {
      logger.error('Cannot send notification: Missing required fields (recipient or type)');
      return null;
    }

    let savedNotification = null;

    // Save to database if requested
    if (saveToDB) {
      // Use the bundling feature of the Notification model
      savedNotification = await Notification.createWithBundling(notification);
    }

    // Get recipient's socket connections
    const recipientId = notification.recipient.toString();
    const userConnections = io.userConnectionsMap;

    if (userConnections && userConnections.has(recipientId)) {
      const recipientSockets = userConnections.get(recipientId);

      // If recipient has active connections
      if (recipientSockets && recipientSockets.size > 0) {
        // Prepare the notification payload (either the saved one or the input)
        const notificationToSend = savedNotification || notification;

        // Populate sender info if needed and not already populated
        let populatedNotification = notificationToSend;

        if (notificationToSend.sender &&
            typeof notificationToSend.sender !== 'object' &&
            !notificationToSend.sender.nickname) {

          try {
            // If we have a DB notification, populate it
            if (savedNotification) {
              populatedNotification = await Notification.findById(savedNotification._id)
                .populate('sender', 'nickname username photos avatar')
                .lean();
            }
            // Otherwise, try to populate the sender manually
            else if (notification.sender) {
              const sender = await User.findById(notification.sender)
                .select('nickname username photos avatar')
                .lean();

              if (sender) {
                populatedNotification = {
                  ...notification,
                  sender
                };
              }
            }
          } catch (error) {
            logger.error(`Error populating notification sender: ${error.message}`);
            // Continue with unpopulated notification
            populatedNotification = notificationToSend;
          }
        }

        // Choose appropriate socket event based on notification type
        let eventName = 'notification';
        switch (notification.type) {
          case 'message':
            eventName = 'newMessage';
            break;
          case 'like':
            eventName = 'newLike';
            break;
          case 'story':
            eventName = 'newStory';
            break;
          case 'photoRequest':
            eventName = 'photoPermissionRequestReceived';
            break;
          case 'photoResponse':
            eventName = 'photoPermissionResponseReceived';
            break;
          case 'comment':
            eventName = 'newComment';
            break;
          case 'call':
            eventName = 'incomingCall';
            break;
          // For other types, use the generic 'notification' event
        }

        // Emit to all recipient's sockets
        recipientSockets.forEach(socketId => {
          io.to(socketId).emit(eventName, populatedNotification);

          // Also send to the generic notification event for client consistency
          if (eventName !== 'notification') {
            io.to(socketId).emit('notification', populatedNotification);
          }
        });

        logger.info(`Notification sent to ${recipientSockets.size} socket(s) for user ${recipientId}`);
      } else {
        logger.debug(`User ${recipientId} has no active socket connections, notification saved only`);
      }
    } else {
      logger.debug(`User ${recipientId} not connected, notification saved only`);
    }

    return savedNotification;
  } catch (error) {
    logger.error(`Error sending notification: ${error.message}`);
    return null;
  }
};

/**
 * Helper to create a message notification
 * @param {Object} io - Socket.IO instance
 * @param {Object} sender - Sender user
 * @param {Object} recipient - Recipient user
 * @param {Object} message - Message data
 */
export const sendMessageNotification = async (io, sender, recipient, message) => {
  if (!recipient || !recipient._id || !sender || !sender._id || !message) {
    logger.error('Cannot send message notification: Missing required parameters');
    return null;
  }

  try {
    const notification = {
      recipient: recipient._id,
      sender: sender._id,
      type: 'message',
      title: `New message from ${sender.nickname || 'Someone'}`,
      content: message.content || 'Sent you a message',
      reference: message._id,
      referenceModel: 'Message',
      data: {
        message: message,
        sender: {
          _id: sender._id,
          nickname: sender.nickname,
          photo: sender.photos && sender.photos.length > 0 ?
                 sender.photos[0].url : null
        }
      }
    };

    return await sendNotification(io, notification);
  } catch (error) {
    logger.error(`Error creating message notification: ${error.message}`);
    return null;
  }
};

/**
 * Helper to create a like notification
 * @param {Object} io - Socket.IO instance
 * @param {Object} sender - Sender user
 * @param {Object} recipient - Recipient user
 * @param {Object} likeData - Like data
 */
export const sendLikeNotification = async (io, sender, recipient, likeData) => {
  if (!recipient || !recipient._id || !sender || !sender._id) {
    logger.error('Cannot send like notification: Missing required parameters');
    return null;
  }

  try {
    const isMatch = likeData?.isMatch || false;
    const type = isMatch ? 'match' : 'like';

    const notification = {
      recipient: recipient._id,
      sender: sender._id,
      type,
      title: isMatch ?
             `You have a match with ${sender.nickname || 'Someone'}!` :
             `${sender.nickname || 'Someone'} liked you`,
      content: isMatch ?
               'You both liked each other. Start a conversation now!' :
               'Someone has shown interest in your profile',
      reference: likeData?._id,
      referenceModel: 'Like',
      data: {
        ...likeData,
        isMatch,
        sender: {
          _id: sender._id,
          nickname: sender.nickname,
          photo: sender.photos && sender.photos.length > 0 ?
                 sender.photos[0].url : null
        }
      }
    };

    return await sendNotification(io, notification);
  } catch (error) {
    logger.error(`Error creating like notification: ${error.message}`);
    return null;
  }
};

/**
 * Helper to create a photo permission request notification
 * @param {Object} io - Socket.IO instance
 * @param {Object} requester - Requester user
 * @param {Object} owner - Photo owner user
 * @param {Object} permission - Permission data
 */
export const sendPhotoPermissionRequestNotification = async (io, requester, owner, permission) => {
  if (!owner || !owner._id || !requester || !requester._id || !permission) {
    logger.error('Cannot send photo request notification: Missing required parameters');
    return null;
  }

  try {
    const notification = {
      recipient: owner._id,
      sender: requester._id,
      type: 'photoRequest',
      title: `${requester.nickname || 'Someone'} requested access to your photo`,
      content: 'Click to review the request',
      reference: permission._id,
      referenceModel: 'Photo',
      data: {
        permissionId: permission._id,
        photoId: permission.photo,
        requester: {
          _id: requester._id,
          nickname: requester.nickname,
          photo: requester.photos && requester.photos.length > 0 ?
                 requester.photos[0].url : null
        }
      }
    };

    return await sendNotification(io, notification);
  } catch (error) {
    logger.error(`Error creating photo request notification: ${error.message}`);
    return null;
  }
};

/**
 * Helper to create a photo permission response notification
 * @param {Object} io - Socket.IO instance
 * @param {Object} owner - Photo owner user
 * @param {Object} requester - Requester user
 * @param {Object} permission - Permission data
 */
export const sendPhotoPermissionResponseNotification = async (io, owner, requester, permission) => {
  if (!owner || !owner._id || !requester || !requester._id || !permission) {
    logger.error('Cannot send photo response notification: Missing required parameters');
    return null;
  }

  try {
    const approved = permission.status === 'approved';

    const notification = {
      recipient: requester._id,
      sender: owner._id,
      type: 'photoResponse',
      title: `${owner.nickname || 'Someone'} ${approved ? 'approved' : 'declined'} your photo request`,
      content: approved ?
               'You now have access to view their private photo.' :
               'Your request to view their private photo was declined.',
      reference: permission._id,
      referenceModel: 'Photo',
      data: {
        permissionId: permission._id,
        photoId: permission.photo,
        status: permission.status,
        owner: {
          _id: owner._id,
          nickname: owner.nickname,
          photo: owner.photos && owner.photos.length > 0 ?
                 owner.photos[0].url : null
        }
      }
    };

    return await sendNotification(io, notification);
  } catch (error) {
    logger.error(`Error creating photo response notification: ${error.message}`);
    return null;
  }
};

/**
 * Helper to create a comment notification
 * @param {Object} io - Socket.IO instance
 * @param {Object} commenter - Commenter user
 * @param {Object} owner - Content owner user
 * @param {Object} commentData - Comment data
 */
export const sendCommentNotification = async (io, commenter, owner, commentData) => {
  if (!owner || !owner._id || !commenter || !commenter._id || !commentData) {
    logger.error('Cannot send comment notification: Missing required parameters');
    return null;
  }

  try {
    const notification = {
      recipient: owner._id,
      sender: commenter._id,
      type: 'comment',
      title: `${commenter.nickname || 'Someone'} commented on your post`,
      content: commentData.content || 'Left a comment on your post',
      reference: commentData._id,
      referenceModel: 'Comment',
      data: {
        commentId: commentData._id,
        postId: commentData.post || commentData.postId,
        content: commentData.content,
        commenter: {
          _id: commenter._id,
          nickname: commenter.nickname,
          photo: commenter.photos && commenter.photos.length > 0 ?
                 commenter.photos[0].url : null
        }
      }
    };

    return await sendNotification(io, notification);
  } catch (error) {
    logger.error(`Error creating comment notification: ${error.message}`);
    return null;
  }
};

export default {
  registerNotificationHandlers,
  sendNotification,
  sendMessageNotification,
  sendLikeNotification,
  sendPhotoPermissionRequestNotification,
  sendPhotoPermissionResponseNotification,
  sendCommentNotification
};
