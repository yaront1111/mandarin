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
    // Use relative path for production, and make sure we're not using undefined paths
    let serverUrl;
    
    // Check for environment variables from Vite
    if (import.meta.env?.VITE_SOCKET_URL) {
      serverUrl = import.meta.env.VITE_SOCKET_URL;
      console.log(`Using environment variable for socket connection: ${serverUrl}`);
    } 
    // Check for options provided directly
    else if (options.serverUrl) {
      serverUrl = options.serverUrl;
      console.log(`Using provided option for socket connection: ${serverUrl}`);
    } 
    // Use window.location.origin as a fallback
    else {
      serverUrl = window.location.origin;
      console.log(`Using window.location.origin for socket connection: ${serverUrl}`);
    }
    
    // CRITICAL: In production, add the exact socket.io path to the URL
    // This ensures proper path handling with Nginx proxying
    if (window.location.hostname !== 'localhost' && 
        window.location.hostname !== '127.0.0.1') {
      // For production, just use the origin without specifying a custom socket path
      console.log("Production environment detected. Using origin for Socket.IO connection.");
      serverUrl = window.location.origin;
    }
    
    console.log(`Connecting to socket server at ${serverUrl}`)

    try {
      // Simplify socket initialization for more reliable connections
      console.log(`Creating simplified socket connection to ${serverUrl} with userId ${userId}`)
      
      // ULTIMATE FALLBACK STRATEGY
      console.log(`Starting robust connection strategy for socket.io`);
      
      // For production, simplify and focus on most reliable connection
      const isProduction = window.location.hostname !== 'localhost' && 
                          window.location.hostname !== '127.0.0.1';
                          
      if (isProduction) {
        // In production, use VERY basic connection settings with RELATIVE path and NO trailing slash
        console.log("Using production simplified connection strategy with maximally compatible settings");
        
        // CRITICAL: Use a direct websocket address WITHOUT a trailing slash in the path
        // This is often the key issue with Nginx proxying of socket.io
        this.socket = io(window.location.origin, {
          query: { token },
          auth: { token },
          reconnection: true,
          reconnectionAttempts: 10,
          timeout: 20000,
          transports: ["polling", "websocket"],
          path: "/socket.io", // NO trailing slash - this is critical
          forceNew: true,
          autoConnect: true,
          withCredentials: false // Disable credentials for simpler CORS
        });
        
        console.log("Created simplified socket connection in production mode");
        
        // Set up basic error reporting
        this.socket.once("connect_error", (err) => {
          console.error(`Production socket connection error: ${err.message}`);
          
          // If this fails, try the socket.io socket path as a fallback
          console.log("Falling back to alternate path due to connection error");
          setTimeout(() => {
            try {
              if (this.socket) {
                this.socket.disconnect();
              }
              
              // First try with no path specified
              console.log("Trying with no path specified");
              this.socket = io(window.location.origin, {
                query: { token },
                forceNew: true,
                autoConnect: true
              });
              
              // Set up second fallback
              this.socket.once("connect_error", (error) => {
                console.error(`Second fallback also failed: ${error.message}`);
                
                // Try bare websocket if everything else fails
                console.log("Attempting last resort raw websocket connection");
                
                try {
                  if (this.socket) {
                    this.socket.disconnect();
                  }
                  
                  // Check if our app is hosted on the same domain as the backend
                  // If so, WebSocket will work without CORS issues
                  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                  const wsUrl = `${wsProtocol}//${window.location.host}/socket.io/?token=${encodeURIComponent(token)}&EIO=4&transport=websocket`;
                  
                  console.log(`Connecting raw WebSocket to: ${wsUrl}`);
                  
                  // Create a raw WebSocket connection
                  const rawSocket = new WebSocket(wsUrl);
                  
                  // Basic raw websocket wrapper to simulate socket.io
                  this.socket = {
                    id: `raw-${Date.now()}`,
                    connected: false,
                    rawSocket: rawSocket,
                    
                    // Minimal event handlers
                    eventHandlers: {},
                    
                    // Simple emit
                    emit: (event, data) => {
                      if (rawSocket.readyState === WebSocket.OPEN) {
                        try {
                          rawSocket.send(JSON.stringify({
                            event,
                            data,
                            token
                          }));
                          return true;
                        } catch (err) {
                          console.error(`Error sending via raw websocket: ${err.message}`);
                          return false;
                        }
                      }
                      return false;
                    },
                    
                    // Simple on
                    on: (event, callback) => {
                      if (!this.socket.eventHandlers[event]) {
                        this.socket.eventHandlers[event] = [];
                      }
                      this.socket.eventHandlers[event].push(callback);
                      return () => this.socket.off(event, callback);
                    },
                    
                    // Simple off
                    off: (event, callback) => {
                      if (this.socket.eventHandlers[event]) {
                        this.socket.eventHandlers[event] = this.socket.eventHandlers[event]
                          .filter(cb => cb !== callback);
                      }
                    },
                    
                    // Basic disconnect
                    disconnect: () => {
                      if (rawSocket) {
                        rawSocket.close();
                      }
                    },
                    
                    // Is connected check
                    isConnected: () => {
                      return rawSocket && rawSocket.readyState === WebSocket.OPEN;
                    }
                  };
                  
                  // Raw WebSocket event handlers
                  rawSocket.onopen = () => {
                    console.log("Raw WebSocket connected");
                    this.socket.connected = true;
                    
                    // Simulate connect event
                    if (this.socket.eventHandlers.connect) {
                      this.socket.eventHandlers.connect.forEach(cb => cb());
                    }
                  };
                  
                  rawSocket.onclose = () => {
                    console.log("Raw WebSocket closed");
                    this.socket.connected = false;
                    
                    // Simulate disconnect event
                    if (this.socket.eventHandlers.disconnect) {
                      this.socket.eventHandlers.disconnect.forEach(cb => cb());
                    }
                  };
                  
                  rawSocket.onerror = (error) => {
                    console.error("Raw WebSocket error:", error);
                    
                    // Simulate error event
                    if (this.socket.eventHandlers.error) {
                      this.socket.eventHandlers.error.forEach(cb => cb(error));
                    }
                  };
                  
                  rawSocket.onmessage = (event) => {
                    try {
                      const data = JSON.parse(event.data);
                      if (data.event && this.socket.eventHandlers[data.event]) {
                        this.socket.eventHandlers[data.event].forEach(cb => cb(data.data));
                      }
                    } catch (err) {
                      console.error("Error parsing message:", err);
                    }
                  };
                  
                } catch (finalError) {
                  console.error("Fatal: All fallback methods failed:", finalError);
                }
              });
                
            } catch (e) {
              console.error("Fallback connection also failed:", e);
            }
          }, 1000);
        });
        
      } else {
        // Development mode - can use more complex connection strategy
        let socketPaths = ["/socket.io/", "socket.io", ""];
        console.log("Using development connection strategy with multiple fallbacks");
        
        // Try each path in sequence
        const tryNextPath = (index = 0) => {
          if (index >= socketPaths.length) {
            console.error("All socket connection attempts failed");
            return;
          }
          
          const path = socketPaths[index];
          console.log(`Attempting socket connection with path: "${path}"`);
          
          try {
            // Clean up previous socket if any
            if (this.socket) {
              this.socket.disconnect();
              this.socket.removeAllListeners();
            }
            
            // Create socket with current path
            this.socket = io(serverUrl, {
              query: { token },
              auth: { token },
              reconnection: true,
              reconnectionAttempts: 3,
              timeout: 5000,
              transports: ["polling", "websocket"],
              autoConnect: true,
              forceNew: true,
              ...(path ? { path } : {})
            });
            
            // Set up timeout for this attempt
            const timeout = setTimeout(() => {
              console.log(`Connection timeout with path "${path}", trying next`);
              tryNextPath(index + 1);
            }, 5000);
            
            // Listen for success
            this.socket.once("connect", () => {
              console.log(`Connected successfully with path: "${path}"`);
              clearTimeout(timeout);
            });
            
            // Listen for error
            this.socket.once("connect_error", (err) => {
              console.error(`Connection failed with path "${path}": ${err.message}`);
              clearTimeout(timeout);
              tryNextPath(index + 1);
            });
            
          } catch (err) {
            console.error(`Error creating socket with path "${path}": ${err.message}`);
            tryNextPath(index + 1);
          }
        };
        
        // Start with first path
        tryNextPath();
      }

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
    if ((!this.connected && !this.usingApiFallback) || this.pendingMessages.length === 0) return

    console.log(`Processing ${this.pendingMessages.length} pending messages`)

    // Process all pending messages
    const messages = [...this.pendingMessages]
    this.pendingMessages = []

    messages.forEach((msg) => {
      this.emit(msg.event, msg.data, msg.target)
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
   * Automatically uses API fallback if socket is not available
   * @param {string} event - Event name
   * @param {any} data - Event data
   * @param {string} target - Optional target user ID (for direct messages)
   * @returns {boolean} - Success status
   */
  emit(event, data = {}, target = null) {
    // If using API fallback, route through that
    if (this.usingApiFallback) {
      console.log(`Using API fallback to emit '${event}'`);
      
      // Using the global apiService instance
      if (window.apiService) {
        // Asynchronously send via API fallback
        window.apiService.socketFallbackSend(event, data, target)
          .then(result => {
            if (!result.success) {
              console.error(`API fallback emit for '${event}' failed:`, result.error);
              // Queue for retry if reconnected
              this.pendingMessages.push({ event, data, target });
            }
          })
          .catch(err => {
            console.error(`Error in API fallback emit for '${event}':`, err);
            // Queue for retry if reconnected
            this.pendingMessages.push({ event, data, target });
          });
        return true;
      } else {
        console.warn(`API service not available for fallback emit of '${event}'`);
        // Queue for later retry
        this.pendingMessages.push({ event, data, target });
        return false;
      }
    }
    
    // Traditional socket.io emit
    if (!this.socket) {
      console.warn(`Socket not initialized, cannot emit '${event}'`)
      this.pendingMessages.push({ event, data, target })
      return false
    }

    if (!this.connected) {
      console.log(`Socket not connected, queueing '${event}'`)
      this.pendingMessages.push({ event, data, target })
      return true
    }

    try {
      // If a target is specified, and it's not a room that the socket is already in
      if (target) {
        this.socket.emit(event, { ...data, target });
      } else {
        this.socket.emit(event, data);
      }
      return true
    } catch (error) {
      console.error(`Error emitting '${event}':`, error)
      // Queue for retry
      this.pendingMessages.push({ event, data, target })
      return false
    }
  }

  /**
   * Enhanced reconnect method with better notification support and API fallback
   */
  enhancedReconnect() {
    if (this.reconnecting) {
      console.log("Already attempting reconnection, skipping duplicate request");
      return;
    }

    console.log("Forcing socket reconnection with notification support...");
    this.reconnecting = true;

    // Close existing connection with better error handling
    if (this.socket) {
      try {
        this.socket.disconnect();
        this.socket.close();
      } catch (error) {
        console.error("Error closing socket:", error);
        // Continue anyway - don't let this stop us from reconnecting
      }
    }

    // Stop heartbeat
    this._stopHeartbeat();

    // Reconnect if we have userId
    if (this.userId) {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (token) {
        // Add a small random delay to prevent simultaneous reconnection attempts
        const reconnectDelay = 1000 + Math.random() * 2000;
        console.log(`Scheduling reconnection in ${Math.round(reconnectDelay)}ms`);
        
        setTimeout(() => {
          try {
            // Re-fetch a fresh token directly from storage in case it changed
            const freshToken = localStorage.getItem("token") || sessionStorage.getItem("token");
            if (freshToken !== token) {
              console.log("Token changed since reconnection attempt started, using fresh token");
            }
            
            // Check network status - if browser is offline, wait for online event
            if (!navigator.onLine) {
              console.log("Browser is offline, waiting for connection to return");
              
              // Set up one-time event listener for reconnection when back online
              const onlineHandler = () => {
                console.log("Browser back online, attempting reconnection");
                window.removeEventListener('online', onlineHandler);
                
                // Wait a moment for network to stabilize
                setTimeout(() => {
                  this.reconnecting = false;
                  this.enhancedReconnect();
                }, 2000);
              };
              
              window.addEventListener('online', onlineHandler, { once: true });
              this.reconnecting = false;
              return;
            }
            
            // Always use the most recent token available
            console.log("Initializing socket with fresh token");
            this.init(this.userId, freshToken || token, {
              // Explicitly try polling first on reconnect for better reliability
              transportOptions: {
                polling: {
                  extraHeaders: {
                    "X-Reconnect-Attempt": "true"
                  }
                }
              }
            });
            
            // Dispatch reconnection success event specifically for notifications
            window.dispatchEvent(new CustomEvent("notificationSocketReconnected"));
            console.log("Socket reconnected with notification support");
          } catch (err) {
            console.error("Socket reconnection failed:", err);
            
            // Attempt fallback to polling-only if WebSocket is the issue
            if (err.message && (err.message.includes("websocket") || err.message.includes("WebSocket"))) {
              console.log("WebSocket error detected, trying fallback to polling transport only");
              try {
                this.init(this.userId, token, {
                  transports: ["polling"],
                  autoConnect: true
                });
                console.log("Fallback to polling transport initiated");
              } catch (fallbackErr) {
                console.error("Polling fallback also failed:", fallbackErr);
                
                // If all socket attempts fail, try API fallback
                this._activateApiFallback(token);
              }
            } else {
              // For other errors, try API fallback if the retry count is high enough
              if (this.connectionAttempts >= 3) {
                this._activateApiFallback(token);
              }
            }
            
            // If reconnection failed due to token issues, try one more time with a clean token
            if (err.message && (err.message.includes("auth") || err.message.includes("token"))) {
              console.log("Authentication error detected, trying emergency session reset");
              
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
                      console.log("Performing emergency session reset");
                      localStorage.clear();
                      sessionStorage.clear();
                      window.location.reload();
                    });
                  }
                } catch (emergencyErr) {
                  console.error("Emergency recovery failed:", emergencyErr);
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
        console.error("Cannot reconnect: No authentication token found");
        this.reconnecting = false;
      }
    } else {
      console.error("Cannot reconnect: No user ID");
      this.reconnecting = false;
    }
  }
  
  /**
   * Activate API fallback when all Socket.io connection methods fail
   * This uses the HTTP-based fallback API for real-time communication
   * @private
   * @param {string} token - Auth token
   */
  async _activateApiFallback(token) {
    console.log("All socket connection attempts failed, activating API fallback");
    
    // Import apiService dynamically if needed
    try {
      if (!window.apiService) {
        const apiServiceModule = await import('./apiService.jsx');
        window.apiService = apiServiceModule.default;
      }
      
      const apiService = window.apiService;
      
      // Save fallback state
      this.usingApiFallback = true;
      this.fallbackClientId = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Initialize fallback connection
      const fallbackResult = await apiService.initSocketFallback(this.userId, this.fallbackClientId);
      
      if (fallbackResult.success) {
        console.log("API fallback activated successfully:", fallbackResult);
        
        // Set up polling for events
        this._startFallbackPolling();
        
        // Create a simulated "connected" event to trigger normal flow
        this.connected = true;
        
        window.dispatchEvent(new CustomEvent("socketConnected", {
          detail: {
            userId: this.userId,
            socketId: this.fallbackClientId,
            usingFallback: true
          }
        }));
        
        this._notifyEventHandlers("socketConnected", {
          userId: this.userId,
          socketId: this.fallbackClientId,
          usingFallback: true
        });
        
        // Also trigger pong to prevent heartbeat errors
        this.lastPong = Date.now();
      } else {
        console.error("API fallback initialization failed:", fallbackResult.error);
        this.usingApiFallback = false;
      }
    } catch (err) {
      console.error("Error activating API fallback:", err);
      this.usingApiFallback = false;
    }
  }

  /**
   * Start long-polling mechanism for the API fallback
   * @private
   */
  _startFallbackPolling() {
    if (!this.usingApiFallback || this.fallbackPolling) return;
    
    console.log("Starting fallback polling for real-time events");
    
    // Mark as polling
    this.fallbackPolling = true;
    
    // Track last event ID
    this.fallbackLastEventId = 0;
    
    // Create polling function
    const pollForEvents = async () => {
      if (!this.usingApiFallback || !this.fallbackPolling) return;
      
      try {
        const apiService = window.apiService;
        if (!apiService) return;
        
        // Poll with current last event ID
        const response = await apiService.socketFallbackPoll(
          this.fallbackLastEventId,
          20000 // 20 second long poll
        );
        
        if (response.success && response.events && response.events.length > 0) {
          // Process all events
          response.events.forEach(event => {
            // Update last event ID
            this.fallbackLastEventId = Math.max(this.fallbackLastEventId, event.id);
            
            // Emit event to handlers
            this._notifyEventHandlers(event.event, event.data);
            
            // Also dispatch window event for global listeners
            window.dispatchEvent(new CustomEvent(event.event, {
              detail: event.data
            }));
          });
        }
        
        // Schedule next poll based on response or default delay
        const nextDelay = response.pollingInfo?.nextPollDelay || 0;
        setTimeout(pollForEvents, nextDelay);
        
        // Update lastPong to prevent heartbeat errors
        this.lastPong = Date.now();
        
      } catch (err) {
        console.error("Fallback polling error:", err);
        
        // On error, wait a bit longer before retrying
        setTimeout(pollForEvents, 5000);
      }
    };
    
    // Start polling immediately
    pollForEvents();
  }
  
  /**
   * Attempt to refresh auth token
   * @private
   * @returns {Promise} - Promise that resolves when token refresh completes
   */
  _attemptTokenRefresh() {
    return new Promise((resolve, reject) => {
      console.log("Attempting to refresh authentication token");
      
      // First try a token refresh API if available
      fetch('/api/auth/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })
      .then(response => {
        if (!response.ok) throw new Error('Token refresh failed');
        return response.json();
      })
      .then(data => {
        if (data.token) {
          console.log("Token refresh successful");
          localStorage.setItem('token', data.token);
          this.reconnecting = false;
          this.enhancedReconnect();
          resolve();
        } else {
          throw new Error('No token in response');
        }
      })
      .catch(err => {
        console.error("Token refresh failed:", err);
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

    // Stop API fallback if active
    if (this.usingApiFallback) {
      console.log("Stopping API fallback polling");
      this.fallbackPolling = false;
      this.usingApiFallback = false;
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
