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
    this.messageCache = new Map(); // Cache messages by conversationId (Sorted Oldest First)
    this._processedMessages = new Set(); // Track recently processed messages to prevent duplicates
    this.socketListeners = []; // Track socket listeners for cleanup
    this.initPromise = null; // Promise tracking the initialization process
    this.conversationsCache = null; // Cache for conversations
    this.lastConversationsFetchTime = 0; // Timestamp of last conversations fetch
    // Added simple cache TTL for getMessages (e.g., 1 minute)
    this.messageCacheTimestamps = new Map();
    this.MESSAGE_CACHE_TTL = 60 * 1000; // 1 minute in ms
  }

  /**
   * Initialize the chat service with user data
   * @param {Object} user - Current user information
   */
  initialize(user) {
    log.debug('ChatService.initialize called with user:', user ? user._id : 'no user'); // Log less verbose data

    // If already initializing, return the existing promise
    if (this.initPromise) {
      log.debug('Initialization already in progress, returning existing promise');
      return this.initPromise;
    }

    // If already initialized with the same user, return resolved promise
    if (this.initialized && this.user?._id === user?._id) {
      log.debug(`Chat service already initialized for user: ${user?._id}`);
      return Promise.resolve(true);
    }

    // Validate the user object and ID
    if (!user) {
      const error = new Error('Cannot initialize chat service without user data');
      log.error(error.message);
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

        // If no valid ID from user._id, try user._id
        if (!validUserId && user._id) {
          if (isValidId(user._id)) {
            validUserId = user._id;
            log.debug(`Using user._id instead of user._id: ${validUserId}`);
          }
        }

        // If still no valid ID, try token
        if (!validUserId) {
          log.warn(`User object has invalid/missing ID: ${user._id}, trying token-based ID`);
          try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (token) {
              const base64Url = token.split(".")[1];
              const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
              const payload = JSON.parse(atob(base64));
              const tokenId = payload.id || payload.sub ||
                             (payload.user && (payload.user._id || payload.user._id));
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

        log.info(`Initializing chat service for user ID: ${validatedUser._id}`);
        this.user = validatedUser;

        // Initialize socket if needed
        if (!socketService.isConnected() && validUserId) {
          const token = localStorage.getItem('token') || sessionStorage.getItem('token');
          if (token) {
            log.debug(`Initializing socket with validated user ID: ${validUserId}`);
            try {
              socketService.init(validUserId, token);
              // Add a small delay to allow socket to connect before setting up listeners
              // Consider using socket 'connect' event instead for more reliability
              setTimeout(() => {
                this._setupSocketListeners();
                this.initialized = true;
                log.info('Chat service initialized successfully (socket connecting)');
                this.initPromise = null; // Clear promise *after* resolving
                resolve(true);
              }, 500);
            } catch (socketError) {
              log.error('Socket initialization error:', socketError);
              this.initialized = true; // Still consider initialized for API fallbacks
              log.warn('Chat service initialized without active socket connection');
              this.initPromise = null;
              resolve(true); // Resolve even on socket error
            }
          } else {
            this.initialized = true;
            log.warn('Chat service initialized without socket (no token available)');
            this.initPromise = null;
            resolve(true);
          }
        } else {
          if (socketService.isConnected()) {
            this._setupSocketListeners(); // Ensure listeners are set if already connected
          }
          this.initialized = true;
          log.info('Chat service initialized successfully (socket possibly already connected)');
          this.initPromise = null;
          resolve(true);
        }
      } catch (error) {
        log.error('Error during chat service initialization:', error);
        this.initPromise = null;
        reject(error);
      }
    });

    // Add timeout to prevent hanging initialization
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        if (this.initPromise) { // Check if it hasn't already resolved/rejected
          log.warn('Chat service initialization timed out');
          this.initialized = true; // Force initialization to true to allow fallbacks
          this.initPromise = null; // Clear the potentially hanging promise
          reject(new Error('Chat service initialization timed out')); // Reject the race
        }
      }, 5000); // 5 second timeout
    });

    // Return the promise that resolves/rejects first
    return Promise.race([this.initPromise, timeoutPromise])
      .catch(err => {
        log.warn(`Initialization error/timeout handled, enabling fallbacks: ${err.message}`);
        this.initialized = true; // Ensure initialized is true even on error/timeout
        return true; // Always resolve outer promise to true prevent blocking app load
      });
  }


  /**
   * Set up socket event listeners
   * @private
   */
  _setupSocketListeners() {
    // Clean up any existing listeners first
    this._cleanupSocketListeners();

    this.socketListeners = []; // Reset tracked listeners

    const addListener = (event, handler) => {
        const unsubscribe = socketService.on(event, handler);
        this.socketListeners.push(unsubscribe); // Track for cleanup
    };

    // New message received
    addListener('messageReceived', (message) => {
      log.debug(`Socket: messageReceived from ${message.sender}`);
      const conversationId = message.sender === this.user?._id ? message.recipient : message.sender;
      this._updateMessageCache(conversationId, message);
      this._notifyEventListeners('messageReceived', message);
    });

    // Message sent confirmation
    addListener('messageSent', (message) => {
      log.debug(`Socket: messageSent confirmation for ${message._id}`);
      const conversationId = message.recipient; // Assuming recipient is always the other user
      this._updateMessageCache(conversationId, message); // Update cache with confirmed message
      // We might not need a specific 'messageSent' event for UI if 'messageUpdated' handles status changes
      this._notifyEventListeners('messageUpdated', message); // Notify UI of update
    });

     // Handle message errors from socket
     addListener('messageError', (error) => {
        log.error(`Socket: messageError received: ${error.message || error.error}`);
        if (error && error.tempMessageId) {
            // Find conversation ID associated with temp ID (might need better tracking)
            // For now, assume recipient was stored somewhere or find message in cache by tempId
            // This part is tricky without knowing the recipient easily
            log.error(`Need to update message cache for tempId ${error.tempMessageId} with error state.`);
            // Attempt to find and update cache (implementation depends on how temp messages are stored)
        }
        this._notifyEventListeners('messageError', error);
    });


    // Typing indicators
    addListener('userTyping', (data) => {
      this._notifyEventListeners('userTyping', data);
    });

    // Connection status changes
    addListener('connect', () => {
      log.info('Socket connected, processing pending messages');
      this._processPendingMessages();
      this._notifyEventListeners('connectionChanged', { connected: true });
    });

    addListener('disconnect', () => {
      log.warn('Socket disconnected'); // Use warn level
      this._notifyEventListeners('connectionChanged', { connected: false });
    });

    log.debug(`Setup ${this.socketListeners.length} socket listeners`);
  }

  /**
   * Clean up socket listeners
   * @private
   */
  _cleanupSocketListeners() {
    if (this.socketListeners && this.socketListeners.length > 0) {
       log.debug(`Cleaning up ${this.socketListeners.length} socket listeners`);
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

    log.debug(`Updating message cache for ${conversationId} with message ID ${message._id || message.tempId || 'unknown'}`);

    const messages = this.messageCache.get(conversationId) || [];
    const tempId = message.tempMessageId || message.tempId;
    let messageUpdated = false;

    // Find existing index (either by _id or tempId)
    const existingIndex = messages.findIndex(m =>
        (message._id && m._id === message._id) || // Match server ID
        (tempId && (m.tempId === tempId || m.tempMessageId === tempId || m._id === tempId)) // Match temp ID
    );

    if (existingIndex >= 0) {
        // Update existing message
        log.debug(`Updating existing message at index ${existingIndex} (ID: ${messages[existingIndex]._id || messages[existingIndex].tempId})`);
        // Merge new data, ensuring tempId is preserved if it was the match key
        messages[existingIndex] = {
            ...messages[existingIndex], // Keep old fields
            ...message, // Overwrite with new fields
            tempId: messages[existingIndex].tempId || tempId // Ensure tempId persists if relevant
        };
        messageUpdated = true;
        this._notifyEventListeners('messageUpdated', messages[existingIndex]);
    } else {
        // Add new message only if it's not a near duplicate
        const now = new Date();
        const nearDuplicates = messages.filter(m =>
            m.content === message.content &&
            m.sender === message.sender &&
            m.recipient === message.recipient &&
            !m._id && // Only check against potentially pending messages
            Math.abs(new Date(m.createdAt) - new Date(message.createdAt)) < 5000 // Within 5 seconds
        );

        if (nearDuplicates.length > 0) {
            log.debug(`Skipping near-duplicate new message in cache for ${conversationId}`);
        } else {
            log.debug(`Adding new message to cache for ${conversationId}`);
            messages.push(message); // Add to end (for oldest-first sort)
            messageUpdated = true;
            // Notify 'messageReceived' only for genuinely new messages from others
            if (message.sender !== this.user?._id) {
                 this._notifyEventListeners('messageReceived', message);
            }
        }
    }

    if (messageUpdated) {
        // Sort messages by date (OLDEST FIRST for UI consistency)
        messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        // Update cache
        this.messageCache.set(conversationId, messages);
        // Update timestamp for this conversation's cache
        this.messageCacheTimestamps.set(conversationId, Date.now());
    }
}


  /**
   * Get messages for a conversation
   * @param {string} recipientId - ID of the other user
   * @param {number} page - Page number (pagination)
   * @param {number} limit - Number of messages per page
   * @returns {Promise<Array>} - Array of messages (sorted oldest first)
   */
  async getMessages(recipientId, page = 1, limit = 20) {
    log.info(`getMessages called: recipientId=${recipientId}, page=${page}, limit=${limit}, initialized=${this.initialized}, user=${this.user?._id}`);

    // Auto-initialization check (simplified)
    if (!this.isReady()) {
      log.warn('ChatService not ready in getMessages, attempting auto-init...');
      // Assuming initialize handles errors and ensures `initialized` is true
      await this.initialize(this.user || {}); // Pass current user if exists
      if (!this.isReady()) {
         log.error('Auto-initialization failed in getMessages');
         return []; // Return empty if still not ready
      }
       log.info('Auto-initialization successful in getMessages');
    }

    if (!recipientId) {
      log.error('No recipient ID provided for getMessages');
      return [];
    }

    const cachedMessages = this.messageCache.get(recipientId);
    const cacheTimestamp = this.messageCacheTimestamps.get(recipientId) || 0;
    const isCacheFresh = Date.now() - cacheTimestamp < this.MESSAGE_CACHE_TTL;

    // **MODIFIED CACHE/FETCH LOGIC**
    // Decide if we need to fetch from API
    let shouldFetchFromAPI = true;
    if (page === 1 && cachedMessages && cachedMessages.length > 0 && isCacheFresh) {
        log.debug(`Using fresh cache for page 1 request with ${recipientId}.`);
        shouldFetchFromAPI = false;
    } else if (!cachedMessages || cachedMessages.length === 0) {
         log.debug(`No cache found for ${recipientId}, fetching page ${page}.`);
         shouldFetchFromAPI = true;
    } else if (page > 1) {
         log.debug(`Workspaceing page ${page} for ${recipientId} (cache exists but not page 1).`);
         shouldFetchFromAPI = true;
    } else if (cachedMessages && !isCacheFresh) {
         log.debug(`Cache is stale for ${recipientId}, fetching page ${page}.`);
         shouldFetchFromAPI = true;
    }

    let messagesFromServer = null;
    let fetchError = null;

    if (shouldFetchFromAPI) {
        try {
            log.debug(`Workspaceing messages from API: recipient=${recipientId}, page=${page}`);
            const fetchWithTimeout = async (timeoutMs = 8000) => {
                // ... (fetchWithTimeout implementation remains the same) ...
                 let timeoutId;
                 try {
                     const timeoutPromise = new Promise((_, reject) => {
                         timeoutId = setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
                     });
                     const response = await Promise.race([
                         apiService.get(`/messages/${recipientId}`, { page, limit, _t: Date.now() }),
                         timeoutPromise
                     ]);
                     clearTimeout(timeoutId);
                     return response;
                 } catch (err) {
                     clearTimeout(timeoutId);
                     throw err;
                 }
            };

            const response = await fetchWithTimeout();
            log.debug('API response received:', response ? 'object' : 'null/undefined'); // Log less verbosely

            if (response && response.success && Array.isArray(response.data)) {
                messagesFromServer = response.data.map(msg => ({ // Ensure structure
                    ...msg,
                    _id: msg._id || `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    createdAt: msg.createdAt || new Date().toISOString(),
                    content: msg.content || (msg.type === 'text' ? '' : msg.type) // Handle null content
                }));

                log.debug(`Loaded ${messagesFromServer.length} messages from server`);

                // Sort oldest first immediately
                messagesFromServer.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

                // Update cache ONLY if fetching page 1 successfully
                if (page === 1) {
                    log.debug(`Updating cache for ${recipientId} with ${messagesFromServer.length} messages.`);
                    this.messageCache.set(recipientId, [...messagesFromServer]); // Use spread to ensure new array
                    this.messageCacheTimestamps.set(recipientId, Date.now()); // Update timestamp
                }
                // Note: Logic for merging page > 1 results into cache is not implemented here for simplicity.

            } else {
                // API error or empty data
                fetchError = new Error(response?.error || `Failed to load messages (success=${response?.success})`);
                log.error(`API fetch failed or returned empty/invalid data: ${fetchError.message}`);
                messagesFromServer = null; // Explicitly null on failure/empty
            }
        } catch (err) {
            fetchError = err; // Capture fetch error
            log.error(`Error fetching messages API with ${recipientId}:`, err);
            messagesFromServer = null; // Explicitly null on catch
        }
    } else {
         log.debug("Skipping API fetch, using cache.");
         // We will use cachedMessages below
    }

    // ** DECIDE WHAT TO RETURN **
    if (messagesFromServer !== null) {
        // API fetch was successful (even if empty array)
        log.debug(`getMessages returning ${messagesFromServer.length} messages from server fetch`);
        return messagesFromServer; // Already sorted oldest-first
    } else if (cachedMessages && cachedMessages.length > 0) {
        // API was skipped or failed, but we have cache
        log.warn(`getMessages returning ${cachedMessages.length} messages from cache (API skipped/failed)`);
        // Ensure cache is sorted correctly (should be due to _updateMessageCache, but double-check)
        cachedMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return cachedMessages;
    } else {
        // API failed/skipped and no cache
        log.warn('getMessages returning empty array (no server data, no cache)');
        return [];
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
    log.info(`sendMessage called: recipientId=${recipientId}, type="${type}", initialized=${this.initialized}, user=${this.user?._id}`); // Less verbose content

    if (!this.isReady()) {
      log.error('Attempted to send message without initialization');
      throw new Error('Chat service not initialized');
    }
    if (!recipientId) {
      log.error('No recipient ID provided for sendMessage');
      throw new Error('Recipient ID is required');
    }

    log.debug(`Sending ${type} message to ${recipientId}`);

    // Create a temporary message object for optimistic UI updates
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tempMessage = {
      _id: tempId, // Use _id for temp initially for consistency? Or keep tempId separate? Let's use tempId.
      tempId: tempId,
      sender: this.user._id,
      recipient: recipientId,
      content,
      type,
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
      read: false,
      status: 'sending', // Initial status
      pending: true
    };

    // Add to cache immediately (will be sorted oldest first)
    this._updateMessageCache(recipientId, tempMessage);

    // Try socket first if connected
    if (socketService.isConnected()) {
        log.debug(`Attempting to send message via socket (tempId: ${tempId})`);
        return new Promise((resolve, reject) => {
            const emitData = { recipientId, content, type, metadata, tempMessageId: tempId };
            let listeners = []; // Store listener unsubscribe functions + timeout clear
            let timeoutId = null;

            const cleanup = () => {
                clearTimeout(timeoutId);
                listeners.forEach(unsub => typeof unsub === 'function' && unsub());
                listeners = []; // Clear array
            };

            const handleSuccess = (message) => {
                if (!message || message.tempMessageId !== tempId) return; // Ensure it's for this message
                log.info(`Socket confirmed message sent (tempId: ${tempId} -> _id: ${message._id})`);
                cleanup();
                this._updateMessageCache(recipientId, { ...message, pending: false, status: 'sent' });
                resolve(message);
            };

            const handleError = (error) => {
                 if (!error || error.tempMessageId !== tempId) return; // Ensure it's for this message
                 log.error(`Socket message error (tempId: ${tempId}): ${error.message || error.error}`);
                 cleanup();
                 this._updateMessageCache(recipientId, { ...tempMessage, status: 'error', error: error.message || error.error || 'Socket send failed' });
                 reject(new Error(error.message || error.error || 'Failed to send message via socket'));
            };

            // Add listeners and store unsubscribe functions
            listeners.push(socketService.on('messageSent', handleSuccess));
            listeners.push(socketService.on('message:sent', handleSuccess)); // Alternative name just in case
            listeners.push(socketService.on('messageError', handleError));
            listeners.push(socketService.on('message:error', handleError)); // Alternative name

            // Emit the message
            socketService.emit('sendMessage', emitData);
            log.debug(`Emitted 'sendMessage' for tempId: ${tempId}`);

            // Set timeout for socket response (2 seconds)
            timeoutId = setTimeout(() => {
                if (listeners.length > 0) { // Check if it hasn't already resolved/rejected
                     log.warn(`Socket confirmation timeout for tempId: ${tempId}. Falling back to API.`);
                     cleanup(); // Clean up socket listeners
                     // Fallback to API
                     this._sendViaApi(recipientId, content, type, metadata, tempId)
                         .then(resolve) // Resolve outer promise with API result
                         .catch(reject); // Reject outer promise with API error
                }
            }, 2000);
        });

    } else {
        // Socket not connected, queue for later (optional) and use API directly
        log.warn('Socket not connected. Sending message via API directly.');
        // Decide if queueing is needed if API is primary when disconnected
        // this._queuePendingMessage({ recipientId, content, type, metadata, tempMessageId: tempId }); // Maybe don't queue if sending via API now?
        return this._sendViaApi(recipientId, content, type, metadata, tempId);
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
    log.info(`Sending message via API fallback (tempId: ${tempId})`);

    // Update temp message status in cache (find it first)
    const cachedMessages = this.messageCache.get(recipientId) || [];
    const tempIndex = cachedMessages.findIndex(m => m.tempId === tempId);
    if (tempIndex !== -1) {
        cachedMessages[tempIndex] = { ...cachedMessages[tempIndex], status: 'sending-api' };
        this._updateMessageCache(recipientId, cachedMessages[tempIndex]); // Notify UI potentially
    }

    try {
      const requestData = { recipient: recipientId, content, type, metadata };
      log.debug('API POST /messages request data:', requestData);
      const response = await apiService.post('/messages', requestData);
      log.debug('API POST /messages response:', response);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to send message via API');
      }

      const message = response.data; // The confirmed message from the server
      log.debug(`Message sent via API: (tempId: ${tempId} -> _id: ${message._id})`);

      // Create a properly formatted message object for cache update
      const formattedMessage = {
        ...message, // Server data (_id, createdAt, etc.)
        tempId: tempId, // Keep reference to original temp ID
        pending: false,
        status: 'sent'
      };

      // Update cache with the confirmed message (replaces temp message)
      this._updateMessageCache(recipientId, formattedMessage);
      return formattedMessage; // Return confirmed message

    } catch (err) {
      log.error(`API message send error (tempId: ${tempId}):`, err);
      // Update cache with error state
      const errorMessage = { // Recreate based on tempId in case original object is lost
        tempId: tempId,
        sender: this.user?._id, // Need user context
        recipient: recipientId,
        content, type, metadata,
        createdAt: new Date().toISOString(), // Or use temp message's time if available
        status: 'error',
        error: err.message || 'API send failed',
        pending: false
      };
       // Find and update/replace the temp message with error state
      this._updateMessageCache(recipientId, errorMessage);

      // Trigger event (optional, could be handled by 'messageUpdated')
      // this._notifyEventListeners('messageError', { tempMessageId: tempId, error: err.message });
      throw err; // Rethrow error to be caught by calling function
    }
  }


  /**
   * Queue a message for later sending
   * @param {Object} messageData - Message data
   * @private
   */
  _queuePendingMessage(messageData) {
    // Consider if queueing is still desired if API fallback is primary when disconnected
    this.pendingMessages.push({ ...messageData, timestamp: Date.now() });
    log.debug(`Queued message to ${messageData.recipientId || messageData.recipient} for later sending`);
  }

  /**
   * Process any pending messages
   * @private
   */
  _processPendingMessages() {
    if (this.pendingMessages.length === 0 || !socketService.isConnected()) return;

    log.info(`Processing ${this.pendingMessages.length} pending messages`);
    const messagesToSend = [...this.pendingMessages];
    this.pendingMessages = []; // Clear queue immediately

    messagesToSend.forEach(msg => {
      const isTooOld = Date.now() - msg.timestamp > 600000; // 10 minutes
      if (isTooOld) {
        log.warn(`Skipping stale pending message (tempId: ${msg.tempMessageId})`);
        // Optionally update cache for this message to 'failed' state
        return;
      }
      log.debug(`Sending queued message via socket (tempId: ${msg.tempMessageId})`);
      socketService.emit('sendMessage', {
          recipientId: msg.recipientId || msg.recipient,
          content: msg.content,
          type: msg.type,
          metadata: msg.metadata,
          tempMessageId: msg.tempMessageId
       });
    });
  }

  /**
   * Mark a conversation as read
   * @param {string} conversationId - ID of the conversation (other user's ID)
   * @returns {Promise<Object>} - API response or null on error
   */
  async markConversationRead(conversationId) {
    if (!this.isReady() || !conversationId) {
      log.warn(`Cannot mark read: Service not ready or no conversationId (${conversationId})`);
      return null;
    }

    try {
      log.debug(`Marking conversation with ${conversationId} as read via API`);
      // API call should mark messages as read on the backend
      const response = await apiService.put(`/messages/conversation/${conversationId}/read`);

      // Optimistically update cache - mark messages FROM the other user as read
      const messages = this.messageCache.get(conversationId) || [];
      let cacheUpdated = false;
      const updatedMessages = messages.map(msg => {
        // Mark messages received from the conversation partner as read
        if (msg.sender === conversationId && !msg.read) {
          cacheUpdated = true;
          return { ...msg, read: true, readAt: new Date().toISOString() };
        }
        return msg;
      });

      if (cacheUpdated) {
         log.debug(`Optimistically updated message cache for ${conversationId} as read.`);
         this.messageCache.set(conversationId, updatedMessages);
         // Notify potentially? Maybe not needed if UI updates based on conversation unread count
      }

      return response; // Return API response
    } catch (err) {
      log.error(`Error marking conversation ${conversationId} as read:`, err);
      return null; // Return null on error
    }
  }


  /**
   * Direct API fetch to bypass regular service (for conversations)
   * @returns {Promise<Array>} Conversations array (empty on error)
   * @private
   */
  async _getConversationsDirectAPI() {
    log.debug("Fetching conversations using direct API method");
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        log.error("No auth token available for direct API call");
        return [];
      }

      const response = await fetch('/api/messages/conversations', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store' // Ensure fresh data
        }
      });

      if (!response.ok) {
        log.warn(`Direct API fetch failed with status ${response.status}`);
        return [];
      }

      const data = await response.json();
      if (data && data.success && Array.isArray(data.data)) {
        log.debug(`Direct API returned ${data.data.length} conversations`);
        return data.data;
      } else {
        log.warn("Direct API returned invalid data structure:", data);
        return [];
      }
    } catch (err) {
      log.error("Error in direct API fetch:", err);
      return [];
    }
  }

  /**
   * Get all conversations for current user
   * @returns {Promise<Array>} - Array of conversations
   */
// Inside ChatService class...

  async getConversations() {
    log.debug("ChatService.getConversations called");
    const now = Date.now();

    // Check cache first (1 minute expiry)
    if (this.conversationsCache && now - this.lastConversationsFetchTime < 60000) {
      log.debug(`Using cached conversations (${this.conversationsCache.length} items)`);
      return this.conversationsCache;
    }

    // Auto-initialization check
     if (!this.isReady()) {
      log.warn('ChatService not ready in getConversations, attempting auto-init...');
      await this.initialize(this.user || {});
      if (!this.isReady()) {
         log.error('Auto-initialization failed in getConversations, cannot fetch.');
         return [];
      }
       log.info('Auto-initialization successful in getConversations');
    }

    // *** CORRECTED PROMISE HANDLING ***
    const fetchAttempts = [
      this._getConversationsDirectAPI(), // Primary attempt
      apiService.get('/messages/conversations').then(r => { // Secondary attempt
          if (r?.success && Array.isArray(r.data)) return r.data;
          // Throw an error or specific object to indicate non-critical failure
          throw new Error('Regular API failed or returned invalid data');
      })
      // Add other attempts here if needed, ensuring they throw on failure
    ];

    try {
      log.debug('Attempting conversation fetch methods using Promise.any');

      // Promise.any resolves with the value of the first promise that fulfills.
      // It rejects with AggregateError if ALL promises reject.
      const firstSuccessfulResult = await Promise.any(fetchAttempts);

      // If we reach here, at least one promise fulfilled.
      // We expect the result to be an array.
      if (Array.isArray(firstSuccessfulResult)) {
        log.info(`Successfully loaded ${firstSuccessfulResult.length} conversations via Promise.any`);
        this.conversationsCache = firstSuccessfulResult;
        this.lastConversationsFetchTime = now;
        return firstSuccessfulResult;
      } else {
        // This case should be rare if promises resolve correctly with arrays
        log.warn('Promise.any resolved but the result was not an array:', firstSuccessfulResult);
        // Fallback to cache if available
        if (this.conversationsCache) {
             log.warn(`Returning potentially stale cached conversations (${this.conversationsCache.length}) after unexpected Promise.any result.`);
             return this.conversationsCache;
         }
        log.error("No conversations loaded (unexpected Promise.any result type) and no cache available.");
        return [];
      }

    } catch (aggregateError) {
      // This block catches AggregateError if ALL fetchAttempts promises rejected.
      log.error('All conversation fetch attempts failed:', aggregateError);
      // Fallback to potentially stale cache if available
      if (this.conversationsCache) {
           log.warn(`Returning potentially stale cached conversations (${this.conversationsCache.length}) as fallback after all fetches failed.`);
           return this.conversationsCache;
       }
      // No cache available, return empty array (mock fallback was removed)
      log.error("No conversations loaded and no cache available after all fetches failed.");
      return [];
    }
  } // end getConversations
  /**
   * Create mock conversations for fallback - **REMOVED for production**
   * @returns {Array} Mock conversation data
   * @private
   */
  // _getMockConversations() { ... } // Function removed


  /**
   * Send typing indicator
   * @param {string} recipientId - ID of the recipient
   */
  sendTypingIndicator(recipientId) {
    if (!this.isReady() || !socketService.isConnected() || !recipientId) {
      // log.debug('Typing indicator not sent (not ready or disconnected)'); // Can be noisy
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
    // Deduplicate message related events using tempId or _id
    const isMessageEvent = ['messageReceived', 'messageSent', 'messageUpdated', 'messageError'].includes(event);
    let messageKey = null;

    if (isMessageEvent && data && (data._id || data.tempMessageId || data.tempId)) {
        const id = data._id || data.tempMessageId || data.tempId;
        // Use a simpler key, rely on the short timeout for deduplication
        messageKey = `${event}-${id}`;

        if (this._processedMessages.has(messageKey)) {
            log.debug(`Skipping duplicate ${event} notification for message ID/tempId ${id}`);
            return;
        }
        this._processedMessages.add(messageKey);
        setTimeout(() => {
            this._processedMessages.delete(messageKey);
        }, 1500); // Shorter timeout might be sufficient (1.5 seconds)
    }

    if (!this.eventListeners.has(event)) return;

    // Use try/catch within the loop to prevent one listener error from stopping others
    this.eventListeners.get(event).forEach(callback => {
        try {
            callback(data);
        } catch (err) {
            log.error(`Error in ${event} event listener callback:`, err);
        }
    });
}


  /**
   * Check if chat service is ready to use
   * @returns {boolean} - Ready status
   */
  isReady() {
    // Added check for user._id as well
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
   * Get the authentication token if available.
   * Used by other parts of the app if needed.
   * @returns {string|null} Auth token or null
   */
   getAuthToken() {
      return localStorage.getItem('token') || sessionStorage.getItem('token');
   }


  /**
   * Clean up the chat service
   */
  cleanup() {
    log.info('Cleaning up ChatService...'); // Use info level
    this._cleanupSocketListeners();
    this.eventListeners.clear();
    this.messageCache.clear();
    this.messageCacheTimestamps.clear();
    this.pendingMessages = [];
    this.initialized = false;
    this.user = null;
    this.conversationsCache = null;
    this.lastConversationsFetchTime = 0;
    this._processedMessages.clear();
    // Don't necessarily disconnect socket here, as it might be shared
    // socketService.disconnect();
    log.info('Chat service cleaned up');
  }
}

// Create singleton instance
const chatService = new ChatService();
export default chatService;
