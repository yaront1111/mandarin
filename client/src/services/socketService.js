// client/src/services/socketService.js
import io from "socket.io-client"
import { toast } from "react-toastify"

class SocketService {
  constructor() {
    this.socket = null
    this.userId = null
    this.connectionState = "disconnected" // 'connecting', 'connected', 'disconnected'
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.connectionTimeout = null
    this.reconnectTimer = null
    this.wasDisconnected = false
    this.handlers = {
      newMessage: [],
      userOnline: [],
      userOffline: [],
      userTyping: [],
      incomingCall: [],
      callAnswered: [],
      error: [],
    }
  }

  /**
   * Initialize the socket connection with improved error handling and manual reconnection logic.
   * If a connection is already active or in progress, it reuses it.
   * @param {string} userId - Current user ID.
   * @param {string} token - Authentication token.
   * @returns {SocketService} - This instance.
   */
  init(userId, token) {
    // If we already have a socket connection for this user, don't create a new one
    if (this.socket && this.userId === userId) {
      if (this.socket.connected) {
        console.log("Socket already connected, reusing connection")
        return this
      } else if (this.connectionState === "connecting") {
        console.log("Socket already connecting, waiting for connection")
        return this
      }
    }

    // If we have an existing socket for a different user or in a disconnected state, clean it up
    if (this.socket) {
      this.disconnect()
    }

    this.userId = userId
    this.connectionState = "connecting"

    const socketUrl = process.env.REACT_APP_SOCKET_URL || window.location.origin

    // Clear any existing timers
    if (this.connectionTimeout) clearTimeout(this.connectionTimeout)
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)

    // Set a connection timeout: if not connected within 10 seconds, handle failure
    this.connectionTimeout = setTimeout(() => {
      if (this.connectionState !== "connected") {
        console.error("Socket connection timeout")
        this.connectionState = "disconnected"
        this._handleConnectionFailure()
      }
    }, 10000)

    // Create a new socket instance with manual reconnection (disable auto reconnection)
    this.socket = io(socketUrl, {
      autoConnect: true,
      reconnection: false,
      timeout: 20000,
      query: { token },
    })

