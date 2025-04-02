import { io } from "socket.io-client"
import { toast } from "react-toastify"

/**
 * Socket.io client wrapper with enhanced connection management
 * Improved with better notification support and real-time reliability
 */
class SocketClient {
  constructor() {
    this.socket = null
    this.connected = false
    this.reconnecting = false
    this.userId = null
    this.pendingMessages = []
    this.eventHandlers = {}
    this.connectionAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 5000
    this.heartbeatInterval = null
    this.lastPong = null
    this.notificationSyncChannel = null
    this.connectionMonitorInterval = null
    this.notificationEventTypes = [
      "notification",
      "newMessage",
      "newLike",
      "photoPermissionRequestReceived",
      "photoPermissionResponseReceived",
      "newComment",
      "incomingCall",
      "newStory",
    ]
  }

  /**
   * Initialize socket connection
   * @param {string} userId - Current user ID
   * @param {string} token - Auth token
   * @param {Object} options - Additional options
   * @returns {Object} - Socket instance
   */
  init(userId, token, options = {}) {
    if (this.socket && this.connected) {
      console.log("Socket already connected")
      return this.socket
    }

    // Save user ID for reconnection
    this.userId = userId

    // IMPORTANT: Always connect to the backend server, not the frontend
    // Use relative path when in the same domain or origin
    const serverUrl = options.serverUrl || process.env.REACT_APP_SOCKET_URL || window.location.origin
    console.log(`Connecting to socket server at ${serverUrl}`)

    try {
      // Initialize socket with auth and reconnection options
      this.socket = io(serverUrl, {
        query: { token },
        auth: { token, userId },
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 30000,
        timeout: 20000,
        transports: ["websocket", "polling"],
        autoConnect: true,
      })

      // Set up core socket event handlers
      this._setupSocketHandlers()

      // Set up notification sync for cross-tab communication
      this.setupNotificationSyncChannel()

      // Start connection monitoring for notifications
      this.startConnectionMonitoring()

      return this.socket
    } catch (error) {
      console.error("Socket initialization error:", error)
      throw error
    }
  }

  /**
   * Check if the socket is connected
   * @returns {boolean} - Socket connection status
   */
  isConnected() {
    return this.socket && this.connected
  }

  /**
   * Set up core socket event handlers
   */
  _setupSocketHandlers() {
    if (!this.socket) return

    // Connection events
    this.socket.on("connect", () => {
      console.log("Socket connected successfully")
      this.connected = true
      this.connectionAttempts = 0
      this._startHeartbeat()
      this._processPendingMessages()

      // Notify listeners
      this._notifyEventHandlers("socketConnected", {
        userId: this.userId,
        socketId: this.socket.id,
      })

      // Dispatch global event for notification components
      window.dispatchEvent(
        new CustomEvent("socketConnected", {
          detail: { userId: this.userId, socketId: this.socket.id },
        }),
      )
    })

    // Connection error handling
    this.socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error)
      this.connected = false
      this.connectionAttempts++

      if (this.connectionAttempts >= this.maxReconnectAttempts) {
        this._notifyEventHandlers("socketConnectionFailed", {
          error: error.message,
          attempts: this.connectionAttempts,
        })

        // Show error toast only after multiple failed attempts
        if (this.connectionAttempts === this.maxReconnectAttempts) {
          toast.error("Failed to connect to the chat server. Please check your internet connection.")
        }
      }

