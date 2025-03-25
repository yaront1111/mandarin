import { io } from 'socket.io-client';
import { toast } from 'react-toastify';

/**
 * Socket.io client wrapper with enhanced WebRTC support
 */
class SocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnecting = false;
    this.userId = null;
    this.pendingMessages = [];
    this.eventHandlers = {};
    this.connectionAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
    this.heartbeatInterval = null;
    this.lastPong = null;
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
      console.log('Socket already connected');
      return this.socket;
    }

    // Save user ID for reconnection
    this.userId = userId;

    // Determine the server URL
    const serverUrl = options.serverUrl ||
      (process.env.REACT_APP_SOCKET_URL || window.location.origin);

    console.log(`Connecting to socket server at ${serverUrl}`);

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
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });

      // Set up core socket event handlers
      this._setupSocketHandlers();

      return this.socket;
    } catch (error) {
      console.error('Socket initialization error:', error);
      throw error;
    }
  }

  /**
   * Check if the socket is connected
   * @returns {boolean} - Socket connection status
   */
  isConnected() {
    return this.socket && this.connected;
  }

  /**
   * Set up core socket event handlers
   */
  _setupSocketHandlers() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('Socket connected successfully');
      this.connected = true;
      this.connectionAttempts = 0;
      this._startHeartbeat();
      this._processPendingMessages();

      // Notify listeners
      this._notifyEventHandlers('socketConnected', {
        userId: this.userId,
        socketId: this.socket.id,
      });
    });

    // Connection error handling
    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.connected = false;
      this.connectionAttempts++;

      if (this.connectionAttempts >= this.maxReconnectAttempts) {
        this._notifyEventHandlers('socketConnectionFailed', {
          error: error.message,
          attempts: this.connectionAttempts,
        });

        // Show error toast only after multiple failed attempts
        if (this.connectionAttempts === this.maxReconnectAttempts) {
          toast.error('Failed to connect to the chat server. Please check your internet connection.');
        }
      }
    });

    // Disconnection events
    this.socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${reason}`);
      this.connected = false;
      this._stopHeartbeat();

      // Notify listeners
      this._notifyEventHandlers('socketDisconnected', { reason });

      // Auto reconnect if not intentional
      if (reason === 'io server disconnect' || reason === 'transport close') {
        this.reconnect();
      }
    });

    // Reconnection events
    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`Socket reconnected after ${attemptNumber} attempts`);
      this.connected = true;
      this.reconnecting = false;

      // Notify listeners
      this._notifyEventHandlers('socketReconnected', {
        userId: this.userId,
        attempts: attemptNumber,
      });
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Socket reconnect attempt ${attemptNumber}`);
      this.reconnecting = true;
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
      this.reconnecting = false;

      toast.error('Failed to reconnect to the chat server. Please reload the page.');

      // Notify listeners
      this._notifyEventHandlers('socketReconnectFailed', {
        userId: this.userId,
      });
    });

    // Server acknowledgment
    this.socket.on('welcome', (data) => {
      console.log('Socket welcome message received:', data);
    });

    // Heartbeat events
    this.socket.on('pong', () => {
      this.lastPong = Date.now();
    });

    // Error event
    this.socket.on('error', (error) => {
      console.error('Socket server error:', error);
      toast.error(`Server error: ${error.message || 'Unknown error'}`);
    });

    // Authentication error
    this.socket.on('auth_error', (error) => {
      console.error('Socket authentication error:', error);
      toast.error('Authentication failed. Please log in again.');

      // Trigger authentication event to log out
      window.dispatchEvent(new CustomEvent('authLogout'));
    });

    // WebRTC signaling events
    this.socket.on('videoSignal', (data) => {
      this._notifyEventHandlers('videoSignal', data);
    });

    this.socket.on('videoHangup', (data) => {
      this._notifyEventHandlers('videoHangup', data);
    });

    this.socket.on('videoError', (data) => {
      this._notifyEventHandlers('videoError', data);
    });

    this.socket.on('videoMediaControl', (data) => {
      this._notifyEventHandlers('videoMediaControl', data);
    });

    this.socket.on('incomingCall', (data) => {
      this._notifyEventHandlers('incomingCall', data);
    });

    // Chat events
    this.socket.on('messageReceived', (data) => {
      this._notifyEventHandlers('messageReceived', data);
    });

    this.socket.on('messageSent', (data) => {
      this._notifyEventHandlers('messageSent', data);
    });

    this.socket.on('messageError', (data) => {
      this._notifyEventHandlers('messageError', data);
    });

    this.socket.on('userTyping', (data) => {
      this._notifyEventHandlers('userTyping', data);
    });
  }

  /**
   * Start heartbeat to monitor connection
   */
  _startHeartbeat() {
    this._stopHeartbeat();
    this.lastPong = Date.now();

    // Send ping every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.connected) {
        this.socket.emit('ping');

        // Check if we've received a pong in the last 60 seconds
        const now = Date.now();
        if (this.lastPong && now - this.lastPong > 60000) {
          console.warn('No heartbeat response in 60 seconds, reconnecting...');
          this.reconnect();
        }
      }
    }, 30000);
  }

  /**
   * Stop heartbeat interval
   */
  _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Process any pending messages
   */
  _processPendingMessages() {
    if (!this.connected || this.pendingMessages.length === 0) return;

    console.log(`Processing ${this.pendingMessages.length} pending messages`);

    // Process all pending messages
    const messages = [...this.pendingMessages];
    this.pendingMessages = [];

    messages.forEach(msg => {
      this.emit(msg.event, msg.data);
    });
  }

  /**
   * Register an event handler
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   * @returns {Function} - Unsubscribe function
   */
  on(event, callback) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }

    this.eventHandlers[event].push(callback);

    // Also register with socket if already connected
    if (this.socket) {
      this.socket.on(event, callback);
    }

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Remove an event handler
   * @param {string} event - Event name
   * @param {Function} callback - Event callback to remove
   */
  off(event, callback) {
    // Remove from socket
    if (this.socket) {
      this.socket.off(event, callback);
    }

    // Remove from local handlers
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event]
        .filter(handler => handler !== callback);

      if (this.eventHandlers[event].length === 0) {
        delete this.eventHandlers[event];
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
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
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
      console.warn(`Socket not initialized, cannot emit '${event}'`);
      return false;
    }

    if (!this.connected) {
      console.log(`Socket not connected, queueing '${event}'`);
      this.pendingMessages.push({ event, data });
      return true;
    }

    try {
      this.socket.emit(event, data);
      return true;
    } catch (error) {
      console.error(`Error emitting '${event}':`, error);
      return false;
    }
  }

  /**
   * Force reconnection
   */
  reconnect() {
    if (this.reconnecting) return;

    console.log('Forcing socket reconnection...');
    this.reconnecting = true;

    // Close existing connection
    if (this.socket) {
      try {
        this.socket.close();
      } catch (error) {
        console.error('Error closing socket:', error);
      }
    }

    // Stop heartbeat
    this._stopHeartbeat();

    // Reconnect if we have userId
    if (this.userId) {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (token) {
        setTimeout(() => {
          this.init(this.userId, token);
        }, 1000);
      } else {
        console.error('Cannot reconnect: No authentication token found');
        this.reconnecting = false;
      }
    } else {
      console.error('Cannot reconnect: No user ID');
      this.reconnecting = false;
    }
  }

  /**
   * Disconnect the socket
   */
  disconnect() {
    console.log('Disconnecting socket');

    this._stopHeartbeat();

    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch (error) {
        console.error('Error disconnecting socket:', error);
      }
      this.socket = null;
    }

    this.connected = false;
    this.reconnecting = false;
  }

  // ------------------------
  // VideoCall specific methods
  // ------------------------

  /**
   * Send WebRTC signaling data
   * @param {string} recipientId - Recipient user ID
   * @param {Object} signal - WebRTC signal data
   * @param {Object} from - Sender details
   * @returns {boolean} - Success status
   */
  sendVideoSignal(recipientId, signal, from = null) {
    return this.emit('videoSignal', {
      recipientId,
      signal,
      from: from || {
        userId: this.userId,
      },
    });
  }

  /**
   * Notify hangup to remote peer
   * @param {string} recipientId - Recipient user ID
   * @returns {boolean} - Success status
   */
  sendVideoHangup(recipientId) {
    return this.emit('videoHangup', {
      recipientId,
      userId: this.userId,
      timestamp: Date.now(),
    });
  }

  /**
   * Send media control event (mute/unmute)
   * @param {string} recipientId - Recipient user ID
   * @param {string} type - Control type (audio/video)
   * @param {boolean} muted - Muted state
   * @returns {boolean} - Success status
   */
  sendMediaControl(recipientId, type, muted) {
    return this.emit('videoMediaControl', {
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
      if (!this.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const callData = {
        callId: Date.now().toString(),
        recipientId,
        callType: 'video',
      };

      const handleCallInitiated = (response) => {
        this.off('callInitiated', handleCallInitiated);
        this.off('callError', handleCallError);
        resolve(response);
      };

      const handleCallError = (error) => {
        this.off('callInitiated', handleCallInitiated);
        this.off('callError', handleCallError);
        reject(new Error(error.message || 'Failed to initiate call'));
      };

      // Register one-time event handlers
      this.on('callInitiated', handleCallInitiated);
      this.on('callError', handleCallError);

      // Emit the call request
      this.emit('initiateCall', callData);

      // Set a timeout
      setTimeout(() => {
        this.off('callInitiated', handleCallInitiated);
        this.off('callError', handleCallError);

        reject(new Error('Call initiation timed out'));
      }, 15000);
    });
  }

  /**
   * Send a text message
   * @param {string} recipientId - Recipient user ID
   * @param {string} content - Message content
   * @param {string} type - Message type
   * @param {Object} metadata - Additional message metadata
   * @returns {Promise} - Resolves with sent message data
   */
  sendMessage(recipientId, content, type = 'text', metadata = {}) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        const tempMessage = {
          id: `temp-${Date.now()}`,
          recipientId,
          content,
          type,
          metadata,
          pending: true,
          timestamp: new Date(),
        };

        this.pendingMessages.push({
          event: 'sendMessage',
          data: { recipientId, content, type, metadata, tempMessageId: tempMessage.id },
        });

        resolve(tempMessage);
        return;
      }

      const tempMessageId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const handleMessageSent = (data) => {
        if (data.tempMessageId === tempMessageId) {
          this.off('messageSent', handleMessageSent);
          this.off('messageError', handleMessageError);
          resolve(data);
        }
      };

      const handleMessageError = (error) => {
        if (error.tempMessageId === tempMessageId) {
          this.off('messageSent', handleMessageSent);
          this.off('messageError', handleMessageError);
          reject(new Error(error.error || 'Failed to send message'));
        }
      };

      // Register one-time event handlers
      this.on('messageSent', handleMessageSent);
      this.on('messageError', handleMessageError);

      // Emit the message
      this.emit('sendMessage', {
        recipientId,
        content,
        type,
        metadata,
        tempMessageId,
      });

      // Set a timeout
      setTimeout(() => {
        this.off('messageSent', handleMessageSent);
        this.off('messageError', handleMessageError);

        // Return a temporary message if no response
        resolve({
          _id: tempMessageId,
          sender: this.userId,
          recipient: recipientId,
          content,
          type,
          metadata,
          createdAt: new Date().toISOString(),
          read: false,
          status: 'pending',
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
    this.emit('typing', { recipientId });
  }
}

// Create singleton instance
const socketClient = new SocketClient();
export default socketClient;
