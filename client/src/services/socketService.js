// client/src/services/socketService.js
import io from 'socket.io-client';
import { toast } from 'react-toastify';

class SocketService {
  constructor() {
    this.socket = null;
    this.userId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.connectionTimeout = null;
    this.wasDisconnected = false;
    this.handlers = {
      newMessage: [],
      userOnline: [],
      userOffline: [],
      userTyping: [],
      incomingCall: [],
      callAnswered: [],
      error: []
    };
  }

  /**
   * Initialize the socket connection.
   * @param {string} userId - Current user ID.
   * @param {string} token - Authentication token.
   * @returns {SocketService} - This instance.
   */
  init(userId, token) {
    if (this.socket && this.socket.connected) {
      return this;
    }

    this.userId = userId;
    const socketUrl = process.env.REACT_APP_SOCKET_URL || window.location.origin;

    // Clear any existing timeout
    if (this.connectionTimeout) clearTimeout(this.connectionTimeout);

    // Set a timeout to detect connection issues
    this.connectionTimeout = setTimeout(() => {
      if (this.socket && !this.socket.connected) {
        console.error('Socket connection timeout');
        toast.error('Could not establish real-time connection. Chat features might be limited.');
      }
    }, 10000);

    // Initialize socket with token passed in the query parameters
    this.socket = io(socketUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 3000,
      query: { token }
    });

    // When connected, join the user's room
    this.socket.on('connect', () => {
      console.log('Socket connected with ID:', this.socket.id);
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
      this.reconnectAttempts = 0;
      this.socket.emit('join', { userId });
      if (this.wasDisconnected) {
        toast.success('Real-time connection restored');
        this.wasDisconnected = false;
      }
    });

    // Standard event listeners
    this.socket.on('newMessage', (message) => {
      this.handlers.newMessage.forEach((handler) => handler(message));
    });

    this.socket.on('userOnline', (data) => {
      this.handlers.userOnline.forEach((handler) => handler(data));
    });

    this.socket.on('userOffline', (data) => {
      this.handlers.userOffline.forEach((handler) => handler(data));
    });

    this.socket.on('userTyping', (data) => {
      this.handlers.userTyping.forEach((handler) => handler(data));
    });

    this.socket.on('incomingCall', (data) => {
      this.handlers.incomingCall.forEach((handler) => handler(data));
    });

    this.socket.on('callAnswered', (data) => {
      this.handlers.callAnswered.forEach((handler) => handler(data));
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.handlers.error.forEach((handler) => handler(error));
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      if (error.message === 'Authentication error') {
        toast.error('Authentication failed. Please log in again.');
        this.disconnect();
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.wasDisconnected = true;
      if (reason === 'io server disconnect') {
        // Manually attempt to reconnect if the server disconnects you
        setTimeout(() => {
          this.socket.connect();
        }, 1000);
      }
      toast.warn('Real-time connection lost. Attempting to reconnect...');
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`Socket reconnected after ${attemptNumber} attempts`);
      this.socket.emit('join', { userId });
      toast.success('Real-time connection restored');
      this.wasDisconnected = false;
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      this.reconnectAttempts = attemptNumber;
      console.log(`Reconnect attempt ${attemptNumber}/${this.maxReconnectAttempts}`);
    });

    this.socket.on('reconnect_failed', () => {
      console.log('Socket reconnection failed after', this.maxReconnectAttempts, 'attempts');
      toast.error('Connection lost. Please refresh the page.');
    });

    return this;
  }

  /**
   * Check if the socket is currently connected.
   * @returns {boolean} - True if connected.
   */
  isConnected() {
    return this.socket && this.socket.connected;
  }

  /**
   * Register an event handler.
   * @param {string} event - Event name.
   * @param {Function} handler - Handler function.
   * @returns {Function} - Unsubscribe function.
   */
  on(event, handler) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(handler);
    return () => {
      this.handlers[event] = this.handlers[event].filter((h) => h !== handler);
    };
  }

  /**
   * Remove an event handler.
   * @param {string} event - Event name.
   * @param {Function} handler - Handler function.
   */
  off(event, handler) {
    if (!this.handlers[event]) return;
    if (handler) {
      this.handlers[event] = this.handlers[event].filter((h) => h !== handler);
    } else {
      this.handlers[event] = [];
    }
  }

  /**
   * Send a private message.
   * @param {string} recipient - Recipient user ID.
   * @param {string} type - Message type (e.g., 'text', 'wink', 'video').
   * @param {string} content - Message content.
   * @returns {Promise} - Resolves when message is acknowledged.
   */
  sendMessage(recipient, type, content) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        this.socket.connect();
        toast.warning('Connection lost. Attempting to reconnect...');
        reject(new Error('Socket not connected'));
        return;
      }
      const message = { sender: this.userId, recipient, type, content };
      this.socket.emit('privateMessage', message, (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Send a typing indicator to a recipient.
   * @param {string} recipient - Recipient user ID.
   */
  sendTyping(recipient) {
    if (!this.isConnected()) {
      this.socket.connect();
      return;
    }
    this.socket.emit('typing', { sender: this.userId, recipient });
  }

  /**
   * Initiate a video call.
   * @param {string} recipient - Recipient user ID.
   * @returns {Promise} - Resolves when call is initiated.
   */
  initiateVideoCall(recipient) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        toast.warning('Connection lost. Please refresh the page.');
        reject(new Error('Socket not connected'));
        return;
      }
      this.socket.emit('videoCallRequest', { caller: this.userId, recipient }, (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Answer a video call.
   * @param {string} caller - Caller user ID.
   * @param {boolean} answer - Accept or decline the call.
   * @returns {Promise} - Resolves when the answer is sent.
   */
  answerVideoCall(caller, answer) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        toast.warning('Connection lost. Please refresh the page.');
        reject(new Error('Socket not connected'));
        return;
      }
      this.socket.emit('videoCallAnswer', { caller, recipient: this.userId, answer }, (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Manually reconnect the socket with a new token.
   * @param {string} token - Authentication token.
   * @returns {boolean} - True if reconnection was attempted.
   */
  reconnect(token) {
    if (!this.userId) {
      console.error('Cannot reconnect: no user ID');
      return false;
    }
    if (this.socket) {
      this.socket.io.opts.query = { token };
      this.socket.connect();
      return true;
    }
    return false;
  }

  /**
   * Disconnect the socket and clean up handlers.
   */
  disconnect() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.userId = null;
      Object.keys(this.handlers).forEach((event) => {
        this.handlers[event] = [];
      });
    }
  }
}

// Create a singleton instance of SocketService
const socketService = new SocketService();
export default socketService;
