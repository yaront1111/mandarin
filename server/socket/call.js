// src/socket/registerCallHandlers.js

import { User } from "../models/index.js";
import logger from "../logger.js";
import mongoose from "mongoose";

// Simple logger fallback if logger doesn't have create method
const log = {
  info: (...args) => console.log("[socket:call]", ...args),
  error: (...args) => console.error("[socket:call]", ...args),
  warn: (...args) => console.warn("[socket:call]", ...args),
  debug: (...args) => console.debug("[socket:call]", ...args)
};

/**
 * Validate that a string is a valid Mongo ObjectId
 * @param {string} id
 * @returns {boolean}
 */
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Deliver a socket event to a user with retry logic
 * @param {Object} io - Socket.IO server instance
 * @param {Map<string, Set<string>>} userConnections
 * @param {string} recipientId
 * @param {string} eventName
 * @param {Function} buildPayload - () => payload object
 * @param {Object}   [opts]
 * @param {number}   [opts.maxAttempts=3]
 * @param {number}   [opts.delayMs=1000]
 * @param {string}   [opts.errorEvent]   - event to emit on failure back to sender
 * @param {string}   [opts.errorMessage] - message to include in error payload
 * @param {string}   [opts.fromSocketId]  - socket ID of sender to notify on final failure
 */
const deliverEventToUser = async (
  io,
  userConnections,
  recipientId,
  eventName,
  buildPayload,
  {
    maxAttempts = 3,
    delayMs = 1000,
    errorEvent,
    errorMessage,
    fromSocketId,
  } = {}
) => {
  if (!userConnections.has(recipientId)) {
    if (errorEvent && fromSocketId) {
      io.to(fromSocketId).emit(errorEvent, { error: "Recipient is offline", recipientId });
    }
    return false;
  }

  let attempts = 0,
    succeeded = false;

  const tryOnce = async () => {
    attempts++;
    const payload = buildPayload();
    const socketIds = userConnections.get(recipientId);

    for (const sid of socketIds) {
      try {
        io.to(sid).emit(eventName, payload);
        succeeded = true;
      } catch (err) {
        log.error(`Error emitting ${eventName} to ${sid}: ${err.message}`);
      }
    }

    if (!succeeded && attempts < maxAttempts) {
      log.debug(`${eventName} attempt ${attempts} failed, retrying in ${delayMs}ms`);
      await new Promise((r) => setTimeout(r, delayMs));
      await tryOnce();
    } else if (!succeeded && errorEvent && fromSocketId) {
      log.error(`${eventName} failed after ${attempts} attempts`);
      io.to(fromSocketId).emit(errorEvent, { error: errorMessage, recipientId });
    }

    return succeeded;
  };

  return tryOnce();
};

/**
 * Register call & video socket handlers
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 * @param {Map<string, Set<string>>} userConnections
 * @param {Object} rateLimiters
 */
