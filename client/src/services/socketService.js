// Enhanced socketService.js with improved connection handling and error recovery
import io from "socket.io-client"
import { toast } from "react-toastify"

class SocketService {
  constructor() {
    this.socket = null
    this.userId = null
    this.token = null
    this.isConnecting = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 2000
    this.eventHandlers = {}
    this.pendingMessages = []
    this.connectionTimeout = null
    this.heartbeatInterval = null
    this.lastHeartbeat = null
    this.serverUrl = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000"
  }

  /**
   * Initialize socket connection
   * @param {string} userId - User ID
   * @param {string} token - Authentication token
   */
  init(userId, token) {
    if (this.isConnecting) return

    this.userId = userId
    this.token = token
    this.isConnecting = true

    // Clear any existing connection timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
    }

    // Set connection timeout
    this.connectionTimeout = setTimeout(() => {
      if (!this.socket || !this.socket.connected) {
        console.error("Socket connection timeout")
        this.isConnecting = false
        toast.error("Chat connection timed out. Please refresh the page.")
      }
    }, 10000)

    // Create socket connection with proper authentication
    try {
      console.log("Initializing socket with userId:", userId)

      // Make sure we're using the correct URL
      const serverUrl = process.env.REACT_APP_SOCKET_URL || window.location.origin
      console.log("Socket server URL:", serverUrl)

      this.socket = io(serverUrl, {
        query: { token }, // Pass token as a query parameter
        auth: { token, userId }, // Also include in auth object for redundancy
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        timeout: 10000,
        transports: ["websocket", "polling"],
      })

      // Setup event handlers
      this._setupEventHandlers()

      console.log("Socket connection initialized")
    } catch (error) {
      console.error("Socket initialization error:", error)
      this.isConnecting = false
      toast.error("Failed to connect to chat server. Please refresh the page.")
    }
  }

  /**
   * Setup socket event handlers
   */
  _setupEventHandlers() {
    if (!this.socket) return

    // Connection events
    this.socket.on("connect", () => {
      console.log("Socket connected")
      this.isConnecting = false
      this.reconnectAttempts = 0

      // Clear connection timeout
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout)
        this.connectionTimeout = null
      }

      // Start heartbeat
      this._startHeartbeat()

      // Process any pending messages
      this._processPendingMessages()

      // Notify user of connection
      toast.success("Chat connection established")
    })

    this.socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error)
      this.isConnecting = false

      // Clear connection timeout
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout)
        this.connectionTimeout = null
      }

      // Increment reconnect attempts
      this.reconnectAttempts++

      // Show error message if max attempts reached
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        toast.error("Failed to connect to chat server. Please refresh the page.")
      }
    })

    this.socket.on("disconnect", (reason) => {
      console.warn("Socket disconnected:", reason)

      // Stop heartbeat
      this._stopHeartbeat()

      // Show notification for unexpected disconnects
      if (reason !== "io client disconnect") {
        toast.warning("Chat connection lost. Attempting to reconnect...")
      }
    })

    this.socket.on("reconnect", (attemptNumber) => {
      console.log(`Socket reconnected after ${attemptNumber} attempts`)
      toast.success("Chat connection restored")
    })

    this.socket.on("reconnect_attempt", (attemptNumber) => {
      console.log(`Socket reconnect attempt ${attemptNumber}`)
    })

    this.socket.on("reconnect_error", (error) => {
      console.error("Socket reconnect error:", error)
    })

    this.socket.on("reconnect_failed", () => {
      console.error("Socket reconnect failed")
      toast.error("Failed to reconnect to chat server. Please refresh the page.")
    })

    // Server events
    this.socket.on("error", (error) => {
      console.error("Socket server error:", error)
      toast.error(`Chat server error: ${error.message || "Unknown error"}`)
    })

    this.socket.on("pong", () => {
      this.lastHeartbeat = Date.now()
    })
  }

  /**
   * Start heartbeat to keep connection alive
   */
  _startHeartbeat() {
    this._stopHeartbeat()

    this.lastHeartbeat = Date.now()
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.socket.emit("ping")

        // Check if we've received a pong recently
        const now = Date.now()
        if (this.lastHeartbeat && now - this.lastHeartbeat > 30000) {
          console.warn("No heartbeat received for 30 seconds, reconnecting...")
          this.reconnect()
        }
      }
    }, 15000)
  }

  /**
   * Stop heartbeat interval
   */
  _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * Process any pending messages
   */
  _processPendingMessages() {
    if (!this.socket || !this.socket.connected || this.pendingMessages.length === 0) return

    console.log(`Processing ${this.pendingMessages.length} pending messages`)

    // Process each pending message
    this.pendingMessages.forEach((message) => {
      this.socket.emit(message.event, message.data)
    })

    // Clear pending messages
    this.pendingMessages = []
  }

  /**
   * Check if socket is connected
   * @returns {boolean} - True if connected
   */
  isConnected() {
    return this.socket && this.socket.connected
  }

  /**
   * Reconnect to socket server
   */
  reconnect() {
    if (this.socket) {
      this.socket.disconnect()
    }

    this.init(this.userId, this.token)
  }

  /**
   * Register event handler
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   * @returns {Function} - Function to remove event handler
   */
  on(event, callback) {
    if (!this.socket) return null

    // Register handler
    this.socket.on(event, callback)

    // Store handler reference
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = []
    }
    this.eventHandlers[event].push(callback)

    // Return function to remove handler
    return callback
  }

  /**
   * Remove event handler
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  off(event, callback) {
    if (!this.socket || !callback) return

    // Remove handler
    this.socket.off(event, callback)

    // Remove from stored handlers
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event].filter((handler) => handler !== callback)
    }
  }

  /**
   * Send a message
   * @param {string} recipientId - Recipient ID
   * @param {string} type - Message type
   * @param {string} content - Message content
   * @returns {Promise<Object>} - Message object
   */
  async sendMessage(recipientId, type, content) {
    return new Promise((resolve, reject) => {
      // Check if socket is connected
      if (!this.socket || !this.socket.connected) {
        console.warn("Socket not connected, attempting to reconnect...")

        // Try to reconnect
        if (this.userId && this.token) {
          this.reconnect()

          // Queue message for later (optional)
          this.pendingMessages.push({
            event: "sendMessage",
            data: { recipientId, type, content },
          })

          // Fall back to API-based message sending
          console.log("Falling back to API-based message sending")

          // Return a placeholder message that the API can update later
          const tempMessage = {
            _id: `temp-${Date.now()}`,
            sender: this.userId,
            recipient: recipientId,
            type,
            content,
            createdAt: new Date().toISOString(),
            read: false,
            pending: true,
          }

          resolve(tempMessage)
          return
        }

        reject(new Error("Socket not connected"))
        return
      }

      // Validate parameters
      if (!recipientId || !type || !content) {
        reject(new Error("Invalid message parameters"))
        return
      }

      // Validate recipientId format
      if (!/^[0-9a-fA-F]{24}$/.test(recipientId)) {
        reject(new Error(`Invalid recipient ID format: ${recipientId}`))
        return
      }

      // Set timeout for response
      const timeout = setTimeout(() => {
        this.socket.off("messageSent", handleMessageSent)
        this.socket.off("messageError", handleMessageError)
        reject(new Error("Message send timeout"))
      }, 5000)

      // Handle message sent
      const handleMessageSent = (message) => {
        clearTimeout(timeout)
        this.socket.off("messageSent", handleMessageSent)
        this.socket.off("messageError", handleMessageError)
        resolve(message)
      }

      // Handle message error
      const handleMessageError = (error) => {
        clearTimeout(timeout)
        this.socket.off("messageSent", handleMessageSent)
        this.socket.off("messageError", handleMessageError)
        reject(new Error(error.message || "Failed to send message"))
      }

      // Register handlers
      this.socket.once("messageSent", handleMessageSent)
      this.socket.once("messageError", handleMessageError)

      // Send message
      this.socket.emit("sendMessage", { recipientId, type, content })
    })
  }

  /**
   * Send typing indicator
   * @param {string} recipientId - Recipient ID
   */
  sendTyping(recipientId) {
    if (!this.socket || !this.socket.connected) {
      return
    }

    // Validate recipientId format
    if (!recipientId || !/^[0-9a-fA-F]{24}$/.test(recipientId)) {
      console.error(`Invalid recipient ID format for typing: ${recipientId}`)
      return
    }

    this.socket.emit("typing", { recipientId })
  }

  /**
   * Initiate a video call
   * @param {string} recipientId - Recipient ID
   * @returns {Promise<Object>} - Call object
   */
  initiateVideoCall(recipientId) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error("Socket not connected"))
        return
      }

      // Validate recipientId format
      if (!recipientId || !/^[0-9a-fA-F]{24}$/.test(recipientId)) {
        reject(new Error(`Invalid recipient ID format: ${recipientId}`))
        return
      }

      // Set timeout for response
      const timeout = setTimeout(() => {
        this.socket.off("callInitiated", handleCallInitiated)
        this.socket.off("callError", handleCallError)
        reject(new Error("Call initiation timeout"))
      }, 10000)

      // Handle call initiated
      const handleCallInitiated = (callData) => {
        clearTimeout(timeout)
        this.socket.off("callInitiated", handleCallInitiated)
        this.socket.off("callError", handleCallError)
        resolve(callData)
      }

      // Handle call error
      const handleCallError = (error) => {
        clearTimeout(timeout)
        this.socket.off("callInitiated", handleCallInitiated)
        this.socket.off("callError", handleCallError)
        reject(new Error(error.message || "Failed to initiate call"))
      }

      // Register handlers
      this.socket.once("callInitiated", handleCallInitiated)
      this.socket.once("callError", handleCallError)

      // Initiate call
      this.socket.emit("initiateCall", { recipientId })
    })
  }

  /**
   * Answer a video call
   * @param {string} callerId - Caller ID
   * @param {boolean} accept - Whether to accept the call
   * @returns {Promise<Object>} - Call object
   */
  answerVideoCall(callerId, accept) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error("Socket not connected"))
        return
      }

      // Validate callerId format
      if (!callerId || !/^[0-9a-fA-F]{24}$/.test(callerId)) {
        reject(new Error(`Invalid caller ID format: ${callerId}`))
        return
      }

      // Set timeout for response
      const timeout = setTimeout(() => {
        this.socket.off("callAnswered", handleCallAnswered)
        this.socket.off("callError", handleCallError)
        reject(new Error("Call answer timeout"))
      }, 10000)

      // Handle call answered
      const handleCallAnswered = (callData) => {
        clearTimeout(timeout)
        this.socket.off("callAnswered", handleCallAnswered)
        this.socket.off("callError", handleCallError)
        resolve(callData)
      }

      // Handle call error
      const handleCallError = (error) => {
        clearTimeout(timeout)
        this.socket.off("callAnswered", handleCallAnswered)
        this.socket.off("callError", handleCallError)
        reject(new Error(error.message || "Failed to answer call"))
      }

      // Register handlers
      this.socket.once("callAnswered", handleCallAnswered)
      this.socket.once("callError", handleCallError)

      // Answer call
      this.socket.emit("answerCall", { callerId, accept })
    })
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }

    // Stop heartbeat
    this._stopHeartbeat()

    // Clear connection timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }

    // Clear event handlers
    this.eventHandlers = {}
  }
}

// Create singleton instance
const socketService = new SocketService()

export default socketService
