// client/src/services/socketService.jsx - Refactored
import socketClient from "./socketClient.jsx"

class SocketService {
  constructor() {
    this.socket = socketClient
    this.initialized = false
    this.showConnectionToasts = true
    this.debugMode = import.meta.env.MODE !== "production"
    this.eventListeners = new Map() // Keep track of all event listeners
  }

  /**
   * Initialize socket connection with a given userId and token.
   * @param {string} userId - User ID.
   * @param {string} token - Authentication token.
   * @param {Object} options - Additional options.
   * @returns {Object} - The socket object.
   */
  init(userId, token, options = {}) {
    if (this.initialized) {
      this._log("Socket service already initialized")
      return this.socket
    }

    this._log("Initializing socket service")
    this.socket.init(userId, token, options)
    this.initialized = true

    // Attach event emitter to window for app-wide events
    window.socketService = this

    // Add reconnection listener to reset services that depend on socket
    this.on("connect", () => {
      this._log("Socket reconnected, dispatching reconnect event")
      window.dispatchEvent(new CustomEvent("socketReconnected"))
    })

    return this.socket
  }

  // ----------------------
  // Core Connection Methods
  // ----------------------

  /**
   * Check if socket is connected and valid
   * @returns {boolean} Whether socket is connected and ready to use
   */
  isConnected() {
    return this.socket.isConnected()
  }

  /**
   * Force reconnection: disconnect and reinitialize.
   */
  reconnect() {
    this._log("Forcing socket reconnection")
    return this.socket.reconnect()
  }

  /**
   * Disconnect the socket and clean up all listeners and intervals.
   */
  disconnect() {
    this._log("Disconnecting socket")
    this.initialized = false

    // Keep track of listeners to restore on reconnection
    this.savedListeners = Array.from(this.eventListeners.entries())

    return this.socket.disconnect()
  }

  /**
   * Register an event listener.
   * @param {string} event - Event name.
   * @param {Function} callback - Callback function.
   * @returns {Function} - Unsubscribe function.
   */
  on(event, callback) {
    // Keep track of this listener for potential reconnection scenarios
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event).add(callback)

    const unsubscribe = this.socket.on(event, callback)

