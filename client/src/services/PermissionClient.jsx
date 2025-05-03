// client/src/services/PermissionClient.jsx
import socketService from "./socketService.jsx";
import { toast } from "react-toastify";
import logger from "../utils/logger";

const log = logger.create("PermissionClient");

/**
 * Client for handling photo permission socket operations.
 * Uses standardized socketService for communication.
 */
class PermissionClient {
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
      let cleanup;
      let timeoutId;

      const handleSuccess = (response) => {
        if (response.requestId === requestId) {
          log.debug(`Photo permission request succeeded: ${requestId}`);
          if (cleanup) cleanup();
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
          if (cleanup) cleanup();
          reject(new Error(response.error || 'Permission request failed'));
        }
      };

      // Setup cleanup function
      cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        socketService.off('photoPermissionRequested', handleSuccess);
        socketService.off('photoPermissionError', handleError);
      };

      // Register event handlers using socketService
      socketService.on('photoPermissionRequested', handleSuccess);
      socketService.on('photoPermissionError', handleError);

      // Send the request using socketService
      const emitted = socketService.emit("requestPhotoPermission", payload);

      if (!emitted) {
        log.error(`Failed to emit photo permission request: ${requestId}`);
        cleanup();
        reject(new Error("Failed to send permission request"));
      }

      // Set timeout
      timeoutId = setTimeout(() => {
        log.warn(`Photo permission request timed out: ${requestId}`);
        cleanup();
        reject(new Error('Permission request timed out'));
      }, 10000); // 10-second timeout
    });
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
      let cleanup;
      let timeoutId;

      const handleSuccess = (response) => {
        if (response.requestId === requestId) {
          log.debug(`Photo permission response succeeded: ${requestId}`);
          if (cleanup) cleanup();
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
          if (cleanup) cleanup();
          reject(new Error(response.error || 'Permission response failed'));
        }
      };

      // Setup cleanup function
      cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        socketService.off('photoPermissionResponded', handleSuccess);
        socketService.off('photoPermissionError', handleError);
      };

      // Register event handlers
      socketService.on('photoPermissionResponded', handleSuccess);
      socketService.on('photoPermissionError', handleError);

      // Send the response
      const emitted = socketService.emit("respondToPhotoPermission", payload);

      if (!emitted) {
        log.error(`Failed to emit photo permission response: ${requestId}`);
        cleanup();
        reject(new Error("Failed to send permission response"));
      }

      // Set timeout
      timeoutId = setTimeout(() => {
        log.warn(`Photo permission response timed out: ${requestId}`);
        cleanup();
        reject(new Error('Permission response timed out'));
      }, 10000); // 10-second timeout
    });
  }
}

// Create a singleton instance
const permissionClient = new PermissionClient();
export default permissionClient;