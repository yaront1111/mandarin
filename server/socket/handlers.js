import { Message, User } from "../models/index.js"
import logger from "../logger.js"
import mongoose from "mongoose"

/**
 * Handle user disconnect
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket connection
 * @param {Map} userConnections - Map of user connections
 */
const handleUserDisconnect = async (io, socket, userConnections) => {
  try {
    logger.info(`Socket ${socket.id} disconnected`)

    if (socket.user && socket.user._id) {
      const userId = socket.user._id.toString()

      // Remove this socket from user connections
      if (userConnections.has(userId)) {
        userConnections.get(userId).delete(socket.id)

        // If this was the last connection for this user, update their status
        if (userConnections.get(userId).size === 0) {
          userConnections.delete(userId)

          // Update user status in database
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastActive: Date.now(),
          })

          // Notify other users
          io.emit("userOffline", { userId, timestamp: Date.now() })
          logger.info(`User ${userId} is now offline (no active connections)`)
        } else {
          logger.info(`User ${userId} still has ${userConnections.get(userId).size} active connections`)
        }
      }
    }
  } catch (error) {
    logger.error(`Error handling disconnect for ${socket.id}: ${error.message}`)
  }
}

/**
 * Send a message notification
 * @param {Object} io - Socket.IO server instance
 * @param {Object} sender - Sender user object
 * @param {Object} recipient - Recipient user object
 * @param {Object} message - Message object
 */
const sendMessageNotification = async (io, sender, recipient, message) => {
  try {
    const recipientUser = await User.findById(recipient._id).select("settings socketId")

    // Check if recipient has message notifications enabled
    if (recipientUser?.settings?.notifications?.messages !== false) {
      // Send socket notification if user is online
      if (recipientUser?.socketId) {
        io.to(recipientUser.socketId).emit("new_message", {
          sender,
          message,
          timestamp: new Date(),
        })
      }

      // Attempt to store a notification in the database if the model exists
      try {
        // Use the Notification model if it exists; otherwise, dynamically import it.
        const Notification = mongoose.models.Notification || (await import("../models/Notification.js")).default

        if (Notification) {
          await Notification.create({
            recipient: recipient._id,
            type: "message",
            sender: sender._id,
            content: message.content,
            reference: message._id,
          })
        }
      } catch (notificationError) {
        logger.debug(`Notification saving skipped: ${notificationError.message}`)
      }
    }
  } catch (error) {
    logger.error(`Error sending message notification: ${error.message}`)
  }
}

// Add functions to handle like and photo permission notifications

/**
 * Send a like notification
 * @param {Object} io - Socket.IO server instance
 * @param {Object} sender - Sender user object
 * @param {Object} recipient - Recipient user object
 * @param {Object} likeData - Like data
 */
const sendLikeNotification = async (io, sender, recipient, likeData) => {
  try {
    const recipientUser = await User.findById(recipient._id).select("settings")

    // Check if recipient has like notifications enabled
    if (recipientUser?.settings?.notifications?.likes !== false) {
      // Send socket notification if user is online
      if (userConnections.has(recipient._id.toString())) {
        userConnections.get(recipient._id.toString()).forEach((socketId) => {
          io.to(socketId).emit("new_like", {
            sender: {
              _id: sender._id,
              nickname: sender.nickname,
              photos: sender.photos,
            },
            timestamp: new Date(),
            ...likeData,
          })
        })
      }

      // Attempt to store a notification in the database if the model exists
      try {
        const Notification = mongoose.models.Notification || (await import("../models/Notification.js")).default

        if (Notification) {
          await Notification.create({
            recipient: recipient._id,
            type: "like",
            sender: sender._id,
            content: `${sender.nickname} liked your profile`,
            reference: likeData._id,
          })
        }
      } catch (notificationError) {
        logger.debug(`Notification saving skipped: ${notificationError.message}`)
      }
    }
  } catch (error) {
    logger.error(`Error sending like notification: ${error.message}`)
  }
}

/**
 * Send a photo permission request notification
 * @param {Object} io - Socket.IO server instance
 * @param {Object} requester - User requesting permission
 * @param {Object} owner - Photo owner
 * @param {Object} permissionData - Permission request data
 */
