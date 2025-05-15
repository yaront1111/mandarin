// client/src/services/enhanced/chatService.js
// Enhanced Chat Service with improved reliability and performance

import enhancedSocketClient from "./socketClient.js";
import apiService from "../apiService.jsx";
import logger from "../../utils/logger.js";
import { getToken } from "../../utils/tokenStorage.js";
import config from "../../config.js";

// Create named logger
const log = logger.create("EnhancedChatService");

// Configuration constants
const MESSAGE_TTL = config.CACHE.TTL.MESSAGES;
const CONVERSATION_TTL = config.CACHE.TTL.CONVERSATIONS;
const MESSAGE_FETCH_TIMEOUT = config.TIMEOUTS.FETCH.MESSAGES;
const MESSAGE_DEDUP_TIMEOUT = config.TIMEOUTS.MESSAGE.DEDUPLICATION;
const SOCKET_ACK_TIMEOUT = config.SOCKET.TIMEOUT.ACK;

/**
 * Efficient LRU Cache implementation for message caching
 */
class LRUCache {
  /**
   * Create a new LRU cache
   * @param {number} capacity Maximum number of items
   */
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
    this.head = { next: null, prev: null, key: null, value: null };
    this.tail = { next: null, prev: null, key: null, value: null };
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.size = 0;
  }
  
  /**
   * Get value from cache
   * @param {string} key Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    if (!this.cache.has(key)) return undefined;
    
    // Move to front (most recently used)
    const node = this.cache.get(key);
    this._removeNode(node);
    this._addToFront(node);
    
    return node.value;
  }
  
  /**
   * Put value in cache
   * @param {string} key Cache key
   * @param {*} value Value to cache
   */
  put(key, value) {
    if (this.cache.has(key)) {
      // Update existing
      const node = this.cache.get(key);
      node.value = value;
      this._removeNode(node);
      this._addToFront(node);
    } else {
      // Add new
      const newNode = { key, value, next: null, prev: null };
      this.cache.set(key, newNode);
      this._addToFront(newNode);
      this.size++;
      
      // Evict if over capacity
      if (this.size > this.capacity) {
        const nodeToRemove = this.tail.prev;
        this._removeNode(nodeToRemove);
        this.cache.delete(nodeToRemove.key);
        this.size--;
      }
    }
  }
  
  /**
   * Check if key exists in cache
   * @param {string} key Cache key
   * @returns {boolean} Whether key exists
   */
  has(key) {
    return this.cache.has(key);
  }
  
  /**
   * Remove key from cache
   * @param {string} key Cache key
   */
  remove(key) {
    if (this.cache.has(key)) {
      const node = this.cache.get(key);
      this._removeNode(node);
      this.cache.delete(key);
      this.size--;
    }
  }
  
  /**
   * Get all values in cache
   * @returns {Array} Array of values
   */
  values() {
    return Array.from(this.cache.values()).map(node => node.value);
  }
  
  /**
   * Get all keys in cache
   * @returns {Array} Array of keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }
  
  /**
   * Clear the cache
   */
  clear() {
    this.cache = new Map();
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.size = 0;
  }
  
  /**
   * Remove a node from the linked list
   * @param {Object} node Node to remove
   * @private
   */
  _removeNode(node) {
    const prev = node.prev;
    const next = node.next;
    prev.next = next;
    next.prev = prev;
  }
  
  /**
   * Add a node to the front of the linked list
   * @param {Object} node Node to add
   * @private
   */
  _addToFront(node) {
    node.next = this.head.next;
    node.prev = this.head;
    this.head.next.prev = node;
    this.head.next = node;
  }
}

/**
 * Enhanced Chat Service with improved reliability and performance
 */