export const registerCallHandlers = (io, socket, userConnections, rateLimiters) => {
  const { callLimiter } = rateLimiters;

  socket.on("videoSignal", async (data) => {
    try {
      const { recipientId, signal, from } = data;
      if (!isValidId(recipientId) || !signal) {
        log.error("Invalid videoSignal payload", data);
        return socket.emit("videoError", { error: "Invalid video signal", recipientId });
      }

      log.debug(`videoSignal from ${socket.user.id} → ${recipientId}`);
      await deliverEventToUser(
        io,
        userConnections,
        recipientId,
        "videoSignal",
        () => ({
          signal,
          userId: socket.user.id,
          from: from || {
            userId: socket.user.id,
            name: socket.user.nickname || "User",
          },
          timestamp: Date.now(),
        }),
        {
          maxAttempts: 3,
          delayMs: 1000,
          errorEvent: "videoError",
          errorMessage: "Failed to deliver signal to recipient",
          fromSocketId: socket.id,
        }
      );
    } catch (err) {
      log.error(`videoSignal handler error: ${err.message}`);
      socket.emit("videoError", { error: "Signal processing error" });
    }
  });

  socket.on("peerIdExchange", async (data) => {
    try {
      const { recipientId, peerId, from, isFallback } = data;
      if (!isValidId(recipientId) || !peerId) {
        log.error("Invalid peerIdExchange payload", data);
        return socket.emit("videoError", { error: "Invalid peer ID exchange", recipientId });
      }

      log.debug(`peerIdExchange ${peerId} from ${socket.user.id} → ${recipientId}`);
      await deliverEventToUser(
        io,
        userConnections,
        recipientId,
        "peerIdExchange",
        () => ({
          peerId,
          userId: socket.user.id,
          from: from || { userId: socket.user.id, name: socket.user.nickname || "User" },
          isFallback: Boolean(isFallback),
          timestamp: Date.now(),
        }),
        {
          maxAttempts: 5,
          delayMs: 800,
          errorEvent: "videoError",
          errorMessage: "Failed to deliver peer ID after multiple attempts",
          fromSocketId: socket.id,
        }
      );
    } catch (err) {
      log.error(`peerIdExchange handler error: ${err.message}`);
      socket.emit("videoError", { error: "Peer ID exchange error" });
    }
  });

  socket.on("videoHangup", async ({ recipientId }) => {
    try {
      if (!isValidId(recipientId)) {
        log.error(`Invalid videoHangup recipientId: ${recipientId}`);
        return;
      }
      log.debug(`videoHangup from ${socket.user.id} → ${recipientId}`);
      await deliverEventToUser(
        io,
        userConnections,
        recipientId,
        "videoHangup",
        () => ({ userId: socket.user.id, timestamp: Date.now() }),
        { maxAttempts: 3, delayMs: 1000 }
      );
    } catch (err) {
      log.error(`videoHangup handler error: ${err.message}`);
    }
  });

  socket.on("videoMediaControl", ({ recipientId, type, muted }) => {
    try {
      if (!isValidId(recipientId) || !["audio", "video"].includes(type)) {
        log.error("Invalid videoMediaControl payload", { recipientId, type });
        return;
      }
      log.debug(`videoMediaControl (${type}:${muted}) from ${socket.user.id} → ${recipientId}`);
      const sockets = userConnections.get(recipientId) || [];
      for (const sid of sockets) {
        io.to(sid).emit("videoMediaControl", {
          userId: socket.user.id,
          type,
          muted,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      log.error(`videoMediaControl handler error: ${err.message}`);
    }
  });

  socket.on("initiateCall", async (data) => {
    try {
      const { recipientId, callType, callId } = data;
      // rate limit
      try {
        await callLimiter.consume(socket.user.id.toString());
      } catch {
        log.warn(`Rate limit exceeded for ${socket.user.id}`);
        return socket.emit("callError", { error: "Rate limit exceeded" });
      }

      if (!isValidId(recipientId)) {
        return socket.emit("callError", { error: "Invalid recipient ID" });
      }
      const recipient = await User.findById(recipientId);
      if (!recipient) {
        return socket.emit("callError", { error: "Recipient not found" });
      }
      const caller = await User.findById(socket.user.id);
      if (callType === "video" && caller.accountTier === "FREE") {
        return socket.emit("callError", { error: "Upgrade required for video calls" });
      }

      log.info(`initiateCall from ${socket.user.id} → ${recipientId}`);
      const payload = {
        callId: callId || `call-${Date.now()}`,
        callType,
        userId: socket.user.id.toString(),
        caller: {
          userId: caller.id.toString(),
          name: caller.nickname || "User",
          photo: caller.photos?.[0]?.url || null,
        },
        timestamp: Date.now(),
      };

      const delivered = await deliverEventToUser(
        io,
        userConnections,
        recipientId,
        "incomingCall",
        () => payload,
        {
          maxAttempts: 3,
          delayMs: 1000,
          errorEvent: "callError",
          errorMessage: "Failed to reach recipient",
          fromSocketId: socket.id,
        }
      );

      if (delivered) {
        socket.emit("callInitiated", { success: true, recipientId, callId: payload.callId });
      }
    } catch (err) {
      log.error(`initiateCall handler error: ${err.message}`);
      socket.emit("callError", { error: "Failed to initiate call" });
    }
  });

  socket.on("answerCall", async (data) => {
    try {
      const { callerId, accept, callId } = data;
      if (!isValidId(callerId)) {
        log.error(`Invalid answerCall callerId: ${callerId}`);
        return;
      }
      log.info(`${accept ? "accepted" : "rejected"} call ${callId} by ${socket.user.id}`);

      await deliverEventToUser(
        io,
        userConnections,
        callerId,
        "callAnswered",
        () => ({ userId: socket.user.id.toString(), accept, callId, timestamp: Date.now() }),
        {
          maxAttempts: 5,
          delayMs: 800,
        }
      );
    } catch (err) {
      log.error(`answerCall handler error: ${err.message}`);
    }
  });
};
