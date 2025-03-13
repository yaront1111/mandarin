// src/services/socketService.js
import io from 'socket.io-client';
import { toast } from 'react-toastify';

/**
 * Socket service singleton for managing Socket.IO connections
 */
class SocketService {
  constructor() {
    this.socket = null;
    this.userId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
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
   * Initialize socket connection
   * @param {string} userId - Current user ID
   * @param {string} token - Authentication token
   * @returns {SocketService} - this instance for chaining
   */
  init(userId, token) {
    if (this.socket && this.socket.connected) {
      return this;
    }

    this.userId = userId;

    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

    this.socket = io(socketUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 3000,
      query: { token } // Send token with connection
    });

    // Connect and join user's room
    this.socket.on('connect', () => {
      console.log('Socket connected with ID:', this.socket.id);
      this.reconnectAttempts = 0;
      this.socket.emit('join', { userId });
    });

    // Set up listeners for standard events
    this.socket.on('newMessage', (message) => {
      this.handlers.newMessage.forEach(handler => handler(message));
    });

    this.socket.on('userOnline', (data) => {
      this.handlers.userOnline.forEach(handler => handler(data));
    });

    this.socket.on('userOffline', (data) => {
      this.handlers.userOffline.forEach(handler => handler(data));
    });

    this.socket.on('userTyping', (data) => {
      this.handlers.userTyping.forEach(handler => handler(data));
    });

    this.socket.on('incomingCall', (data) => {
      this.handlers.incomingCall.forEach(handler => handler(data));
    });

    this.socket.on('callAnswered', (data) => {
      this.handlers.callAnswered.forEach(handler => handler(data));
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.handlers.error.forEach(handler => handler(error));
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);

      if (error.message === 'Authentication error') {
        toast.error('Authentication failed. Please log in again.');
        this.disconnect();
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);

      if (reason === 'io server disconnect') {
        // Server disconnected the client, need to reconnect manually
        this.socket.connect();
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`Socket reconnected after ${attemptNumber} attempts`);
      // Re-join room on reconnection
      this.socket.emit('join', { userId });
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      this.reconnectAttempts = attemptNumber;
      console.log(`Socket reconnect attempt ${attemptNumber}/${this.maxReconnectAttempts}`);
    });

    this.socket.on('reconnect_failed', () => {
      console.log('Socket reconnection failed after', this.maxReconnectAttempts, 'attempts');
      toast.error('Connection lost. Please refresh the page.');
    });

    return this;
  }

  /**
   * Check if socket is connected
   * @returns {boolean} - True if socket is connected
   */
  isConnected() {
    return this.socket && this.socket.connected;
  }

  /**
   * Add event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function
   * @returns {Function} - Function to remove the handler
   */
  on(event, handler) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }

    this.handlers[event].push(handler);

    return () => {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    };
  }

  /**
   * Remove event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function
   */
  off(event, handler) {
    if (!this.handlers[event]) {
      return;
    }

    if (handler) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    } else {
      this.handlers[event] = [];
    }
  }

  /**
   * Send a private message
   * @param {string} recipient - Recipient user ID
   * @param {string} type - Message type (text, wink, video)
   * @param {string} content - Message content
   * @returns {Promise<void>} - Promise that resolves when message is acknowledged
   */
  sendMessage(recipient, type, content) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        toast.warning('Connection lost. Attempting to reconnect...');
        this.socket.connect();
        reject(new Error('Socket not connected'));
        return;
      }

      const message = {
        sender: this.userId,
        recipient,
        type,
        content
      };

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
   * Send typing indicator
   * @param {string} recipient - Recipient user ID
   */
  sendTyping(recipient) {
    if (!this.isConnected()) {
      return;
    }

    this.socket.emit('typing', {
      sender: this.userId,
      recipient
    });
  }

  /**
   * Initiate a video call
   * @param {string} recipient - Recipient user ID
   * @returns {Promise<void>} - Promise that resolves when call is initiated
   */
  initiateVideoCall(recipient) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        toast.warning('Connection lost. Please refresh the page.');
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('videoCallRequest', {
        caller: this.userId,
        recipient
      }, (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Answer a video call
   * @param {string} caller - Caller user ID
   * @param {boolean} answer - Accept or decline the call
   * @returns {Promise<void>} - Promise that resolves when answer is sent
   */
  answerVideoCall(caller, answer) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        toast.warning('Connection lost. Please refresh the page.');
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('videoCallAnswer', {
        caller,
        recipient: this.userId,
        answer
      }, (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.userId = null;

      // Clear all handlers
      Object.keys(this.handlers).forEach(event => {
        this.handlers[event] = [];
      });
    }
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