class EnhancedChatService {
  constructor() {
    this.initialized = false;
    this.user = null;
    this.initPromise = null;
    
    // Use more efficient LRU cache for messages (500 conversations)
    this.messageCache = new LRUCache(500);
    
    // Timestamps for cache validation
    this.messageCacheTs = new Map();
    
    // Conversations cache
    this.conversationsCache = null;
    this.conversationsTs = 0;
    
    // Track processed message IDs to prevent duplicates
    this.processed = new Set();
    
    // Track pending messages with expiration
    this.pendingMessages = [];
    this.pendingMessageMap = new Map();
    
    // Event handlers
    this.eventHandlers = new Map();
    
    // Connection state
    this.isConnected = false;
    
    // Register connection events from socket client
    this._registerConnectionHandlers();
    
    log.info("EnhancedChatService created");
  }
  
  /**
   * Register connection handlers
   * @private
   */
  _registerConnectionHandlers() {
    // Track connection state
    enhancedSocketClient.on(config.SOCKET.EVENTS.SOCKET_CONNECTED, () => {
      this.isConnected = true;
      this._notify("connectionChanged", { connected: true });
      this._processPendingMessages();
    });
    
    enhancedSocketClient.on(config.SOCKET.EVENTS.SOCKET_DISCONNECTED, () => {
      this.isConnected = false;
      this._notify("connectionChanged", { connected: false });
    });
  }
  
  /**
   * Initialize chat service for a user
   * @param {Object} user User object
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize(user) {
    // Don't initialize multiple times
    if (this.initialized && this.user?._id === user?._id) {
      return true;
    }
    
    // Don't start multiple initialization processes
    if (this.initPromise) {
      return this.initPromise;
    }
    
    // Create initialization promise
    this.initPromise = new Promise(async (resolve, reject) => {
      try {
        log.info(`Initializing EnhancedChatService for user: ${user?._id}`);
        
        // Validate user ID
        if (!user || !user._id) {
          throw new Error("Invalid user object");
        }
        
        // Store user reference
        this.user = { ...user };
        
        // Get auth token
        const token = getToken();
        if (!token) {
          throw new Error("No authentication token found");
        }
        
        // Initialize socket client
        await enhancedSocketClient.init(user._id, token);
        
        // Set up message handlers
        this._setupMessageHandlers();
        
        // Load initial data
        this.initialized = true;
        resolve(true);
      } catch (error) {
        log.error("Chat service initialization failed:", error);
        
        // Mark as initialized anyway to prevent infinite loading
        this.initialized = true;
        reject(error);
      } finally {
        this.initPromise = null;
      }
    });
    
    return this.initPromise;
  }
  
  /**
   * Set up message handlers
   * @private
   */
  _setupMessageHandlers() {
    // Register for message events
    this._registerSocketHandler("messageReceived", this._handleIncomingMessage.bind(this));
    this._registerSocketHandler("messageSent", this._handleMessageSent.bind(this));
    this._registerSocketHandler("messageError", this._handleMessageError.bind(this));
    this._registerSocketHandler("userTyping", this._handleTypingNotification.bind(this));
    this._registerSocketHandler("messagesRead", this._handleMessagesRead.bind(this));
    
    // Enhanced features
    this._registerSocketHandler("messageQueued", this._handleMessageQueued.bind(this));
    this._registerSocketHandler("messageStatus", this._handleMessageStatus.bind(this));
    this._registerSocketHandler("bulkMessages", this._handleBulkMessages.bind(this));
  }
  
  /**
   * Register a socket event handler
   * @param {string} event Event name
   * @param {Function} handler Event handler
   * @private
   */
  _registerSocketHandler(event, handler) {
    enhancedSocketClient.on(event, handler);
  }
  
  /**
   * Handle incoming message
   * @param {Object} message Message object
   * @private
   */
  _handleIncomingMessage(message) {
    if (!message) return;
    
    // Check for duplicate
    const msgId = message._id || message.tempId;
    if (this._isDuplicate(msgId)) {
      log.debug(`Ignoring duplicate message: ${msgId}`);
      return;
    }
    
    // Mark as processed
    this._markAsProcessed(msgId);
    
    // Cache the message
    const conversationId = message.sender;
    this._cacheMessage(conversationId, message);
    
    // Notify subscribers
    this._notify("messageReceived", message);
  }
  
