// client/src/services/socketService.jsx - Production version with improvements
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
    this.connectionState = "disconnected"
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectInterval = 3000 // 3 seconds
    this.connectionMonitor = null
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

    // Clear any existing connection monitor
    this._clearConnectionMonitor()

    this._log(`Initializing socket service for user: ${userId}`)
    this.userId = userId
    this.reconnectAttempts = 0

    try {
      // Pass environment-specific server URL based on environment
      const isDev = process.env.NODE_ENV === 'development'
      options.serverUrl = isDev ? 'http://localhost:5000' : 'https://flirtss.com'

      this.socket.init(userId, token, options)
      this.initialized = true
      this.connectionState = "connecting"

      // Add connection state listeners
      this.socket.on("connect", () => {
        this._log("Socket connection established")
        this.connectionState = "connected"
        this.reconnectAttempts = 0
        this._processPendingMessages()

        // Dispatch reconnect event for other components
        window.dispatchEvent(new CustomEvent("socketReconnected"))
      })

      this.socket.on("disconnect", (reason) => {
        this._log(`Socket disconnected: ${reason}`)
        this.connectionState = "disconnected"

        // Start monitoring connection if not already monitoring
        this._startConnectionMonitor()
      })

      this.socket.on("connect_error", (error) => {
        this._log(`Socket connection error: ${error}`)
        this.connectionState = "error"

        // Start monitoring connection if not already monitoring
        this._startConnectionMonitor()
      })

      // Start connection monitoring
      this._startConnectionMonitor()

      return this.socket
    } catch (err) {
      this._log(`Socket initialization error: ${err.message}`, "error")
      this.connectionState = "error"
      throw err
    }
  }

  /**
   * Start connection monitoring to handle reconnections
   * @private
   */
  _startConnectionMonitor() {
    if (this.connectionMonitor) return

    this._log("Starting socket connection monitor")

    this.connectionMonitor = setInterval(() => {
      // Only attempt reconnect if:
      // 1. Socket is initialized
      // 2. Not currently connected
      // 3. Not in cooldown mode (reconnectAttempts >= maxReconnectAttempts)
      // 4. Not currently reconnecting
      // Check if socket is in fallback mode
      const isFallbackMode = this.socket && this.socket.socket && 
                            this.socket.socket.io && 
                            this.socket.socket.io.engine && 
                            this.socket.socket.io.engine.transport && 
                            this.socket.socket.io.engine.transport.name === 'none';
      
      if (
        this.initialized &&
        this.connectionState !== "connected" &&
        this.reconnectAttempts < this.maxReconnectAttempts &&
        this.connectionState !== "reconnecting" &&
        !isFallbackMode
      ) {
        this._log(`Connection monitor: Socket is ${this.connectionState}, attempting reconnect`)
        this.reconnect()
      }
    }, 15000) // Check every 15 seconds (increased from 10 to reduce frequency)
  }

  /**
   * Clear connection monitoring interval
   * @private
   */
  _clearConnectionMonitor() {
    if (this.connectionMonitor) {
      clearInterval(this.connectionMonitor)
      this.connectionMonitor = null
      this._log("Cleared socket connection monitor")
    }
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
    // If socket is already connected, no need to reconnect
    if (this.connectionState === "connected") {
      this._log("Socket already connected, no need to reconnect")
      this.reconnectAttempts = 0
      return true
    }

    // Check if socket is in fallback mode
    const isFallbackMode = this.socket && this.socket.socket && 
                          this.socket.socket.io && 
                          this.socket.socket.io.engine && 
                          this.socket.socket.io.engine.transport && 
                          this.socket.socket.io.engine.transport.name === 'none';
                          
    if (isFallbackMode) {
      this._log("Socket in fallback mode, skipping reconnection attempt", "warn")
      return false;
    }

    // Prevent excessive reconnection attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this._log(
        `Maximum reconnect attempts (${this.maxReconnectAttempts}) reached, stopping reconnection attempts`,
        "warn",
      )

      // After a 30 second cooldown, reset the counter to allow future reconnect attempts
      setTimeout(() => {
        this._log("Reconnect cooldown completed, resetting counter")
        this.reconnectAttempts = 0
      }, 30000)

      return false
    }

    this.reconnectAttempts++
    this._log(`Forcing socket reconnection (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    this.connectionState = "reconnecting"

    try {
      // Only attempt reconnect if socket exists
      if (this.socket && typeof this.socket.reconnect === "function") {
        return this.socket.reconnect()
      } else {
        this._log("Socket not initialized, cannot reconnect", "warn")
        return false
      }
    } catch (err) {
      this._log(`Reconnection error: ${err.message}`, "error")
      return false
    }
  }

  /**
   * Disconnect the socket and clean up all listeners and intervals
   */
  disconnect() {
    this._log("Disconnecting socket")
    this._clearConnectionMonitor()
    this.initialized = false
    this.connectionState = "disconnected"
    this.pendingMessages = []

    // Keep track of listeners to restore on reconnection
    this.savedListeners = Array.from(this.eventListeners.entries())
    this.eventListeners.clear()

    return this.socket.disconnect()
  }

  /**
   * Register an event listener with better tracking
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} - Unsubscribe function
   */
  on(event, callback) {
    if (!callback || typeof callback !== "function") {
      this._log(`Invalid callback for event: ${event}`, "error")
      return () => {}
    }

    this._log(`Registering listener for event: ${event}`)

    // Keep track of this listener for potential reconnection scenarios
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event).add(callback)

    let unsubscribe
    try {
      unsubscribe = this.socket.on(event, callback)
    } catch (err) {
      this._log(`Error registering event listener for ${event}: ${err.message}`, "error")
      unsubscribe = () => {}
    }

    // Return enhanced unsubscribe function that also removes from our tracking
    return () => {
      if (this.eventListeners.has(event)) {
        this.eventListeners.get(event).delete(callback)
        if (this.eventListeners.get(event).size === 0) {
          this.eventListeners.delete(event)
        }
      }
      try {
        unsubscribe()
      } catch (err) {
        this._log(`Error unsubscribing from event ${event}: ${err.message}`, "error")
      }
    }
  }

  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    this._log(`Removing listener for event: ${event}`)

    try {
      this.socket.off(event, callback)
    } catch (err) {
      this._log(`Error removing event listener for ${event}: ${err.message}`, "error")
    }

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
      this._log(`Socket not initialized, cannot emit '${event}'`, "warn")
      return false
    }

    if (!this.isConnected()) {
      this._log(`Socket not connected, queueing '${event}'`, "warn")
      // Add timestamp to pending messages for potential TTL implementation
      this.pendingMessages.push({
        event,
        data,
        timestamp: Date.now(),
      })
      return true
    }

    try {
      this._log(`Emitting event: ${event}`)
      this.socket.emit(event, data)
      return true
    } catch (error) {
      this._log(`Error emitting '${event}': ${error.message}`, "error")

      // Add to pending messages if it's an important event
      const importantEvents = ["sendMessage", "messageRead", "answerCall"]
      if (importantEvents.includes(event)) {
        this._log(`Adding failed '${event}' to pending queue for retry`, "warn")
        this.pendingMessages.push({
          event,
          data,
          timestamp: Date.now(),
        })
      }

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
          id: tempMessageId,
          sender: this.userId,
          recipient: recipientId,
          type,
          content,
          metadata: {
            ...metadata,
            clientMessageId: tempMessageId,
          },
          createdAt: new Date().toISOString(),
          read: false,
          pending: true,
          status: "pending",
          tempMessageId,
        }

        // Queue the message for when connection is restored
        this.pendingMessages.push({
          event: "sendMessage",
          data: {
            recipientId,
            type,
            content,
            metadata: {
              ...metadata,
              clientMessageId: tempMessageId,
            },
            tempMessageId,
          },
          timestamp: Date.now(),
        })

        return resolve(tempMessage)
      }

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
        if (data && data.tempMessageId === tempMessageId) {
          this._log(`Message confirmed sent: ${tempMessageId}`)
          cleanupHandlers()
          resolve(data)
        }
      }

      const handleMessageError = (error) => {
        if (error && error.tempMessageId === tempMessageId) {
          this._log(`Message error for ${tempMessageId}: ${error.error || "Unknown error"}`, "error")
          cleanupHandlers()
          reject(new Error(error.error || "Failed to send message"))
        }
      }

      // Register event handlers
      this.socket.on("messageSent", handleMessageSent)
      this.socket.on("messageError", handleMessageError)

      // Enhance metadata
      const enhancedMetadata = {
        ...metadata,
        clientMessageId: tempMessageId,
      }

      // Emit the message
      this._log(`Emitting sendMessage with tempId: ${tempMessageId}`)
      const emissionSuccess = this.socket.emit("sendMessage", {
        recipientId,
        type,
        content,
        metadata: enhancedMetadata,
        tempMessageId,
      })

      if (!emissionSuccess) {
        this._log(`Message emission failed immediately for ${tempMessageId}`, "error")
        cleanupHandlers()

        // Return a pending message so UI can show something
        resolve({
          id: tempMessageId,
          sender: this.userId,
          recipient: recipientId,
          content,
          type,
          metadata: enhancedMetadata,
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

        this._log(`Message timeout reached for ${tempMessageId}`, "warn")
        cleanupHandlers()

        // If timed out, return a temporary message with pending status
        resolve({
          id: tempMessageId,
          sender: this.userId,
          recipient: recipientId,
          content,
          type,
          metadata: enhancedMetadata,
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

    // Clone the array to avoid mutation issues during processing
    const messages = [...this.pendingMessages]
    this.pendingMessages = []

    // Process queued messages with a slight delay between them
    messages.forEach((msg, index) => {
      // Apply a short staggered delay to avoid overwhelming the server
      setTimeout(() => {
        // Check if the message is too old (5 minutes)
        const isTooOld = Date.now() - msg.timestamp > 300000

        if (isTooOld) {
          this._log(`Skipping stale pending message of type ${msg.event}`, "warn")
          return
        }

        this._log(`Processing queued message: ${msg.event}`)
        this.emit(msg.event, msg.data)
      }, index * 100) // 100ms between messages
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
        this._log(`Socket not connected, cannot initiate call`, "error")
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
        this._log(`Call initiated successfully: ${response.callId || "unknown"}`)
        this.socket.off("callInitiated", handleCallInitiated)
        this.socket.off("callError", handleCallError)
        resolve(response)
      }

      const handleCallError = (error) => {
        this._log(`Call initiation error: ${error.message || "unknown"}`, "error")
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
        this._log(`Call initiation timeout reached`, "warn")
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
      this._log(`Cannot answer call: Socket not connected`, "error")
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
        this._log(`Retrying call answer (attempt ${attempts})`, "warn")
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
      state: this.connectionState,
      reconnectAttempts: this.reconnectAttempts,
      pendingMessages: this.pendingMessages.length,
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
   * Update privacy settings for socket-related features
   * @param {Object} privacySettings - User privacy settings
   */
  updatePrivacySettings(privacySettings) {
    if (!privacySettings) return

    // Store privacy settings reference
    this.privacySettings = privacySettings

    // Apply relevant settings
    if (privacySettings.showOnlineStatus !== undefined) {
      this._log(`Updating online status visibility: ${privacySettings.showOnlineStatus}`)
      // Emit status update to server if needed
      if (this.isConnected()) {
        this.socket.emit("updatePrivacySettings", {
          showOnlineStatus: privacySettings.showOnlineStatus,
        })
      }
    }

    this._log(`Privacy settings updated: ${JSON.stringify(privacySettings)}`)
  }

  /**
   * Enable or disable debug mode
   * @param {boolean} enable - True to enable debug logging
   */
  setDebugMode(enable) {
    this.debugMode = enable
  }

  /**
   * Log messages with severity levels
   * @private
   * @param {string} message - Message to log
   * @param {string} level - Log level ('log', 'warn', 'error')
   */
  _log(message, level = "log") {
    if (!this.debugMode && level === "log") return

    const prefix = `[SocketService]`
    const timestamp = new Date().toISOString().substring(11, 19) // HH:MM:SS

    switch (level) {
      case "warn":
        console.warn(`${prefix} [${timestamp}]`, message)
        break
      case "error":
        console.error(`${prefix} [${timestamp}]`, message)
        // Could also send to an error reporting service here
        break
      default:
        console.log(`${prefix} [${timestamp}]`, message)
    }
  }
}

// Create a singleton instance
const socketService = new SocketService()
export default socketService
