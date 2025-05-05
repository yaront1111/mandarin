import { io } from "socket.io-client"
import { toast } from "react-toastify"
import logger from "../utils/logger.js"
import apiService from "./apiService.jsx"
import { getToken, setToken } from "../utils/tokenStorage"
import { SOCKET } from "../config.js"

// Create a named logger for this service
const log = logger.create("SocketClient")

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
    this.maxReconnectAttempts = SOCKET.RECONNECT.MAX_ATTEMPTS
    this.reconnectDelay = SOCKET.RECONNECT.DELAY
    this.heartbeatInterval = null
    this.lastPong = null
    this.notificationSyncChannel = null
    this.connectionMonitorInterval = null
    this.notificationEventTypes = SOCKET.NOTIFICATION.SYNC_EVENT_TYPES
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
      log.info("Socket already connected")
      return this.socket
    }

    // Save user ID for reconnection
    this.userId = userId
    
    // Determine correct server URL based on environment
    const isDev = process.env.NODE_ENV === 'development'
    
    // Use the current page's origin as the socket server URL in production
    // This ensures the connection uses the same domain as the page
    let serverUrl;
    if (isDev) {
      serverUrl = SOCKET.URLS.DEV;
    } else {
      // Use window.location.origin to get the current domain
      // This avoids hardcoding domains and works with any custom domain
      serverUrl = window.location.origin;
      log.info(`Using current origin for socket connection: ${serverUrl}`);
    }
    
    log.info(`Connecting to socket server at ${serverUrl}`)

    try {
      // Initialize socket with improved auth and reconnection options
      this.socket = io(serverUrl, {
        query: { token },
        auth: { token, userId },
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: SOCKET.RECONNECT.DELAY_MAX,
        timeout: SOCKET.CONNECTION.TIMEOUT,
        path: "/socket.io/", // Explicitly specify path for more reliability
        transports: ["polling", "websocket"], // Always try both transports
        autoConnect: true,
        forceNew: true, // Force new connection attempt
        withCredentials: true, // Enable sending credentials with cross-origin requests
        extraHeaders: {}, // Leave empty to avoid CORS issues
        rejectUnauthorized: false, // Ignore self-signed certificates for secure connections  
        secure: window.location.protocol === 'https:', // Match page protocol
        upgrade: true, // Try to upgrade to websocket
      })

      // Set up core socket event handlers
      this._setupSocketHandlers()

      // Set up notification sync for cross-tab communication
      this.setupNotificationSyncChannel()

      // Start connection monitoring for notifications
      this.startConnectionMonitoring()

      return this.socket
    } catch (error) {
      log.error("Socket initialization error:", error)
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
      log.info("Socket connected successfully")
      this.connected = true
      this.connectionAttempts = 0
      this._startHeartbeat()
      this._processPendingMessages()

      // Notify listeners
      this._notifyEventHandlers(SOCKET.EVENTS.SOCKET_CONNECTED, {
        userId: this.userId,
        socketId: this.socket.id,
      })

      // Dispatch global event for notification components
      window.dispatchEvent(
        new CustomEvent(SOCKET.EVENTS.SOCKET_CONNECTED, {
          detail: { userId: this.userId, socketId: this.socket.id },
        }),
      )
    })

    // Connection error handling with enhanced WebSocket diagnostics
    this.socket.on("connect_error", (error) => {
      log.error("Socket connection error:", error)
      this.connected = false
      this.connectionAttempts++
      
      // Enhanced error logging for websocket issues
      log.error("Socket connection error details:", {
        message: error.message || "Unknown error",
        type: error.type || "Unknown type",
        transport: this.socket.io?.engine?.transport?.name || "Unknown transport",
        attempts: this.connectionAttempts,
        url: this.socket.io?.uri || "Unknown URL"
      });

      // Try switching to polling transport if WebSocket is failing
      if (this.connectionAttempts > 2 && 
         (error.message?.includes('websocket') || 
          this.socket.io?.engine?.transport?.name === 'websocket')) {
        log.warn("Switching to polling transport after WebSocket failures");
        
        // Force polling as the only transport option after repeated WebSocket failures
        if (this.socket.io?.opts) {
          this.socket.io.opts.transports = SOCKET.TRANSPORT.FALLBACK;
          log.info("Forced polling-only transport mode");
        }
      }

      if (this.connectionAttempts >= this.maxReconnectAttempts) {
        this._notifyEventHandlers(SOCKET.EVENTS.SOCKET_CONNECTION_FAILED, {
          error: error.message,
          attempts: this.connectionAttempts,
        })

        // Show error toast only after multiple failed attempts
        if (this.connectionAttempts === this.maxReconnectAttempts) {
          toast.error(
            "Failed to connect to the chat server.",
            { autoClose: 5000 }
          );
        }
      }

      // Dispatch global event for notification components
      window.dispatchEvent(
        new CustomEvent("socketConnectionError", {
          detail: { 
            error: error.message, 
            attempts: this.connectionAttempts,
            transport: this.socket.io?.engine?.transport?.name || "unknown"
          },
        }),
      )
    })

    // Disconnection events
    this.socket.on("disconnect", (reason) => {
      log.info(`Socket disconnected: ${reason}`)
      this.connected = false
      this._stopHeartbeat()

      // Notify listeners
      this._notifyEventHandlers(SOCKET.EVENTS.SOCKET_DISCONNECTED, { reason })

      // Dispatch global event for notification components
      window.dispatchEvent(
        new CustomEvent(SOCKET.EVENTS.SOCKET_DISCONNECTED, {
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
      log.info(`Socket reconnected after ${attemptNumber} attempts`)
      this.connected = true
      this.reconnecting = false

      // Notify listeners
      this._notifyEventHandlers(SOCKET.EVENTS.SOCKET_RECONNECTED, {
        userId: this.userId,
        attempts: attemptNumber,
      })

      // Dispatch global event for notification components
      window.dispatchEvent(
        new CustomEvent(SOCKET.EVENTS.SOCKET_RECONNECTED, {
          detail: { userId: this.userId, attempts: attemptNumber },
        }),
      )
    })

    this.socket.on("reconnect_attempt", (attemptNumber) => {
      log.debug(`Socket reconnect attempt ${attemptNumber}`)
      this.reconnecting = true
    })

    this.socket.on("reconnect_error", (error) => {
      log.error("Socket reconnection error:", error)
    })

    this.socket.on("reconnect_failed", () => {
      log.error("Socket reconnection failed")
      this.reconnecting = false

      toast.error("Failed to reconnect to the chat server. Please reload the page.")

      // Notify listeners
      this._notifyEventHandlers(SOCKET.EVENTS.SOCKET_RECONNECT_FAILED, {
        userId: this.userId,
      })

      // Dispatch global event for notification components
      window.dispatchEvent(
        new CustomEvent(SOCKET.EVENTS.SOCKET_RECONNECT_FAILED, {
          detail: { userId: this.userId },
        }),
      )
    })

    // Server acknowledgment
    this.socket.on("welcome", (data) => {
      log.debug("Socket welcome message received:", data)
    })

    // Heartbeat events
    this.socket.on("pong", () => {
      this.lastPong = Date.now()
    })

    // Error event
    this.socket.on("error", (error) => {
      log.error("Socket server error:", error)
      toast.error(`Server error: ${error.message || "Unknown error"}`)
    })

    // Authentication error
    this.socket.on("auth_error", (error) => {
      log.error("Socket authentication error:", error)
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
              type: SOCKET.NOTIFICATION.SYNC_ACTIONS.NEW_NOTIFICATION,
              data: data,
            })
          } catch (err) {
            log.error("Error syncing notification to other tabs:", err)
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
      log.warn("BroadcastChannel not supported, cross-tab sync disabled")
      return null
    }

    try {
      this.notificationSyncChannel = new BroadcastChannel(SOCKET.NOTIFICATION.SYNC_CHANNEL_NAME)

      // Listen for messages from other tabs
      this.notificationSyncChannel.onmessage = (event) => {
        const { type, data } = event.data

        if (type === SOCKET.NOTIFICATION.SYNC_ACTIONS.NEW_NOTIFICATION) {
          log.debug("Received new notification from another tab")
          window.dispatchEvent(new CustomEvent("newNotification", { detail: data }))
        } else if (type === SOCKET.NOTIFICATION.SYNC_ACTIONS.MARK_READ) {
          log.debug("Received mark-read event from another tab")
          window.dispatchEvent(new CustomEvent("notificationRead", { detail: data }))
        } else if (type === SOCKET.NOTIFICATION.SYNC_ACTIONS.MARK_ALL_READ) {
          log.debug("Received mark-all-read event from another tab")
          window.dispatchEvent(new CustomEvent("allNotificationsRead"))
        }
      }

      log.info("Notification sync channel initialized")
      return this.notificationSyncChannel
    } catch (error) {
      log.error("Error setting up notification sync channel:", error)
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

    // Send ping based on configured interval
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.connected) {
        this.socket.emit("ping")

        // Check if we've received a pong in the configured timeout period
        const now = Date.now()
        if (this.lastPong && now - this.lastPong > SOCKET.CONNECTION.HEARTBEAT_TIMEOUT) {
          log.warn(`No heartbeat response in ${SOCKET.CONNECTION.HEARTBEAT_TIMEOUT / 1000} seconds, reconnecting...`)
          this.enhancedReconnect()
        }
      }
    }, SOCKET.CONNECTION.HEARTBEAT_INTERVAL)
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

    // Check connection health based on configured interval
    this.connectionMonitorInterval = setInterval(() => {
      this.checkSocketHealthForNotifications()
    }, SOCKET.CONNECTION.MONITOR_INTERVAL)

    log.info("Notification connection monitoring started")
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

    // Extra debugging info about socket state
    log.debug(`Socket health check - Connected: ${this.connected}, Time since last heartbeat: ${timeSinceLastPong/1000}s`)

    // Check if socket object is valid
    if (!this.socket || typeof this.socket.emit !== "function") {
      log.warn("Invalid socket object, attempting to reconnect...")
      this.enhancedReconnect()
      return false
    }

    // Check if it's been too long since last pong
    if (timeSinceLastPong > SOCKET.CONNECTION.HEARTBEAT_TIMEOUT) {
      log.warn(`No socket response in the last ${SOCKET.CONNECTION.HEARTBEAT_TIMEOUT / 1000} seconds, reconnecting for notifications...`)
      this.enhancedReconnect()
      return false
    }

    // Check if socket is actually connected
    if (!this.connected) {
      log.warn("Socket appears disconnected, reconnecting for notifications...")
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

    log.info(`Processing ${this.pendingMessages.length} pending messages`)

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
          log.error(`Error in ${event} handler:`, error)
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
      log.warn(`Socket not initialized, cannot emit '${event}'`)
      return false
    }

    if (!this.connected) {
      log.info(`Socket not connected, queueing '${event}'`)
      this.pendingMessages.push({ event, data })
      return true
    }

    try {
      this.socket.emit(event, data)
      return true
    } catch (error) {
      log.error(`Error emitting '${event}':`, error)
      return false
    }
  }

  /**
   * Enhanced reconnect method with better notification support
   */
  enhancedReconnect() {
    if (this.reconnecting) {
      log.info("Already attempting reconnection, skipping duplicate request");
      return;
    }

    log.info("Forcing socket reconnection with notification support...");
    this.reconnecting = true;

    // Close existing connection with better error handling
    if (this.socket) {
      try {
        this.socket.disconnect();
        this.socket.close();
      } catch (error) {
        log.error("Error closing socket:", error);
        // Continue anyway - don't let this stop us from reconnecting
      }
    }

    // Stop heartbeat
    this._stopHeartbeat();

    // Reconnect if we have userId
    if (this.userId) {
      // Use tokenStorage utility instead of direct localStorage/sessionStorage access
      const token = getToken();
      if (token) {
        // Add a small random delay to prevent simultaneous reconnection attempts
        const reconnectDelay = SOCKET.CONNECTION.RECONNECT_DELAY_MIN + Math.random() * (SOCKET.CONNECTION.RECONNECT_DELAY_MAX - SOCKET.CONNECTION.RECONNECT_DELAY_MIN);
        log.debug(`Scheduling reconnection in ${Math.round(reconnectDelay)}ms`);

        setTimeout(() => {
          try {
            // Re-fetch a fresh token directly from storage in case it changed
            const freshToken = getToken();
            if (freshToken !== token) {
              log.info("Token changed since reconnection attempt started, using fresh token");
            }

            // Check network status - if browser is offline, wait for online event
            if (!navigator.onLine) {
              log.warn("Browser is offline, waiting for connection to return");

              // Set up one-time event listener for reconnection when back online
              const onlineHandler = () => {
                log.info("Browser back online, attempting reconnection");
                window.removeEventListener('online', onlineHandler);

                // Wait a moment for network to stabilize
                setTimeout(() => {
                  this.reconnecting = false;
                  this.enhancedReconnect();
                }, SOCKET.CONNECTION.ONLINE_RECONNECT_DELAY);
              };

              window.addEventListener('online', onlineHandler, { once: true });
              this.reconnecting = false;
              return;
            }

            // Use environment-aware server URL from config
            const isDev = process.env.NODE_ENV === 'development';
            const serverUrl = isDev ? SOCKET.URLS.DEV : SOCKET.URLS.PROD;

            // Always use the most recent token available
            log.info("Initializing socket with fresh token");
            this.init(this.userId, freshToken || token, {
              // Explicitly try websocket first on reconnect for better reliability
              // Removed extraHeaders from transportOptions that were causing CORS issues
              transportOptions: {
                websocket: {}
              }
            });

            // Dispatch reconnection success event specifically for notifications
            window.dispatchEvent(new CustomEvent(SOCKET.EVENTS.NOTIFICATION_SOCKET_RECONNECTED));
            log.info("Socket reconnected with notification support");
          } catch (err) {
            log.error("Socket reconnection failed:", err);

            // Attempt fallback to polling-only if WebSocket is the issue
            if (err.message && (err.message.includes("websocket") || err.message.includes("WebSocket"))) {
              log.warn("WebSocket error detected, trying fallback to polling transport only");
              try {
                // Use environment-aware server URL from config
                const isDev = process.env.NODE_ENV === 'development';
                const serverUrl = isDev ? SOCKET.URLS.DEV : SOCKET.URLS.PROD;

                this.init(this.userId, token, {
                  transports: SOCKET.TRANSPORT.FALLBACK,
                  autoConnect: true
                });
                log.info("Fallback to polling transport initiated");
              } catch (fallbackErr) {
                log.error("Polling fallback also failed:", fallbackErr);
              }
            }

            // If reconnection failed due to token issues, try one more time with a clean token
            if (err.message && (err.message.includes("auth") || err.message.includes("token"))) {
              log.warn("Authentication error detected, trying emergency session reset");

              // Wait 2 seconds before trying the emergency recovery
              setTimeout(() => {
                try {
                  // Use the emergency fix function if available
                  if (typeof window.fixMyUserId === 'function') {
                    window.fixMyUserId();
                  } else {
                    // Try to refresh the token first before full reset
                    this._attemptTokenRefresh().catch(() => {
                      // Last resort: clear storage and reload
                      log.warn("Performing emergency session reset");
                      // Use a more targeted approach than clearing all storage
                      apiService.logout(); // This will handle token removal through the proper channels
                      window.location.reload();
                    });
                  }
                } catch (emergencyErr) {
                  log.error("Emergency recovery failed:", emergencyErr);
                  this.reconnecting = false;
                }
              }, 2000);
              return;
            }
          } finally {
            this.reconnecting = false;
          }
        }, reconnectDelay);
      } else {
        log.error("Cannot reconnect: No authentication token found");
        this.reconnecting = false;
      }
    } else {
      log.error("Cannot reconnect: No user ID");
      this.reconnecting = false;
    }
  }

  /**
   * Attempt to refresh auth token
   * @private
   * @returns {Promise} - Promise that resolves when token refresh completes
   */
  _attemptTokenRefresh() {
    return new Promise((resolve, reject) => {
      log.info("Attempting to refresh authentication token");

      // Use apiService for token refresh
      apiService.post('/auth/refresh-token', {})
        .then(data => {
          if (data.token) {
            log.info("Token refresh successful");
            // Use tokenStorage utility instead of direct localStorage access
            setToken(data.token, true);
            this.reconnecting = false;
            this.enhancedReconnect();
            resolve();
          } else {
            throw new Error('No token in response');
          }
        })
        .catch(err => {
          log.error("Token refresh failed:", err);
          reject(err);
        });
    });
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
    log.info("Disconnecting socket")

    this._stopHeartbeat()
    this.stopConnectionMonitoring()

    // Close notification sync channel
    if (this.notificationSyncChannel) {
      try {
        this.notificationSyncChannel.close()
        this.notificationSyncChannel = null
      } catch (err) {
        log.error("Error closing notification sync channel:", err)
      }
    }

    if (this.socket) {
      try {
        this.socket.disconnect()
      } catch (error) {
        log.error("Error disconnecting socket:", error)
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