  /**
   * Handle message sent confirmation
   * @param {Object} message Message object
   * @private
   */
  _handleMessageSent(message) {
    if (!message) return;
    
    // Check if this was a pending message
    const tempId = message.tempId || message.tempMessageId;
    if (tempId && this.pendingMessageMap.has(tempId)) {
      // Remove from pending messages
      this.pendingMessageMap.delete(tempId);
      this.pendingMessages = this.pendingMessages.filter(m => m.tempId !== tempId);
    }
    
    // Cache the message
    const conversationId = message.recipient;
    this._cacheMessage(conversationId, {
      ...message,
      status: "sent",
      pending: false
    });
    
    // Notify subscribers
    this._notify("messageUpdated", message);
    this._notify("messageSent", message);
  }
  
  /**
   * Handle message error
   * @param {Object} error Error object
   * @private
   */
  _handleMessageError(error) {
    if (!error) return;
    
    // Check if this was a pending message
    const tempId = error.tempId || error.tempMessageId;
    if (tempId && this.pendingMessageMap.has(tempId)) {
      const pendingMessage = this.pendingMessageMap.get(tempId);
      
      // Update message status in cache
      if (pendingMessage.recipientId) {
        this._cacheMessage(pendingMessage.recipientId, {
          ...pendingMessage,
          status: "error",
          error: true,
          errorMessage: error.error || "Failed to send message"
        });
      }
      
      // Remove from pending map
      this.pendingMessageMap.delete(tempId);
      this.pendingMessages = this.pendingMessages.filter(m => m.tempId !== tempId);
    }
    
    // Notify subscribers
    this._notify("messageError", error);
  }
  
  /**
   * Handle typing notification
   * @param {Object} data Typing notification data
   * @private
   */
  _handleTypingNotification(data) {
    if (!data || !data.userId) return;
    
    // Notify subscribers
    this._notify("userTyping", data);
  }
  
  /**
   * Handle messages read notification
   * @param {Object} data Read notification data
   * @private
   */
  _handleMessagesRead(data) {
    if (!data || !data.messageIds || !Array.isArray(data.messageIds)) return;
    
    // Notify subscribers
    this._notify("messagesRead", data);
  }
  
  /**
   * Handle message queued notification
   * @param {Object} data Queue notification data
   * @private
   */
  _handleMessageQueued(data) {
    if (!data || !data.messageId) return;
    
    // Update status of pending message
    const tempId = data.tempId || data.tempMessageId;
    if (tempId && this.pendingMessageMap.has(tempId)) {
      const pendingMessage = this.pendingMessageMap.get(tempId);
      
      // Update status
      pendingMessage.status = "queued";
      pendingMessage.queueId = data.messageId;
      this.pendingMessageMap.set(tempId, pendingMessage);
      
      // Update in cache
      if (pendingMessage.recipientId) {
        this._cacheMessage(pendingMessage.recipientId, {
          ...pendingMessage,
          status: "queued",
          queuedAt: data.timestamp || Date.now()
        });
      }
    }
    
    // Notify subscribers
    this._notify("messageQueued", data);
  }
  
  /**
   * Handle message status update
   * @param {Object} data Status update data
   * @private
   */
  _handleMessageStatus(data) {
    if (!data) return;
    
    // Notify subscribers
    this._notify("messageStatus", data);
  }
  
  /**
   * Handle bulk messages
   * @param {Object} data Bulk messages data
   * @private
   */
  _handleBulkMessages(data) {
    if (!data || !data.messages || !Array.isArray(data.messages)) return;
    
    // Process each message
    data.messages.forEach(message => {
      // Cache the message
      const conversationId = message.sender === this.user._id
        ? message.recipient
        : message.sender;
      
      this._cacheMessage(conversationId, message);
    });
    
    // Notify subscribers
    this._notify("bulkMessages", data);
  }
  