    // Successful connection
    this.socket.on("connect", () => {
      console.log("Socket connected with ID:", this.socket.id)
      this.connectionState = "connected"
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout)
        this.connectionTimeout = null
      }
      this.reconnectAttempts = 0
      this.socket.emit("join", { userId: this.userId })
      if (this.wasDisconnected) {
        toast.success("Real-time connection restored")
        this.wasDisconnected = false
      }
    })

    // Connection error handling with token validation
    this.socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error)
      if (error && error.message === "Authentication error") {
        toast.error("Authentication failed. Please log in again.")
        this.disconnect()

        // Check if token is expired
        const token = sessionStorage.getItem("token")
        if (token) {
          try {
            const base64Url = token.split(".")[1]
            const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
            const payload = JSON.parse(window.atob(base64))
            const now = Math.floor(Date.now() / 1000)

            if (payload.exp < now) {
              // Token is expired, try to refresh it
              const authService = window.apiService || null
              if (authService && typeof authService.refreshToken === "function") {
                authService
                  .refreshToken()
                  .then((newToken) => {
                    if (newToken) {
                      // Retry connection with new token
                      setTimeout(() => this.init(userId, newToken), 1000)
                    } else {
                      // Redirect to log in if refresh failed
                      setTimeout(() => {
                        window.location.href = "/login"
                      }, 1500)
                    }
                  })
                  .catch(() => {
                    setTimeout(() => {
                      window.location.href = "/login"
                    }, 1500)
                  })
                return
              }
            }
          } catch (e) {
            console.error("Error parsing token:", e)
          }
        }

        setTimeout(() => {
          window.location.href = "/login"
        }, 1500)
      } else {
        this._handleConnectionFailure()
      }
    })

    // Handle disconnections with better error recovery
    this.socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason)
      this.connectionState = "disconnected"
      this.wasDisconnected = true

      // If the server forcibly disconnects, try reconnecting after a short delay
      if (reason === "io server disconnect") {
        setTimeout(() => {
          this._handleConnectionFailure()
        }, 1000)
      } else {
        this._handleConnectionFailure()
      }
      toast.warn("Real-time connection lost. Attempting to reconnect...")
    })

    // Add handler for token expiration events from server
    this.socket.on("tokenExpired", () => {
      console.log("Token expired notification from server")
      const authService = window.apiService || null
      if (authService && typeof authService.refreshToken === "function") {
        authService
          .refreshToken()
          .then((newToken) => {
            if (newToken) {
              this.reconnect(newToken)
            }
          })
          .catch((err) => {
            console.error("Failed to refresh token after expiry notification:", err)
            toast.error("Your session has expired. Please log in again.")
            setTimeout(() => {
              window.location.href = "/login"
            }, 1500)
          })
      }
    })

    // Standard event listeners
    this.socket.on("newMessage", (message) => {
      this.handlers.newMessage.forEach((handler) => handler(message))
    })
    this.socket.on("userOnline", (data) => {
      this.handlers.userOnline.forEach((handler) => handler(data))
    })
    this.socket.on("userOffline", (data) => {
      this.handlers.userOffline.forEach((handler) => handler(data))
    })
    this.socket.on("userTyping", (data) => {
      this.handlers.userTyping.forEach((handler) => handler(data))
    })
    this.socket.on("incomingCall", (data) => {
      this.handlers.incomingCall.forEach((handler) => handler(data))
    })
    this.socket.on("callAnswered", (data) => {
      this.handlers.callAnswered.forEach((handler) => handler(data))
    })
    this.socket.on("error", (error) => {
      console.error("Socket error:", error)
      this.handlers.error.forEach((handler) => handler(error))
    })

    return this
  }

  /**
   * Private method to handle connection failures using exponential backoff.
   * It schedules a reconnection attempt if the maximum attempts haven't been reached.
   */
  _handleConnectionFailure() {
    // Prevent multiple concurrent reconnection timers.
    if (this.reconnectTimer) return
    toast.error("Could not establish real-time connection. Retrying...")

    const backoffTime = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts))
    this.reconnectAttempts++
    console.log(`Reconnect attempt ${this.reconnectAttempts} scheduled in ${backoffTime / 1000}s`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        if (this.userId) {
          const token = sessionStorage.getItem("token")
          if (token) {
            this.init(this.userId, token)
          } else {
            console.error("No token available for reconnection")
            toast.error("Authentication expired. Please refresh the page.")
          }
        }
      } else {
        toast.error("Could not reconnect. Please refresh the page.")
      }
    }, backoffTime)
  }

  /**
   * Check if the socket is currently connected.
   * @returns {boolean} True if connected.
   */
  isConnected() {
    return this.socket && this.socket.connected
  }

  /**
   * Register an event handler.
   * @param {string} event - Event name.
   * @param {Function} handler - Handler function.
   * @returns {Function} Unsubscribe function.
   */
  on(event, handler) {
    if (!this.handlers[event]) {
      this.handlers[event] = []
    }
    this.handlers[event].push(handler)
    return () => {
      this.handlers[event] = this.handlers[event].filter((h) => h !== handler)
    }
  }

  /**
   * Remove an event handler.
   * @param {string} event - Event name.
   * @param {Function} handler - Handler function.
   */
  off(event, handler) {
    if (!this.handlers[event]) return
    if (handler) {
      this.handlers[event] = this.handlers[event].filter((h) => h !== handler)
    } else {
      this.handlers[event] = []
    }
  }

  /**
   * Send a private message.
   * @param {string} recipient - Recipient user ID.
   * @param {string} type - Message type (e.g., 'text', 'video').
   * @param {string} content - Message content.
   * @returns {Promise} Resolves when the message is acknowledged.
   */
  sendMessage(recipient, type, content) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        toast.warning("Connection lost. Attempting to reconnect...")
        this._handleConnectionFailure()
        reject(new Error("Socket not connected"))
        return
      }
      const message = { sender: this.userId, recipient, type, content }
      this.socket.emit("privateMessage", message, (response) => {
        if (response && response.error) {
          reject(new Error(response.error))
        } else {
          resolve(response)
        }
      })
    })
  }

  /**
   * Send a typing indicator to a recipient.
   * @param {string} recipient - Recipient user ID.
   */
  sendTyping(recipient) {
    if (!this.isConnected()) {
      this._handleConnectionFailure()
      return
    }
    this.socket.emit("typing", { sender: this.userId, recipient })
  }

  /**
   * Initiate a video call.
   * @param {string} recipient - Recipient user ID.
   * @returns {Promise} Resolves when the call is initiated.
   */
  initiateVideoCall(recipient) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        toast.warning("Connection lost. Please refresh the page.")
        reject(new Error("Socket not connected"))
        return
      }
      this.socket.emit("videoCallRequest", { caller: this.userId, recipient }, (response) => {
        if (response && response.error) {
          reject(new Error(response.error))
        } else {
          resolve(response)
        }
      })
    })
  }

  /**
   * Answer a video call.
   * @param {string} caller - Caller user ID.
   * @param {boolean} answer - Accept or decline the call.
   * @returns {Promise} Resolves when the answer is sent.
   */
  answerVideoCall(caller, answer) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        toast.warning("Connection lost. Please refresh the page.")
        reject(new Error("Socket not connected"))
        return
      }
      this.socket.emit("videoCallAnswer", { caller, recipient: this.userId, answer }, (response) => {
        if (response && response.error) {
          reject(new Error(response.error))
        } else {
          resolve(response)
        }
      })
    })
  }

  /**
   * Manually reconnect the socket with a new token.
   * @param {string} token - Authentication token.
   * @returns {boolean} True if reconnection was attempted.
   */
  // Improved reconnection with token refresh
  reconnect(token) {
    if (!this.userId) {
      console.error("Cannot reconnect: no user ID")
      return false
    }

    // Disconnect existing socket if any
    if (this.socket) {
      this.socket.disconnect()
    }

    // Start fresh connection with new token
    this.init(this.userId, token)
    return true
  }

  /**
   * Disconnect the socket and clean up timers and handlers.
   */
  disconnect() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.userId = null
    this.connectionState = "disconnected"
    Object.keys(this.handlers).forEach((event) => {
      this.handlers[event] = []
    })
  }
}

const socketService = new SocketService()
export default socketService