const sendPhotoPermissionRequestNotification = async (io, requester, owner, permissionData) => {
  try {
    // Check if owner has photo request notifications enabled
    const photoOwner = await User.findById(owner._id).select("settings")

    if (photoOwner?.settings?.notifications?.photoRequests !== false) {
      // Send socket notification if user is online
      if (userConnections.has(owner._id.toString())) {
        userConnections.get(owner._id.toString()).forEach((socketId) => {
          io.to(socketId).emit("photo_permission_request", {
            requester: {
              _id: requester._id,
              nickname: requester.nickname,
              photos: requester.photos,
            },
            photoId: permissionData.photo,
            permissionId: permissionData._id,
            timestamp: new Date(),
          })
        })
      }

      // Attempt to store a notification in the database if the model exists
      try {
        const Notification = mongoose.models.Notification || (await import("../models/Notification.js")).default

        if (Notification) {
          await Notification.create({
            recipient: owner._id,
            type: "photoRequest",
            sender: requester._id,
            content: `${requester.nickname} requested access to your private photo`,
            reference: permissionData._id,
          })
        }
      } catch (notificationError) {
        logger.debug(`Notification saving skipped: ${notificationError.message}`)
      }
    }
  } catch (error) {
    logger.error(`Error sending photo permission request notification: ${error.message}`)
  }
}

/**
 * Send a photo permission response notification
 * @param {Object} io - Socket.IO server instance
 * @param {Object} owner - Photo owner
 * @param {Object} requester - User who requested permission
 * @param {Object} permissionData - Permission response data
 */
const sendPhotoPermissionResponseNotification = async (io, owner, requester, permissionData) => {
  try {
    // Check if requester has photo response notifications enabled
    const photoRequester = await User.findById(requester._id).select("settings")

    if (photoRequester?.settings?.notifications?.photoRequests !== false) {
      // Send socket notification if user is online
      if (userConnections.has(requester._id.toString())) {
        userConnections.get(requester._id.toString()).forEach((socketId) => {
          io.to(socketId).emit("photo_permission_response", {
            owner: {
              _id: owner._id,
              nickname: owner.nickname,
              photos: owner.photos,
            },
            photoId: permissionData.photo,
            permissionId: permissionData._id,
            status: permissionData.status,
            timestamp: new Date(),
          })
        })
      }

      // Attempt to store a notification in the database if the model exists
      try {
        const Notification = mongoose.models.Notification || (await import("../models/Notification.js")).default

        if (Notification) {
          const action = permissionData.status === "approved" ? "approved" : "rejected"
          await Notification.create({
            recipient: requester._id,
            type: "photoResponse",
            sender: owner._id,
            content: `${owner.nickname} ${action} your photo request`,
            reference: permissionData._id,
          })
        }
      } catch (notificationError) {
        logger.debug(`Notification saving skipped: ${notificationError.message}`)
      }
    }
  } catch (error) {
    logger.error(`Error sending photo permission response notification: ${error.message}`)
  }
}

/**
 * Register all socket event handlers
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket connection
 * @param {Map} userConnections - Map of user connections
 * @param {Object} rateLimiters - Rate limiters
 */