    // Return enhanced unsubscribe function that also removes from our tracking
    return () => {
      if (this.eventListeners.has(event)) {
        this.eventListeners.get(event).delete(callback)
        if (this.eventListeners.get(event).size === 0) {
          this.eventListeners.delete(event)
        }
      }
      unsubscribe()
    }
  }

  /**
   * Remove an event listener.
   * @param {string} event - Event name.
   * @param {Function} callback - Callback function.
   */
  off(event, callback) {
    this.socket.off(event, callback)

    // Also remove from our tracking
    if (this.eventListeners.has(event) && callback) {
      this.eventListeners.get(event).delete(callback)
      if (this.eventListeners.get(event).size === 0) {
        this.eventListeners.delete(event)
      }
    } else if (this.eventListeners.has(event) && !callback) {
      // If no callback provided, remove all listeners for this event
      this.eventListeners.delete(event)
    }
  }

  /**
   * Emit an event to the server.
   * @param {string} event - Event name.
   * @param {object} data - Event data.
   * @returns {boolean} - True if emitted or queued.
   */
  emit(event, data = {}) {
    return this.socket.emit(event, data)
  }

  // ----------------------
  // Messaging Methods
  // ----------------------

  /**
   * Send a message to a user.
   * @param {string} recipientId - Recipient user ID.
   * @param {string} content - Message content.
   * @param {string} type - Message type.
   * @param {object} metadata - Additional metadata.
   * @returns {Promise<object>} - Resolves with the message data.
   */
  async sendMessage(recipientId, content, type = "text", metadata = {}) {
    return new Promise((resolve, reject) => {
      const tempMessageId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

      // If not connected, queue the message and return a temporary
      if (!this.isConnected()) {
        this._log("Socket not connected, queueing message")
        const tempMessage = {
          _id: tempMessageId,
          sender: this.socket.userId,
          recipient: recipientId,
          type,
          content,
          metadata,
          createdAt: new Date().toISOString(),
          read: false,
          pending: true,
          tempMessageId,
        }

        return resolve(tempMessage)
      }

      // Set up one-time event handlers for response
      const handleMessageSent = (data) => {
        if (data.tempMessageId === tempMessageId) {
          this.socket.off("messageSent", handleMessageSent)
          this.socket.off("messageError", handleMessageError)
          resolve(data)
        }
      }

      const handleMessageError = (error) => {
        if (error.tempMessageId === tempMessageId) {
          this.socket.off("messageSent", handleMessageSent)
          this.socket.off("messageError", handleMessageError)
          reject(new Error(error.error || "Failed to send message"))
        }
      }

      // Register event handlers
      this.socket.on("messageSent", handleMessageSent)
      this.socket.on("messageError", handleMessageError)

      // Emit the message
      this.socket.emit("sendMessage", {
        recipientId,
        type,
        content,
        metadata,
        tempMessageId,
      })

      // Set a timeout for response
      setTimeout(() => {
        this.socket.off("messageSent", handleMessageSent)
        this.socket.off("messageError", handleMessageError)

        // If timed out, return a temporary message
        resolve({
          _id: tempMessageId,
          sender: this.socket.userId,
          recipient: recipientId,
          content,
          type,
          metadata,
          createdAt: new Date().toISOString(),
          read: false,
          status: "pending",
          tempMessageId,
        })
      }, 10000)
    })
  }

  /**
   * Send typing indicator
   * @param {string} recipientId - Recipient user ID
   */
  sendTyping(recipientId) {
    this.socket.emit("typing", { recipientId })
  }

  // ----------------------
  // Video/Call Methods
  // ----------------------

  /**
   * Send WebRTC signaling data
   * @param {string} recipientId - Recipient user ID
   * @param {Object} signal - WebRTC signal data
   * @param {Object} from - Sender details
   * @returns {boolean} - Success status
   */
  sendVideoSignal(recipientId, signal, from = null) {
    this._log(`Sending video signal to ${recipientId}`)

    // Retry logic for important signaling messages
    const maxRetries = 3
    let retryCount = 0

    const attemptSend = () => {
      const success = this.socket.emit("videoSignal", {
        recipientId,
        signal,
        from: from || {
          userId: this.socket.userId,
        },
        timestamp: Date.now(),
      })

      if (!success && retryCount < maxRetries) {
        retryCount++
        this._log(`Retrying video signal send (${retryCount}/${maxRetries})`)
        setTimeout(attemptSend, 1000)
      }

      return success
    }

    return attemptSend()
  }

  /**
   * Notify hangup to remote peer
   * @param {string} recipientId - Recipient user ID
   * @returns {boolean} - Success status
   */
  sendVideoHangup(recipientId) {
    this._log(`Sending hangup signal to ${recipientId}`)

    // Retry logic for important signaling messages
    const maxRetries = 3
    let retryCount = 0

    const attemptSend = () => {
      const success = this.socket.emit("videoHangup", {
        recipientId,
        userId: this.socket.userId,
        timestamp: Date.now(),
      })

      if (!success && retryCount < maxRetries) {
        retryCount++
        this._log(`Retrying hangup signal send (${retryCount}/${maxRetries})`)
        setTimeout(attemptSend, 1000)
      }

      return success
    }

    return attemptSend()
  }

  /**
   * Send media control event (mute/unmute)
   * @param {string} recipientId - Recipient user ID
   * @param {string} type - Control type (audio/video)
   * @param {boolean} muted - Muted state
   * @returns {boolean} - Success status
   */
  sendMediaControl(recipientId, type, muted) {
    return this.socket.emit("videoMediaControl", {
      recipientId,
      type,
      muted,
      userId: this.socket.userId,
    })
  }

  /**
   * Initiate a video call with a user.
   * @param {string} recipientId - Recipient user ID.
   * @returns {Promise<object>} - Resolves with call data.
   */
  initiateVideoCall(recipientId) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        return reject(new Error("Socket not connected"))
      }

      const callData = {
        callId: `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        recipientId,
        callType: "video",
        userId: this.socket.userId,
        caller: {
          userId: this.socket.userId,
          name: localStorage.getItem("userNickname") || "User",
        },
        timestamp: Date.now(),
      }

      this._log("Initiating call with data:", callData)

      const handleCallInitiated = (response) => {
        this.socket.off("callInitiated", handleCallInitiated)
        this.socket.off("callError", handleCallError)
        resolve(response)
      }

      const handleCallError = (error) => {
        this.socket.off("callInitiated", handleCallInitiated)
        this.socket.off("callError", handleCallError)
        reject(new Error(error.message || "Failed to initiate call"))
      }

      // Register event handlers
      this.socket.on("callInitiated", handleCallInitiated)
      this.socket.on("callError", handleCallError)

      // Emit call request
      this.socket.emit("initiateCall", callData)

      // Set a timeout
      setTimeout(() => {
        this.socket.off("callInitiated", handleCallInitiated)
        this.socket.off("callError", handleCallError)
        resolve({ success: true, callId: callData.callId })
      }, 5000)
    })
  }

  /**
   * Answer a call
   * @param {string} callerId - Caller user ID
   * @param {boolean} accept - Whether to accept the call
   * @param {string} callId - Call ID
   * @returns {boolean} - Success status
   */
  answerCall(callerId, accept, callId) {
    this._log(`Answering call from ${callerId} with accept=${accept}`)

    // Retry logic for important signaling messages
    const maxRetries = 3
    let retryCount = 0

    const attemptSend = () => {
      const success = this.socket.emit("answerCall", {
        callerId,
        accept,
        callId,
        userId: this.socket.userId,
        timestamp: Date.now(),
      })

      if (!success && retryCount < maxRetries) {
        retryCount++
        this._log(`Retrying call answer send (${retryCount}/${maxRetries})`)
        setTimeout(attemptSend, 1000)
      }

      return success
    }

    return attemptSend()
  }

  // ----------------------
  // User Status Methods
  // ----------------------

  /**
   * Get connection status and details.
   * @returns {object} - Connection status object.
   */
  getStatus() {
    return {
      connected: this.isConnected(),
      initialized: this.initialized,
      userId: this.socket.userId,
    }
  }

  // ----------------------
  // Configuration Methods
  // ----------------------

  /**
   * Enable or disable connection toast notifications.
   * @param {boolean} enable - True to enable toasts.
   */
  setShowConnectionToasts(enable) {
    this.showConnectionToasts = enable
  }

  /**
   * Enable or disable debug mode.
   * @param {boolean} enable - True to enable debug logging.
   */
  setDebugMode(enable) {
    this.debugMode = enable
  }

  // ----------------------
  // Photo Permission Methods
  // ----------------------

  /**
   * Request access to a private photo
   * @param {string} photoId - ID of the photo
   * @param {string} ownerId - ID of the photo owner
   * @returns {Promise<object>} Result of the request
   */
  requestPhotoAccess(photoId, ownerId) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        return reject(new Error("Socket not connected"));
      }

      const requestId = `req-${photoId}-${this.socket.userId}`;

      const handleSuccess = (response) => {
        if (response.requestId === requestId) {
          cleanup();
          resolve(response);
        }
      };

      const handleError = (error) => {
        if (error.requestId === requestId) {
          cleanup();
          reject(new Error(error.error || "Permission request failed"));
        }
      };

      const cleanup = () => {
        this.socket.off("photoPermissionRequested", handleSuccess);
        this.socket.off("photoPermissionError", handleError);
      };

      // Listen for response events
      this.socket.on("photoPermissionRequested", handleSuccess);
      this.socket.on("photoPermissionError", handleError);

      // Emit the request
      const success = this.socket.emit("requestPhotoPermission", { photoId, ownerId });

      if (!success) {
        cleanup();
        reject(new Error("Failed to send permission request"));
      }

      // Timeout for the request
      setTimeout(() => {
        cleanup();
        reject(new Error("Permission request timed out"));
      }, 10000);
    });
  }

  /**
   * Respond to a photo permission request
   * @param {string} permissionId - ID of the permission request
   * @param {string} status - 'approved' or 'rejected'
   * @returns {Promise<object>} Result of the response
   */
  respondToPhotoPermission(permissionId, status) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        return reject(new Error("Socket not connected"));
      }

      if (!["approved", "rejected"].includes(status)) {
        return reject(new Error("Invalid status. Must be 'approved' or 'rejected'."));
      }

      const requestId = `res-${permissionId}-${this.socket.userId}`;

      const handleSuccess = (response) => {
        if (response.requestId === requestId) {
          cleanup();
          resolve(response);
        }
      };

      const handleError = (error) => {
        if (error.requestId === requestId) {
          cleanup();
          reject(new Error(error.error || "Permission response failed"));
        }
      };

      const cleanup = () => {
        this.socket.off("photoPermissionResponded", handleSuccess);
        this.socket.off("photoPermissionError", handleError);
      };

      // Listen for response events
      this.socket.on("photoPermissionResponded", handleSuccess);
      this.socket.on("photoPermissionError", handleError);

      // Emit the response
      const success = this.socket.emit("respondToPhotoPermission", { permissionId, status });

      if (!success) {
        cleanup();
        reject(new Error("Failed to send permission response"));
      }

      // Timeout for the request
      setTimeout(() => {
        cleanup();
        reject(new Error("Permission response timed out"));
      }, 10000);
    });
  }

  // ----------------------
  // Utilities
  // ----------------------

  /**
   * Log messages if in debug mode
   * @private
   */
  _log(...args) {
    if (this.debugMode) {
      console.log("[SocketService]", ...args)
    }
  }
}

// Create a singleton instance
const socketService = new SocketService()
export default socketService
