import { User } from "../models/index.js";
import logger from "../logger.js";
import mongoose from "mongoose";

/**
 * Register call and video-related socket handlers
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket connection
 * @param {Map} userConnections - Map of user connections
 * @param {Object} rateLimiters - Rate limiters
 */
const registerCallHandlers = (io, socket, userConnections, rateLimiters) => {
  const { callLimiter } = rateLimiters;

  // WebRTC signaling - pass signal data between peers
  socket.on("videoSignal", (data) => {
    try {
      const { recipientId, signal, from } = data;

      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        logger.error(`Invalid recipient ID in video signal: ${recipientId}`);
        return;
      }

      if (!signal) {
        logger.error("Missing signal data in video signal message");
        return;
      }

      logger.debug(`Forwarding video signal from ${socket.user._id} to ${recipientId}`);

      // Forward the signal to the recipient with retry logic
      if (userConnections.has(recipientId)) {
        let delivered = false;

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
            });
            delivered = true;
          } catch (err) {
            logger.error(`Error sending signal to socket ${recipientSocketId}: ${err.message}`);
          }
        });

        if (!delivered) {
          // Notify sender that delivery failed
          socket.emit("videoError", {
            error: "Failed to deliver signal to recipient",
            recipientId,
          });
        }
      } else {
        // Recipient is offline
        socket.emit("videoError", {
          error: "Recipient is offline",
          recipientId,
        });
      }
    } catch (error) {
      logger.error(`Error handling video signal: ${error.message}`);
      socket.emit("videoError", { error: "Signal processing error" });
    }
  });

  // Handle video call hangup
  socket.on("videoHangup", (data) => {
    try {
      const { recipientId } = data;

      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        logger.error(`Invalid recipient ID in video hangup: ${recipientId}`);
        return;
      }

      logger.debug(`Forwarding video hangup from ${socket.user._id} to ${recipientId}`);

      if (userConnections.has(recipientId)) {
        userConnections.get(recipientId).forEach((recipientSocketId) => {
          io.to(recipientSocketId).emit("videoHangup", {
            userId: socket.user._id,
            timestamp: Date.now(),
          });
        });
      }
    } catch (error) {
      logger.error(`Error handling video hangup: ${error.message}`);
    }
  });

  // Handle video media control events (mute audio/video)
  socket.on("videoMediaControl", (data) => {
    try {
      const { recipientId, type, muted } = data;

      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        logger.error(`Invalid recipient ID in media control: ${recipientId}`);
        return;
      }

      if (!type || !["audio", "video"].includes(type)) {
        logger.error(`Invalid media control type: ${type}`);
        return;
      }

      logger.debug(`Forwarding ${type} control (muted: ${muted}) from ${socket.user._id} to ${recipientId}`);

      if (userConnections.has(recipientId)) {
        userConnections.get(recipientId).forEach((recipientSocketId) => {
          io.to(recipientSocketId).emit("videoMediaControl", {
            userId: socket.user._id,
            type,
            muted,
            timestamp: Date.now(),
          });
        });
      }
    } catch (error) {
      logger.error(`Error handling video media control: ${error.message}`);
    }
  });

  // Handle call initiation
  socket.on("initiateCall", async (data) => {
    try {
      const { recipientId, callType, callId } = data;

      // Apply rate limiting
      try {
        await callLimiter.consume(socket.user._id.toString());
      } catch (rateLimitError) {
        logger.warn(`Rate limit exceeded for call initiation by user ${socket.user._id}`);
        socket.emit("callError", {
          error: "Rate limit exceeded. Please try again later.",
        });
        return;
      }

      // Validate recipient ID
      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        socket.emit("callError", {
          error: "Invalid recipient ID",
        });
        return;
      }

      // Check if recipient exists
      const recipient = await User.findById(recipientId);
      if (!recipient) {
        socket.emit("callError", {
          error: "Recipient not found",
        });
        return;
      }

      // Get full user object to check permissions
      const user = await User.findById(socket.user._id);

      // Check if user can make video calls
      if (callType === "video" && user.accountTier === "FREE") {
        socket.emit("callError", {
          error: "Free accounts cannot make video calls. Upgrade for video calls.",
        });
        return;
      }

      logger.info(`Call initiated from ${socket.user._id} to ${recipientId}`);

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
          });
        });

        // Confirm to the caller that the call was initiated
        socket.emit("callInitiated", {
          success: true,
          recipientId,
          callId: callId || `call-${Date.now()}`,
        });
      } else {
        // Recipient is offline
        socket.emit("callError", {
          error: "Recipient is offline",
          recipientId,
        });
      }
    } catch (error) {
      logger.error(`Error initiating call: ${error.message}`);
      socket.emit("callError", {
        error: "Failed to initiate call",
      });
    }
  });

  // Handle call answer
  socket.on("answerCall", (data) => {
    try {
      const { callerId, accept, callId } = data;

      if (!mongoose.Types.ObjectId.isValid(callerId)) {
        logger.error(`Invalid caller ID in call answer: ${callerId}`);
        return;
      }

      logger.info(`Call ${accept ? "accepted" : "rejected"} by ${socket.user._id} from ${callerId}`);

      // Notify the caller about the answer with retry logic
      if (userConnections.has(callerId)) {
        let delivered = false;

        userConnections.get(callerId).forEach((callerSocketId) => {
          try {
            io.to(callerSocketId).emit("callAnswered", {
              userId: socket.user._id.toString(),
              accept,
              callId,
              timestamp: Date.now(),
            });
            delivered = true;
          } catch (err) {
            logger.error(`Error sending call answer to socket ${callerSocketId}: ${err.message}`);
          }
        });

        if (!delivered) {
          // Log that delivery failed
          logger.error(`Failed to deliver call answer to caller ${callerId}`);
        }
      } else {
        logger.warn(`Caller ${callerId} is no longer connected`);
      }
    } catch (error) {
      logger.error(`Error handling call answer: ${error.message}`);
    }
  });
};

export { registerCallHandlers };
