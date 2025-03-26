// client/src/services/socketService.jsx - Refactored
import socketClient from './socketClient.jsx';
import { toast } from "react-toastify";
import { getToken } from "../utils/tokenStorage";

class SocketService {
  constructor() {
    this.socket = socketClient;
    this.initialized = false;
    this.showConnectionToasts = true;
    this.debugMode = import.meta.env.MODE !== "production";
  }

  /**
   * Initialize socket connection with a given userId and token.
   * @param {string} userId - User ID.
   * @param {string} token - Authentication token.
   */
  init(userId, token, options = {}) {
    if (this.initialized) {
      this._log("Socket service already initialized");
      return;
    }

    this._log("Initializing socket service");
    this.socket.init(userId, token, options);
    this.initialized = true;
    
    // Attach event emitter to window for app-wide events
    window.socketService = this;
  }

  // ----------------------
  // Core Connection Methods
  // ----------------------
  
  /**
   * Check if socket is connected and valid
   * @returns {boolean} Whether socket is connected and ready to use
   */
  isConnected() {
    return this.socket.isConnected();
  }

  /**
   * Force reconnection: disconnect and reinitialize.
   */
  reconnect() {
    this._log("Forcing socket reconnection");
    return this.socket.reconnect();
  }

  /**
   * Disconnect the socket and clean up all listeners and intervals.
   */
  disconnect() {
    this._log("Disconnecting socket");
    this.initialized = false;
    return this.socket.disconnect();
  }

  /**
   * Register an event listener.
   * @param {string} event - Event name.
   * @param {Function} callback - Callback function.
   * @returns {Function} - Unsubscribe function.
   */
  on(event, callback) {
    return this.socket.on(event, callback);
  }

  /**
   * Remove an event listener.
   * @param {string} event - Event name.
   * @param {Function} callback - Callback function.
   */
  off(event, callback) {
    this.socket.off(event, callback);
  }

  /**
   * Emit an event to the server.
   * @param {string} event - Event name.
   * @param {object} data - Event data.
   * @returns {boolean} - True if emitted or queued.
   */
  emit(event, data = {}) {
    return this.socket.emit(event, data);
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
      const tempMessageId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // If not connected, queue the message and return a temporary
      if (!this.isConnected()) {
        this._log("Socket not connected, queueing message");
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
        };
        
        return resolve(tempMessage);
      }

      // Set up one-time event handlers for response
      const handleMessageSent = (data) => {
        if (data.tempMessageId === tempMessageId) {
          this.socket.off("messageSent", handleMessageSent);
          this.socket.off("messageError", handleMessageError);
          resolve(data);
        }
      };

      const handleMessageError = (error) => {
        if (error.tempMessageId === tempMessageId) {
          this.socket.off("messageSent", handleMessageSent);
          this.socket.off("messageError", handleMessageError);
          reject(new Error(error.error || "Failed to send message"));
        }
      };

      // Register event handlers
      this.socket.on("messageSent", handleMessageSent);
      this.socket.on("messageError", handleMessageError);

      // Emit the message
      this.socket.emit("sendMessage", {
        recipientId,
        type,
        content,
        metadata,
        tempMessageId,
      });

      // Set a timeout for response
      setTimeout(() => {
        this.socket.off("messageSent", handleMessageSent);
        this.socket.off("messageError", handleMessageError);

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
        });
      }, 10000);
    });
  }

  /**
   * Send typing indicator
   * @param {string} recipientId - Recipient user ID
   */
  sendTyping(recipientId) {
    this.socket.emit("typing", { recipientId });
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
    this._log(`Sending video signal to ${recipientId}`);

    // Retry logic for important signaling messages
    const maxRetries = 3;
    let retryCount = 0;

    const attemptSend = () => {
      const success = this.socket.emit("videoSignal", {
        recipientId,
        signal,
        from: from || {
          userId: this.socket.userId,
        },
        timestamp: Date.now(),
      });

      if (!success && retryCount < maxRetries) {
        retryCount++;
        this._log(`Retrying video signal send (${retryCount}/${maxRetries})`);
        setTimeout(attemptSend, 1000);
      }

      return success;
    };

    return attemptSend();
  }

  /**
   * Notify hangup to remote peer
   * @param {string} recipientId - Recipient user ID
   * @returns {boolean} - Success status
   */
  sendVideoHangup(recipientId) {
    this._log(`Sending hangup signal to ${recipientId}`);

    // Retry logic for important signaling messages
    const maxRetries = 3;
    let retryCount = 0;

    const attemptSend = () => {
      const success = this.socket.emit("videoHangup", {
        recipientId,
        userId: this.socket.userId,
        timestamp: Date.now(),
      });

      if (!success && retryCount < maxRetries) {
        retryCount++;
        this._log(`Retrying hangup signal send (${retryCount}/${maxRetries})`);
        setTimeout(attemptSend, 1000);
      }

      return success;
    };

    return attemptSend();
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
    });
  }

  /**
   * Initiate a video call with a user.
   * @param {string} recipientId - Recipient user ID.
   * @returns {Promise<object>} - Resolves with call data.
   */
  initiateVideoCall(recipientId) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        return reject(new Error("Socket not connected"));
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
      };

      this._log("Initiating call with data:", callData);

      const handleCallInitiated = (response) => {
        this.socket.off("callInitiated", handleCallInitiated);
        this.socket.off("callError", handleCallError);
        resolve(response);
      };

      const handleCallError = (error) => {
        this.socket.off("callInitiated", handleCallInitiated);
        this.socket.off("callError", handleCallError);
        reject(new Error(error.message || "Failed to initiate call"));
      };

      // Register event handlers
      this.socket.on("callInitiated", handleCallInitiated);
      this.socket.on("callError", handleCallError);

      // Emit call request
      this.socket.emit("initiateCall", callData);

      // Set a timeout
      setTimeout(() => {
        this.socket.off("callInitiated", handleCallInitiated);
        this.socket.off("callError", handleCallError);
        resolve({ success: true, callId: callData.callId });
      }, 5000);
    });
  }

  /**
   * Answer a call
   * @param {string} callerId - Caller user ID
   * @param {boolean} accept - Whether to accept the call
   * @param {string} callId - Call ID
   * @returns {boolean} - Success status
   */
  answerCall(callerId, accept, callId) {
    this._log(`Answering call from ${callerId} with accept=${accept}`);

    // Retry logic for important signaling messages
    const maxRetries = 3;
    let retryCount = 0;

    const attemptSend = () => {
      const success = this.socket.emit("answerCall", {
        callerId,
        accept,
        callId,
        userId: this.socket.userId,
        timestamp: Date.now(),
      });

      if (!success && retryCount < maxRetries) {
        retryCount++;
        this._log(`Retrying call answer send (${retryCount}/${maxRetries})`);
        setTimeout(attemptSend, 1000);
      }

      return success;
    };

    return attemptSend();
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
    };
  }

  // ----------------------
  // Configuration Methods
  // ----------------------
  
  /**
   * Enable or disable connection toast notifications.
   * @param {boolean} enable - True to enable toasts.
   */
  setShowConnectionToasts(enable) {
    this.showConnectionToasts = enable;
  }

  /**
   * Enable or disable debug mode.
   * @param {boolean} enable - True to enable debug logging.
   */
  setDebugMode(enable) {
    this.debugMode = enable;
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
      console.log("[SocketService]", ...args);
    }
  }
}

// Create a singleton instance
const socketService = new SocketService();
export default socketService;
