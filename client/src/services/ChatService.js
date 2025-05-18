// client/src/services/ChatService.js

import socketService from './socketService.jsx';
import apiService from './apiService.jsx';
import { logger } from '../utils';
import { getToken } from '../utils/tokenStorage';
import { CACHE, SOCKET, TIMEOUTS } from '../config';

const log = logger.create('ChatService');
// Use configuration values from config.js
const MESSAGE_TTL = CACHE.TTL.MESSAGES;                    // From config
const CONVERSATION_TTL = CACHE.TTL.CONVERSATIONS;          // From config
const INIT_TIMEOUT = SOCKET.TIMEOUT.INIT;                  // From config
const SOCKET_ACK_TIMEOUT = SOCKET.TIMEOUT.ACK;             // From config
const MESSAGE_FETCH_TIMEOUT = TIMEOUTS.FETCH.MESSAGES;     // From config
const MESSAGE_DEDUP_TIMEOUT = TIMEOUTS.MESSAGE.DEDUPLICATION; // From config
const PENDING_MESSAGE_EXPIRY = TIMEOUTS.MESSAGE.PENDING_EXPIRY; // From config
const FILE_CACHE_KEY = 'mandarin_file_urls';               // LocalStorage key for file URL cache
const FILE_CACHE_HASH_KEY = 'mandarin_file_urls_by_hash';  // LocalStorage key for file URL hash cache

function isValidObjectId(id) {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
}

function extractIdFromToken() {
  try {
    const token = getToken();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.id || payload.sub || (payload.user && (payload.user._id || payload.user._id));
  } catch {
    return null;
  }
}

class ChatService {
  constructor() {
    this.initialized = false;
    this.user = null;
    this.initPromise = null;

    this.activeChats = new Map();
    this.eventListeners = new Map();
    this.messageCache = new Map();
    this.messageCacheTs = new Map();
    this.conversationsCache = null;
    this.conversationsTs = 0;
    this.processed = new Set();
    this.pendingMessages = [];

    this.socketUnsubscribers = [];
    // Use socketService for connection events
    this._registerSocketHandlers();
  }

  _registerSocketHandlers() {
    // Register for connect/disconnect events from socketService
    socketService.on('connect', () => {
      log.info('Socket connected – processing pending messages');
      this._processPending();
      this._notify('connectionChanged', { connected: true });
    });
    
    socketService.on('disconnect', () => {
      log.warn('Socket disconnected');
      this._notify('connectionChanged', { connected: false });
    });
  }