const registerSocketHandlers = (io, socket, userConnections, rateLimiters) => {
  const { typingLimiter, messageLimiter, callLimiter } = rateLimiters

  // Handle ping (heartbeat)
  socket.on("ping", () => {
    try {
      socket.emit("pong")
    } catch (error) {
      logger.error(`Error handling ping from ${socket.id}: ${error.message}`)
    }
  })

  // Handle disconnect using the consolidated function
  socket.on("disconnect", async (reason) => {
    try {
      await handleUserDisconnect(io, socket, userConnections)
      logger.debug(`Disconnect reason: ${reason}`)
    } catch (error) {
      logger.error(`Error in disconnect event: ${error.message}`)
    }
  })

  // Handle sending messages
  socket.on("sendMessage", async (data) => {
    try {
      const { recipientId, type, content, metadata, tempMessageId } = data

      // Apply rate limiting
      try {
        await messageLimiter.consume(socket.user._id.toString())
      } catch (rateLimitError) {
        logger.warn(`Rate limit exceeded for message sending by user ${socket.user._id}`)
        socket.emit("messageError", {
          error: "Rate limit exceeded. Please try again later.",
          tempMessageId,
        })
        return
      }

      // Validate recipient ID
      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        socket.emit("messageError", {
          error: "Invalid recipient ID",
          tempMessageId,
        })
        return
      }

      // Check if recipient exists
      const recipient = await User.findById(recipientId)
      if (!recipient) {
        socket.emit("messageError", {
          error: "Recipient not found",
          tempMessageId,
        })
        return
      }

      // Get full user object to check permissions
      const user = await User.findById(socket.user._id)

      // Check if user can send this type of message
      if (type !== "wink" && !user.canSendMessages()) {
        socket.emit("messageError", {
          error: "Free accounts can only send winks. Upgrade to send messages.",
          tempMessageId,
        })
        return
      }

      // Create and save message
      const message = new Message({
        sender: socket.user._id,
        recipient: recipientId,
        type,
        content,
        metadata,
        read: false,
        createdAt: new Date(),
      })

      await message.save()

      // Format message for response
      const messageResponse = {
        _id: message._id,
        sender: socket.user._id,
        recipient: recipientId,
        type,
        content,
        metadata,
        createdAt: message.createdAt,
        read: false,
        tempMessageId,
      }

      // Send message to sender for confirmation
      socket.emit("messageSent", messageResponse)

      // Send message to recipient if they're online
      if (userConnections.has(recipientId)) {
        userConnections.get(recipientId).forEach((recipientSocketId) => {
          io.to(recipientSocketId).emit("messageReceived", messageResponse)
        })
      }

      // Send message notification
      sendMessageNotification(io, socket.user, recipient, messageResponse)

      logger.info(`Message sent from ${socket.user._id} to ${recipientId}`)
    } catch (error) {
      logger.error(`Error sending message: ${error.message}`)
      socket.emit("messageError", {
        error: "Failed to send message",
        tempMessageId: data?.tempMessageId,
      })
    }
  })

  // Handle typing indicator
  socket.on("typing", async (data) => {
    try {
      const { recipientId } = data
      try {
        await typingLimiter.consume(socket.user._id.toString())
      } catch (rateLimitError) {
        return
      }
      if (!mongoose.Types.ObjectId.isValid(recipientId)) return
      if (userConnections.has(recipientId)) {
        userConnections.get(recipientId).forEach((recipientSocketId) => {
          io.to(recipientSocketId).emit("userTyping", {
            userId: socket.user._id,
            timestamp: Date.now(),
          })
        })
      }
    } catch (error) {
      logger.error(`Error handling typing indicator: ${error.message}`)
    }
  })

  // WebRTC signaling - pass signal data between peers
  socket.on("videoSignal", (data) => {
    try {
      const { recipientId, signal, from } = data

      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        logger.error(`Invalid recipient ID in video signal: ${recipientId}`)
        return
      }

      if (!signal) {
        logger.error("Missing signal data in video signal message")
        return
      }

      logger.debug(`Forwarding video signal from ${socket.user._id} to ${recipientId}`)

      // Forward the signal to the recipient with retry logic
      if (userConnections.has(recipientId)) {
        let delivered = false

        userConnections.get(recipientId).forEach((recipientSocketId) => {
          try {
            io.to(recipientSocketId).emit("videoSignal", {
              signal,
              userId: socket.user._id,
              from: from || {
                userId: socket.user._id,
                name: socket.user.nickname || "User",
              },
              timestamp: Date.now(),
            })
            delivered = true
          } catch (err) {
            logger.error(`Error sending signal to socket ${recipientSocketId}: ${err.message}`)
          }
        })

        if (!delivered) {
          // Notify sender that delivery failed
          socket.emit("videoError", {
            error: "Failed to deliver signal to recipient",
            recipientId,
          })
        }
      } else {
        // Recipient is offline
        socket.emit("videoError", {
          error: "Recipient is offline",
          recipientId,
        })
      }
    } catch (error) {
      logger.error(`Error handling video signal: ${error.message}`)
      socket.emit("videoError", { error: "Signal processing error" })
    }
  })

  // Handle video call hangup
  socket.on("videoHangup", (data) => {
    try {
      const { recipientId } = data

      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        logger.error(`Invalid recipient ID in video hangup: ${recipientId}`)
        return
      }

      logger.debug(`Forwarding video hangup from ${socket.user._id} to ${recipientId}`)

      if (userConnections.has(recipientId)) {
        userConnections.get(recipientId).forEach((recipientSocketId) => {
          io.to(recipientSocketId).emit("videoHangup", {
            userId: socket.user._id,
            timestamp: Date.now(),
          })
        })
      }
    } catch (error) {
      logger.error(`Error handling video hangup: ${error.message}`)
    }
  })

  // Handle video media control events (mute audio/video)
  socket.on("videoMediaControl", (data) => {
    try {
      const { recipientId, type, muted } = data

      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        logger.error(`Invalid recipient ID in media control: ${recipientId}`)
        return
      }

      if (!type || !["audio", "video"].includes(type)) {
        logger.error(`Invalid media control type: ${type}`)
        return
      }

      logger.debug(`Forwarding ${type} control (muted: ${muted}) from ${socket.user._id} to ${recipientId}`)

      if (userConnections.has(recipientId)) {
        userConnections.get(recipientId).forEach((recipientSocketId) => {
          io.to(recipientSocketId).emit("videoMediaControl", {
            userId: socket.user._id,
            type,
            muted,
            timestamp: Date.now(),
          })
        })
      }
    } catch (error) {
      logger.error(`Error handling video media control: ${error.message}`)
    }
  })

  // Handle call initiation
  socket.on("initiateCall", async (data) => {
    try {
      const { recipientId, callType, callId } = data

      // Apply rate limiting
      try {
        await callLimiter.consume(socket.user._id.toString())
      } catch (rateLimitError) {
        logger.warn(`Rate limit exceeded for call initiation by user ${socket.user._id}`)
        socket.emit("callError", {
          error: "Rate limit exceeded. Please try again later.",
        })
        return
      }

      // Validate recipient ID
      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        socket.emit("callError", {
          error: "Invalid recipient ID",
        })
        return
      }

      // Check if recipient exists
      const recipient = await User.findById(recipientId)
      if (!recipient) {
        socket.emit("callError", {
          error: "Recipient not found",
        })
        return
      }

      // Get full user object to check permissions
      const user = await User.findById(socket.user._id)

      // Check if user can make video calls
      if (callType === "video" && user.accountTier === "FREE") {
        socket.emit("callError", {
          error: "Free accounts cannot make video calls. Upgrade for video calls.",
        })
        return
      }

      logger.info(`Call initiated from ${socket.user._id} to ${recipientId}`)

      // Notify the recipient about the incoming call
      if (userConnections.has(recipientId)) {
        userConnections.get(recipientId).forEach((recipientSocketId) => {
          io.to(recipientSocketId).emit("incomingCall", {
            callId: callId || `call-${Date.now()}`,
            callType,
            userId: socket.user._id.toString(),
            caller: {
              userId: socket.user._id.toString(),
              name: user.nickname || "User",
              photo: user.photos && user.photos.length > 0 ? user.photos[0].url : null,
            },
            timestamp: Date.now(),
          })
        })

        // Confirm to the caller that the call was initiated
        socket.emit("callInitiated", {
          success: true,
          recipientId,
          callId: callId || `call-${Date.now()}`,
        })
      } else {
        // Recipient is offline
        socket.emit("callError", {
          error: "Recipient is offline",
          recipientId,
        })
      }
    } catch (error) {
      logger.error(`Error initiating call: ${error.message}`)
      socket.emit("callError", {
        error: "Failed to initiate call",
      })
    }
  })

  // Handle call answer
  socket.on("answerCall", (data) => {
    try {
      const { callerId, accept, callId } = data

      if (!mongoose.Types.ObjectId.isValid(callerId)) {
        logger.error(`Invalid caller ID in call answer: ${callerId}`)
        return
      }

      logger.info(`Call ${accept ? "accepted" : "rejected"} by ${socket.user._id} from ${callerId}`)

      // Notify the caller about the answer with retry logic
      if (userConnections.has(callerId)) {
        let delivered = false

        userConnections.get(callerId).forEach((callerSocketId) => {
          try {
            io.to(callerSocketId).emit("callAnswered", {
              userId: socket.user._id.toString(),
              accept,
              callId,
              timestamp: Date.now(),
            })
            delivered = true
          } catch (err) {
            logger.error(`Error sending call answer to socket ${callerSocketId}: ${err.message}`)
          }
        })

        if (!delivered) {
          // Log that delivery failed
          logger.error(`Failed to deliver call answer to caller ${callerId}`)
        }
      } else {
        logger.warn(`Caller ${callerId} is no longer connected`)
      }
    } catch (error) {
      logger.error(`Error handling call answer: ${error.message}`)
    }
  })

  // Emit user online status when they connect
  io.emit("userOnline", {
    userId: socket.user._id.toString(),
    timestamp: Date.now(),
  })

  logger.info(`Socket handlers registered for user ${socket.user._id}`)
}

// Export the new functions
export {
  registerSocketHandlers,
  sendMessageNotification,
  handleUserDisconnect,
  sendLikeNotification,
  sendPhotoPermissionRequestNotification,
  sendPhotoPermissionResponseNotification,
}
