// client/src/services/socketService.jsx - Production version with fixes
import socketClient from "./socketClient.jsx"

class SocketService {
  constructor() {
    this.socket = socketClient
    this.initialized = false
    this.showConnectionToasts = true
    this.debugMode = process.env.NODE_ENV !== "production"
    this.eventListeners = new Map() // Keep track of all event listeners
    this.pendingMessages = []
    this.userId = null
    this.connectionState = 'disconnected'
  }

  /**
   * Initialize socket connection with a given userId and token.
   * @param {string} userId - User ID.
   * @param {string} token - Authentication token.
   * @param {Object} options - Additional options.
   * @returns {Object} - The socket object.
   */
  init(userId, token, options = {}) {
    if (this.initialized && this.socket.isConnected() && this.userId === userId) {
      this._log("Socket service already initialized and connected")
      return this.socket
    }

    this._log(`Initializing socket service for user: ${userId}`)
    this.userId = userId

    this.socket.init(userId, token, options)
    this.initialized = true
    this.connectionState = 'connecting'

    // Add connection state listeners
    this.socket.on("connect", () => {
      this._log("Socket connection established")
      this.connectionState = 'connected'
      this._processPendingMessages()

      // Dispatch reconnect event for other components
      window.dispatchEvent(new CustomEvent("socketReconnected"))
    })

    this.socket.on("disconnect", (reason) => {
      this._log(`Socket disconnected: ${reason}`)
      this.connectionState = 'disconnected'
    })

    this.socket.on("connect_error", (error) => {
      this._log(`Socket connection error: ${error}`)
      this.connectionState = 'error'
    })

    return this.socket
  }

  /**
   * Check if socket is connected and valid
   * @returns {boolean} Whether socket is connected and ready to use
   */
  isConnected() {
    return this.socket && this.socket.isConnected()
  }

  /**
   * Force reconnection: disconnect and reinitialize
   */
  reconnect() {
    this._log("Forcing socket reconnection")
    this.connectionState = 'reconnecting'
    return this.socket.reconnect()
  }

  /**
   * Disconnect the socket and clean up all listeners and intervals
   */
  disconnect() {
    this._log("Disconnecting socket")
    this.initialized = false
    this.connectionState = 'disconnected'

    // Keep track of listeners to restore on reconnection
    this.savedListeners = Array.from(this.eventListeners.entries())

    return this.socket.disconnect()
  }

