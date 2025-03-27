import logger from "../logger.js"
import { checkSocketPermission } from "./Auth.js"

/**
 * Setup WebRTC call signaling handlers
 * @param {Object} io - Socket.IO instance
 * @param {Object} socket - Socket instance
 */
const setupCallHandlers = (io, socket) => {
  // Handle peer ID exchange for WebRTC
  socket.on("peerIdExchange", async (data) => {
    try {
      const { peerId, targetUserId, callId } = data

      if (!peerId || !targetUserId || !callId) {
        logger.warn(`Invalid peerIdExchange data from ${socket.id}: ${JSON.stringify(data)}`)
        return
      }

      logger.info(`Peer ID exchange: ${socket.id} -> ${targetUserId}, callId: ${callId}`)

      // Check if user has permission to initiate calls
      if (!checkSocketPermission(socket, "initiateCall")) {
        logger.warn(`User ${socket.id} attempted to exchange peer ID without permission`)
        socket.emit("callError", {
          error: "You don't have permission to make calls",
          callId,
        })
        return
      }

      // Forward the peer ID to the target user
      const targetSocket = io.sockets.sockets.get(targetUserId)

      if (targetSocket) {
        targetSocket.emit("peerIdExchange", {
          peerId,
          userId: socket.id,
          callId,
        })

        logger.debug(`Forwarded peer ID ${peerId} to ${targetUserId} for call ${callId}`)
      } else {
        logger.warn(`Target user ${targetUserId} not found for peer ID exchange`)
        socket.emit("callError", {
          error: "User is offline or unavailable",
          callId,
        })
      }
    } catch (error) {
      logger.error(`Error in peerIdExchange: ${error.message}`)
      socket.emit("callError", {
        error: "Failed to exchange connection information",
        details: error.message,
      })
    }
  })

  // Handle call initiation
  socket.on("initiateCall", async (data) => {
    try {
      const { targetUserId, callType = "video" } = data

      if (!targetUserId) {
        logger.warn(`Invalid initiateCall data from ${socket.id}: ${JSON.stringify(data)}`)
        return
      }

      // Check if user has permission to initiate calls
      if (!checkSocketPermission(socket, "initiateCall")) {
        logger.warn(`User ${socket.id} attempted to initiate call without permission`)
        socket.emit("callError", {
          error: "You don't have permission to make calls",
        })
        return
      }

      // Generate a unique call ID
      const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`

      logger.info(`Call initiation: ${socket.id} -> ${targetUserId}, type: ${callType}, callId: ${callId}`)

      // Get caller information
      const caller = {
        id: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      }

      // Send call request to target user
      const targetSocket = io.sockets.sockets.get(targetUserId)

      if (targetSocket) {
        targetSocket.emit("incomingCall", {
          callId,
          callType,
          userId: socket.id,
          caller,
          timestamp: Date.now(),
        })

        // Send confirmation to caller
        socket.emit("callInitiated", {
          callId,
          targetUserId,
          callType,
          timestamp: Date.now(),
        })

        logger.debug(`Sent incoming call notification to ${targetUserId} for call ${callId}`)
      } else {
        logger.warn(`Target user ${targetUserId} not found for call initiation`)
        socket.emit("callError", {
          error: "User is offline or unavailable",
        })
      }
    } catch (error) {
      logger.error(`Error in initiateCall: ${error.message}`)
      socket.emit("callError", {
        error: "Failed to initiate call",
        details: error.message,
      })
    }
  })

  // Handle call answer (accept/reject)
  socket.on("answerCall", async (data) => {
    try {
      const { callId, accept, targetUserId } = data

      if (!callId || typeof accept !== "boolean" || !targetUserId) {
        logger.warn(`Invalid answerCall data from ${socket.id}: ${JSON.stringify(data)}`)
        return
      }

      logger.info(`Call answer: ${socket.id} -> ${targetUserId}, callId: ${callId}, accept: ${accept}`)

      // Forward the answer to the caller
      const targetSocket = io.sockets.sockets.get(targetUserId)

      if (targetSocket) {
        targetSocket.emit("callAnswered", {
          userId: socket.id,
          accept,
          callId,
          timestamp: Date.now(),
        })

        logger.debug(`Forwarded call answer to ${targetUserId} for call ${callId}`)
      } else {
        logger.warn(`Target user ${targetUserId} not found for call answer`)
        socket.emit("callError", {
          error: "Caller is offline or unavailable",
          callId,
        })
      }
    } catch (error) {
      logger.error(`Error in answerCall: ${error.message}`)
      socket.emit("callError", {
        error: "Failed to answer call",
        details: error.message,
      })
    }
  })

  // Handle call hangup
  socket.on("videoHangup", async (data) => {
    try {
      const { targetUserId, callId } = data

      if (!targetUserId || !callId) {
        logger.warn(`Invalid videoHangup data from ${socket.id}: ${JSON.stringify(data)}`)
        return
      }

      logger.info(`Call hangup: ${socket.id} -> ${targetUserId}, callId: ${callId}`)

      // Forward the hangup to the target user
      const targetSocket = io.sockets.sockets.get(targetUserId)

      if (targetSocket) {
        targetSocket.emit("videoHangup", {
          userId: socket.id,
          timestamp: Date.now(),
        })

        logger.debug(`Forwarded hangup to ${targetUserId} for call ${callId}`)
      } else {
        logger.debug(`Target user ${targetUserId} not found for hangup, but continuing`)
      }
    } catch (error) {
      logger.error(`Error in videoHangup: ${error.message}`)
    }
  })
}

export const registerCallHandlers = setupCallHandlers