  /**
   * Check if a message ID has been processed already
   * @param {string} msgId Message ID
   * @returns {boolean} Whether message is a duplicate
   * @private
   */
  _isDuplicate(msgId) {
    if (!msgId) return false;
    return this.processed.has(msgId);
  }
  
  /**
   * Mark a message as processed
   * @param {string} msgId Message ID
   * @private
   */
  _markAsProcessed(msgId) {
    if (!msgId) return;
    
    this.processed.add(msgId);
    
    // Set up automatic cleanup
    setTimeout(() => {
      this.processed.delete(msgId);
    }, MESSAGE_DEDUP_TIMEOUT);
    
    // Cleanup if set is getting too large
    if (this.processed.size > 1000) {
      log.debug("Cleaning up processed messages set");
      // Keep only the most recent entries
      const toKeep = Array.from(this.processed).slice(-500);
      this.processed = new Set(toKeep);
    }
  }
  
  /**
   * Cache a message for a conversation
   * @param {string} conversationId Conversation ID
   * @param {Object} message Message object
   * @private
   */
  _cacheMessage(conversationId, message) {
    if (!conversationId || !message) return;
    
    // Get existing messages for this conversation
    let messages = this.messageCache.get(conversationId) || [];
    if (!Array.isArray(messages)) {
      messages = [];
    }
    
    // Check for existing message with same ID or tempId
    const msgId = message._id || message.tempId;
    const existingIndex = messages.findIndex(m => 
      (m._id && m._id === msgId) || 
      (m.tempId && (m.tempId === message.tempId || m.tempId === message.tempMessageId))
    );
    
    if (existingIndex >= 0) {
      // Update existing message
      messages[existingIndex] = {
        ...messages[existingIndex],
        ...message
      };
    } else {
      // Add new message
      messages.push(message);
    }
    
    // Sort by creation time
    messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    // Store in cache
    this.messageCache.put(conversationId, messages);
    this.messageCacheTs.set(conversationId, Date.now());
    
    log.debug(`Updated message cache for conversation ${conversationId}, now has ${messages.length} messages`);
  }
  
  /**
   * Get messages for a conversation
   * @param {string} recipientId Recipient/conversation ID
   * @param {number} page Page number
   * @param {number} limit Items per page
   * @returns {Promise<Array>} Messages
   */
  async getMessages(recipientId, page = 1, limit = 20) {
    await this._ensureInitialized();
    
    if (!recipientId) {
      return [];
    }
    
    // Check cache for first page
    const now = Date.now();
    const cached = this.messageCache.get(recipientId) || [];
    const fresh = now - (this.messageCacheTs.get(recipientId) || 0) < MESSAGE_TTL;
    const useCache = page === 1 && cached.length && fresh;
    
    if (useCache) {
      log.debug(`Using cache for conversation ${recipientId}, ${cached.length} messages`);
      return cached;
    }
    
    try {
      log.debug(`Fetching messages for ${recipientId}, page ${page}`);
      
      // Add race for timeout protection
      const resp = await Promise.race([
        apiService.get(`/messages/${recipientId}`, { page, limit, _t: now }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Request timeout")), MESSAGE_FETCH_TIMEOUT)
        )
      ]);
      
      if (resp.success && Array.isArray(resp.data)) {
        // Process received messages
        const messages = resp.data.map(m => ({
          ...m,
          tempId: m.tempId || null,
          createdAt: m.createdAt || new Date().toISOString()
        })).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        // Update cache for first page
        if (page === 1) {
          this.messageCache.put(recipientId, messages);
          this.messageCacheTs.set(recipientId, now);
        } else if (cached.length > 0) {
          // For subsequent pages, merge with cache
          const allMessages = [...cached];
          
          // Add only messages not already in cache
          messages.forEach(msg => {
            if (!allMessages.some(m => m._id === msg._id)) {
              allMessages.push(msg);
            }
          });
          
          // Sort and update cache
          allMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          this.messageCache.put(recipientId, allMessages);
          this.messageCacheTs.set(recipientId, now);
        }
        
        return messages;
      }
      
      throw new Error(resp.error || "Invalid response");
    } catch (err) {
      log.warn(`Failed to fetch messages: ${err.message}, using cache`);
      return cached;
    }
  }
  
