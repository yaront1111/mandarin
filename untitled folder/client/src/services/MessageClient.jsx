// client/src/services/MessageClient.jsx
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

        // Queue message if socket is not connected (logic might need adjustment based on socketClient implementation)
         if (this.socketClient.pendingMessages) {
            this.socketClient.pendingMessages.push({
              event: "sendMessage",
              data: { recipientId, content, type, metadata, tempMessageId: tempMessage.id },
            });
         } else {
            console.warn("SocketClient does not support pending messages queue.");
         }

        resolve(tempMessage); // Resolve with temporary message immediately
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

      // Set a timeout for confirmation
      setTimeout(() => {
        this.socketClient.off("messageSent", handleMessageSent);
        this.socketClient.off("messageError", handleMessageError);
        // If no confirmation after timeout, resolve with a pending state message
        // This assumes the message might still arrive later, UI should handle 'pending'
         resolve({
           _id: tempMessageId, // Use temp ID if real ID not received
           sender: this.userId,
           recipient: recipientId,
           content,
           type,
           metadata,
           createdAt: new Date().toISOString(),
           read: false,
           status: "pending", // Indicate it might not have been confirmed
           tempMessageId,
         });
      }, 10000); // 10-second timeout
    });
  }

  /**
   * Send typing indicator
   * @param {string} recipientId - Recipient user ID
   */
  sendTyping(recipientId) {
     if (this.isConnected()) {
        this.socketClient.emit("typing", { recipientId });
     }
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
   * @returns {Promise} - Resolves when like is sent or rejects on error
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
        // Check if emit returned false due to buffer full or other immediate issue
        reject(new Error("Failed to send like event immediately"));
      }
      // Note: This doesn't guarantee server processing, only that emit was called.
      // For guaranteed delivery, server ACKs would be needed.
    });
  }

   /**
    * Register a handler for new likes
    * @param {Function} callback - Like handler
    * @returns {Function} - Unsubscribe function
    */
   onNewLike(callback) {
     // Ensure the event name matches the server emission ('new_like' vs 'newLike')
     return this.socketClient.on("newLike", callback); // Assuming server emits 'newLike' now
   }

  // --- REMOVED PHOTO PERMISSION METHODS ---
  // requestPhotoPermission removed
  // respondToPhotoRequest removed
  // onPhotoPermissionRequest removed
  // onPhotoPermissionResponse removed
}

// Ensure socketClient is imported if not already globally available
// import socketClient from './socketClient.jsx'; // Assuming path

// Create and export an instance (if this is how it's used)
// const messageClientInstance = new MessageClient(socketClient);
// export default messageClientInstance;

// Or just export the class
export default MessageClient;
