/**
 * Call client that handles all WebRTC and call-related socket operations
 */
class CallClient {
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
   * Send WebRTC signaling data
   * @param {string} recipientId - Recipient user ID
   * @param {Object} signal - WebRTC signal data
   * @param {Object} from - Sender details
   * @returns {boolean} - Success status
   */
  sendVideoSignal(recipientId, signal, from = null) {
    console.log(`Sending video signal to ${recipientId}`);

    // Retry logic for important signaling messages
    const maxRetries = 3;
    let retryCount = 0;

    const attemptSend = () => {
      const success = this.socketClient.emit("videoSignal", {
        recipientId,
        signal,
        from: from || {
          userId: this.userId,
        },
        timestamp: Date.now(),
      });

      if (!success && retryCount < maxRetries) {
        retryCount++;
        console.log(`Retrying video signal send (${retryCount}/${maxRetries})`);
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
    console.log(`Sending hangup signal to ${recipientId}`);

    // Retry logic for important signaling messages
    const maxRetries = 3;
    let retryCount = 0;

    const attemptSend = () => {
      const success = this.socketClient.emit("videoHangup", {
        recipientId,
        userId: this.userId,
        timestamp: Date.now(),
      });

      if (!success && retryCount < maxRetries) {
        retryCount++;
        console.log(`Retrying hangup signal send (${retryCount}/${maxRetries})`);
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
    return this.socketClient.emit("videoMediaControl", {
      recipientId,
      type,
      muted,
      userId: this.userId,
    });
  }

  /**
   * Initiate a video call
   * @param {string} recipientId - Recipient user ID
   * @returns {Promise} - Resolves when call is initiated
   */
  initiateVideoCall(recipientId) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error("Socket not connected"));
        return;
      }

      const callData = {
        callId: `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        recipientId,
        callType: "video",
        userId: this.userId,
        caller: {
          userId: this.userId,
          name: localStorage.getItem("userNickname") || "User",
        },
        timestamp: Date.now(),
      };

      console.log("Initiating call with data:", callData);

      const handleCallInitiated = (response) => {
        this.socketClient.off("callInitiated", handleCallInitiated);
        this.socketClient.off("callError", handleCallError);
        resolve(response);
      };

      const handleCallError = (error) => {
        this.socketClient.off("callInitiated", handleCallInitiated);
        this.socketClient.off("callError", handleCallError);
        reject(new Error(error.message || "Failed to initiate call"));
      };

      // Register one-time event handlers
      this.socketClient.on("callInitiated", handleCallInitiated);
      this.socketClient.on("callError", handleCallError);

      // Emit the call request
      this.socketClient.emit("initiateCall", callData);

      // Set a timeout
      setTimeout(() => {
        this.socketClient.off("callInitiated", handleCallInitiated);
        this.socketClient.off("callError", handleCallError);
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
    console.log(`Answering call from ${callerId} with accept=${accept}`);

    // Retry logic for important signaling messages
    const maxRetries = 3;
    let retryCount = 0;

    const attemptSend = () => {
      const success = this.socketClient.emit("answerCall", {
        callerId,
        accept,
        callId,
        userId: this.userId,
        timestamp: Date.now(),
      });

      if (!success && retryCount < maxRetries) {
        retryCount++;
        console.log(`Retrying call answer send (${retryCount}/${maxRetries})`);
        setTimeout(attemptSend, 1000);
      }

      return success;
    };

    return attemptSend();
  }

  /**
   * Register a handler for incoming video signals
   * @param {Function} callback - Signal handler
   * @returns {Function} - Unsubscribe function
   */
  onVideoSignal(callback) {
    return this.socketClient.on("videoSignal", callback);
  }

  /**
   * Register a handler for video hangup events
   * @param {Function} callback - Hangup handler
   * @returns {Function} - Unsubscribe function
   */
  onVideoHangup(callback) {
    return this.socketClient.on("videoHangup", callback);
  }

  /**
   * Register a handler for video media control events
   * @param {Function} callback - Media control handler
   * @returns {Function} - Unsubscribe function
   */
  onVideoMediaControl(callback) {
    return this.socketClient.on("videoMediaControl", callback);
  }

  /**
   * Register a handler for incoming calls
   * @param {Function} callback - Incoming call handler
   * @returns {Function} - Unsubscribe function
   */
  onIncomingCall(callback) {
    return this.socketClient.on("incomingCall", callback);
  }

  /**
   * Register a handler for call answers
   * @param {Function} callback - Call answer handler
   * @returns {Function} - Unsubscribe function
   */
  onCallAnswered(callback) {
    return this.socketClient.on("callAnswered", callback);
  }

  /**
   * Register a handler for call errors
   * @param {Function} callback - Call error handler
   * @returns {Function} - Unsubscribe function
   */
  onCallError(callback) {
    return this.socketClient.on("callError", callback);
  }
}

export default CallClient;
