// client/src/services/ChatService.js

import socketService from './socketService.jsx';
import apiService from './apiService.jsx';
import { logger } from '../utils';

const log = logger.create('ChatService');
const MESSAGE_TTL = 60_000;           // 1 min for message cache
const CONVERSATION_TTL = 60_000;      // 1 min for conversations cache
const INIT_TIMEOUT = 5_000;           // 5 sec init timeout
const SOCKET_ACK_TIMEOUT = 2_000;     // 2 sec socket send timeout

function isValidObjectId(id) {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
}

function extractIdFromToken() {
  try {
    const token = localStorage.token || sessionStorage.token;
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.id || payload.sub || (payload.user && (payload.user.id || payload.user.id));
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
    if (this.initialized && this.user?.id === user?.id) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Init timeout')), INIT_TIMEOUT);
      try {
        let uid = user?.id;
        if (!isValidObjectId(uid)) uid = extractIdFromToken();
        if (!isValidObjectId(uid)) throw new Error('Invalid user ID');
        this.user = { ...user, id: uid, id: uid };
        log.info(`Initializing ChatService for ${uid}`);

        const token = localStorage.token || sessionStorage.token;
        if (token && !socketService.isConnected()) {
          socketService.init(uid, token);
        }

        this._setupSocketListeners();
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

    listen('messageReceived', (msg) => this._onSocketMessage(msg, false));
    listen('messageSent',    (msg) => this._onSocketMessage(msg, true));
    listen('messageError',   (err) => this._notify('messageError', err));
  }

  _cleanupSocketListeners() {
    this.socketUnsubscribers.forEach(u => u());
    this.socketUnsubscribers = [];
  }

  _onSocketMessage(message, sent) {
    const id = sent ? message.id : message.sender;
    const convo = sent ? message.recipient : message.sender;
    this._cacheMessage(convo, message);
    this._notify(sent ? 'messageUpdated' : 'messageReceived', message);
  }

  _cacheMessage(convoId, message) {
    if (!convoId || !message) return;
    const key = `${message.id || message.tempId}-${convoId}`;
    if (this.processed.has(key)) return;
    this.processed.add(key);
    setTimeout(() => this.processed.delete(key), 1500);

    let arr = this.messageCache.get(convoId) || [];
    const idx = arr.findIndex(m => m.id === message.id || m.tempId === message.tempId);
    if (idx >= 0) arr[idx] = { ...arr[idx], ...message };
    else arr.push(message);

    arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    this.messageCache.set(convoId, arr);
    this.messageCacheTs.set(convoId, Date.now());
  }

  async getMessages(recipientId, page = 1, limit = 20) {
    await this.initialize(this.user || {});
    if (!recipientId) return [];

    const now = Date.now();
    const cached = this.messageCache.get(recipientId) || [];
    const fresh = now - (this.messageCacheTs.get(recipientId) || 0) < MESSAGE_TTL;
    const useCache = page === 1 && cached.length && fresh;

    if (useCache) {
      log.debug(`getMessages: using cache for ${recipientId}`);
      return cached;
    }

    try {
      log.debug(`getMessages: fetching page ${page} for ${recipientId}`);
      const resp = await Promise.race([
        apiService.get(`/messages/${recipientId}`, { page, limit, _t: now }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), 8000))
      ]);
      if (resp.success && Array.isArray(resp.data)) {
        const msgs = resp.data.map(m => ({
          ...m,
          tempId: m.tempId || null,
          createdAt: m.createdAt || new Date().toISOString()
        })).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        if (page === 1) {
          this.messageCache.set(recipientId, msgs);
          this.messageCacheTs.set(recipientId, now);
        }
        return msgs;
      }
      throw new Error(resp.error || 'Invalid response');
    } catch (err) {
      log.warn(`getMessages failed, fallback to cache: ${err.message}`);
      return cached;
    }
  }

  async sendMessage(recipientId, content, type = 'text', metadata = {}) {
    await this.initialize(this.user || {});
    if (!recipientId) throw new Error('Recipient required');

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    const tempMsg = {
      tempId, id: tempId,
      sender: this.user.id, recipient: recipientId,
      content, type, metadata,
      createdAt: new Date().toISOString(),
      status: 'sending', pending: true
    };
    this._cacheMessage(recipientId, tempMsg);

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
      if (Date.now() - m.timestamp > 600_000) return; // drop >10 min
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
        this.conversationsCache = res;
        this.conversationsTs = now;
        return res;
      }
      throw new Error('Bad data');
    } catch {
      return this.conversationsCache || [];
    }
  }

  async _fetchDirect() {
    const token = localStorage.token || sessionStorage.token;
    if (!token) return [];
    const res = await fetch('/api/messages/conversations', {
      headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.success && Array.isArray(data.data) ? data.data : [];
  }

  sendTypingIndicator(recipientId) {
    if (this.initialized && socketService.isConnected() && recipientId) {
      socketService.emit('typing', { recipientId });
      return true;
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
    return this.initialized && !!this.user?.id;
  }

  isConnected() {
    return socketService.isConnected();
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