  /**
   * Register an event listener with better tracking
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} - Unsubscribe function
   */
  on(event, callback) {
    this._log(`Registering listener for event: ${event}`)

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
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    this._log(`Removing listener for event: ${event}`)
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
   * Emit an event to the server with better error handling
   * @param {string} event - Event name
   * @param {object} data - Event data
   * @returns {boolean} - True if emitted or queued
   */
  emit(event, data = {}) {
    if (!this.socket) {
      this._log(`Socket not initialized, cannot emit '${event}'`)
      return false
    }

    if (!this.isConnected()) {
      this._log(`Socket not connected, queueing '${event}'`)
      this.pendingMessages.push({ event, data })
      return true
    }

    try {
      this._log(`Emitting event: ${event} with data:`, data)
      this.socket.emit(event, data)
      return true
    } catch (error) {
      this._log(`Error emitting '${event}':`, error)
      return false
    }
  }
  /**
   * Send a message to a user with improved error handling
   * @param {string} recipientId - Recipient user ID
   * @param {string} type - Message type ('text', 'wink', etc.)
   * @param {string} content - Message content
   * @param {object} metadata - Additional metadata
   * @returns {Promise<object>} - Resolves with the message data
   */
  async sendMessage(recipientId, type = "text", content, metadata = {}) {
    this._log(`Attempting to send ${type} message to ${recipientId}`)

    return new Promise((resolve, reject) => {
      const tempMessageId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      const timeoutRef = { current: null }
      let handlersCleaned = false

      // If not connected, queue the message and return a temporary message object
      if (!this.isConnected()) {
        this._log(`Socket not connected, returning pending message with id ${tempMessageId}`)
        const tempMessage = {
          _id: tempMessageId,
          sender: this.userId,
          recipient: recipientId,
          type,
          content,
          metadata,
          createdAt: new Date().toISOString(),
          read: false,
          pending: true,
          status: "pending",
          tempMessageId,
        }

        return resolve(tempMessage)
      }

      // Debug log to track message sending
      this._log(`Preparing socket message: ${recipientId}, type: ${type}, tempId: ${tempMessageId}`)

      // Clean up handlers and timeouts
      const cleanupHandlers = () => {
        if (handlersCleaned) return
        handlersCleaned = true

        this.socket.off("messageSent", handleMessageSent)
        this.socket.off("messageError", handleMessageError)

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }

      // Set up one-time event handlers for response
      const handleMessageSent = (data) => {
        if (data.tempMessageId === tempMessageId) {
          this._log(`Message confirmed sent: ${tempMessageId}`)
          cleanupHandlers()
          resolve(data)
        }
      }

      const handleMessageError = (error) => {
        if (error.tempMessageId === tempMessageId) {
          this._log(`Message error for ${tempMessageId}: ${error.error || "Unknown error"}`)
          cleanupHandlers()
          reject(new Error(error.error || "Failed to send message"))
        }
      }

      // Register event handlers
      this.socket.on("messageSent", handleMessageSent)
      this.socket.on("messageError", handleMessageError)

      // Emit the message
      this._log(`Emitting sendMessage with tempId: ${tempMessageId}`)
      const emissionSuccess = this.socket.emit("sendMessage", {
        recipientId,
        type,
        content,
        metadata,
        tempMessageId,
      })

      if (!emissionSuccess) {
        this._log(`Message emission failed immediately for ${tempMessageId}`)
        cleanupHandlers()

        // Return a pending message so UI can show something
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
          pending: true,
          tempMessageId,
        })
        return
      }

      // Set a timeout for response to prevent hanging promises
      timeoutRef.current = setTimeout(() => {
        if (handlersCleaned) return

        this._log(`Message timeout reached for ${tempMessageId}`)
        cleanupHandlers()

        // If timed out, return a temporary message with pending status
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
          pending: true,
          tempMessageId,
        })
      }, 10000) // 10 second timeout
    })
  }
  /**
   * Send typing indicator
   * @param {string} recipientId - Recipient user ID
   */
  sendTyping(recipientId) {
    // Don't log or handle errors for typing indicators - these are low priority
    if (this.isConnected()) {
      this.socket.emit("typing", { recipientId })
    }
  }

  /**
   * Process any pending messages after connection is established
   * @private
   */
  _processPendingMessages() {
    if (this.pendingMessages.length === 0) return

    this._log(`Processing ${this.pendingMessages.length} pending messages`)

    const messages = [...this.pendingMessages]
    this.pendingMessages = []

    messages.forEach(msg => {
      this.emit(msg.event, msg.data)
    })
  }

  /**
   * Initiate a video call with a user
   * @param {string} recipientId - Recipient user ID
   * @returns {Promise<object>} - Resolves with call data
   */
  initiateVideoCall(recipientId) {
    this._log(`Initiating video call to ${recipientId}`)

    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        this._log(`Socket not connected, cannot initiate call`)
        return reject(new Error("Socket not connected"))
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
      }

      const handleCallInitiated = (response) => {
        this._log(`Call initiated successfully: ${response.callId || 'unknown'}`)
        this.socket.off("callInitiated", handleCallInitiated)
        this.socket.off("callError", handleCallError)
        resolve(response)
      }

      const handleCallError = (error) => {
        this._log(`Call initiation error: ${error.message || 'unknown'}`)
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
        this._log(`Call initiation timeout reached`)
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
  answerVideoCall(callerId, accept, callId) {
    this._log(`Answering call from ${callerId} with accept=${accept}`)

    if (!this.isConnected()) {
      this._log(`Cannot answer call: Socket not connected`)
      return false
    }

    // Send response with retry logic for reliability
    let attempts = 0
    const maxAttempts = 3

    const attemptAnswer = () => {
      attempts++
      const success = this.socket.emit("answerCall", {
        callerId,
        accept,
        callId,
        userId: this.userId,
        timestamp: Date.now(),
      })

      if (!success && attempts < maxAttempts) {
        this._log(`Retrying call answer (attempt ${attempts})`)
        setTimeout(attemptAnswer, 1000)
      }

      return success
    }

    return attemptAnswer()
  }

  /**
   * Get connection status and details
   * @returns {object} - Connection status object
   */
  getStatus() {
    return {
      connected: this.isConnected(),
      initialized: this.initialized,
      userId: this.userId,
      state: this.connectionState
    }
  }

  /**
   * Enable or disable connection toast notifications
   * @param {boolean} enable - True to enable toasts
   */
  setShowConnectionToasts(enable) {
    this.showConnectionToasts = enable
  }

  /**
   * Enable or disable debug mode
   * @param {boolean} enable - True to enable debug logging
   */
  setDebugMode(enable) {
    this.debugMode = enable
  }

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
