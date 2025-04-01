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
        let deliveryAttempts = 0;
        const maxDeliveryAttempts = 3;

        const attemptDelivery = (socketIds) => {
          deliveryAttempts++;

          let currentDeliverySuccess = false;
          socketIds.forEach((recipientSocketId) => {
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
              currentDeliverySuccess = true;
            } catch (err) {
              logger.error(`Error sending signal to socket ${recipientSocketId}: ${err.message}`);
            }
          });

          // If delivery failed and we haven't reached max attempts, try again
          if (!currentDeliverySuccess && deliveryAttempts < maxDeliveryAttempts) {
            setTimeout(() => {
              // Get fresh socket IDs in case they've changed
              const currentSocketIds = userConnections.get(recipientId);
              if (currentSocketIds && currentSocketIds.size > 0) {
                attemptDelivery(currentSocketIds);
              }
            }, 1000); // Wait 1 second before retry
          }
        };

        attemptDelivery(userConnections.get(recipientId));

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

  // Handle peer ID exchange with guaranteed delivery
  socket.on("peerIdExchange", (data) => {
    try {
      const { recipientId, peerId, from, isFallback } = data;

      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        logger.error(`Invalid recipient ID in peerIdExchange: ${recipientId}`);
        return;
      }

      if (!peerId) {
        logger.error(`Missing peerId in peerIdExchange request`);
        return;
      }

      logger.debug(`Processing peerIdExchange from ${socket.user._id} to ${recipientId} with ID ${peerId}`);

      // Make sure we have proper from data
      const fromData = from || {
        userId: socket.user._id,
        name: socket.user.nickname || "User"
      };

      // Forward the peer ID to the recipient with retry logic
      if (userConnections.has(recipientId)) {
        let delivered = false;
        let deliveryAttempts = 0;
        const maxDeliveryAttempts = 5; // More retries for critical peerId exchange

        const attemptDelivery = (socketIds) => {
          deliveryAttempts++;

          let currentDeliverySuccess = false;
          socketIds.forEach((recipientSocketId) => {
            try {
              io.to(recipientSocketId).emit("peerIdExchange", {
                peerId,
                userId: socket.user._id,
                from: fromData,
                isFallback: isFallback || false,
                timestamp: Date.now()
              });
              delivered = true;
              currentDeliverySuccess = true;
              logger.debug(`Successfully delivered peerIdExchange to socket ${recipientSocketId}`);
            } catch (err) {
              logger.error(`Error sending peerIdExchange to socket ${recipientSocketId}: ${err.message}`);
            }
          });

          // If delivery failed and we haven't reached max attempts, try again
          if (!currentDeliverySuccess && deliveryAttempts < maxDeliveryAttempts) {
            logger.debug(`peerIdExchange delivery attempt ${deliveryAttempts} failed, retrying in 800ms`);
            setTimeout(() => {
              // Get fresh socket IDs in case they've changed
              const currentSocketIds = userConnections.get(recipientId);
              if (currentSocketIds && currentSocketIds.size > 0) {
                attemptDelivery(currentSocketIds);
              }
            }, 800); // Wait 800ms before retry
          } else if (!currentDeliverySuccess) {
            logger.error(`Failed to deliver peerIdExchange after ${maxDeliveryAttempts} attempts`);
            socket.emit("videoError", {
              error: "Failed to deliver peer ID to recipient after multiple attempts",
              recipientId
            });
          }
        };

        attemptDelivery(userConnections.get(recipientId));
      } else {
        // Recipient is offline
        logger.warn(`Recipient ${recipientId} is offline for peerIdExchange`);
        socket.emit("videoError", {
          error: "Recipient is offline",
          recipientId,
        });
      }
    } catch (error) {
      logger.error(`Error handling peerIdExchange: ${error.message}`);
      socket.emit("videoError", { error: "Peer ID exchange error" });
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

      // Use guaranteed delivery for hangup as well
      if (userConnections.has(recipientId)) {
        let delivered = false;
        let deliveryAttempts = 0;
        const maxDeliveryAttempts = 3;

        const attemptDelivery = (socketIds) => {
          deliveryAttempts++;

          let currentDeliverySuccess = false;
          socketIds.forEach((recipientSocketId) => {
            try {
              io.to(recipientSocketId).emit("videoHangup", {
                userId: socket.user._id,
                timestamp: Date.now(),
              });
              delivered = true;
              currentDeliverySuccess = true;
            } catch (err) {
              logger.error(`Error sending hangup to socket ${recipientSocketId}: ${err.message}`);
            }
          });

          // If delivery failed and we haven't reached max attempts, try again
          if (!currentDeliverySuccess && deliveryAttempts < maxDeliveryAttempts) {
            setTimeout(() => {
              // Get fresh socket IDs in case they've changed
              const currentSocketIds = userConnections.get(recipientId);
              if (currentSocketIds && currentSocketIds.size > 0) {
                attemptDelivery(currentSocketIds);
              }
            }, 1000); // Wait 1 second before retry
          }
        };

        attemptDelivery(userConnections.get(recipientId));
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

      // Notify the recipient about the incoming call with guaranteed delivery
      if (userConnections.has(recipientId)) {
        let delivered = false;
        let deliveryAttempts = 0;
        const maxDeliveryAttempts = 3;

        const callPayload = {
          callId: callId || `call-${Date.now()}`,
          callType,
          userId: socket.user._id.toString(),
          caller: {
            userId: socket.user._id.toString(),
            name: user.nickname || "User",
            photo: user.photos && user.photos.length > 0 ? user.photos[0].url : null,
          },
          timestamp: Date.now(),
        };

        const attemptDelivery = (socketIds) => {
          deliveryAttempts++;

          let currentDeliverySuccess = false;
          socketIds.forEach((recipientSocketId) => {
            try {
              io.to(recipientSocketId).emit("incomingCall", callPayload);
              delivered = true;
              currentDeliverySuccess = true;
            } catch (err) {
              logger.error(`Error sending incomingCall to socket ${recipientSocketId}: ${err.message}`);
            }
          });

          // If delivery failed and we haven't reached max attempts, try again
          if (!currentDeliverySuccess && deliveryAttempts < maxDeliveryAttempts) {
            setTimeout(() => {
              // Get fresh socket IDs in case they've changed
              const currentSocketIds = userConnections.get(recipientId);
              if (currentSocketIds && currentSocketIds.size > 0) {
                attemptDelivery(currentSocketIds);
              }
            }, 1000); // Wait 1 second before retry
          }
        };

        attemptDelivery(userConnections.get(recipientId));

        if (delivered) {
          // Confirm to the caller that the call was initiated
          socket.emit("callInitiated", {
            success: true,
            recipientId,
            callId: callPayload.callId,
          });
        } else {
          // Recipient couldn't be reached
          socket.emit("callError", {
            error: "Failed to reach recipient",
            recipientId,
          });
        }
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

      // Notify the caller about the answer with guaranteed delivery
      if (userConnections.has(callerId)) {
        let delivered = false;
        let deliveryAttempts = 0;
        const maxDeliveryAttempts = 5; // More attempts for critical call answer

        const answerPayload = {
          userId: socket.user._id.toString(),
          accept,
          callId,
          timestamp: Date.now(),
        };

        const attemptDelivery = (socketIds) => {
          deliveryAttempts++;

          let currentDeliverySuccess = false;
          socketIds.forEach((callerSocketId) => {
            try {
              io.to(callerSocketId).emit("callAnswered", answerPayload);
              delivered = true;
              currentDeliverySuccess = true;
            } catch (err) {
              logger.error(`Error sending call answer to socket ${callerSocketId}: ${err.message}`);
            }
          });

          // If delivery failed and we haven't reached max attempts, try again
          if (!currentDeliverySuccess && deliveryAttempts < maxDeliveryAttempts) {
            setTimeout(() => {
              // Get fresh socket IDs in case they've changed
              const currentSocketIds = userConnections.get(callerId);
              if (currentSocketIds && currentSocketIds.size > 0) {
                attemptDelivery(currentSocketIds);
              }
            }, 800); // Wait 800ms before retry
          }
        };

        attemptDelivery(userConnections.get(callerId));

        if (!delivered) {
          // Log that delivery failed
          logger.error(`Failed to deliver call answer to caller ${callerId} after ${maxDeliveryAttempts} attempts`);
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
