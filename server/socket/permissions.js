// server/src/sockets/permissions.js

import mongoose from "mongoose";
import { sendNotification } from "./notification.js";
import logger from "../logger.js";

// Simple logger fallback if logger.create doesn't exist
const log = {
  info: (...args) => console.log("[socket:permissions]", ...args),
  error: (...args) => console.error("[socket:permissions]", ...args),
  warn: (...args) => console.warn("[socket:permissions]", ...args),
  debug: (...args) => console.debug("[socket:permissions]", ...args)
};

// ——— Socket event names ———
const EVENTS = {
  REQUEST:    "requestPhotoPermission",
  REQUESTED:  "photoPermissionRequested",
  RESPOND:    "respondToPhotoPermission",
  RESPONDED:  "photoPermissionResponded",
  ERROR:      "photoPermissionError"
};

/**
 * Wraps a socket listener to catch and log errors.
 * @param {Function} fn
 * @returns {Function}
 */
const safeListener = fn => async payload => {
  try {
    await fn(payload);
  } catch (err) {
    log.error("Handler error:", err);
  }
};

/**
 * Safely emit an event on a socket.
 * @param {import("socket.io").Socket} socket
 * @param {string} event
 * @param {any} data
 */
const safeEmit = (socket, event, data) => {
  try {
    socket.emit(event, data);
  } catch (err) {
    log.error(`Emit error [${event}]:`, err);
  }
};

/**
 * Handle a photo-permission request: acknowledge to requester and notify owner.
 *
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 * @param {object} data
 * @param {string} data.photoId
 * @param {string} data.ownerId
 * @param {string} data.permissionId
 */
export async function sendPhotoPermissionRequestNotification(io, socket, data) {
  const { photoId, ownerId, permissionId } = data;
  const requestId = `req-${photoId}-${socket.user._id}`;

  // Validate IDs
  if (
    !mongoose.Types.ObjectId.isValid(photoId) ||
    !mongoose.Types.ObjectId.isValid(ownerId) ||
    !mongoose.Types.ObjectId.isValid(permissionId)
  ) {
    return safeEmit(socket, EVENTS.ERROR, { error: "Invalid ID format", requestId });
  }

  // Acknowledge back to requester
  safeEmit(socket, EVENTS.REQUESTED, {
    success:      true,
    photoId,
    ownerId,
    permissionId,
    requestId,
    timestamp:    Date.now()
  });

  // Send an actual notification to owner
  await sendNotification(io, {
    recipient: ownerId,
    sender:    socket.user._id,
    type:      "photoRequest",
    title:     `${socket.user.nickname || "Someone"} requested access to your private photo`,
    content:   "Click to review the request",
    reference: permissionId,
    data:      { permissionId, photoId }
  });
}

/**
 * Handle a photo-permission response: acknowledge to owner and notify requester.
 *
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 * @param {object} data
 * @param {string} data.permissionId
 * @param {'approved'|'rejected'} data.status
 * @param {string} data.requesterId  // must be passed so we know whom to notify
 */
export async function sendPhotoPermissionResponseNotification(io, socket, data) {
  const { permissionId, status, requesterId } = data;
  const requestId = `res-${permissionId}-${socket.user._id}`;

  // Validate inputs
  if (
    !mongoose.Types.ObjectId.isValid(permissionId) ||
    !mongoose.Types.ObjectId.isValid(requesterId) ||
    !["approved", "rejected"].includes(status)
  ) {
    return safeEmit(socket, EVENTS.ERROR, { error: "Invalid input", requestId });
  }

  // Acknowledge back to responder
  safeEmit(socket, EVENTS.RESPONDED, {
    success:      true,
    permissionId,
    status,
    requestId,
    timestamp:    Date.now()
  });

  // Send an actual notification to the original requester
  await sendNotification(io, {
    recipient: requesterId,
    sender:    socket.user._id,
    type:      "photoResponse",
    title:     `${socket.user.nickname || "Someone"} ${status} your photo request`,
    content:   status === "approved"
                 ? "You can now view the private photo."
                 : "Your request was declined.",
    reference: permissionId,
    data:      { permissionId, status }
  });
}

/**
 * Register photo-permission socket handlers for this connection.
 *
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 */
export function registerPermissionHandlers(io, socket) {
  socket.on(EVENTS.REQUEST,   safeListener(data => sendPhotoPermissionRequestNotification(io, socket, data)));
  socket.on(EVENTS.RESPOND,   safeListener(data => sendPhotoPermissionResponseNotification(io, socket, data)));
}