  /**
   * Send a message to a recipient
   * @param {string} recipientId Recipient ID
   * @param {string} content Message content
   * @param {string} type Message type
   * @param {Object} metadata Message metadata
   * @returns {Promise<Object>} Sent message
   */
  async sendMessage(recipientId, content, type = "text", metadata = {}) {
    await this._ensureInitialized();
    
    if (!recipientId) {
      throw new Error("Recipient ID required");
    }
    
    // Generate temp ID
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Create temporary message
    const tempMsg = {
      _id: tempId,
      tempId,
      sender: this.user._id,
      recipient: recipientId,
      recipientId, // For internal tracking
      content,
      type,
      metadata: {
        ...metadata,
        clientMsgId: tempId
      },
      createdAt: new Date().toISOString(),
      status: "sending",
      pending: true
    };
    
    // Cache the temporary message
    this._cacheMessage(recipientId, tempMsg);
    
    // Add to pending messages
    this.pendingMessages.push(tempMsg);
    this.pendingMessageMap.set(tempId, tempMsg);
    
    // Attempt to send via socket if connected
    if (this.isConnected) {
      return new Promise((resolve, reject) => {
        // Setup one-time handlers
        const messageAck = enhancedSocketClient.once(
          "messageSent",
          data => {
            if (data.tempId === tempId || data.tempMessageId === tempId) {
              // Update status and resolve
              this._cacheMessage(recipientId, {
                ...data,
                status: "sent",
                pending: false
              });
              
              resolve(data);
            }
          },
          data => data.tempId === tempId || data.tempMessageId === tempId
        );
        
        const messageError = enhancedSocketClient.once(
          "messageError",
          error => {
            if (error.tempId === tempId || error.tempMessageId === tempId) {
              // Update status
              this._cacheMessage(recipientId, {
                ...tempMsg,
                status: "error",
                error: true,
                errorMessage: error.error || "Failed to send message"
              });
              
              // If the error indicates offline user, try API instead
              if (error.error === "Recipient is offline" && this.serverFeatures?.queueing) {
                // Server supports queueing, let it handle delivery
                resolve({
                  ...tempMsg,
                  status: "queued",
                  queuedAt: Date.now()
                });
              } else {
                reject(new Error(error.error || "Failed to send message"));
              }
            }
          },
          error => error.tempId === tempId || error.tempMessageId === tempId
        );
        
        // Also listen for queue acknowledgment
        const queueAck = enhancedSocketClient.once(
          "messageQueued",
          data => {
            if (data.tempId === tempId || data.tempMessageId === tempId) {
              // Update status
              this._cacheMessage(recipientId, {
                ...tempMsg,
                status: "queued",
                queueId: data.messageId,
                queuedAt: data.timestamp || Date.now()
              });
              
              resolve({
                ...tempMsg,
                status: "queued",
                queueId: data.messageId,
                queuedAt: data.timestamp || Date.now()
              });
            }
          },
          data => data.tempId === tempId || data.tempMessageId === tempId
        );
        
        // Send the message
        enhancedSocketClient.emit("sendMessage", {
          recipientId,
          content,
          type,
          metadata: {
            ...metadata,
            clientMsgId: tempId
          },
          tempMessageId: tempId
        });
        
        // Set timeout to fall back to API
        setTimeout(() => {
          // Check if we've already received a response
          if (this.pendingMessageMap.has(tempId)) {
            log.warn(`No socket ACK for message ${tempId}, falling back to API`);
            
            // Clean up socket handlers
            messageAck();
            messageError();
            queueAck();
            
            // Send via API
            this._sendViaApi(recipientId, content, type, metadata, tempId)
              .then(resolve)
              .catch(reject);
          }
        }, SOCKET_ACK_TIMEOUT);
      });
    } else {
      // Socket not connected, send via API directly
      log.warn("Socket not connected, sending via API");
      return this._sendViaApi(recipientId, content, type, metadata, tempId);
    }
  }
  
