// client/src/services/PermissionClient.jsx
import socketService from "./socketService.jsx";
import { SOCKET } from "../config";
import logger from "../utils/logger";

const log = logger.create("PermissionClient");

/**
 * Client for handling photo permission socket operations.
 * Uses standardized socketService for communication.
 */
class PermissionClient {
  constructor() {
    // Track unsubscribers to clean up event listeners correctly
    this._eventUnsubscribers = new Map();
  }

  /**
   * Request access to a private photo.
   * @param {string} ownerId - The ID of the photo owner.
   * @param {string} photoId - The ID of the photo.
   * @returns {Promise<object>} Resolves with request status or rejects on error.
   */
  requestPhotoPermission(ownerId, photoId) {
    return new Promise((resolve, reject) => {
      if (!socketService.isConnected()) {
        log.warn("Cannot request photo permission: Socket not connected");
        return reject(new Error("Socket not connected"));
      }
      if (!ownerId || !photoId) {
        log.warn("Missing required parameters for photo permission request");
        return reject(new Error("Owner ID and Photo ID are required"));
      }

      const payload = { ownerId, photoId };
      const requestId = `req-${photoId}-${Date.now()}`; // Unique ID for this request
      payload.requestId = requestId; // Add requestId to payload
      
      log.debug(`Requesting photo permission: ${photoId} from ${ownerId}`);

      // Create event handlers
      let timeoutId;

      const handleSuccess = (response) => {
        if (response.requestId === requestId) {
          log.debug(`Photo permission request succeeded: ${requestId}`);
          this._cleanupEventListeners(requestId);
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.error || 'Failed to request permission'));
          }
        }
      };

      const handleError = (response) => {
        if (response.requestId === requestId) {
          log.error(`Photo permission request error: ${response.error || 'Unknown error'}`);
          this._cleanupEventListeners(requestId);
          reject(new Error(response.error || 'Permission request failed'));
        }
      };

      // Register event handlers using socketService
      this._registerEventListener(requestId, 'photoPermissionRequested', handleSuccess);
      this._registerEventListener(requestId, 'photoPermissionError', handleError);

      // Send the request using socketService
      const emitted = socketService.emit("requestPhotoPermission", payload);

      if (!emitted) {
        log.error(`Failed to emit photo permission request: ${requestId}`);
        this._cleanupEventListeners(requestId);
        reject(new Error("Failed to send permission request"));
        return;
      }

      // Set timeout using configuration
      timeoutId = setTimeout(() => {
        log.warn(`Photo permission request timed out: ${requestId}`);
        this._cleanupEventListeners(requestId);
        reject(new Error('Permission request timed out'));
      }, SOCKET.TIMEOUT.PERMISSION_REQUEST || SOCKET.TIMEOUT.ACK * 5); // Use permission timeout or 5x ACK

      // Store timeout for cleanup
      this._eventUnsubscribers.set(`${requestId}-timeout`, timeoutId);
    });
  }

  /**
   * Register an event listener and store the unsubscribe function
   * @private
   * @param {string} requestId - Unique request ID
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  _registerEventListener(requestId, event, handler) {
    const unsubscribe = socketService.on(event, handler);
    this._eventUnsubscribers.set(`${requestId}-${event}`, unsubscribe);
  }

  /**
   * Clean up event listeners and timeouts for a request
   * @private
   * @param {string} requestId - Unique request ID
   */
  _cleanupEventListeners(requestId) {
    // Clean up all event listeners and timeouts for this request
    for (const [key, unsubscribe] of this._eventUnsubscribers.entries()) {
      if (key.startsWith(requestId)) {
        if (key.endsWith('-timeout')) {
          clearTimeout(unsubscribe);
        } else {
          // Call the unsubscribe function
          unsubscribe();
        }
        this._eventUnsubscribers.delete(key);
      }
    }
  }

  /**
   * Respond to a photo permission request.
   * @param {string} permissionId - The ID of the permission request document.
   * @param {'approved' | 'rejected'} status - The response status.
   * @returns {Promise<object>} Resolves with response status or rejects on error.
   */
  respondToPhotoPermission(permissionId, status) {
    return new Promise((resolve, reject) => {
      if (!socketService.isConnected()) {
        log.warn("Cannot respond to photo permission: Socket not connected");
        return reject(new Error("Socket not connected"));
      }
      if (!permissionId || !status) {
        log.warn("Missing required parameters for photo permission response");
        return reject(new Error("Permission ID and status are required"));
      }
      if (!['approved', 'rejected'].includes(status)) {
        log.warn(`Invalid status for photo permission response: ${status}`);
        return reject(new Error("Invalid status provided"));
      }

      const payload = { permissionId, status };
      const requestId = `res-${permissionId}-${Date.now()}`;
      payload.requestId = requestId;
      
      log.debug(`Responding to photo permission: ${permissionId} with ${status}`);

      // Create event handlers
      const handleSuccess = (response) => {
        if (response.requestId === requestId) {
          log.debug(`Photo permission response succeeded: ${requestId}`);
          this._cleanupEventListeners(requestId);
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.error || 'Failed to respond to permission'));
          }
        }
      };

      const handleError = (response) => {
        if (response.requestId === requestId) {
          log.error(`Photo permission response error: ${response.error || 'Unknown error'}`);
          this._cleanupEventListeners(requestId);
          reject(new Error(response.error || 'Permission response failed'));
        }
      };

      // Register event handlers using consolidated method
      this._registerEventListener(requestId, 'photoPermissionResponded', handleSuccess);
      this._registerEventListener(requestId, 'photoPermissionError', handleError);

      // Send the response
      const emitted = socketService.emit("respondToPhotoPermission", payload);

      if (!emitted) {
        log.error(`Failed to emit photo permission response: ${requestId}`);
        this._cleanupEventListeners(requestId);
        reject(new Error("Failed to send permission response"));
        return;
      }

      // Set timeout
      const timeoutId = setTimeout(() => {
        log.warn(`Photo permission response timed out: ${requestId}`);
        this._cleanupEventListeners(requestId);
        reject(new Error('Permission response timed out'));
      }, SOCKET.TIMEOUT.PERMISSION_REQUEST || SOCKET.TIMEOUT.ACK * 5); // Use permission timeout or 5x ACK

      // Store timeout for cleanup
      this._eventUnsubscribers.set(`${requestId}-timeout`, timeoutId);
    });
  }

  /**
   * Clean up all event listeners
   */
  cleanup() {
    // Clean up all registered event listeners
    for (const [key, unsubscribe] of this._eventUnsubscribers.entries()) {
      if (key.endsWith('-timeout')) {
        clearTimeout(unsubscribe);
      } else {
        unsubscribe();
      }
    }
    this._eventUnsubscribers.clear();
    log.debug('Permission client cleaned up');
  }
}

// Create a singleton instance
const permissionClient = new PermissionClient();
export default permissionClient;