// client/src/services/enhanced/socketClient.js
// Enhanced Socket.IO client implementation with improved reliability and performance

import { io } from "socket.io-client";
import { toast } from "react-toastify";
import logger from "../../utils/logger.js";
import { getToken } from "../../utils/tokenStorage";
import config from "../../config.js";

// Create named logger
const log = logger.create("EnhancedSocketClient");

// Configuration constants from the config file
const {
  RECONNECT,
  CONNECTION,
  NOTIFICATION,
  TRANSPORT,
  EVENTS,
  TIMEOUT
} = config.SOCKET;

/**
 * Exponential backoff implementation for reconnection
 */
class ExponentialBackoff {
  constructor({
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 1.5,
    jitter = 0.1
  } = {}) {
    this.initialDelay = initialDelay;
    this.maxDelay = maxDelay;
    this.factor = factor;
    this.jitter = jitter;
    this.attempts = 0;
  }
  
  /**
   * Get the next backoff delay
   * @returns {number} Delay in milliseconds
   */
  next() {
    this.attempts++;
    
    // Calculate exponential backoff
    let delay = this.initialDelay * Math.pow(this.factor, this.attempts - 1);
    
    // Apply maximum
    delay = Math.min(delay, this.maxDelay);
    
    // Add random jitter
    if (this.jitter > 0) {
      const jitterAmount = delay * this.jitter;
      delay += Math.random() * jitterAmount;
    }
    
    return Math.floor(delay);
  }
  
  /**
   * Reset the backoff attempts counter
   */
  reset() {
    this.attempts = 0;
  }
  
  /**
   * Get the current attempt count
   * @returns {number} Current attempt count
   */
  getAttempts() {
    return this.attempts;
  }
}

/**
 * Enhanced Socket.IO client with improved reliability and performance
 */
class EnhancedSocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnecting = false;
    this.userId = null;
    
    // Message management
    this.pendingMessages = [];
    this.processedMessages = new Set();
    
    // Event callbacks
    this.eventHandlers = new Map();
    this.oneTimeHandlers = new Map();
    
    // Set max size for processed messages to prevent memory leaks
    this.maxProcessedMessages = 500;
    this.processedMessagesCleanupInterval = null;
    
    // Connection management
    this.connectionAttempts = 0;
    this.maxReconnectAttempts = RECONNECT.MAX_ATTEMPTS;
    this.backoff = new ExponentialBackoff({
      initialDelay: RECONNECT.DELAY,
      maxDelay: RECONNECT.DELAY_MAX,
      factor: 1.5,
      jitter: 0.2
    });
    
    // Monitoring
    this.heartbeatInterval = null;
    this.lastPong = null;
    this.connectionMonitorInterval = null;
    
    // Connection diagnostics
    this.diagnostics = {
      connectionHistory: [],
      lastConnectionAttempt: null,
      lastTransport: null,
      lastError: null,
      pingStats: {
        count: 0,
        totalTime: 0,
        maxTime: 0,
        minTime: Number.MAX_SAFE_INTEGER,
        lastPing: null
      }
    };
    
    // Cross-tab synchronization
    this.notificationSyncChannel = null;
    this.setupNotificationSyncChannel();
    
    // Track initialization state
    this.initPromise = null;
    
    // Session identifier for multiple tabs
    this.sessionId = Math.random().toString(36).substring(2, 15);
    
    // Track online status for reconnection decisions
    this._listenForNetworkChanges();
    
    log.info("EnhancedSocketClient created", this.sessionId);
  }
  
  /**
   * Initialize socket connection
   * @param {string} userId User ID
   * @param {string} token Auth token
   * @param {Object} options Additional options
   * @returns {Promise<Object>} Socket instance
   */
  async init(userId, token, options = {}) {
    // Don't initialize multiple times simultaneously
    if (this.initPromise) {
      return this.initPromise;
    }
    
    // Create a new initialization promise
    this.initPromise = new Promise((resolve, reject) => {
      // Check if already connected with same user
      if (this.socket && this.connected && this.userId === userId) {
        log.info("Socket already connected for user", userId);
        this.initPromise = null;
        return resolve(this.socket);
      }
      
      // Clean up any existing connections
      this._cleanup();
      
      // Set up periodic cleanup for processed messages
      if (!this.processedMessagesCleanupInterval) {
        this.processedMessagesCleanupInterval = setInterval(() => {
          this._cleanupProcessedMessages();
        }, 5 * 60 * 1000); // Every 5 minutes
      }
      
      // Save user ID for reconnection
      this.userId = userId;
      this.backoff.reset();
      this.connectionAttempts = 0;
      
      // Determine correct server URL
      const isDev = process.env.NODE_ENV === 'development';
      let serverUrl;
      
      if (isDev) {
        serverUrl = options.serverUrl || TRANSPORT.URLS.DEV;
      } else {
        // Use window.location.origin to get the current domain in production
        serverUrl = window.location.origin;
      }
      
      log.info(`Connecting to socket server at ${serverUrl}`);
      
      try {
        // Initialize core connection options
        const connectionOptions = {
          query: { token, version: process.env.APP_VERSION || '1.0.0' },
          auth: { token, userId },
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: RECONNECT.DELAY,
          reconnectionDelayMax: RECONNECT.DELAY_MAX,
          timeout: CONNECTION.TIMEOUT,
          path: "/socket.io/", // Ensure trailing slash for server compatibility
          transports: options.transports || TRANSPORT.DEFAULT,
          autoConnect: true,
          forceNew: true,
          withCredentials: true,
          secure: window.location.protocol === 'https:',
          upgrade: true
        };
        
        // Initialize socket with enhanced options
        this.socket = io(serverUrl, connectionOptions);
        
        // Set up core socket event handlers
        this._setupSocketHandlers();
        
        // Start connection monitoring
        this._startConnectionMonitoring();
        
        // Resolve with the socket instance
        resolve(this.socket);
      } catch (error) {
        log.error("Socket initialization error:", error);
        this.initPromise = null;
        reject(error);
      }
    });
    
    try {
      await this.initPromise;
      // Clear the promise once done, successful or not
      this.initPromise = null;
      return this.socket;
    } catch (error) {
      this.initPromise = null;
      throw error;
    }
  }
  
  /**
   * Check if the socket is connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.socket && this.connected;
  }
  
  /**
   * Get diagnostics data about the connection
   * @returns {Object} Connection diagnostics
   */
  getDiagnostics() {
    return {
      ...this.diagnostics,
      connected: this.connected,
      reconnecting: this.reconnecting,
      connectionAttempts: this.connectionAttempts,
      pendingMessages: this.pendingMessages.length,
      processedMessages: this.processedMessages.size,
      transportType: this.socket?.io?.engine?.transport?.name || "none",
      transport: this.socket?.io?.engine?.transport || null,
      sessionId: this.sessionId,
      backoffAttempts: this.backoff.getAttempts()
    };
  }
  
  /**
   * Set up core socket event handlers
   * @private
   */
  _setupSocketHandlers() {
    if (!this.socket) return;
    
    // Connection success
    this.socket.on("connect", () => {
      log.info("Socket connected successfully");
      this.connected = true;
      this.reconnecting = false;
      this.connectionAttempts = 0;
      this.backoff.reset();
      
      // Update diagnostics
      this.diagnostics.connectionHistory.push({
        type: "connect",
        timestamp: Date.now(),
        transport: this.socket.io?.engine?.transport?.name || "unknown"
      });
      
      // Keep history limited to prevent memory leaks
      if (this.diagnostics.connectionHistory.length > 20) {
        this.diagnostics.connectionHistory.shift();
      }
      
      this.diagnostics.lastTransport = this.socket.io?.engine?.transport?.name || "unknown";
      
      // Start heartbeat
      this._startHeartbeat();
      
      // Process any pending messages
      this._processPendingMessages();
      
      // Notify event handlers
      this._notifyEventHandlers(EVENTS.SOCKET_CONNECTED, {
        userId: this.userId,
        socketId: this.socket.id,
        transport: this.socket.io?.engine?.transport?.name || "unknown",
        timestamp: Date.now()
      });
      
      // Dispatch global event for components
      window.dispatchEvent(
        new CustomEvent(EVENTS.SOCKET_CONNECTED, {
          detail: {
            userId: this.userId,
            socketId: this.socket.id,
            transport: this.socket.io?.engine?.transport?.name || "unknown"
          }
        })
      );
    });
    
    // Connection error
    this.socket.on("connect_error", (error) => {
      log.error("Socket connection error:", error);
      this.connected = false;
      this.connectionAttempts++;
      
      // Update diagnostics
      this.diagnostics.connectionHistory.push({
        type: "connect_error",
        timestamp: Date.now(),
        error: error.message || "Unknown connection error"
      });
      
      this.diagnostics.lastError = {
        message: error.message || "Unknown connection error",
        timestamp: Date.now(),
        attempt: this.connectionAttempts
      };
      
      // Enhanced error logging for troubleshooting
      log.error("Socket connection error details:", {
        message: error.message || "Unknown error",
        type: error.type || "Unknown type",
        transport: this.socket.io?.engine?.transport?.name || "Unknown transport",
        attempts: this.connectionAttempts,
        url: this.socket.io?.uri || "Unknown URL"
      });
      
      // Try switching to polling if WebSocket is failing
      if (this.connectionAttempts > 2 && 
         (error.message?.includes('websocket') || 
          this.socket.io?.engine?.transport?.name === 'websocket')) {
        log.warn("Switching to polling transport after WebSocket failures");
        
        // Force polling as the only transport option
        if (this.socket.io?.opts) {
          this.socket.io.opts.transports = TRANSPORT.FALLBACK;
          log.info("Forced polling-only transport mode");
        }
      }
      
      // Notify handlers
      this._notifyEventHandlers(EVENTS.SOCKET_CONNECTION_FAILED, {
        error: error.message,
        attempts: this.connectionAttempts
      });
      
      // Show user-facing error only after multiple failures
      if (this.connectionAttempts === this.maxReconnectAttempts) {
        toast.error(
          "Failed to connect to the chat server.",
          { autoClose: 5000 }
        );
      }
      
      // Dispatch global event
      window.dispatchEvent(
        new CustomEvent("socketConnectionError", {
          detail: { 
            error: error.message, 
            attempts: this.connectionAttempts,
            transport: this.socket.io?.engine?.transport?.name || "unknown"
          }
        })
      );
    });
    
    // Disconnection
    this.socket.on("disconnect", (reason) => {
      log.info(`Socket disconnected: ${reason}`);
      this.connected = false;
      this._stopHeartbeat();
      
      // Update diagnostics
      this.diagnostics.connectionHistory.push({
        type: "disconnect",
        timestamp: Date.now(),
        reason: reason
      });
      
      // Notify handlers
      this._notifyEventHandlers(EVENTS.SOCKET_DISCONNECTED, { reason });
      
      // Dispatch global event
      window.dispatchEvent(
        new CustomEvent(EVENTS.SOCKET_DISCONNECTED, {
          detail: { reason }
        })
      );
      
      // Auto reconnect for certain disconnect reasons
      if (
        reason === "io server disconnect" || 
        reason === "transport close" || 
        reason === "transport error"
      ) {
        this.reconnect();
      }
    });
    
    // Reconnection handlers
    this.socket.on("reconnect", (attemptNumber) => {
      log.info(`Socket reconnected after ${attemptNumber} attempts`);
      this.connected = true;
      this.reconnecting = false;
      
      // Notify handlers
      this._notifyEventHandlers(EVENTS.SOCKET_RECONNECTED, {
        userId: this.userId,
        attempts: attemptNumber
      });
      
      // Dispatch global event
      window.dispatchEvent(
        new CustomEvent(EVENTS.SOCKET_RECONNECTED, {
          detail: { userId: this.userId, attempts: attemptNumber }
        })
      );
    });
    
    this.socket.on("reconnect_attempt", (attemptNumber) => {
      log.debug(`Socket reconnect attempt ${attemptNumber}`);
      this.reconnecting = true;
      
      // Update diagnostics
      this.diagnostics.connectionHistory.push({
        type: "reconnect_attempt",
        timestamp: Date.now(),
        attempt: attemptNumber
      });
    });
    
    this.socket.on("reconnect_error", (error) => {
      log.error("Socket reconnection error:", error);
      
      // Update diagnostics
      this.diagnostics.lastError = {
        message: error.message || "Unknown reconnection error",
        timestamp: Date.now(),
        type: "reconnect_error"
      };
    });
    
    this.socket.on("reconnect_failed", () => {
      log.error("Socket reconnection failed after all attempts");
      this.reconnecting = false;
      
      toast.error("Failed to reconnect to the chat server. Please reload the page.");
      
      // Notify handlers
      this._notifyEventHandlers(EVENTS.SOCKET_RECONNECT_FAILED, {
        userId: this.userId
      });
      
      // Dispatch global event
      window.dispatchEvent(
        new CustomEvent(EVENTS.SOCKET_RECONNECT_FAILED, {
          detail: { userId: this.userId }
        })
      );
    });
    
    // Server welcome message
    this.socket.on("welcome", (data) => {
      log.debug("Socket welcome message received:", data);
      
      // Store server-provided features/diagnostics
      if (data.server === "enhanced") {
        this.serverFeatures = data.features || {};
      }
    });
    
    // Heartbeat (ping/pong)
    this.socket.on("pong", (data) => {
      const now = Date.now();
      this.lastPong = now;
      
      // Calculate ping time if we have lastPing
      if (this._lastPingTime) {
        const pingTime = now - this._lastPingTime;
        this._lastPingTime = null;
        
        // Update ping statistics
        this.diagnostics.pingStats.count++;
        this.diagnostics.pingStats.totalTime += pingTime;
        this.diagnostics.pingStats.maxTime = Math.max(this.diagnostics.pingStats.maxTime, pingTime);
        this.diagnostics.pingStats.minTime = Math.min(this.diagnostics.pingStats.minTime, pingTime);
        this.diagnostics.pingStats.lastPing = pingTime;
      }
    });
    
    // Error handling
    this.socket.on("error", (error) => {
      log.error("Socket server error:", error);
      
      // Only show toast for significant errors
      if (error && typeof error === "object" && error.critical) {
        toast.error(`Server error: ${error.message || "Unknown error"}`);
      }
      
      // Update diagnostics
      this.diagnostics.lastError = {
        message: error.message || "Unknown server error",
        timestamp: Date.now(),
        type: "server_error"
      };
    });
    
    // Authentication error
    this.socket.on("auth_error", (error) => {
      log.error("Socket authentication error:", error);
      
      toast.error("Authentication failed. Please log in again.");
      
      // Update diagnostics
      this.diagnostics.lastError = {
        message: error.message || "Authentication failed",
        timestamp: Date.now(),
        type: "auth_error"
      };
      
      // Trigger authentication event to log out
      window.dispatchEvent(new CustomEvent("authLogout"));
    });
    
    // Register server reconnection suggestion
    this.socket.on("reconnect_suggestion", (data) => {
      log.info("Server suggested reconnection:", data);
      
      // If the server suggests a reconnection, we should respect it
      setTimeout(() => {
        this.reconnect();
      }, 1000); // Delay reconnection by 1 second
    });
    
    // Register common event forwarders
    this._setupEventForwarders();
  }
  
  /**
   * Set up event forwarders for common events
   * @private
   */
  _setupEventForwarders() {
    // Helper function to register a simple event forwarder
    const forwardEvent = (eventName) => {
      this.socket.on(eventName, (data) => {
        // Skip duplicate events using the message tracking
        if (this._isDuplicateEvent(eventName, data)) {
          log.debug(`Skipping duplicate ${eventName} event`, data?._id || "");
          return;
        }
        
        // Record processed event
        this._recordProcessedEvent(eventName, data);
        
        // Forward to event handlers
        this._notifyEventHandlers(eventName, data);
        
        // Check for one-time handlers
        this._checkOneTimeHandlers(eventName, data);
      });
    };
    
    // Register message events
    forwardEvent("messageReceived");
    forwardEvent("messageSent");
    forwardEvent("messageError");
    forwardEvent("userTyping");
    forwardEvent("messagesRead");
    
    // Register call events
    forwardEvent("videoSignal");
    forwardEvent("videoHangup");
    forwardEvent("videoError");
    forwardEvent("videoMediaControl");
    forwardEvent("incomingCall");
    forwardEvent("callAnswered");
    forwardEvent("callInitiated");
    forwardEvent("callError");
    
    // Register user events
    forwardEvent("userOnline");
    forwardEvent("userOffline");
    
    // Register notification events
    forwardEvent("notification");
    forwardEvent("newLike");
    forwardEvent("photoPermissionRequestReceived");
    forwardEvent("photoPermissionResponseReceived");
    forwardEvent("newComment");
    forwardEvent("newStory");
    
    // Register enhanced protocol events
    forwardEvent("messageQueued");
    forwardEvent("messageStatus");
    forwardEvent("bulkMessages");
  }
  
  /**
   * Start heartbeat to monitor connection health
   * @private
   */
  _startHeartbeat() {
    this._stopHeartbeat();
    this.lastPong = Date.now();
    
    // Send ping based on configured interval
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.connected) {
        // Store ping time for latency calculation
        this._lastPingTime = Date.now();
        this.socket.emit("ping");
        
        // Check if we've received a pong recently
        const now = Date.now();
        if (this.lastPong && now - this.lastPong > CONNECTION.HEARTBEAT_TIMEOUT) {
          log.warn(`No heartbeat response in ${CONNECTION.HEARTBEAT_TIMEOUT / 1000} seconds, reconnecting...`);
          this.reconnect();
        }
      }
    }, CONNECTION.HEARTBEAT_INTERVAL);
  }
  
  /**
   * Stop heartbeat interval
   * @private
   */
  _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  /**
   * Start connection monitoring
   * @private
   */
  _startConnectionMonitoring() {
    // Clear any existing monitoring
    this._stopConnectionMonitoring();
    
    // Start new monitoring interval
    this.connectionMonitorInterval = setInterval(() => {
      this._checkConnectionHealth();
    }, CONNECTION.MONITOR_INTERVAL);
    
    log.debug("Connection monitoring started");
  }
  
  /**
   * Stop connection monitoring
   * @private
   */
  _stopConnectionMonitoring() {
    if (this.connectionMonitorInterval) {
      clearInterval(this.connectionMonitorInterval);
      this.connectionMonitorInterval = null;
    }
  }
  
  /**
   * Check connection health and reconnect if needed
   * @private
   */
  _checkConnectionHealth() {
    // Skip if not initialized
    if (!this.userId || !this.socket) return false;
    
    const now = Date.now();
    const lastPong = this.lastPong || 0;
    const timeSinceLastPong = now - lastPong;
    
    log.debug(`Connection health check - Connected: ${this.connected}, Time since last heartbeat: ${timeSinceLastPong/1000}s`);
    
    // Check if socket is invalid
    if (!this.socket || typeof this.socket.emit !== "function") {
      log.warn("Invalid socket object, attempting to reconnect");
      this.reconnect();
      return false;
    }
    
    // Check for heartbeat timeout
    if (timeSinceLastPong > CONNECTION.HEARTBEAT_TIMEOUT) {
      log.warn(`No heartbeat response in ${CONNECTION.HEARTBEAT_TIMEOUT / 1000} seconds, reconnecting`);
      this.reconnect();
      return false;
    }
    
    // Check connection state
    if (!this.connected && !this.reconnecting) {
      log.warn("Socket disconnected but not reconnecting, initiating reconnection");
      this.reconnect();
      return false;
    }
    
    return true;
  }
  
  /**
   * Set up notifications sync between tabs
   * @private
   */
  setupNotificationSyncChannel() {
    // Only set up if not already initialized and browser supports BroadcastChannel
    if (this.notificationSyncChannel || typeof BroadcastChannel === "undefined") {
      return;
    }
    
    try {
      this.notificationSyncChannel = new BroadcastChannel(NOTIFICATION.SYNC_CHANNEL_NAME);
      
      // Listen for messages from other tabs
      this.notificationSyncChannel.onmessage = (event) => {
        const { type, data } = event.data;
        
        if (type === NOTIFICATION.SYNC_ACTIONS.NEW_NOTIFICATION) {
          // Forward notification to event handlers
          this._notifyEventHandlers(data.type || "notification", data);
          
          // Also dispatch global event
          window.dispatchEvent(new CustomEvent("newNotification", { detail: data }));
        } else if (type === NOTIFICATION.SYNC_ACTIONS.MARK_READ) {
          window.dispatchEvent(new CustomEvent("notificationRead", { detail: data }));
        } else if (type === NOTIFICATION.SYNC_ACTIONS.MARK_ALL_READ) {
          window.dispatchEvent(new CustomEvent("allNotificationsRead"));
        } else if (type === NOTIFICATION.SYNC_ACTIONS.SOCKET_CONNECTED) {
          // Another tab connected - we could potentially disconnect if needed
          log.debug("Another tab connected to socket server");
        }
      };
      
      log.info("Notification sync channel initialized");
      return this.notificationSyncChannel;
    } catch (error) {
      log.error("Error setting up notification sync channel:", error);
      this.notificationSyncChannel = null;
      return null;
    }
  }
  
  /**
   * Process pending messages after connection is established
   * @private
   */
  _processPendingMessages() {
    if (!this.connected || !this.pendingMessages.length) return;
    
    log.info(`Processing ${this.pendingMessages.length} pending messages`);
    
    // Process in batches with prioritization
    const messages = [...this.pendingMessages];
    this.pendingMessages = [];
    
    // Sort by priority (higher priority values first)
    messages.sort((a, b) => {
      // Priority order
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Otherwise by timestamp
      return a.timestamp - b.timestamp;
    });
    
    // Process in batches with delay to avoid overwhelming the server
    const processBatch = (batch, index) => {
      setTimeout(() => {
        batch.forEach(msg => {
          try {
            this.socket.emit(msg.event, msg.data);
            log.debug(`Sent pending ${msg.event} message`);
          } catch (err) {
            log.error(`Error sending pending ${msg.event}:`, err);
          }
        });
      }, index * 100); // 100ms between batches
    };
    
    // Split into batches of 5 messages
    const batchSize = 5;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      processBatch(batch, i / batchSize);
    }
  }
  
  /**
   * Check if an event is a duplicate
   * @param {string} eventName Event name
   * @param {Object} data Event data
   * @returns {boolean} Whether event is a duplicate
   * @private
   */
  _isDuplicateEvent(eventName, data) {
    if (!data) return false;
    
    // Generate event key
    const eventKey = this._generateEventKey(eventName, data);
    if (!eventKey) return false;
    
    // Check if already processed
    return this.processedMessages.has(eventKey);
  }
  
  /**
   * Record a processed event to prevent duplicates
   * @param {string} eventName Event name
   * @param {Object} data Event data
   * @private
   */
  _recordProcessedEvent(eventName, data) {
    if (!data) return;
    
    // Generate event key
    const eventKey = this._generateEventKey(eventName, data);
    if (!eventKey) return;
    
    // Record the event
    this.processedMessages.add(eventKey);
    
    // Clean up processed messages periodically to prevent memory leaks
    if (this.processedMessages.size > this.maxProcessedMessages) {
      this._cleanupProcessedMessages();
    }
  }
  
  /**
   * Generate a unique key for event deduplication
   * @param {string} eventName Event name
   * @param {Object} data Event data
   * @returns {string} Event key
   * @private
   */
  _generateEventKey(eventName, data) {
    // Skip key generation for events without data
    if (!data) return null;
    
    if (eventName.includes("message")) {
      // For messages, use ID and type
      const msgId = data._id || data.tempId || data.tempMessageId;
      if (msgId) {
        return `${eventName}:${msgId}`;
      }
      
      // Fallback for messages without ID
      const sender = data.sender || "";
      const recipient = data.recipient || "";
      const timestamp = data.timestamp || data.createdAt || Date.now();
      return `${eventName}:${sender}:${recipient}:${timestamp}`;
    } else if (eventName.includes("notification")) {
      // For notifications
      const id = data._id || data.id || "";
      const type = data.type || "";
      const timestamp = data.timestamp || Date.now();
      return `${eventName}:${type}:${id}:${timestamp}`;
    } else if (eventName.includes("call")) {
      // For calls
      const callId = data.callId || "";
      const timestamp = data.timestamp || Date.now();
      return `${eventName}:${callId}:${timestamp}`;
    }
    
    // Default key for other events
    const id = data._id || data.id || "";
    const timestamp = data.timestamp || Date.now();
    return `${eventName}:${id}:${timestamp}`;
  }
  
  /**
   * Clean up old processed messages to prevent memory leaks
   * @private
   */
  _cleanupProcessedMessages() {
    log.debug(`Cleaning up processed messages, current size: ${this.processedMessages.size}`);
    
    // Keep the most recent messages
    const keepCount = Math.floor(this.maxProcessedMessages * 0.8); // Keep 80% of max
    if (this.processedMessages.size <= keepCount) return;
    
    const toRemove = this.processedMessages.size - keepCount;
    let removed = 0;
    
    // Convert to array and remove oldest entries
    const entries = Array.from(this.processedMessages);
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.processedMessages.delete(entries[i]);
      removed++;
    }
    
    log.debug(`Removed ${removed} old processed messages, ${this.processedMessages.size} remaining`);
  }
  
  /**
   * Register event handler
   * @param {string} event Event name
   * @param {Function} callback Event callback
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!callback || typeof callback !== "function") {
      log.warn(`Invalid callback for event: ${event}`);
      return () => {}; // Return dummy function
    }
    
    // Create handler set if it doesn't exist
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    
    // Add to handlers
    this.eventHandlers.get(event).add(callback);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }
  
  /**
   * Register one-time event handler
   * @param {string} event Event name
   * @param {Function} callback Event callback
   * @param {Function} [matcher] Optional matcher function to identify the right event
   * @returns {Function} Unsubscribe function
   */
  once(event, callback, matcher = null) {
    if (!callback || typeof callback !== "function") {
      log.warn(`Invalid callback for one-time event: ${event}`);
      return () => {}; // Return dummy function
    }
    
    // Create one-time handler set if it doesn't exist
    if (!this.oneTimeHandlers.has(event)) {
      this.oneTimeHandlers.set(event, new Set());
    }
    
    // Create wrapper object with matcher
    const handlerObj = {
      callback,
      matcher: matcher || (() => true)
    };
    
    // Add to one-time handlers
    this.oneTimeHandlers.get(event).add(handlerObj);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.oneTimeHandlers.get(event);
      if (handlers) {
        handlers.forEach(h => {
          if (h.callback === callback) {
            handlers.delete(h);
          }
        });
        
        if (handlers.size === 0) {
          this.oneTimeHandlers.delete(event);
        }
      }
    };
  }
  
  /**
   * Remove event handler
   * @param {string} event Event name
   * @param {Function} callback Event callback
   */
  off(event, callback) {
    // Remove from regular handlers
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(callback);
      
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
    
    // Also check one-time handlers
    const oneTimeHandlers = this.oneTimeHandlers.get(event);
    if (oneTimeHandlers) {
      oneTimeHandlers.forEach(h => {
        if (h.callback === callback) {
          oneTimeHandlers.delete(h);
        }
      });
      
      if (oneTimeHandlers.size === 0) {
        this.oneTimeHandlers.delete(event);
      }
    }
  }
  
  /**
   * Notify registered event handlers
   * @param {string} event Event name
   * @param {any} data Event data
   * @private
   */
  _notifyEventHandlers(event, data) {
    // Notify regular handlers
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          log.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }
  
  /**
   * Check and execute matching one-time handlers
   * @param {string} event Event name
   * @param {Object} data Event data
   * @private
   */
  _checkOneTimeHandlers(event, data) {
    const handlers = this.oneTimeHandlers.get(event);
    if (!handlers || handlers.size === 0) return;
    
    // Track handlers to remove after execution
    const handlersToRemove = [];
    
    // Check each handler
    handlers.forEach(handler => {
      try {
        // Check if this handler matches the event data
        if (handler.matcher(data)) {
          // Execute the handler
          handler.callback(data);
          handlersToRemove.push(handler);
        }
      } catch (error) {
        log.error(`Error in one-time ${event} handler:`, error);
        handlersToRemove.push(handler);
      }
    });
    
    // Remove executed handlers
    handlersToRemove.forEach(handler => {
      handlers.delete(handler);
    });
    
    // Clean up if all handlers were removed
    if (handlers.size === 0) {
      this.oneTimeHandlers.delete(event);
    }
  }
  
  /**
   * Emit an event to the server
   * @param {string} event Event name
   * @param {any} data Event data
   * @param {Object} options Event options
   * @returns {boolean} Success status
   */
  emit(event, data = {}, options = {}) {
    // Validate socket state
    if (!this.socket) {
      log.warn(`Socket not initialized, cannot emit '${event}'`);
      
      // Optionally queue for later
      if (options.queueIfDisconnected !== false) {
        this._queueMessage(event, data, options.priority || 2);
      }
      
      return false;
    }
    
    // Check connection status
    if (!this.connected) {
      log.info(`Socket not connected, ${options.queueIfDisconnected !== false ? 'queueing' : 'dropping'} '${event}'`);
      
      // Queue for later if not explicitly disabled
      if (options.queueIfDisconnected !== false) {
        this._queueMessage(event, data, options.priority || 2);
      }
      
      return false;
    }
    
    // Handle rate limiting for certain events
    if (event === 'typing') {
      return this._throttleSend(event, data, 1000); // 1 second throttle for typing
    }
    
    // Normal emission
    try {
      this.socket.emit(event, data);
      return true;
    } catch (error) {
      log.error(`Error emitting '${event}':`, error);
      
      // Queue important events on error
      if (options.queueOnError !== false && this._isImportantEvent(event)) {
        this._queueMessage(event, data, options.priority || 2);
      }
      
      return false;
    }
  }
  
  /**
   * Check if an event is important enough to retry
   * @param {string} event Event name
   * @returns {boolean} Whether event is important
   * @private
   */
  _isImportantEvent(event) {
    const importantEvents = [
      "sendMessage", 
      "messageRead", 
      "answerCall",
      "videoHangup",
      "initiateCall"
    ];
    return importantEvents.includes(event);
  }
  
  /**
   * Queue a message for later delivery
   * @param {string} event Event name
   * @param {Object} data Event data
   * @param {number} priority Priority level (1=highest, 3=lowest)
   * @private
   */
  _queueMessage(event, data, priority = 2) {
    // Validate priority
    priority = Math.max(1, Math.min(3, priority));
    
    // Add to queue with timestamp
    this.pendingMessages.push({
      event,
      data,
      timestamp: Date.now(),
      priority
    });
    
    // Enforce maximum queue size to prevent memory issues
    if (this.pendingMessages.length > 100) {
      // Sort by priority first
      this.pendingMessages.sort((a, b) => a.priority - b.priority);
      
      // Remove lowest priority (highest number) messages
      while (this.pendingMessages.length > 100) {
        // Find lowest priority message
        let lowestPriorityIndex = this.pendingMessages.length - 1;
        this.pendingMessages.splice(lowestPriorityIndex, 1);
      }
      
      log.warn(`Pending message queue pruned to 100 messages`);
    }
    
    log.debug(`Queued ${event} message with priority ${priority}`);
  }
  
  /**
   * Throttle frequent events
   * @param {string} event Event name
   * @param {Object} data Event data
   * @param {number} minInterval Minimum time between events in ms
   * @returns {boolean} Whether event was sent
   * @private
   */
  _throttleSend(event, data, minInterval) {
    // Create throttle map if it doesn't exist
    if (!this._throttleMap) {
      this._throttleMap = new Map();
    }
    
    const now = Date.now();
    const lastSent = this._throttleMap.get(event) || 0;
    
    // Check if enough time has elapsed
    if (now - lastSent < minInterval) {
      return false;
    }
    
    // Update last sent time
    this._throttleMap.set(event, now);
    
    // Send the event
    try {
      this.socket.emit(event, data);
      return true;
    } catch (error) {
      log.error(`Error sending throttled ${event}:`, error);
      return false;
    }
  }
  
  /**
   * Listen for network status changes
   * @private
   */
  _listenForNetworkChanges() {
    // Listen for online event
    window.addEventListener('online', () => {
      log.info("Browser online event detected");
      
      // Wait a short time for connection to stabilize
      setTimeout(() => {
        if (this.userId && !this.connected && !this.reconnecting) {
          log.info("Reconnecting after network restored");
          this.reconnect();
        }
      }, CONNECTION.ONLINE_RECONNECT_DELAY);
    });
    
    // Listen for offline event
    window.addEventListener('offline', () => {
      log.warn("Browser offline event detected");
      
      // Update connection status for UI
      if (this.connected) {
        this._notifyEventHandlers(EVENTS.SOCKET_DISCONNECTED, { 
          reason: "network_offline", 
          isNetworkIssue: true 
        });
      }
    });
    
    // Listen for visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.userId && !this.connected && !this.reconnecting) {
        log.info("Page became visible, checking connection");
        
        // Small delay before checking
        setTimeout(() => {
          this._checkConnectionHealth();
        }, 1000);
      }
    });
  }
  
  /**
   * Reconnect with enhanced reconnection logic
   */
  reconnect() {
    if (this.reconnecting) {
      log.info("Already attempting reconnection, skipping duplicate request");
      return;
    }
    
    this.reconnecting = true;
    log.info("Forcing socket reconnection...");
    
    // Close existing socket
    this._closeExistingSocket();
    
    // Stop heartbeat
    this._stopHeartbeat();
    
    // Check if network is available
    if (!navigator.onLine) {
      log.warn("Browser is offline, waiting for connection to return");
      
      // Set up one-time event listener for reconnection when back online
      const onlineHandler = () => {
        log.info("Browser back online, attempting reconnection");
        window.removeEventListener('online', onlineHandler);
        
        // Wait a moment for network to stabilize
        setTimeout(() => {
          this.reconnecting = false;
          this.reconnect();
        }, CONNECTION.ONLINE_RECONNECT_DELAY);
      };
      
      window.addEventListener('online', onlineHandler, { once: true });
      this.reconnecting = false;
      return;
    }
    
    // Get a fresh token
    const token = getToken();
    if (!token || !this.userId) {
      log.error("Cannot reconnect: Missing authentication token or user ID");
      this.reconnecting = false;
      return;
    }
    
    // Calculate backoff delay
    const backoffDelay = this.backoff.next();
    log.info(`Reconnecting with backoff delay: ${backoffDelay}ms (attempt: ${this.backoff.getAttempts()})`);
    
    // Update diagnostics
    this.diagnostics.lastConnectionAttempt = {
      timestamp: Date.now(),
      attempt: this.backoff.getAttempts(),
      delay: backoffDelay
    };
    
    // Schedule reconnection with backoff
    setTimeout(() => {
      try {
        log.info("Initializing connection after backoff delay");
        
        // Determine transport based on history
        const usePollingOnly = this.diagnostics.connectionHistory
          .slice(-3)
          .some(h => h.type === "connect_error" && h.error?.includes("websocket"));
        
        const transport = usePollingOnly ? TRANSPORT.FALLBACK : TRANSPORT.DEFAULT;
        
        // Initialize a new connection
        this.init(this.userId, token, { transports: transport })
          .then(() => {
            log.info("Reconnection successful");
            this.reconnecting = false;
            
            // Dispatch reconnection success event for notifications
            window.dispatchEvent(new CustomEvent(EVENTS.NOTIFICATION_SOCKET_RECONNECTED));
          })
          .catch(err => {
            log.error("Socket reconnection failed:", err);
            this.reconnecting = false;
          });
      } catch (err) {
        log.error("Error during reconnection:", err);
        this.reconnecting = false;
      }
    }, backoffDelay);
  }
  
  /**
   * Safely close existing socket
   * @private
   */
  _closeExistingSocket() {
    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch (error) {
        log.error("Error disconnecting socket:", error);
      }
      
      // Clear socket reference
      this.socket = null;
    }
  }
  
  /**
   * Clean up resources
   * @private
   */
  _cleanup() {
    this._closeExistingSocket();
    this._stopHeartbeat();
    this._stopConnectionMonitoring();
    
    this.connected = false;
    this.reconnecting = false;
    
    // Don't clear userId to allow reconnection
  }
  
  /**
   * Disconnect and cleanup
   */
  disconnect() {
    log.info("Disconnecting socket");
    
    this._cleanup();
    
    // Reset everything
    this.userId = null;
    this.pendingMessages = [];
    this.processedMessages.clear();
    
    // Clear periodic cleanup interval
    if (this.processedMessagesCleanupInterval) {
      clearInterval(this.processedMessagesCleanupInterval);
      this.processedMessagesCleanupInterval = null;
    }
    
    // Clear all timeouts in throttle map
    if (this._throttleMap) {
      this._throttleMap.clear();
    }
    
    // Close notification sync channel
    if (this.notificationSyncChannel) {
      try {
        this.notificationSyncChannel.close();
      } catch (err) {
        log.error("Error closing notification sync channel:", err);
      }
      this.notificationSyncChannel = null;
    }
    
    // Clear event handlers
    this.eventHandlers.clear();
    this.oneTimeHandlers.clear();
    
    log.info("Socket client fully disconnected and cleaned up");
  }
}

// Create singleton instance
const enhancedSocketClient = new EnhancedSocketClient();
export default enhancedSocketClient;