// client/src/services/PermissionClient.jsx
import socketService from "./socketService.jsx";
import { toast } from "react-toastify";

/**
 * Client for handling photo permission socket operations.
 */
class PermissionClient {
  constructor(socket) {
    this.socket = socket;
  }

  /**
   * Request access to a private photo.
   * @param {string} ownerId - The ID of the photo owner.
   * @param {string} photoId - The ID of the photo.
   * @returns {Promise<object>} Resolves with request status or rejects on error.
   */
  requestPhotoPermission(ownerId, photoId) {
    return new Promise((resolve, reject) => {
      if (!this.socket.isConnected()) {
        return reject(new Error("Socket not connected"));
      }
      if (!ownerId || !photoId) {
        return reject(new Error("Owner ID and Photo ID are required"));
      }

      const payload = { ownerId, photoId };
      const requestId = `req-${photoId}-${this.socket.socket?.userId}`; // Match server-side for potential tracking

      const handleSuccess = (response) => {
        if (response.requestId === requestId) {
          cleanup();
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.error || 'Failed to request permission'));
          }
        }
      };

      const handleError = (response) => {
         if (response.requestId === requestId) {
          cleanup();
          reject(new Error(response.error || 'Permission request failed'));
        }
      };

      const cleanup = () => {
        this.socket.off('photoPermissionRequested', handleSuccess);
        this.socket.off('photoPermissionError', handleError);
      };

      // Listen for response events
      this.socket.on('photoPermissionRequested', handleSuccess);
      this.socket.on('photoPermissionError', handleError);

      // Emit the request
      const success = this.socket.emit("requestPhotoPermission", payload);

      if (!success) {
        cleanup();
        reject(new Error("Failed to send permission request event"));
      }

      // Timeout for the request
      setTimeout(() => {
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
      if (!this.socket.isConnected()) {
        return reject(new Error("Socket not connected"));
      }
      if (!permissionId || !status) {
        return reject(new Error("Permission ID and status are required"));
      }
      if (!['approved', 'rejected'].includes(status)) {
         return reject(new Error("Invalid status provided"));
      }

      const payload = { permissionId, status };
      const requestId = `res-${permissionId}-${this.socket.socket?.userId}`;

       const handleSuccess = (response) => {
         if (response.requestId === requestId) {
           cleanup();
           if (response.success) {
             resolve(response);
           } else {
             reject(new Error(response.error || 'Failed to respond to permission'));
           }
         }
       };

       const handleError = (response) => {
          if (response.requestId === requestId) {
           cleanup();
           reject(new Error(response.error || 'Permission response failed'));
         }
       };

       const cleanup = () => {
         this.socket.off('photoPermissionResponded', handleSuccess);
         this.socket.off('photoPermissionError', handleError);
       };

      // Listen for response events
      this.socket.on('photoPermissionResponded', handleSuccess);
      this.socket.on('photoPermissionError', handleError);

      // Emit the response
      const success = this.socket.emit("respondToPhotoPermission", payload);

      if (!success) {
         cleanup();
         reject(new Error("Failed to send permission response event"));
      }

      // Timeout for the request
      setTimeout(() => {
        cleanup();
        reject(new Error('Permission response timed out'));
      }, 10000); // 10-second timeout
    });
  }
}

// Create a singleton instance
const permissionClient = new PermissionClient(socketService);
export default permissionClient;