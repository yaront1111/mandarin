// client/src/services/ChatService.js
/**
 * Centralized service for chat functionality
 * Integrates socket events, HTTP API, and storage in one place
 */
import socketService from './socketService.jsx';
import apiService from './apiService.jsx';
import { logger } from '../utils';

// Create a logger for this service
const log = logger.create('ChatService');

class ChatService {
  constructor() {
    this.initialized = false;
    this.user = null;
    this.activeChats = new Map(); // Track active conversations
    this.eventListeners = new Map(); // Custom event listeners
    this.pendingMessages = []; // Messages waiting to be sent
    this.messageCache = new Map(); // Cache messages by conversationId
  }

  /**
   * Initialize the chat service with user data
   * @param {Object} user - Current user information
   */
  initialize(user) {
    if (this.initialized && this.user?._id === user?._id) {
      log.debug('Chat service already initialized for this user');
      return;
    }

    log.info(`Initializing chat service for user: ${user?.nickname || user?._id}`);
    this.user = user;
    this.initialized = true;

    // Initialize socket service if needed
    if (!socketService.isConnected() && user) {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (token && user._id) {
        socketService.init(user._id, token);
      }
    }

    // Listen for relevant socket events
    this._setupSocketListeners();
  }

  /**
   * Set up socket event listeners
   * @private
   */
  _setupSocketListeners() {
    // Clean up any existing listeners
    this._cleanupSocketListeners();

    // Track our registered listeners for later cleanup
    this.socketListeners = [];

    // New message received
    const messageListener = socketService.on('messageReceived', (message) => {
      log.debug(`New message received from ${message.sender}`);
      
      // Update cache
      const conversationId = message.sender === this.user?._id ? message.recipient : message.sender;
      this._updateMessageCache(conversationId, message);
      
      // Notify listeners
      this._notifyEventListeners('messageReceived', message);
    });
    this.socketListeners.push(messageListener);

    // Message sent confirmation
    const sentListener = socketService.on('messageSent', (message) => {
      log.debug(`Message sent confirmation received for ${message._id}`);
      
      // Update cache
      const conversationId = message.recipient;
      this._updateMessageCache(conversationId, message);
      
      // Notify listeners
      this._notifyEventListeners('messageSent', message);
    });
    this.socketListeners.push(sentListener);

    // Typing indicators
    const typingListener = socketService.on('userTyping', (data) => {
      this._notifyEventListeners('userTyping', data);
    });
    this.socketListeners.push(typingListener);

    // Connection status changes
    const connectListener = socketService.on('connect', () => {
      log.info('Socket connected, processing pending messages');
      this._processPendingMessages();
      this._notifyEventListeners('connectionChanged', { connected: true });
    });
    this.socketListeners.push(connectListener);

    const disconnectListener = socketService.on('disconnect', () => {
      this._notifyEventListeners('connectionChanged', { connected: false });
    });
    this.socketListeners.push(disconnectListener);
  }

  /**
   * Clean up socket listeners
   * @private
   */
  _cleanupSocketListeners() {
    if (this.socketListeners) {
      this.socketListeners.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      this.socketListeners = [];
    }
  }

  /**
   * Update the message cache for a conversation
   * @param {string} conversationId - ID of the conversation
   * @param {Object} message - New message to add
   * @private
   */
  _updateMessageCache(conversationId, message) {
    if (!conversationId || !message) return;
    
    // Get or create message array for this conversation
    const messages = this.messageCache.get(conversationId) || [];
    
    // Check if message already exists
    const existingIndex = messages.findIndex(m => m._id === message._id);
    
    if (existingIndex >= 0) {
      // Update existing message
      messages[existingIndex] = { ...messages[existingIndex], ...message };
    } else {
      // Add new message at the beginning (newer messages first)
      messages.unshift(message);
    }
    
    // Re-sort messages by date
    messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Update cache
    this.messageCache.set(conversationId, messages);
  }