  async initialize(user) {
    if (this.initialized && this.user?._id === user?._id) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Init timeout')), INIT_TIMEOUT);
      try {
        let uid = user?._id;
        if (!isValidObjectId(uid)) uid = extractIdFromToken();
        if (!isValidObjectId(uid)) throw new Error('Invalid user ID');
        this.user = { ...user, _id: uid, id: uid };
        log.info(`Initializing ChatService for ${uid}`);

        const token = getToken();
        // Setup socket listeners first, before connection
        this._setupSocketListeners();
        
        // Initialize socket service and wait for connection
        if (token) {
          socketService.init(uid, token);
          
          // Wait for socket to connect (with timeout)
          const connectionTimeout = 5000; // 5 seconds
          const startTime = Date.now();
          
          while (!socketService.isConnected() && Date.now() - startTime < connectionTimeout) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          if (!socketService.isConnected()) {
            log.warn('Socket connection timeout, proceeding anyway');
          } else {
            log.info('Socket connected successfully');
          }
        }

        this.initialized = true;
        clearTimeout(timeout);
        resolve(true);
      } catch (err) {
        clearTimeout(timeout);
        log.error('Initialization failed:', err);
        this.initialized = true; // allow fallback
        resolve(true);
      } finally {
        this.initPromise = null;
      }
    });

    return this.initPromise;
  }

  _setupSocketListeners() {
    this._cleanupSocketListeners();
    const listen = (evt, fn) => {
      const unsub = socketService.on(evt, fn);
      this.socketUnsubscribers.push(unsub);
    };

    // Register for connection events
    listen('connect', () => {
      log.info('Socket connected');
      this._processPending();
      this._notify('connectionChanged', { connected: true });
    });
    
    listen('disconnect', () => {
      log.warn('Socket disconnected');
      this._notify('connectionChanged', { connected: false });
    });

    // Register for message events
    listen('messageReceived', (msg) => this._onSocketMessage(msg, false));
    listen('messageSent',    (msg) => this._onSocketMessage(msg, true));
    listen('messageError',   (err) => this._notify('messageError', err));

    // Register for typing indicator events
    listen('typing', (data) => {
      if (data && data.userId) {
        this._notify('userTyping', data);
      }
    });
  }

  _cleanupSocketListeners() {
    this.socketUnsubscribers.forEach(u => u());
    this.socketUnsubscribers = [];
  }

  _onSocketMessage(message, sent) {
    const id = sent ? message._id : message.sender;
    const convo = sent ? message.recipient : message.sender;
    this._cacheMessage(convo, message);
    this._notify(sent ? 'messageUpdated' : 'messageReceived', message);
  }

  _cacheMessage(convoId, message) {
    if (!convoId || !message) return;
    const key = `${message._id || message.tempId}-${convoId}`;
    if (this.processed.has(key)) return;
    this.processed.add(key);
    setTimeout(() => this.processed.delete(key), MESSAGE_DEDUP_TIMEOUT);

    let arr = this.messageCache.get(convoId) || [];
    const idx = arr.findIndex(m => m._id === message._id || m.tempId === message.tempId);
    if (idx >= 0) arr[idx] = { ...arr[idx], ...message };
    else arr.push(message);

    arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    this.messageCache.set(convoId, arr);
    this.messageCacheTs.set(convoId, Date.now());
  }

  async getMessages(recipientId, page = 1, limit = 20) {
    await this.initialize(this.user || {});
    if (!recipientId) return { messages: [], partner: null };

    const now = Date.now();
    const cached = this.messageCache.get(recipientId) || [];
    const cachedPartner = this.partnerCache?.get(recipientId);
    const fresh = now - (this.messageCacheTs.get(recipientId) || 0) < MESSAGE_TTL;
    const useCache = page === 1 && cached.length && fresh;

    if (useCache && cachedPartner) {
      log.debug(`getMessages: using cache for ${recipientId}`);
      return { messages: cached, partner: cachedPartner };
    }

    try {
      log.debug(`getMessages: fetching page ${page} for ${recipientId}`);
      const resp = await Promise.race([
        apiService.get(`/messages/${recipientId}`, { page, limit, _t: now }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), MESSAGE_FETCH_TIMEOUT))
      ]);
      if (resp.success) {
        // Extract and store partner info if provided
        if (resp.partner) {
          if (!this.partnerCache) this.partnerCache = new Map();
          this.partnerCache.set(recipientId, resp.partner);
        }

        if (Array.isArray(resp.data)) {
          const msgs = resp.data.map(m => ({
            ...m,
            tempId: m.tempId || null,
            createdAt: m.createdAt || new Date().toISOString()
          })).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

          if (page === 1) {
            this.messageCache.set(recipientId, msgs);
            this.messageCacheTs.set(recipientId, now);
          }
          return { messages: msgs, partner: resp.partner };
        }
      }
      throw new Error(resp.error || 'Invalid response');
    } catch (err) {
      log.warn(`getMessages failed, fallback to cache: ${err.message}`);
      return { messages: cached, partner: cachedPartner };
    }
  }

  async sendMessage(recipientId, content, type = 'text', metadata = {}) {
    await this.initialize(this.user || {});
    if (!recipientId) throw new Error('Recipient required');

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    const tempMsg = {
      tempId, _id: tempId,
      sender: this.user._id, recipient: recipientId,
      content, type, metadata,
      createdAt: new Date().toISOString(),
      status: 'sending', pending: true
    };
    this._cacheMessage(recipientId, tempMsg);

    // Use socketService for sending, with API fallback
    if (socketService.isConnected()) {
      return new Promise((resolve, reject) => {
        let done = false;
        const ack = (msg) => {
          if (msg.tempId !== tempId) return;
          done = true;
          this._cacheMessage(recipientId, { ...msg, status: 'sent', pending: false });
          cleanup();
          resolve(msg);
        };
        const errh = (err) => {
          if (err.tempId !== tempId) return;
          done = true;
          this._cacheMessage(recipientId, { ...tempMsg, status: 'error', error: err.error || err.message });
          cleanup();
          reject(err);
        };
        const cleanup = () => {
          clearTimeout(timeout);
          socketService.off('messageSent', ack);
          socketService.off('messageError', errh);
        };

        // Use socketService event handlers
        socketService.on('messageSent', ack);
        socketService.on('messageError', errh);
        socketService.emit('sendMessage', { recipientId, content, type, metadata, tempId });

        const timeout = setTimeout(() => {
          if (!done) {
            cleanup();
            log.warn(`Socket ack timeout for ${tempId}, falling back to API`);
            this.pendingMessages.push({ recipientId, content, type, metadata, tempId });
            this._sendViaApi(recipientId, content, type, metadata, tempId)
              .then(resolve).catch(reject);
          }
        }, SOCKET_ACK_TIMEOUT);
      });
    }

    log.warn('Socket disconnected – sending via API');
    this.pendingMessages.push({ recipientId, content, type, metadata, tempId });
    return this._sendViaApi(recipientId, content, type, metadata, tempId);
  }

  async _sendViaApi(recipientId, content, type, metadata, tempId) {
    this._cacheMessage(recipientId, { tempId, status: 'sending-api' });
    try {
      const resp = await apiService.post('/messages', { recipient: recipientId, content, type, metadata });
      if (!resp.success || !resp.data) throw new Error(resp.error || 'API send failed');
      const msg = { ...resp.data, tempId, status: 'sent', pending: false };
      this._cacheMessage(recipientId, msg);
      return msg;
    } catch (err) {
      log.error(`API sendMessage error: ${err.message}`);
      this._cacheMessage(recipientId, { tempId, status: 'error', error: err.message });
      throw err;
    }
  }

  _processPending() {
    if (!socketService.isConnected()) return;
    const pend = [...this.pendingMessages];
    this.pendingMessages = [];
    pend.forEach(m => {
      if (Date.now() - m.timestamp > PENDING_MESSAGE_EXPIRY) return; // Drop expired messages
      // Use socketService.emit for all socket operations
      socketService.emit('sendMessage', {
        recipientId: m.recipientId || m.recipient,
        content: m.content,
        type: m.type,
        metadata: m.metadata,
        tempId: m.tempId
      });
    });
  }

  async markConversationRead(convoId) {
    if (!this.initialized || !convoId) return null;
    try {
      const resp = await apiService.put(`/messages/conversation/${convoId}/read`);
      const msgs = this.messageCache.get(convoId) || [];
      const updated = msgs.map(m => m.sender === convoId ? { ...m, read: true, readAt: new Date().toISOString() } : m);
      this.messageCache.set(convoId, updated);
      return resp;
    } catch (err) {
      log.error(`markConversationRead failed: ${err.message}`);
      return null;
    }
  }

  async getConversations() {
    await this.initialize(this.user || {});
    const now = Date.now();
    if (this.conversationsCache && now - this.conversationsTs < CONVERSATION_TTL) {
      return this.conversationsCache;
    }

    const attempts = [
      this._fetchDirect(),
      apiService.get('/messages/conversations').then(r => { if (r.success) return r.data; throw new Error(); })
    ];

    try {
      const res = await Promise.any(attempts);
      if (Array.isArray(res)) {
        // Enhance conversations with pending photo request counts
        const enhancedConversations = await this._enhanceWithPhotoRequests(res);
        this.conversationsCache = enhancedConversations;
        this.conversationsTs = now;
        return enhancedConversations;
      }
      throw new Error('Bad data');
    } catch {
      return this.conversationsCache || [];
    }
  }

  async _enhanceWithPhotoRequests(conversations) {
    try {
      // Get all pending photo permissions where current user is the owner
      // The endpoint already filters by photoOwnerId since we're authenticated
      const pendingPermissions = await apiService.get('/users/photos/permissions', {
        status: 'pending'
      });
      
      console.log('Pending photo permissions response:', pendingPermissions);
      const permissionsData = pendingPermissions.data || [];
      
      // Count permissions per requester
      const pendingCountsMap = permissionsData.reduce((acc, permission) => {
        // Get the ID of the person who requested access
        const requesterId = permission.requestedBy?._id || permission.requestedBy;
        acc[requesterId] = (acc[requesterId] || 0) + 1;
        return acc;
      }, {});
      
      console.log('Pending photo request counts map:', pendingCountsMap);
      
      // Add counts to conversations
      return conversations.map(conv => ({
        ...conv,
        pendingPhotoRequests: pendingCountsMap[conv.user._id] || 0
      }));
    } catch (error) {
      log.warn('Failed to enhance conversations with photo requests:', error);
      // Return conversations without photo request counts on error
      return conversations;
    }
  }

  async _fetchDirect() {
    try {
      const response = await apiService.get('/messages/conversations', {}, { 
        headers: { 'Cache-Control': 'no-cache' }
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      log.error('Failed to fetch conversations directly:', error);
      return [];
    }
  }

  sendTypingIndicator(recipientId) {
    if (this.initialized && socketService.isConnected() && recipientId) {
      // Use socketService.sendTyping method if available, otherwise use emit
      if (typeof socketService.sendTyping === 'function') {
        return socketService.sendTyping(recipientId);
      } else {
        return socketService.emit('typing', { recipientId });
      }
    }
    return false;
  }

  on(event, cb) {
    if (!this.eventListeners.has(event)) this.eventListeners.set(event, new Set());
    this.eventListeners.get(event).add(cb);
    return () => this.eventListeners.get(event).delete(cb);
  }

  _notify(event, data) {
    const set = this.eventListeners.get(event);
    if (!set) return;
    set.forEach(cb => {
      try { cb(data); }
      catch (err) { log.error(`Listener ${event} error:`, err); }
    });
  }

  isReady() {
    return this.initialized && !!this.user?._id;
  }

  isConnected() {
    // Directly use socketService's isConnected method
    const connected = socketService.isConnected();
    log.debug(`ChatService.isConnected: ${connected}`);
    return connected;
  }

  // File URL cache system
  // This replaces the window.__fileMessages global with a proper class method

  /**
   * Initialize the file URL cache system from localStorage
   * @private
   */
  _initFileCache() {
    if (!this._fileUrlCache) {
      log.debug("Initializing file URL caches");

      // Create cache objects
      this._fileUrlCache = {};
      this._fileUrlCacheByHash = {};

      // Load cached file URLs from localStorage
      try {
        // Load ID-based cache
        const persistedUrls = localStorage.getItem(FILE_CACHE_KEY);
        if (persistedUrls) {
          const parsed = JSON.parse(persistedUrls);
          if (parsed && typeof parsed === 'object') {
            this._fileUrlCache = parsed;
            log.debug(`Restored ${Object.keys(parsed).length} file URLs from localStorage`);
          }
        }

        // Load hash-based cache
        const persistedHashUrls = localStorage.getItem(FILE_CACHE_HASH_KEY);
        if (persistedHashUrls) {
          const parsed = JSON.parse(persistedHashUrls);
          if (parsed && typeof parsed === 'object') {
            this._fileUrlCacheByHash = parsed;
            log.debug(`Restored ${Object.keys(parsed).length} file URLs by hash`);
          }
        } else if (Object.keys(this._fileUrlCache).length > 0) {
          // Build hash cache from ID cache if it doesn't exist
          this._rebuildHashCache();
        }
      } catch (err) {
        log.error("Failed to load persisted file URLs", err);
        this._fileUrlCache = {};
        this._fileUrlCacheByHash = {};
      }
    }
  }

  /**
   * Rebuild the hash cache from the ID cache
   * @private
   */
  _rebuildHashCache() {
    log.debug("Building hash-based cache from ID-based cache");

    Object.entries(this._fileUrlCache).forEach(([msgId, msgData]) => {
      if (msgData?.url) {
        // Generate a hash if one doesn't exist
        const hash = msgData.hash || this._generateMessageHash(msgData);
        if (hash) {
          this._fileUrlCacheByHash[hash] = {
            ...msgData,
            id: msgId
          };
        }
      }
    });

    // Persist the new hash cache
    this._persistFileCaches();
  }

  /**
   * Generate a hash for a file message
   * @private
   * @param {Object} msgData - Message data object
   * @returns {string} - Generated hash
   */
  _generateMessageHash(msgData) {
    if (!msgData) return '';
    const fileName = msgData.fileName || '';
    const timeStamp = msgData.timestamp ? new Date(msgData.timestamp).toISOString().substring(0, 16) : '';
    // Use available data to create a semi-unique hash
    return `${fileName}-${timeStamp}`;
  }

  /**
   * Save file caches to localStorage
   * @private
   */
  _persistFileCaches() {
    try {
      localStorage.setItem(FILE_CACHE_KEY, JSON.stringify(this._fileUrlCache));
      localStorage.setItem(FILE_CACHE_HASH_KEY, JSON.stringify(this._fileUrlCacheByHash));
    } catch (err) {
      log.error("Failed to persist file URL caches", err);
    }
  }

  /**
   * Get a file URL from cache by message ID
   * @param {string} messageId - Message ID
   * @returns {Object|null} - File URL data or null if not found
   */
  getFileUrl(messageId) {
    this._initFileCache();
    return this._fileUrlCache[messageId] || null;
  }

  /**
   * Get a file URL from cache by hash
   * @param {string} hash - File hash
   * @returns {Object|null} - File URL data or null if not found
   */
  getFileUrlByHash(hash) {
    this._initFileCache();
    return this._fileUrlCacheByHash[hash] || null;
  }

  /**
   * Add a file URL to the cache
   * @param {string} messageId - Message ID
   * @param {Object} fileData - File data object (url, fileName, etc.)
   */
  addFileUrl(messageId, fileData) {
    this._initFileCache();

    if (!messageId || !fileData?.url) return;

    // Add timestamp if not present
    const data = {
      ...fileData,
      timestamp: fileData.timestamp || new Date().toISOString()
    };

    // Generate hash if not present
    if (!data.hash) {
      data.hash = this._generateMessageHash(data);
    }

    // Update caches
    this._fileUrlCache[messageId] = data;

    if (data.hash) {
      this._fileUrlCacheByHash[data.hash] = {
        ...data,
        id: messageId
      };
    }

    // Persist caches
    this._persistFileCaches();
  }

  /**
   * Remove a file URL from the cache
   * @param {string} messageId - Message ID
   */
  removeFileUrl(messageId) {
    this._initFileCache();

    const data = this._fileUrlCache[messageId];
    if (data) {
      // Remove from hash cache
      if (data.hash && this._fileUrlCacheByHash[data.hash]) {
        delete this._fileUrlCacheByHash[data.hash];
      }

      // Remove from ID cache
      delete this._fileUrlCache[messageId];

      // Persist caches
      this._persistFileCaches();
    }
  }

  /**
   * Clear file URL caches
   */
  clearFileCaches() {
    this._fileUrlCache = {};
    this._fileUrlCacheByHash = {};

    // Remove from localStorage
    try {
      localStorage.removeItem(FILE_CACHE_KEY);
      localStorage.removeItem(FILE_CACHE_HASH_KEY);
    } catch (err) {
      log.error("Failed to clear file URL caches from localStorage", err);
    }
  }

  cleanup() {
    this._cleanupSocketListeners();
    this.eventListeners.clear();
    this.messageCache.clear();
    this.messageCacheTs.clear();
    this.pendingMessages = [];
    this.initialized = false;
    this.user = null;
    this.conversationsCache = null;
    this.conversationsTs = 0;
    this.processed.clear();
    log.info('ChatService cleaned up');
  }
}

export default new ChatService();