  /**
   * Send a message via API
   * @param {string} recipientId Recipient ID
   * @param {string} content Message content
   * @param {string} type Message type
   * @param {Object} metadata Message metadata
   * @param {string} tempId Temporary message ID
   * @returns {Promise<Object>} Sent message
   * @private
   */
  async _sendViaApi(recipientId, content, type, metadata, tempId) {
    try {
      // Update message status
      this._cacheMessage(recipientId, {
        tempId,
        status: "sending-api"
      });
      
      // Send via API
      const resp = await apiService.post("/messages", {
        recipient: recipientId,
        content,
        type,
        metadata: {
          ...metadata,
          clientMsgId: tempId
        }
      });
      
      if (!resp.success || !resp.data) {
        throw new Error(resp.error || "API send failed");
      }
      
      // Process response
      const message = {
        ...resp.data,
        tempId,
        status: "sent",
        pending: false
      };
      
      // Update cache
      this._cacheMessage(recipientId, message);
      
      // Remove from pending
      this.pendingMessageMap.delete(tempId);
      this.pendingMessages = this.pendingMessages.filter(m => m.tempId !== tempId);
      
      return message;
    } catch (err) {
      log.error(`API send error: ${err.message}`);
      
      // Update message status
      this._cacheMessage(recipientId, {
        tempId,
        status: "error",
        error: true,
        errorMessage: err.message
      });
      
      // Remove from pending
      this.pendingMessageMap.delete(tempId);
      this.pendingMessages = this.pendingMessages.filter(m => m.tempId !== tempId);
      
      throw err;
    }
  }
  
  /**
   * Process pending messages
   * @private
   */
  _processPendingMessages() {
    if (!this.isConnected || !this.pendingMessages.length) {
      return;
    }
    
    log.info(`Processing ${this.pendingMessages.length} pending messages`);
    
    // Copy the pending messages
    const messages = [...this.pendingMessages];
    this.pendingMessages = [];
    
    // Process each message with a small delay between them
    messages.forEach((msg, index) => {
      setTimeout(() => {
        if (!this.isConnected) {
          // Socket disconnected during processing
          this.pendingMessages.push(msg);
          return;
        }
        
        // Send via socket
        enhancedSocketClient.emit("sendMessage", {
          recipientId: msg.recipient,
          content: msg.content,
          type: msg.type,
          metadata: msg.metadata,
          tempMessageId: msg.tempId
        });
        
        log.debug(`Sent pending message ${msg.tempId}`);
      }, index * 100); // 100ms between messages
    });
  }
  
  /**
   * Mark a conversation as read
   * @param {string} conversationId Conversation ID
   * @returns {Promise<Object>} API response
   */
  async markConversationRead(conversationId) {
    if (!this.initialized || !conversationId) {
      return null;
    }
    
    try {
      // Send to server
      const resp = await apiService.put(`/messages/conversation/${conversationId}/read`);
      
      // Update local cache
      const messages = this.messageCache.get(conversationId) || [];
      const updated = messages.map(m => 
        m.sender === conversationId ? 
          { ...m, read: true, readAt: new Date().toISOString() } : 
          m
      );
      
      this.messageCache.put(conversationId, updated);
      
      return resp;
    } catch (err) {
      log.error(`Error marking conversation read: ${err.message}`);
      return null;
    }
  }
  
