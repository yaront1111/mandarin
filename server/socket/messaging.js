import { Message, User } from "../models/index.js"
import logger from "../logger.js"
import mongoose from "mongoose"
import { safeObjectId } from "../utils/index.js" // Import from shared utils

/**
 * Send a message notification
 * @param {Object} io - Socket.IO server instance
 * @param {Object} sender - Sender user object
 * @param {Object} recipient - Recipient user object
 * @param {Object} message - Message object
 */
const sendMessageNotification = async (io, sender, recipient, message) => {
  try {
    const recipientUser = await User.findById(recipient._id).select("settings socketId blockedUsers")

    // Check if recipient has blocked the sender
    if (recipientUser && typeof recipientUser.hasBlocked === 'function' && recipientUser.hasBlocked(sender._id)) {
      logger.debug(`Notification blocked: User ${recipient._id} has blocked sender ${sender._id}`)
      return
    }

    // Check if recipient has message notifications enabled
    if (recipientUser?.settings?.notifications?.messages !== false) {
      // Send socket notification if user is online
      if (recipientUser?.socketId) {
        io.to(recipientUser.socketId).emit("messageReceived", {
          ...message,
          senderName: sender.nickname || sender.username || "User",
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

/**
 * Send a like notification
 * @param {Object} io - Socket.IO server instance
 * @param {Object} sender - Sender user object
 * @param {Object} recipient - Recipient user object
 * @param {Object} likeData - Like data
 * @param {Map} userConnections - User connections map
 */
const sendLikeNotification = async (io, sender, recipient, likeData, userConnections) => {
  try {
    const recipientUser = await User.findById(recipient._id).select("settings blockedUsers")

    // Check if recipient has blocked the sender
    if (recipientUser && typeof recipientUser.hasBlocked === 'function' && recipientUser.hasBlocked(sender._id)) {
      logger.debug(`Like notification blocked: User ${recipient._id} has blocked sender ${sender._id}`)
      return
    }

    // Check if recipient has like notifications enabled
    if (recipientUser?.settings?.notifications?.likes !== false) {
      // Send socket notification if user is online
      if (userConnections.has(recipient._id.toString())) {
        userConnections.get(recipient._id.toString()).forEach((socketId) => {
          io.to(socketId).emit("newLike", {
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
 * Register messaging-related socket handlers
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket connection
 * @param {Map} userConnections - Map of user connections
 * @param {Object} rateLimiters - Rate limiters
 */
const registerMessagingHandlers = (io, socket, userConnections, rateLimiters) => {
  const { typingLimiter, messageLimiter } = rateLimiters

  // Handle sending messages
  socket.on("sendMessage", async (data) => {
    try {
      const { recipientId, type, content, metadata, tempMessageId } = data

      logger.debug(`Socket message received: ${type} from ${socket.user._id} to ${recipientId}`)

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

      // Using the global safeObjectId helper function defined at the top of the file

      // Try to convert recipientId to a valid ObjectId
      const recipientObjectId = safeObjectId(recipientId)

      // Validate recipient ID
      if (!recipientObjectId) {
        logger.error(`Invalid recipient ID format: ${recipientId}`)
        socket.emit("messageError", {
          error: "Invalid recipient ID",
          tempMessageId,
        })
        return
      }

      // Check if recipient exists
      const recipient = await User.findById(recipientObjectId)
      if (!recipient) {
        logger.error(`Recipient not found: ${recipientId}`)
        socket.emit("messageError", {
          error: "Recipient not found",
          tempMessageId,
        })
        return
      }

      // Get full user object to check permissions
      const user = await User.findById(socket.user._id)

      // Check if recipient has blocked the sender
      if (typeof recipient.hasBlocked === 'function' && recipient.hasBlocked(socket.user._id)) {
        logger.warn(`Message blocked: User ${recipientId} has blocked sender ${socket.user._id}`)
        socket.emit("messageError", {
          error: "Unable to send message. You have been blocked by this user.",
          tempMessageId,
        })
        return
      }
      
      // Check if sender has blocked the recipient
      if (typeof user.hasBlocked === 'function' && user.hasBlocked(recipientId)) {
        logger.warn(`Message blocked: Sender ${socket.user._id} has blocked recipient ${recipientId}`)
        socket.emit("messageError", {
          error: "Unable to send message. You have blocked this user.",
          tempMessageId,
        })
        return
      }

      // Check if user can send this type of message
      // First, safely check if the method exists, then call it if it does
      if (
        type !== "wink" &&
        (user.accountTier === "FREE" || (typeof user.canSendMessages === "function" && !user.canSendMessages()))
      ) {
        logger.warn(`Free user ${socket.user._id} attempted to send non-wink message`)
        socket.emit("messageError", {
          error: "Free accounts can only send winks. Upgrade to send messages.",
          tempMessageId,
        })
        return
      }

      // Get a sanitized sender ObjectId
      const senderObjectId = safeObjectId(socket.user._id)
      if (!senderObjectId) {
        logger.error(`Invalid sender ID format: ${socket.user._id}`)
        socket.emit("messageError", {
          error: "Invalid sender ID",
          tempMessageId,
        })
        return
      }

      // Create and save message with sanitized IDs
      const message = new Message({
        sender: senderObjectId,
        recipient: recipientObjectId,
        type,
        content,
        metadata,
        read: false,
        createdAt: new Date(),
      })

      await message.save()
      logger.info(`Message saved to database: ${message._id}`)

      // Format message for response - use string IDs consistently
      const messageResponse = {
        _id: message._id.toString(),
        sender: senderObjectId.toString(),
        recipient: recipientObjectId.toString(),
        type,
        content,
        metadata,
        createdAt: message.createdAt,
        read: false,
        tempMessageId,
      }

      // Send message to sender for confirmation
      socket.emit("messageSent", messageResponse)
      logger.debug(`Message sent confirmation emitted: ${message._id} (tempId: ${tempMessageId})`)

      // Send message to recipient if they're online - use string ID for map lookup
      const recipientIdStr = recipientObjectId.toString()
      if (userConnections.has(recipientIdStr)) {
        const connectedSockets = userConnections.get(recipientIdStr)
        logger.debug(`Recipient ${recipientIdStr} has ${connectedSockets.size} active connections`)

        connectedSockets.forEach((recipientSocketId) => {
          io.to(recipientSocketId).emit("messageReceived", messageResponse)
          logger.debug(`Message forwarded to recipient socket: ${recipientSocketId}`)
        })
      } else {
        logger.debug(`Recipient ${recipientIdStr} is not currently connected`)
      }

      // Send message notification
      sendMessageNotification(io, socket.user, recipient, messageResponse)

      logger.info(`Message sent successfully from ${socket.user._id} to ${recipientId}`)
    } catch (error) {
      logger.error(`Error sending message: ${error.message}`, error)
      socket.emit("messageError", {
        error: "Failed to send message: " + (error.message || "Unknown error"),
        tempMessageId: data?.tempMessageId,
      })
    }
  })

  // Handle typing indicator
  socket.on("typing", async (data) => {
    try {
      const { recipientId } = data

      // Rate limiting
      try {
        await typingLimiter.consume(socket.user._id.toString())
      } catch (rateLimitError) {
        return
      }

      // Using the global safeObjectId helper function defined at the top of the file

      // Try to convert recipientId to a valid ObjectId
      const recipientObjectId = safeObjectId(recipientId)
      if (!recipientObjectId) return

      // Use string version for map lookup
      const recipientIdStr = recipientObjectId.toString()
      if (userConnections.has(recipientIdStr)) {
        userConnections.get(recipientIdStr).forEach((recipientSocketId) => {
          io.to(recipientSocketId).emit("userTyping", {
            userId: socket.user._id.toString(),
            timestamp: Date.now(),
          })
        })
      }
    } catch (error) {
      logger.error(`Error handling typing indicator: ${error.message}`)
    }
  })

  // Mark messages as read handler
  socket.on("messageRead", async (data) => {
    try {
      const { messageIds, sender } = data

      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return
      }

      // Using the global safeObjectId helper function defined at the top of the file

      // Try to convert sender ID to a valid ObjectId
      const senderObjectId = safeObjectId(sender)
      if (!senderObjectId) {
        logger.error(`Invalid sender ID format in messageRead: ${sender}`)
        return
      }

      // Get current user's ID as ObjectId
      const userObjectId = safeObjectId(socket.user._id)
      if (!userObjectId) {
        logger.error(`Invalid user ID format in messageRead: ${socket.user._id}`)
        return
      }

      // Convert message IDs to ObjectIds
      const validMessageIds = messageIds.map((id) => safeObjectId(id)).filter((id) => id !== null)

      if (validMessageIds.length === 0) {
        logger.error("No valid message IDs found in messageRead")
        return
      }

      // Update messages in database
      await Message.updateMany(
        { _id: { $in: validMessageIds }, sender: senderObjectId, recipient: userObjectId },
        { $set: { read: true, readAt: new Date() } },
      )

      // Notify sender if they're online - use string ID for map lookup
      const senderIdStr = senderObjectId.toString()
      if (userConnections.has(senderIdStr)) {
        userConnections.get(senderIdStr).forEach((senderSocketId) => {
          io.to(senderSocketId).emit("messagesRead", {
            reader: userObjectId.toString(),
            messageIds: validMessageIds.map((id) => id.toString()),
            timestamp: Date.now(),
          })
        })
      }
    } catch (error) {
      logger.error(`Error handling read receipts: ${error.message}`)
    }
  })
}

export { registerMessagingHandlers, sendMessageNotification, sendLikeNotification }