      // Dispatch global event for notification components
      window.dispatchEvent(
        new CustomEvent("socketConnectionError", {
          detail: { error: error.message, attempts: this.connectionAttempts },
        }),
      )
    })

    // Disconnection events
    this.socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${reason}`)
      this.connected = false
      this._stopHeartbeat()

      // Notify listeners
      this._notifyEventHandlers("socketDisconnected", { reason })

      // Dispatch global event for notification components
      window.dispatchEvent(
        new CustomEvent("socketDisconnected", {
          detail: { reason },
        }),
      )

      // Auto reconnect if not intentional
      if (reason === "io server disconnect" || reason === "transport close") {
        this.enhancedReconnect()
      }
    })

    // Reconnection events
    this.socket.on("reconnect", (attemptNumber) => {
      console.log(`Socket reconnected after ${attemptNumber} attempts`)
      this.connected = true
      this.reconnecting = false

      // Notify listeners
      this._notifyEventHandlers("socketReconnected", {
        userId: this.userId,
        attempts: attemptNumber,
      })

      // Dispatch global event for notification components
      window.dispatchEvent(
        new CustomEvent("socketReconnected", {
          detail: { userId: this.userId, attempts: attemptNumber },
        }),
      )
    })

    this.socket.on("reconnect_attempt", (attemptNumber) => {
      console.log(`Socket reconnect attempt ${attemptNumber}`)
      this.reconnecting = true
    })

    this.socket.on("reconnect_error", (error) => {
      console.error("Socket reconnection error:", error)
    })

    this.socket.on("reconnect_failed", () => {
      console.error("Socket reconnection failed")
      this.reconnecting = false

      toast.error("Failed to reconnect to the chat server. Please reload the page.")

      // Notify listeners
      this._notifyEventHandlers("socketReconnectFailed", {
        userId: this.userId,
      })

      // Dispatch global event for notification components
      window.dispatchEvent(
        new CustomEvent("socketReconnectFailed", {
          detail: { userId: this.userId },
        }),
      )
    })

    // Server acknowledgment
    this.socket.on("welcome", (data) => {
      console.log("Socket welcome message received:", data)
    })

    // Heartbeat events
    this.socket.on("pong", () => {
      this.lastPong = Date.now()
    })

    // Error event
    this.socket.on("error", (error) => {
      console.error("Socket server error:", error)
      toast.error(`Server error: ${error.message || "Unknown error"}`)
    })

    // Authentication error
    this.socket.on("auth_error", (error) => {
      console.error("Socket authentication error:", error)
      toast.error("Authentication failed. Please log in again.")

      // Trigger authentication event to log out
      window.dispatchEvent(new CustomEvent("authLogout"))
    })

    // Register event forwarders for messaging events
    this._registerEnhancedEventForwarder("messageReceived")
    this._registerEnhancedEventForwarder("messageSent")
    this._registerEnhancedEventForwarder("messageError")
    this._registerEnhancedEventForwarder("userTyping")

    // Register event forwarders for call events
    this._registerEnhancedEventForwarder("videoSignal")
    this._registerEnhancedEventForwarder("videoHangup")
    this._registerEnhancedEventForwarder("videoError")
    this._registerEnhancedEventForwarder("videoMediaControl")
    this._registerEnhancedEventForwarder("incomingCall")
    this._registerEnhancedEventForwarder("callAnswered")
    this._registerEnhancedEventForwarder("callInitiated")
    this._registerEnhancedEventForwarder("callError")

    // User events
    this._registerEnhancedEventForwarder("userOnline")
    this._registerEnhancedEventForwarder("userOffline")

    // Notification events
    this._registerEnhancedEventForwarder("notification")
    this._registerEnhancedEventForwarder("newLike")
    this._registerEnhancedEventForwarder("photoPermissionRequestReceived")
    this._registerEnhancedEventForwarder("photoPermissionResponseReceived")
    this._registerEnhancedEventForwarder("newComment")
    this._registerEnhancedEventForwarder("newStory")
  }

  /**
   * Enhanced helper method to register an event forwarder with notification support
   * @param {string} eventName - Event name to forward
   */
  _registerEnhancedEventForwarder(eventName) {
    // Original event forwarding
    this.socket.on(eventName, (data) => {
      this._notifyEventHandlers(eventName, data)

      // Enhancement: Forward notification events to a global browser event
      if (this.notificationEventTypes.includes(eventName)) {
        // Dispatch to window for direct listeners
        window.dispatchEvent(new CustomEvent(eventName, { detail: data }))

        // Also dispatch a generic notification event for consistency
        window.dispatchEvent(new CustomEvent("notification", { detail: data }))

        // Sync with other tabs if enabled
        if (this.notificationSyncChannel) {
          try {
            this.notificationSyncChannel.postMessage({
              type: "NEW_NOTIFICATION",
              data: data,
            })
          } catch (err) {
            console.error("Error syncing notification to other tabs:", err)
          }
        }
      }
    })
  }

  /**
   * Set up broadcast channel for cross-tab notification sync
   */
  setupNotificationSyncChannel() {
    // Only run if the browser supports BroadcastChannel
    if (typeof BroadcastChannel === "undefined") {
      console.log("BroadcastChannel not supported, cross-tab sync disabled")
      return null
    }

    try {
      this.notificationSyncChannel = new BroadcastChannel("notification_sync")

      // Listen for messages from other tabs
      this.notificationSyncChannel.onmessage = (event) => {
        const { type, data } = event.data

        if (type === "NEW_NOTIFICATION") {
          console.log("Received new notification from another tab")
          window.dispatchEvent(new CustomEvent("newNotification", { detail: data }))
        } else if (type === "MARK_READ") {
          console.log("Received mark-read event from another tab")
          window.dispatchEvent(new CustomEvent("notificationRead", { detail: data }))
        } else if (type === "MARK_ALL_READ") {
          console.log("Received mark-all-read event from another tab")
          window.dispatchEvent(new CustomEvent("allNotificationsRead"))
        }
      }

      console.log("Notification sync channel initialized")
      return this.notificationSyncChannel
    } catch (error) {
      console.error("Error setting up notification sync channel:", error)
      this.notificationSyncChannel = null
      return null
    }
  }

  /**
   * Start heartbeat to monitor connection
   */
  _startHeartbeat() {
    this._stopHeartbeat()
    this.lastPong = Date.now()

    // Send ping every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.connected) {
        this.socket.emit("ping")

        // Check if we've received a pong in the last 60 seconds
        const now = Date.now()
        if (this.lastPong && now - this.lastPong > 60000) {
          console.warn("No heartbeat response in 60 seconds, reconnecting...")
          this.enhancedReconnect()
        }
      }
    }, 30000)
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
   * Start connection monitoring specifically for notifications
   */
  startConnectionMonitoring() {
    // Stop any existing monitoring
    this.stopConnectionMonitoring()

    // Check connection health every 45 seconds
    this.connectionMonitorInterval = setInterval(() => {
      this.checkSocketHealthForNotifications()
    }, 45000)

    console.log("Notification connection monitoring started")
  }

  /**
   * Stop connection monitoring
   */
  stopConnectionMonitoring() {
    if (this.connectionMonitorInterval) {
      clearInterval(this.connectionMonitorInterval)
      this.connectionMonitorInterval = null
    }
  }

  /**
   * Check socket health specifically for notifications
   * and force reconnection if needed
   * @returns {boolean} - Socket health status
   */
  checkSocketHealthForNotifications() {
    // Only run if socket should be connected
    if (!this.userId || !this.socket) return false

    const now = Date.now()
    const lastPong = this.lastPong || 0
    const timeSinceLastPong = now - lastPong

    // Check if it's been too long since last pong
    if (timeSinceLastPong > 60000) {
      // 1 minute
      console.warn("No socket response in the last minute, reconnecting for notifications...")
      this.enhancedReconnect()
      return false
    }

    // Check if socket is actually connected
    if (!this.connected) {
      console.warn("Socket appears disconnected, reconnecting for notifications...")
      this.enhancedReconnect()
      return false
    }

    return true
  }

  /**
   * Process any pending messages
   */
  _processPendingMessages() {
    if (!this.connected || this.pendingMessages.length === 0) return

    console.log(`Processing ${this.pendingMessages.length} pending messages`)

    // Process all pending messages
    const messages = [...this.pendingMessages]
    this.pendingMessages = []

    messages.forEach((msg) => {
      this.emit(msg.event, msg.data)
    })
  }

  /**
   * Register an event handler
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   * @returns {Function} - Unsubscribe function
   */
  on(event, callback) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = []
    }

    this.eventHandlers[event].push(callback)

    // Also register with socket if already connected
    if (this.socket) {
      this.socket.on(event, callback)
    }

    // Return unsubscribe function
    return () => this.off(event, callback)
  }

  /**
   * Remove an event handler
   * @param {string} event - Event name
   * @param {Function} callback - Event callback to remove
   */
  off(event, callback) {
    // Remove from socket
    if (this.socket) {
      this.socket.off(event, callback)
    }

    // Remove from local handlers
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event].filter((handler) => handler !== callback)

      if (this.eventHandlers[event].length === 0) {
        delete this.eventHandlers[event]
      }
    }
  }

  /**
   * Notify registered event handlers
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  _notifyEventHandlers(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach((handler) => {
        try {
          handler(data)
        } catch (error) {
          console.error(`Error in ${event} handler:`, error)
        }
      })
    }
  }

  /**
   * Emit an event to the server
   * @param {string} event - Event name
   * @param {any} data - Event data
   * @returns {boolean} - Success status
   */
  emit(event, data = {}) {
    if (!this.socket) {
      console.warn(`Socket not initialized, cannot emit '${event}'`)
      return false
    }

    if (!this.connected) {
      console.log(`Socket not connected, queueing '${event}'`)
      this.pendingMessages.push({ event, data })
      return true
    }

    try {
      this.socket.emit(event, data)
      return true
    } catch (error) {
      console.error(`Error emitting '${event}':`, error)
      return false
    }
  }

  /**
   * Enhanced reconnect method with better notification support
   */
  enhancedReconnect() {
    if (this.reconnecting) return

    console.log("Forcing socket reconnection with notification support...")
    this.reconnecting = true

    // Close existing connection
    if (this.socket) {
      try {
        this.socket.close()
      } catch (error) {
        console.error("Error closing socket:", error)
      }
    }

    // Stop heartbeat
    this._stopHeartbeat()

    // Reconnect if we have userId
    if (this.userId) {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token")
      if (token) {
        // Add a small random delay to prevent simultaneous reconnection attempts
        const reconnectDelay = 1000 + Math.random() * 2000
        setTimeout(() => {
          try {
            // Re-fetch a fresh token directly from storage in case it changed
            const freshToken = localStorage.getItem("token") || sessionStorage.getItem("token")
            if (freshToken !== token) {
              console.log("Token changed since reconnection attempt started, using fresh token")
            }
            
            // Always use the most recent token available
            this.init(this.userId, freshToken || token)
            
            // Dispatch reconnection success event specifically for notifications
            window.dispatchEvent(new CustomEvent("notificationSocketReconnected"))
            console.log("Socket reconnected with notification support")
          } catch (err) {
            console.error("Socket reconnection failed:", err)
            
            // If reconnection failed due to token issues, try one more time with a clean token
            if (err.message && err.message.includes("auth")) {
              console.log("Authentication error detected, trying emergency session reset")
              
              // Wait 2 seconds before trying the emergency recovery
              setTimeout(() => {
                try {
                  // Use the emergency fix function if available
                  if (typeof window.fixMyUserId === 'function') {
                    window.fixMyUserId();
                  } else {
                    // Fallback to manual reset if fix function not available
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.reload();
                  }
                } catch (emergencyErr) {
                  console.error("Emergency recovery failed:", emergencyErr);
                }
              }, 2000);
            }
          }
          this.reconnecting = false
        }, reconnectDelay)
      } else {
        console.error("Cannot reconnect: No authentication token found")
        this.reconnecting = false
      }
    } else {
      console.error("Cannot reconnect: No user ID")
      this.reconnecting = false
    }
  }

  /**
   * Standard reconnect method (kept for backward compatibility)
   */
  reconnect() {
    // Use the enhanced reconnect method
    this.enhancedReconnect()
  }

  /**
   * Disconnect the socket
   */
  disconnect() {
    console.log("Disconnecting socket")

    this._stopHeartbeat()
    this.stopConnectionMonitoring()

    // Close notification sync channel
    if (this.notificationSyncChannel) {
      try {
        this.notificationSyncChannel.close()
        this.notificationSyncChannel = null
      } catch (err) {
        console.error("Error closing notification sync channel:", err)
      }
    }

    if (this.socket) {
      try {
        this.socket.disconnect()
      } catch (error) {
        console.error("Error disconnecting socket:", error)
      }
      this.socket = null
    }

    this.connected = false
    this.reconnecting = false
  }
}

// Create singleton instance
const socketClient = new SocketClient()
export default socketClient