  /**
   * Get all conversations
   * @returns {Promise<Array>} Conversations
   */
  async getConversations() {
    await this._ensureInitialized();
    
    const now = Date.now();
    if (this.conversationsCache && now - this.conversationsTs < CONVERSATION_TTL) {
      return this.conversationsCache;
    }
    
    // Try both direct and regular fetch in race
    const attempts = [
      this._fetchDirect(),
      apiService.get("/messages/conversations")
        .then(r => r.success ? r.data : [])
        .catch(() => [])
    ];
    
    try {
      const result = await Promise.any(attempts);
      if (Array.isArray(result)) {
        this.conversationsCache = result;
        this.conversationsTs = now;
        return result;
      }
      
      throw new Error("Invalid conversations data");
    } catch (err) {
      log.error(`Error fetching conversations: ${err.message}`);
      return this.conversationsCache || [];
    }
  }
  
  /**
   * Direct fetch implementation
   * @returns {Promise<Array>} Conversations
   * @private
   */
  async _fetchDirect() {
    try {
      const response = await apiService.get("/messages/conversations", {}, {
        headers: { "Cache-Control": "no-cache" }
      });
      
      return Array.isArray(response.data) ? response.data : [];
    } catch (err) {
      log.error(`Direct fetch error: ${err.message}`);
      return [];
    }
  }
  
  /**
   * Send typing indicator
   * @param {string} recipientId Recipient ID
   * @returns {boolean} Success status
   */
  sendTypingIndicator(recipientId) {
    if (!this.initialized || !this.isConnected || !recipientId) {
      return false;
    }
    
    return enhancedSocketClient.emit("typing", { recipientId }, {
      queueIfDisconnected: false, // Don't queue typing indicators
      priority: 3 // Low priority
    });
  }
  
  /**
   * Register event handler
   * @param {string} event Event name
   * @param {Function} callback Event handler
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!callback || typeof callback !== "function") {
      return () => {};
    }
    
    // Create handler set if it doesn't exist
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    
    // Add handler
    this.eventHandlers.get(event).add(callback);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        handlers.delete(callback);
        
        if (handlers.size === 0) {
          this.eventHandlers.delete(event);
        }
      }
    };
  }
  
  /**
   * Notify event subscribers
   * @param {string} event Event name
   * @param {Object} data Event data
   * @private
   */
  _notify(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return;
    
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (err) {
        log.error(`Error in ${event} handler:`, err);
      }
    });
  }
  
  /**
   * Check initialization state, initialize if needed
   * @returns {Promise<void>}
   * @private
   */
  async _ensureInitialized() {
    if (!this.initialized) {
      throw new Error("Chat service not initialized");
    }
  }
  
  /**
   * Check if chat service is ready
   * @returns {boolean} Ready status
   */
  isReady() {
    return this.initialized && !!this.user?._id;
  }
  
  /**
   * Check if socket is connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return enhancedSocketClient.isConnected();
  }
  
  /**
   * Get diagnostics information
   * @returns {Object} Diagnostics data
   */
  getDiagnostics() {
    return {
      initialized: this.initialized,
      connected: this.isConnected(),
      pendingMessages: this.pendingMessages.length,
      messageCacheSize: this.messageCache.size,
      conversationsCacheAge: Date.now() - this.conversationsTs,
      socketDiagnostics: enhancedSocketClient.getDiagnostics(),
      user: this.user?._id
    };
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    this.messageCache.clear();
    this.messageCacheTs.clear();
    this.pendingMessages = [];
    this.pendingMessageMap.clear();
    this.processed.clear();
    this.initialized = false;
    this.user = null;
    this.conversationsCache = null;
    this.conversationsTs = 0;
    this.eventHandlers.clear();
    
    log.info("Chat service cleaned up");
  }
}

// Create singleton instance
const enhancedChatService = new EnhancedChatService();
export default enhancedChatService;