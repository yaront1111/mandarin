/**
 * Messaging client that handles all chat-related socket operations
 */
class MessageClient {
  constructor(socketClient) {
    this.socketClient = socketClient;
  }

  /**
   * Get the user ID
   * @returns {string} - Current user ID
   */
  get userId() {
    return this.socketClient.userId;
  }

  /**
   * Check if socket is connected
   * @returns {boolean} - Connection status
   */
  isConnected() {
    return this.socketClient.isConnected();
  }

  /**
   * Send a text message
   * @param {string} recipientId - Recipient user ID
   * @param {string} content - Message content
   * @param {string} type - Message type
   * @param {Object} metadata - Additional message metadata
   * @returns {Promise} - Resolves with sent message data
   */
  sendMessage(recipientId, content, type = "text", metadata = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        const tempMessage = {
          id: `temp-${Date.now()}`,
          recipientId,
          content,
          type,
          metadata,
          pending: true,
          timestamp: new Date(),
        };

        this.socketClient.pendingMessages.push({
          event: "sendMessage",
          data: { recipientId, content, type, metadata, tempMessageId: tempMessage.id },
        });

        resolve(tempMessage);
        return;
      }

      const tempMessageId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const handleMessageSent = (data) => {
        if (data.tempMessageId === tempMessageId) {
          this.socketClient.off("messageSent", handleMessageSent);
          this.socketClient.off("messageError", handleMessageError);
          resolve(data);
        }
      };

      const handleMessageError = (error) => {
        if (error.tempMessageId === tempMessageId) {
          this.socketClient.off("messageSent", handleMessageSent);
          this.socketClient.off("messageError", handleMessageError);
          reject(new Error(error.error || "Failed to send message"));
        }
      };

      // Register one-time event handlers
      this.socketClient.on("messageSent", handleMessageSent);
      this.socketClient.on("messageError", handleMessageError);

      // Emit the message
      this.socketClient.emit("sendMessage", {
        recipientId,
        content,
        type,
        metadata,
        tempMessageId,
      });

      // Set a timeout
      setTimeout(() => {
        this.socketClient.off("messageSent", handleMessageSent);
        this.socketClient.off("messageError", handleMessageError);

        // Return a temporary message if no response
        resolve({
          _id: tempMessageId,
          sender: this.userId,
          recipient: recipientId,
          content,
          type,
          metadata,
          createdAt: new Date().toISOString(),
          read: false,
          status: "pending",
          tempMessageId,
        });
      }, 10000);
    });
  }

  /**
   * Send typing indicator
   * @param {string} recipientId - Recipient user ID
   */
  sendTyping(recipientId) {
    this.socketClient.emit("typing", { recipientId });
  }

  /**
   * Register a handler for receiving messages
   * @param {Function} callback - Message handler
   * @returns {Function} - Unsubscribe function
   */
  onMessageReceived(callback) {
    return this.socketClient.on("messageReceived", callback);
  }

  /**
   * Register a handler for typing indicators
   * @param {Function} callback - Typing handler
   * @returns {Function} - Unsubscribe function
   */
  onUserTyping(callback) {
    return this.socketClient.on("userTyping", callback);
  }

  /**
   * Send a like notification
   * @param {string} recipientId - User ID to like
   * @param {Object} likeData - Additional like data
   * @returns {Promise} - Resolves when like is sent
   */
  sendLike(recipientId, likeData = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error("Socket not connected"));
        return;
      }

      const success = this.socketClient.emit("sendLike", {
        recipientId,
        ...likeData,
        timestamp: Date.now()
      });

      if (success) {
        resolve();
      } else {
        reject(new Error("Failed to send like"));
      }
    });
  }

  /**
   * Request permission to view a private photo
   * @param {string} ownerId - Photo owner ID
   * @param {string} photoId - Photo ID
   * @returns {Promise} - Resolves when request is sent
   */
  requestPhotoPermission(ownerId, photoId) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error("Socket not connected"));
        return;
      }

      const success = this.socketClient.emit("requestPhotoPermission", {
        ownerId,
        photoId,
        timestamp: Date.now()
      });

      if (success) {
        resolve();
      } else {
        reject(new Error("Failed to send photo permission request"));
      }
    });
  }

  /**
   * Respond to a photo permission request
   * @param {string} requesterId - User who requested permission
   * @param {string} photoId - Photo ID
   * @param {boolean} approved - Whether permission is granted
   * @returns {Promise} - Resolves when response is sent
   */
  respondToPhotoRequest(requesterId, photoId, approved) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error("Socket not connected"));
        return;
      }

      const success = this.socketClient.emit("respondToPhotoRequest", {
        requesterId,
        photoId,
        status: approved ? "approved" : "rejected",
        timestamp: Date.now()
      });

      if (success) {
        resolve();
      } else {
        reject(new Error("Failed to send photo permission response"));
      }
    });
  }

  /**
   * Register a handler for new likes
   * @param {Function} callback - Like handler
   * @returns {Function} - Unsubscribe function
   */
  onNewLike(callback) {
    return this.socketClient.on("new_like", callback);
  }

  /**
   * Register a handler for photo permission requests
   * @param {Function} callback - Request handler
   * @returns {Function} - Unsubscribe function
   */
  onPhotoPermissionRequest(callback) {
    return this.socketClient.on("photo_permission_request", callback);
  }

  /**
   * Register a handler for photo permission responses
   * @param {Function} callback - Response handler
   * @returns {Function} - Unsubscribe function
   */
  onPhotoPermissionResponse(callback) {
    return this.socketClient.on("photo_permission_response", callback);
  }
}

export default MessageClient;
