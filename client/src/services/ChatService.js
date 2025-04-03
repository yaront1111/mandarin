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
    this._processedMessages = new Set(); // Track recently processed messages to prevent duplicates
    this.socketListeners = []; // Track socket listeners for cleanup
    this.initPromise = null; // Promise tracking the initialization process
    this.conversationsCache = null; // Cache for conversations
    this.lastConversationsFetchTime = 0; // Timestamp of last conversations fetch
  }

  /**
   * Initialize the chat service with user data
   * @param {Object} user - Current user information
   */
  initialize(user) {
    console.log('ChatService.initialize called with user:', user);

    // If already initializing, return the existing promise
    if (this.initPromise) {
      console.log('Initialization already in progress, returning existing promise');
      return this.initPromise;
    }

    // If already initialized with the same user, return resolved promise
    if (this.initialized && this.user?._id === user?._id) {
      log.debug('Chat service already initialized for this user');
      console.log('Chat service already initialized for user:', user?._id);
      return Promise.resolve(true);
    }

    // Validate the user object and ID
    if (!user) {
      const error = new Error('Cannot initialize chat service without user data');
      log.error(error.message);
      console.error(error.message);
      return Promise.reject(error);
    }

    // Create the initialization promise
    this.initPromise = new Promise((resolve, reject) => {
      try {
        // Simple validation function
        const isValidId = (id) => id && /^[0-9a-fA-F]{24}$/.test(id.toString());

        // Determine a valid user ID
        let validUserId = null;

        // Check user._id first
        if (user._id) {
          if (typeof user._id === 'string' && isValidId(user._id)) {
            validUserId = user._id;
          } else if (typeof user._id === 'object' && user._id !== null) {
            try {
              const idString = user._id.toString();
              const match = idString.match(/([0-9a-fA-F]{24})/);
              if (match && match[1]) {
                validUserId = match[1];
                log.debug(`Extracted ObjectId from complex object: ${validUserId}`);
              }
            } catch (err) {
              log.error(`Failed to extract valid ID from object: ${err.message}`);
            }
          }
        }

        // If no valid ID from user._id, try user.id
        if (!validUserId && user.id) {
          if (isValidId(user.id)) {
            validUserId = user.id;
            log.debug(`Using user.id instead of user._id: ${validUserId}`);
          }
        }

        // If still no valid ID, try token
        if (!validUserId) {
          log.warn(`User has invalid ID: ${user._id}, trying token-based ID`);

          try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (token) {
              const base64Url = token.split(".")[1];
              const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
              const payload = JSON.parse(atob(base64));

              const tokenId = payload.id || payload.sub ||
                             (payload.user && (payload.user._id || payload.user.id));

              if (tokenId && isValidId(tokenId)) {
                validUserId = tokenId;
                log.info(`Using ID from token payload: ${validUserId}`);
              }
            }
          } catch (tokenErr) {
            log.error(`Failed to extract ID from token: ${tokenErr.message}`);
          }
        }

        // If still no valid ID, reject
        if (!validUserId) {
          const error = new Error('Cannot initialize chat service: no valid user ID available');
          log.error(error.message);
          this.initPromise = null;
          reject(error);
          return;
        }

        // Create a user object with the valid ID
        const validatedUser = {
          ...user,
          _id: validUserId,
          id: validUserId // Ensure both _id and id are set
        };

        log.info(`Initializing chat service for user: ${validatedUser.nickname || validatedUser._id}`);
        console.log(`Initializing chat service for user ID: ${validatedUser._id}`);

        // Set the validated user object
        this.user = validatedUser;

        // Initialize socket if needed
        if (!socketService.isConnected() && validUserId) {
          const token = localStorage.getItem('token') || sessionStorage.getItem('token');
          if (token) {
            log.debug(`Initializing socket with validated user ID: ${validUserId}`);
            console.log(`Initializing socket with validated user ID: ${validUserId}`);

            try {
              socketService.init(validUserId, token);

              // Add a small delay to allow socket to connect
              setTimeout(() => {
                // Set up socket listeners
                this._setupSocketListeners();

                // Mark as initialized even if socket connection fails
                this.initialized = true;
                log.info('Chat service initialized successfully');

                // Clear the initialization promise
                const temp = this.initPromise;
                this.initPromise = null;

                // Resolve the promise
                resolve(true);
              }, 500);
            } catch (socketError) {
              log.error('Socket initialization error:', socketError);

              // Still consider service initialized for API fallbacks
              this.initialized = true;

              // Clear the initialization promise
              const temp = this.initPromise;
              this.initPromise = null;

              // Resolve but warn about socket issues
              log.warn('Chat service initialized without socket connection');
              resolve(true);
            }
          } else {
            // No token available, but still mark as initialized for API fallbacks
            this.initialized = true;
            log.warn('Chat service initialized without socket (no token available)');

            // Clear the initialization promise
            const temp = this.initPromise;
            this.initPromise = null;

            resolve(true);
          }
        } else {
          // Socket already connected or not needed
          // Set up socket listeners if connected
          if (socketService.isConnected()) {
            this._setupSocketListeners();
          }

          // Mark as initialized
          this.initialized = true;
          log.info('Chat service initialized successfully');

          // Clear the initialization promise
          const temp = this.initPromise;
          this.initPromise = null;

          resolve(true);
        }
      } catch (error) {
        log.error('Error during chat service initialization:', error);

        // Clear the initialization promise
        const temp = this.initPromise;
        this.initPromise = null;

        reject(error);
      }
    });

    // Add timeout to prevent hanging initialization
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        if (this.initPromise) {
          log.warn('Chat service initialization timed out, forcing resolution');

          // Force initialization to true to allow fallbacks
          this.initialized = true;

          // Clear the initialization promise
          const temp = this.initPromise;
          this.initPromise = null;

          reject(new Error('Chat service initialization timed out'));
        }
      }, 5000); // 5 second timeout
    });

    // Return the promise that resolves first
    return Promise.race([this.initPromise, timeoutPromise])
      .catch(err => {
        // On any error, still mark as initialized to allow API fallbacks
        log.warn(`Initialization error handled, enabling fallbacks: ${err.message}`);
        this.initialized = true;
        return true; // Always resolve to prevent blocking
      });
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
    if (this.socketListeners && this.socketListeners.length > 0) {
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

    log.debug(`Updating message cache for ${conversationId} with message ${message._id || 'unknown'}`);

    // Get or create message array for this conversation
    const messages = this.messageCache.get(conversationId) || [];

    // First check if we're updating a temp message (using tempMessageId or tempId)
    const tempId = message.tempMessageId || message.tempId;
    if (tempId) {
      const tempIndex = messages.findIndex(m =>
        m.tempId === tempId ||
        m.tempMessageId === tempId ||
        m._id === tempId
      );

      if (tempIndex >= 0) {
        log.debug(`Found temp message to update at index ${tempIndex}`);
        // Replace temp message with server message, but keep temp ID for reference
        messages[tempIndex] = {
          ...message,
          tempId: tempId // Keep reference to temp ID
        };

        // Do not trigger messageReceived event here as it causes duplication
        // Instead, use the messageUpdated event
        this._notifyEventListeners('messageUpdated', messages[tempIndex]);

        // Re-sort, update cache and return early
        messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        this.messageCache.set(conversationId, messages);
        return;
      }
    }

    // If not a temp message, check for standard message ID match
    const existingIndex = messages.findIndex(m => m._id === message._id);

    if (existingIndex >= 0) {
      // Update existing message
      log.debug(`Updating existing message at index ${existingIndex}`);
      messages[existingIndex] = { ...messages[existingIndex], ...message };

      // Trigger update event
      this._notifyEventListeners('messageUpdated', messages[existingIndex]);
    } else {
      // Check for a nearly identical message (same content sent in the last 5 seconds)
      // This helps prevent double/triple sends
      const now = new Date();
      const nearDuplicates = messages.filter(m =>
        m.content === message.content &&
        m.sender === message.sender &&
        m.recipient === message.recipient &&
        Math.abs(new Date(m.createdAt) - new Date(message.createdAt)) < 5000 // Within 5 seconds
      );

      if (nearDuplicates.length > 0) {
        log.debug(`Skipping near-duplicate message in cache for ${conversationId}`);
      } else {
        // Add new message at the beginning (newer messages first)
        log.debug(`Adding new message to cache for ${conversationId}`);
        messages.unshift(message);

        // Trigger new message event
        this._notifyEventListeners('messageReceived', message);
      }
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
    // Debug information to track initialization issues
    log.info(`getMessages called with recipientId: ${recipientId}, initialized: ${this.initialized}, user: ${this.user?._id}`);
    console.log(`ChatService.getMessages called with recipientId: ${recipientId}, page: ${page}, limit: ${limit}`);
    console.log(`ChatService state: initialized=${this.initialized}, user ID=${this.user?._id}`);

    // Auto-initialization if needed
    if (!this.initialized || !this.user?._id) {
      log.warn('Attempted to get messages without initialization, attempting auto-initialization');
      console.warn('ChatService not initialized or missing user ID, trying to auto-initialize');

      try {
        // Try to auto-initialize with user info from token
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (token) {
          try {
            // Extract user ID from token
            const base64Url = token.split(".")[1];
            const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
            const payload = JSON.parse(atob(base64));

            const userId = payload.id || payload.sub ||
                         (payload.user && (payload.user._id || payload.user.id));

            if (userId) {
              log.info(`Auto-initializing chat service with user ID from token: ${userId}`);

              // Create a minimal user object and initialize
              const minimalUser = { _id: userId, id: userId };
              await this.initialize(minimalUser);

              if (this.initialized) {
                log.info('Auto-initialization successful, proceeding with message fetch');
              } else {
                log.error('Auto-initialization failed');
                return [];
              }
            } else {
              log.error('No valid user ID in token, cannot auto-initialize');
              return [];
            }
          } catch (err) {
            log.error(`Auto-initialization failed: ${err.message}`);
            return [];
          }
        } else {
          log.error('No token available for auto-initialization');
          return [];
        }
      } catch (err) {
        log.error(`Error during auto-initialization: ${err.message}`);
        return [];
      }
    }

    // Validate recipient ID
    if (!recipientId) {
      log.error('No recipient ID provided for getMessages');
      console.error('No recipient ID provided for ChatService.getMessages');
      return [];
    }

    // Try to get from cache first as fallback
    const cachedMessages = this.messageCache.get(recipientId);
    if (cachedMessages && cachedMessages.length > 0) {
      console.log(`Found ${cachedMessages.length} cached messages for ${recipientId}`);
    } else {
      console.log(`No cached messages found for ${recipientId}`);
    }

    try {
      log.debug(`Fetching messages with ${recipientId}, page ${page}`);
      console.log(`Fetching messages from API for ${recipientId}, page ${page}`);

      // Create a promise with timeout
      const fetchWithTimeout = async (timeoutMs = 8000) => {
        let timeoutId;

        try {
          const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
          });

          const response = await Promise.race([
            apiService.get(`/messages/${recipientId}`, {
              page,
              limit,
              _t: Date.now(),
              _c: Math.random().toString(36).substring(2, 8)
            }),
            timeoutPromise
          ]);

          clearTimeout(timeoutId);
          return response;
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      };

      // Always fetch from server to ensure we have the latest
      console.log('About to call API with fetchWithTimeout');
      const response = await fetchWithTimeout();
      console.log('API response received:', response);

      // If we have a response object but it's empty or has no data property, convert to empty array
      if (response && (!response.data || response.data.length === 0)) {
        log.debug('Response received but no messages found');
        console.log('Response received but no messages found or empty data array');
        // Update cache with empty array
        this.messageCache.set(recipientId, []);
        return [];
      }

      if (!response || !response.success) {
        const errorMsg = response?.error || 'Failed to load messages';
        log.error(`API returned error: ${errorMsg}`);
        console.error(`API returned error: ${errorMsg}`, response);

        // Use cached messages if available instead of throwing
        if (cachedMessages && cachedMessages.length > 0) {
          log.debug(`Using ${cachedMessages.length} cached messages due to API error`);
          console.log(`Using ${cachedMessages.length} cached messages due to API error`);
          return cachedMessages;
        }

        console.error('No cached messages available and API error occurred');
        throw new Error(errorMsg);
      }

      // Guard against null or undefined response data
      let messages = Array.isArray(response.data) ? response.data : [];
      log.debug(`Loaded ${messages.length} messages from server`);
      console.log(`Loaded ${messages.length} messages from server:`, messages);

      // Fix any message objects that might be missing required fields
      messages = messages.map(msg => {
        // Ensure each message has all required fields
        if (!msg._id) msg._id = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        if (!msg.createdAt) msg.createdAt = new Date().toISOString();
        if (msg.type === 'text' && !msg.content) msg.content = '';
        return msg;
      });

      // Update cache with server data
      this.messageCache.set(recipientId, messages);

      // Debug the final return value
      console.log(`ChatService.getMessages returning ${messages.length} messages`);

      // Ensure we're returning an array
      return Array.isArray(messages) ? messages : [];
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
    console.log(`ChatService.sendMessage called: recipientId=${recipientId}, content="${content}", type="${type}"`);
    console.log(`ChatService state: initialized=${this.initialized}, user ID=${this.user?._id}`);

    if (!this.initialized || !this.user?._id) {
      log.warn('Attempted to send message without initialization');
      console.warn('ChatService not initialized or missing user ID');
      throw new Error('Chat service not initialized');
    }

    if (!recipientId) {
      console.error('No recipient ID provided for sendMessage');
      throw new Error('Recipient ID is required');
    }

    log.debug(`Sending ${type} message to ${recipientId}`);
    console.log(`Sending ${type} message to ${recipientId} with content: "${content}"`);
    console.log('Socket connected:', socketService.isConnected());

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
          // Try first with the most likely event name
          log.debug(`Emitting socket message to ${recipientId} with tempId ${tempId}`);
          console.log(`Emitting socket message to ${recipientId} with tempId ${tempId}`);

          const emitData = {
            recipientId,
            content,
            type,
            metadata,
            tempMessageId: tempId
          };

          console.log('Socket emit data:', emitData);
          socketService.emit('sendMessage', emitData);
          console.log('Socket message emitted');

          // Setup listeners for both possible response event names
          let messageListener, messageListener2;
          let errorListener, errorListener2;

          // Centralized handler for successful message sending
          const handleSuccess = (message) => {
            log.debug(`Message confirmed sent: ${tempId}`);
            console.log(`Message confirmed sent: ${tempId}`, message);

            // Clean up all listeners and timeouts
            if (messageListener) {
              console.log('Cleaning up messageListener');
              messageListener();
              if (messageListener.cleanup) messageListener.cleanup();
            }
            if (messageListener2) {
              console.log('Cleaning up messageListener2');
              messageListener2();
              if (messageListener2.cleanup) messageListener2.cleanup();
            }
            if (errorListener) {
              console.log('Cleaning up errorListener');
              errorListener();
              if (errorListener.cleanup) errorListener.cleanup();
            }
            if (errorListener2) {
              console.log('Cleaning up errorListener2');
              errorListener2();
              if (errorListener2.cleanup) errorListener2.cleanup();
            }

            // Resolve with message data
            console.log('Resolving promise with message:', message);
            resolve(message);

            // Update cache with confirmed message
            this._updateMessageCache(recipientId, {
              ...message,
              pending: false,
              status: 'sent'
            });
          };

          // Centralized handler for message errors
          const handleError = (error) => {
            log.error(`Message error for ${tempId}: ${error.message || error.error || 'Unknown error'}`);
            console.error(`Message error for ${tempId}:`, error);

            // Clean up all listeners and timeouts
            if (messageListener) {
              console.log('Cleaning up messageListener');
              messageListener();
              if (messageListener.cleanup) messageListener.cleanup();
            }
            if (messageListener2) {
              console.log('Cleaning up messageListener2');
              messageListener2();
              if (messageListener2.cleanup) messageListener2.cleanup();
            }
            if (errorListener) {
              console.log('Cleaning up errorListener');
              errorListener();
              if (errorListener.cleanup) errorListener.cleanup();
            }
            if (errorListener2) {
              console.log('Cleaning up errorListener2');
              errorListener2();
              if (errorListener2.cleanup) errorListener2.cleanup();
            }

            // Update cache to show error state
            console.log('Updating message cache with error state');
            this._updateMessageCache(recipientId, {
              ...tempMessage,
              status: 'error',
              error: error.message || error.error || 'Failed to send message'
            });

            console.log('Rejecting promise with error');
            reject(new Error(error.message || error.error || 'Failed to send message'));
          };

          // Listen for confirmation (primary event name)
          messageListener = socketService.on('messageSent', (message) => {
            if (message && message.tempMessageId === tempId) {
              handleSuccess(message);
            }
          });

          // Listen for confirmation (alternative event name)
          messageListener2 = socketService.on('message:sent', (message) => {
            if (message && message.tempMessageId === tempId) {
              handleSuccess(message);
            }
          });

          // Listen for errors (primary event name)
          errorListener = socketService.on('messageError', (error) => {
            if (error && error.tempMessageId === tempId) {
              handleError(error);
            }
          });

          // Listen for errors (alternative event name)
          errorListener2 = socketService.on('message:error', (error) => {
            if (error && error.tempMessageId === tempId) {
              handleError(error);
            }
          });

          // Set timeout for socket response - use shorter timeout to improve user experience
          const timeoutId = setTimeout(() => {
            console.log(`Message socket timeout reached for ${tempId}`);
            if (socketService.isConnected()) {
              log.debug(`Message socket timeout reached for ${tempId}, falling back to API`);
              console.log(`Socket still connected but timeout reached, falling back to API`);
              // If no response after 2 seconds, fall back to API but maintain socket for future messages
              this._sendViaApi(recipientId, content, type, metadata, tempId)
                .then(message => {
                  console.log('API fallback successful:', message);
                  resolve(message);
                })
                .catch(error => {
                  console.error('API fallback failed:', error);
                  reject(error);
                });
            } else {
              log.debug(`Socket not connected for ${tempId}, immediately falling back to API`);
              console.log(`Socket not connected, immediately falling back to API`);
              this._sendViaApi(recipientId, content, type, metadata, tempId)
                .then(message => {
                  console.log('API fallback successful:', message);
                  resolve(message);
                })
                .catch(error => {
                  console.error('API fallback failed:', error);
                  reject(error);
                });
            }
          }, 2000); // 2 second timeout for faster fallback

          // Clean up timeout if any listener resolves before timeout
          const cleanupTimeout = () => {
            clearTimeout(timeoutId);
          };
          messageListener.cleanup = cleanupTimeout;
          messageListener2.cleanup = cleanupTimeout;
          errorListener.cleanup = cleanupTimeout;
          errorListener2.cleanup = cleanupTimeout;
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
      log.info(`Sending message via API fallback to ${recipientId}`);
      console.log(`Sending message via API fallback to ${recipientId}`);

      // First update the temp message to show as "sending via API"
      const tempMessage = {
        _id: tempId,
        sender: this.user._id,
        recipient: recipientId,
        content,
        type,
        metadata: metadata || {},
        createdAt: new Date().toISOString(),
        status: 'sending',
        pending: true,
        tempId,
        tempMessageId: tempId, // For consistent reference
        note: 'Sending via API...'
      };

      console.log('Updating cache with sending state:', tempMessage);
      this._updateMessageCache(recipientId, tempMessage);

      // Make the API request
      console.log('Making API request to /messages endpoint');
      const requestData = {
        recipient: recipientId,
        content,
        type,
        metadata
      };
      console.log('API request data:', requestData);

      const response = await apiService.post('/messages', requestData);
      console.log('API response:', response);

      if (!response.success) {
        console.error('API response indicates failure:', response.error);
        throw new Error(response.error || 'Failed to send message');
      }

      const message = response.data;
      log.debug(`Message sent via API: ${message._id}`);
      console.log(`Message sent via API: ${message._id}`, message);

      // Create a properly formatted message object
      const formattedMessage = {
        ...message,
        tempMessageId: tempId, // Keep reference to temp ID
        pending: false,
        status: 'sent'
      };

      console.log('Formatted message for cache update:', formattedMessage);

      // Update cache with the confirmed message
      this._updateMessageCache(recipientId, formattedMessage);

      // Return the formatted message
      console.log('Returning formatted message from _sendViaApi');
      return formattedMessage;
    } catch (err) {
      log.error(`API message send error:`, err);
      console.error(`API message send error:`, err);

      // Update cache with error state
      const errorMessage = {
        _id: tempId,
        sender: this.user._id,
        recipient: recipientId,
        content,
        type,
        metadata: metadata || {},
        createdAt: new Date().toISOString(),
        status: 'error',
        error: err.message,
        pending: false,
        tempId,
        tempMessageId: tempId
      };

      console.log('Updating cache with error state:', errorMessage);

      // Update the message cache
      this._updateMessageCache(recipientId, errorMessage);

      // Trigger event with the error message
      console.log('Notifying event listeners of message error');
      this._notifyEventListeners('messageError', {
        tempMessageId: tempId,
        error: err.message
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
   * Direct API fetch to bypass regular service
   * This is a more reliable method for getting conversations
   * @returns {Promise<Array>} Conversations array
   * @private
   */
  async _getConversationsDirectAPI() {
    try {
      console.log("Fetching conversations using direct API method");

      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        console.error("No auth token available for API call");
        return [];
      }

      // Use a direct fetch with token
      const response = await fetch('/api/messages/conversations', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store'
        }
      });

      if (!response.ok) {
        console.warn(`Direct API returned status ${response.status}`);
        return [];
      }

      const data = await response.json();

      if (data && data.success && Array.isArray(data.data)) {
        console.log(`Direct API returned ${data.data.length} conversations`);
        return data.data;
      } else {
        console.warn("Direct API returned invalid data structure");
        return [];
      }
    } catch (err) {
      console.error("Error in direct API fetch:", err);
      return [];
    }
  }

  /**
   * Get all conversations for current user
   * @returns {Promise<Array>} - Array of conversations
   */
  async getConversations() {
    console.log("ChatService.getConversations called");

    // Check cache first (with 1 minute expiry)
    const now = Date.now();
    if (this.conversationsCache &&
        this.lastConversationsFetchTime > 0 &&
        now - this.lastConversationsFetchTime < 60000) {
      console.log(`Using cached conversations (${this.conversationsCache.length} items)`);
      return this.conversationsCache;
    }

    if (!this.initialized || !this.user?._id) {
      console.warn('Attempted to get conversations without initialization');
      try {
        // Try to auto-initialize
        console.log('Attempting auto-initialization before getting conversations');
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (token) {
          try {
            // Extract user ID from token
            const base64Url = token.split(".")[1];
            const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
            const payload = JSON.parse(atob(base64));

            const userId = payload.id || payload.sub ||
                         (payload.user && (payload.user._id || payload.user.id));

            if (userId) {
              console.log(`Auto-initializing chat service for conversations with ID: ${userId}`);
              const minimalUser = { _id: userId, id: userId };
              await this.initialize(minimalUser);
            }
          } catch (err) {
            console.error('Auto-initialization failed:', err);
          }
        }
      } catch (autoInitErr) {
        console.error('Auto-initialization attempt failed:', autoInitErr);
      }

      // If still not initialized, try direct API fallback
      if (!this.initialized || !this.user?._id) {
        console.log("Still not initialized, trying direct API fallback");

        // Get conversations directly
        const conversations = await this._getConversationsDirectAPI();

        if (conversations.length > 0) {
          // Update cache
          this.conversationsCache = conversations;
          this.lastConversationsFetchTime = now;
          return conversations;
        }

        // If no conversations, try mock data
        return this._getMockConversations();
      }
    }

    // Prepare multiple attempts for reliability
    const fetchAttempts = [];

    // 1. Direct API call (most reliable)
    fetchAttempts.push(this._getConversationsDirectAPI());

    // 2. Regular API call
    fetchAttempts.push(
      apiService.get('/messages/conversations')
        .then(response => {
          if (response && response.success) {
            return Array.isArray(response.data) ? response.data : [];
          }
          throw new Error(response?.error || 'API error');
        })
    );

    // 3. Diagnostic endpoint
    fetchAttempts.push(
      apiService.get('/diagnostic/conversations')
        .then(response => {
          if (response && response.success) {
            return Array.isArray(response.data) ? response.data : [];
          }
          throw new Error('Diagnostic endpoint error');
        })
    );

    // Try all options in parallel and use the first successful one
    try {
      console.log('Attempting all conversation fetch methods in parallel');

      // Create a single promise that resolves with the first successful result
      const result = await Promise.any(fetchAttempts);

      // Check if we got valid data
      if (Array.isArray(result) && result.length > 0) {
        console.log(`Successfully loaded ${result.length} conversations`);

        // Update cache
        this.conversationsCache = result;
        this.lastConversationsFetchTime = now;

        return result;
      } else {
        console.warn('All fetch attempts returned empty results');

        // Check if we have a cache
        if (this.conversationsCache && this.conversationsCache.length > 0) {
          console.log(`Using ${this.conversationsCache.length} cached conversations as fallback`);
          return this.conversationsCache;
        }

        // No cache, use mock data
        return this._getMockConversations();
      }
    } catch (allErrors) {
      console.error('All conversation fetch attempts failed:', allErrors);

      // Check if we have a cache
      if (this.conversationsCache && this.conversationsCache.length > 0) {
        console.log(`Using ${this.conversationsCache.length} cached conversations as fallback`);
        return this.conversationsCache;
      }

      // No cache, use mock data
      return this._getMockConversations();
    }
  }

  /**
   * Create mock conversations for fallback
   * @returns {Array} Mock conversation data
   * @private
   */
  _getMockConversations() {
    console.log("Generating mock conversations as fallback");

    const mockData = [
      {
        _id: "mock-convo-1",
        user: {
          _id: "mock-user-1",
          nickname: "Connection Error",
          isOnline: true,
          photos: []
        },
        lastMessage: {
          content: "Server connection issues detected. Please try refreshing the page.",
          createdAt: new Date().toISOString(),
          sender: "mock-user-1"
        },
        unreadCount: 1
      },
      {
        _id: "mock-convo-2",
        user: {
          _id: "mock-user-2",
          nickname: "Support Team",
          isOnline: true,
          photos: []
        },
        lastMessage: {
          content: "Welcome! If you're seeing this message, our API is experiencing issues. Try refreshing in a few minutes.",
          createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          sender: "mock-user-2"
        },
        unreadCount: 1
      }
    ];

    // Update cache with mock data
    this.conversationsCache = mockData;
    this.lastConversationsFetchTime = Date.now();

    return mockData;
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
   * Notify all event listeners with deduplication for message events
   * @param {string} event - Event name
   * @param {any} data - Event data
   * @private
   */
  _notifyEventListeners(event, data) {
    // Deduplicate message related events
    if ((event === 'messageReceived' || event === 'messageSent') && data && data._id) {
      const messageKey = `${event}-${data._id}-${Date.now().toString().substring(0, 10)}`;

      // Check if we've processed this message in the last second
      if (this._processedMessages.has(messageKey)) {
        log.debug(`Skipping duplicate ${event} notification for message ${data._id}`);
        return;
      }

      // Add to processed set with auto-cleanup after 2 seconds
      this._processedMessages.add(messageKey);
      setTimeout(() => {
        this._processedMessages.delete(messageKey);
      }, 2000);
    }

    // Notify all registered handlers
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
    this.conversationsCache = null;
    this.lastConversationsFetchTime = 0;
    
    log.debug('Chat service cleaned up');
  }
}

// Create singleton instance
const chatService = new ChatService();
export default chatService;