  /**
   * Get messages for a conversation
   * @param {string} recipientId - ID of the other user
   * @param {number} page - Page number (pagination)
   * @param {number} limit - Number of messages per page
   * @returns {Promise<Array>} - Array of messages
   */
  async getMessages(recipientId, page = 1, limit = 20) {
    if (!this.initialized || !this.user?._id) {
      log.warn('Attempted to get messages without initialization');
      return [];
    }

    // Try to get from cache first as fallback
    const cachedMessages = this.messageCache.get(recipientId);

    // Create a promise with timeout
    const fetchWithTimeout = (timeoutMs = 8000) => {
      return Promise.race([
        apiService.get(`/messages/${recipientId}`, {
          page,
          limit
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timed out')), timeoutMs)
        )
      ]);
    };

    try {
      log.debug(`Fetching messages with ${recipientId}, page ${page}`);
      
      // Always fetch from server to ensure we have the latest
      const response = await fetchWithTimeout();
      
      if (!response || !response.success) {
        const errorMsg = response?.error || 'Failed to load messages';
        log.error(`API returned error: ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      // Guard against null or undefined response data
      const messages = Array.isArray(response.data) ? response.data : [];
      log.debug(`Loaded ${messages.length} messages from server`);
      
      // Return empty array instead of null/undefined if no messages
      if (messages.length === 0) {
        log.debug('No messages found for this conversation');
      }
      
      // Update cache with server data
      this.messageCache.set(recipientId, messages);
      
      return messages;
    } catch (err) {
      log.error(`Error fetching messages with ${recipientId}:`, err);
      
      // If we have cached messages, return those as fallback
      if (cachedMessages && cachedMessages.length > 0) {
        log.debug(`Returning ${cachedMessages.length} cached messages as fallback`);
        return cachedMessages;
      } else {
        // Return empty array instead of throwing
        log.debug('No cached messages available, returning empty array');
        return [];
      }
    }
  }

  /**
   * Send a message to another user
   * @param {string} recipientId - ID of the recipient
   * @param {string} content - Message content
   * @param {string} type - Message type (text, file, wink, etc)
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} - The sent message
   */
  async sendMessage(recipientId, content, type = 'text', metadata = null) {
    if (!this.initialized || !this.user?._id) {
      log.warn('Attempted to send message without initialization');
      throw new Error('Chat service not initialized');
    }

    if (!recipientId) {
      throw new Error('Recipient ID is required');
    }

    log.debug(`Sending ${type} message to ${recipientId}`);

    try {
      // Create a temporary message object for optimistic UI updates
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const tempMessage = {
        _id: tempId,
        sender: this.user._id,
        recipient: recipientId,
        content,
        type,
        metadata: metadata || {},
        createdAt: new Date().toISOString(),
        read: false,
        status: 'sending',
        pending: true,
        tempId
      };
      
      // Add to cache immediately for optimistic UI update
      this._updateMessageCache(recipientId, tempMessage);
      
      // Try socket first if connected
      if (socketService.isConnected()) {
        return new Promise((resolve, reject) => {
          socketService.emit('sendMessage', {
            recipient: recipientId,
            content,
            type,
            metadata,
            tempMessageId: tempId
          });
          
          // Listen for confirmation
          const messageListener = socketService.on('messageSent', (message) => {
            if (message.tempMessageId === tempId) {
              messageListener(); // Unsubscribe
              resolve(message);
              
              // Update cache with confirmed message
              this._updateMessageCache(recipientId, {
                ...message,
                pending: false,
                status: 'sent'
              });
            }
          });
          
          // Listen for errors
          const errorListener = socketService.on('messageError', (error) => {
            if (error.tempMessageId === tempId) {
              errorListener(); // Unsubscribe
              messageListener(); // Unsubscribe
              
              // Update cache to show error state
              this._updateMessageCache(recipientId, {
                ...tempMessage,
                status: 'error',
                error: error.message
              });
              
              reject(new Error(error.message || 'Failed to send message'));
            }
          });
          
          // Set timeout for socket response
          setTimeout(() => {
            // If no response after 5 seconds, fall back to API
            sendViaApi().then(resolve).catch(reject);
          }, 5000);
        });
      } else {
        // Socket not connected, queue for later and use API
        this._queuePendingMessage({
          recipient: recipientId,
          content,
          type,
          metadata,
          tempMessageId: tempId
        });
        return this._sendViaApi(recipientId, content, type, metadata, tempId);
      }
    } catch (err) {
      log.error(`Error sending message:`, err);
      throw err;
    }
  }

  /**
   * Send a message via API (fallback method)
   * @param {string} recipientId - Message recipient
   * @param {string} content - Message content
   * @param {string} type - Message type
   * @param {Object} metadata - Message metadata
   * @param {string} tempId - Temporary message ID
   * @returns {Promise<Object>} - The sent message
   * @private
   */
  async _sendViaApi(recipientId, content, type, metadata, tempId) {
    try {
      log.debug(`Sending message via API fallback`);
      
      const response = await apiService.post('/messages', {
        recipient: recipientId,
        content,
        type,
        metadata
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to send message');
      }
      
      const message = response.data;
      
      // Update cache
      this._updateMessageCache(recipientId, {
        ...message,
        tempMessageId: tempId,
        pending: false,
        status: 'sent'
      });
      
      return message;
    } catch (err) {
      // Update cache with error state
      this._updateMessageCache(recipientId, {
        _id: tempId,
        sender: this.user._id,
        recipient: recipientId,
        content,
        type,
        metadata: metadata || {},
        createdAt: new Date().toISOString(),
        status: 'error',
        error: err.message,
        pending: false
      });
      
      throw err;
    }
  }

  /**
   * Queue a message for later sending
   * @param {Object} messageData - Message data
   * @private
   */
  _queuePendingMessage(messageData) {
    this.pendingMessages.push({
      ...messageData,
      timestamp: Date.now()
    });
    log.debug(`Queued message to ${messageData.recipient} for later sending`);
  }

  /**
   * Process any pending messages
   * @private
   */
  _processPendingMessages() {
    if (this.pendingMessages.length === 0) return;
    
    log.info(`Processing ${this.pendingMessages.length} pending messages`);
    
    // Clone the array to avoid mutation issues
    const messages = [...this.pendingMessages];
    this.pendingMessages = [];
    
    // Process each message
    messages.forEach(msg => {
      // Skip messages older than 10 minutes
      const isTooOld = Date.now() - msg.timestamp > 600000;
      if (isTooOld) {
        log.debug(`Skipping stale message to ${msg.recipient}`);
        return;
      }
      
      // Send via socket
      socketService.emit('sendMessage', msg);
    });
  }

  /**
   * Mark a conversation as read
   * @param {string} conversationId - ID of the conversation (user ID)
   * @returns {Promise<Object>} - API response
   */
  async markConversationRead(conversationId) {
    if (!this.initialized || !this.user?._id || !conversationId) {
      return null;
    }
    
    try {
      log.debug(`Marking conversation with ${conversationId} as read`);
      
      const response = await apiService.put(`/messages/conversation/${conversationId}/read`);
      
      // Update cache to mark messages as read
      const messages = this.messageCache.get(conversationId) || [];
      const updatedMessages = messages.map(msg => {
        if (msg.sender === conversationId && !msg.read) {
          return { ...msg, read: true, readAt: new Date().toISOString() };
        }
        return msg;
      });
      
      this.messageCache.set(conversationId, updatedMessages);
      
      return response;
    } catch (err) {
      log.error(`Error marking conversation as read:`, err);
      return null;
    }
  }

  /**
   * Get all conversations for current user
   * @returns {Promise<Array>} - Array of conversations
   */
  async getConversations() {
    if (!this.initialized || !this.user?._id) {
      log.warn('Attempted to get conversations without initialization');
      return [];
    }
    
    // Create a promise with timeout
    const fetchWithTimeout = (timeoutMs = 8000) => {
      return Promise.race([
        apiService.get('/messages/conversations'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timed out')), timeoutMs)
        )
      ]);
    };
    
    try {
      log.debug('Fetching conversations list');
      
      const response = await fetchWithTimeout();
      
      if (!response || !response.success) {
        const error = response?.error || 'Failed to load conversations';
        log.error(`API error loading conversations: ${error}`);
        return []; // Return empty array instead of throwing
      }
      
      // Guard against null or undefined response data
      const conversations = Array.isArray(response.data) ? response.data : [];
      log.debug(`Loaded ${conversations.length} conversations`);
      
      return conversations;
    } catch (err) {
      log.error('Error fetching conversations:', err);
      // Don't throw, return empty array to gracefully handle errors
      return [];
    }
  }

  /**
   * Send typing indicator
   * @param {string} recipientId - ID of the recipient
   */
  sendTypingIndicator(recipientId) {
    if (!this.initialized || !socketService.isConnected() || !recipientId) {
      return false;
    }
    
    socketService.emit('typing', { recipientId });
    return true;
  }

  /**
   * Register an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   * @returns {Function} - Unsubscribe function
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    const listeners = this.eventListeners.get(event);
    listeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      const currentListeners = this.eventListeners.get(event);
      if (currentListeners) {
        currentListeners.delete(callback);
      }
    };
  }

  /**
   * Notify all event listeners
   * @param {string} event - Event name
   * @param {any} data - Event data
   * @private
   */
  _notifyEventListeners(event, data) {
    if (!this.eventListeners.has(event)) return;
    
    this.eventListeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        log.error(`Error in ${event} event listener:`, err);
      }
    });
  }

  /**
   * Check if chat service is ready to use
   * @returns {boolean} - Ready status
   */
  isReady() {
    return this.initialized && !!this.user?._id;
  }

  /**
   * Check if socket is connected
   * @returns {boolean} - Socket connection status
   */
  isConnected() {
    return socketService.isConnected();
  }

  /**
   * Clean up the chat service
   */
  cleanup() {
    this._cleanupSocketListeners();
    this.eventListeners.clear();
    this.messageCache.clear();
    this.pendingMessages = [];
    this.initialized = false;
    this.user = null;
    
    log.debug('Chat service cleaned up');
  }
}

// Create singleton instance
const chatService = new ChatService();
export default chatService;