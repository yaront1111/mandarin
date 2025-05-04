// src/services/notificationService.js

import apiService from "./apiService.jsx";
import socketService from "./socketService.jsx";
import { logger } from "../utils/logger.js";
import { formatDate } from "../utils/index.js";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SOCKET, TIMEOUTS } from "../config";

// Use constants from config
const POLL_INTERVAL_MS = TIMEOUTS.POLL.NOTIFICATIONS;
const BUNDLE_WINDOW_MS = 5 * 60_000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 2000;

const log = logger.create("NotificationService");

/**
 * @typedef {object} Notification
 * @property {string} _id
 * @property {string} type
 * @property {string} title
 * @property {string} message
 * @property {object|null} sender
 * @property {object} data
 * @property {boolean} read
 * @property {string} createdAt
 * @property {number} createdAtTime
 * @property {number} count
 */

/**
 * Service responsible for fetching, bundling, broadcasting,
 * and navigating notifications in the UI.
 */
class NotificationService {
  constructor() {
    /** @type {Map<string, Notification>} */
    this._byId = new Map();
    /** @type {Notification[]} */
    this._sorted = [];
    this.unreadCount = 0;
    this.listeners = new Set();
    this.settings = { _init: false };
    this.navigate = null;
    this.loading = false;
    this.fetching = false;
    this.poller = null;
    this.bc = null;
    this._abortController = null;
    this._retryAttempts = 0;
    
    // Define notificationEventTypes centrally for consistency with socketService
    this.notificationEventTypes = [
      "notification",
      "newMessage",
      "newLike",
      "photoPermissionRequestReceived",
      "photoPermissionResponseReceived",
      "newComment",
      "incomingCall",
      "newStory",
    ];

    // Move socketHandlers higher for clarity
    this.socketHandlers = {
      notification: d => this._onSocket("generic", d),
      newMessage: d => this._onSocket("message", d),
      newLike: d => this._onSocket(d.isMatch ? "match" : "like", d),
      photoPermissionRequestReceived: d => this._onSocket("photoRequest", d),
      photoPermissionResponseReceived: d => this._onSocket("photoResponse", d),
      newComment: d => this._onSocket("comment", d),
      incomingCall: d => this._onSocket("call", d),
      newStory: d => this._onSocket("story", d),
    };

    this._initBroadcast();
  }

  /** Initialize BroadcastChannel for cross-tab sync */
  _initBroadcast() {
    if (typeof BroadcastChannel === "function") {
      try {
        this.bc = new BroadcastChannel("notification_sync");
        this.bc.onmessage = ({ data: { type, payload } }) => {
          if (type === "ADD") this._add(payload, false);
          if (type === "READ") this._markReadLocal(payload.notificationId, false);
          if (type === "READ_ALL") this._markAllLocal(false);
        };
      } catch (err) {
        log.error("BroadcastChannel init failed:", err);
      }
    }
  }

  /** Send a message to other tabs */
  _sync(type, payload) {
    if (!this.bc) return;
    try {
      this.bc.postMessage({ type, payload });
    } catch (err) {
      log.error("Broadcast sync failed:", err);
    }
  }

  /**
   * Supply React Router navigation
   * @param {(path: string) => void} fn
   */
  setNavigate(fn) {
    if (typeof fn === "function") this.navigate = fn;
  }

  /**
   * Initialize polling + sockets. Call once.
   * @param {object} userSettings
   */
  initialize(userSettings = {}) {
    if (this.settings._init) return;
    const defaults = {
      messages: true,
      calls: true,
      stories: true,
      likes: true,
      comments: true,
      photoRequests: true
    };
    this.settings = { ...defaults, ...(userSettings.notifications || {}) };
    this.settings._init = true;

    this._setupSocket();
    this.fetchNotifications();
    this._managePolling();
  }

  /** Wire up socket handlers using socketService */
  _setupSocket() {
    // Use socketService for connect/disconnect events
    socketService.on("connect", () => {
      this._clearPoller();
      this.fetchNotifications();
    });
    
    socketService.on("disconnect", () => this._managePolling());
    
    // Set up handlers for all notification events
    for (const [evt, fn] of Object.entries(this.socketHandlers)) {
      socketService.on(evt, fn);
    }
  }

  /** Start or stop polling based on socket state */
  _managePolling() {
    if (!this.settings._init) return;
    
    // Use socketService to check connection
    const connected = socketService.isConnected();
    
    if (!connected && !this.poller) {
      this.poller = setInterval(() => this.fetchNotifications(), POLL_INTERVAL_MS);
      this.fetchNotifications();
    } else if (connected && this.poller) {
      this._clearPoller();
    }
  }

  /** Clear the polling interval */
  _clearPoller() {
    clearInterval(this.poller);
    this.poller = null;
  }

  /**
   * Fetch notifications from the server, with abort + retry support
   */
  async fetchNotifications() {
    if (!this.settings._init || this.fetching) return;
    this.fetching = true;
    this.loading = true;
    this._notify();

    // Cancel any in-flight request
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();

    try {
      const resp = await apiService.get(
        "/notifications",
        { _t: Date.now() },
        { signal: this._abortController.signal }
      );

      if (resp.success && Array.isArray(resp.data)) {
        this._processFetched(resp.data);
        this._retryAttempts = 0; // reset on success
      } else {
        log.warn("Unexpected notifications payload", resp);
      }
    } catch (err) {
      // Only retry on network/server errors, not on abort
      if (err.name !== "AbortError" && this._retryAttempts < MAX_RETRY_ATTEMPTS) {
        this._retryAttempts += 1;
        const delay = RETRY_BASE_DELAY_MS * 2 ** (this._retryAttempts - 1);
        setTimeout(() => this.fetchNotifications(), delay);
      } else {
        log.error("Fetch notifications failed:", err);
      }
    } finally {
      this.loading = false;
      this.fetching = false;
      this._notify();
    }
  }

  /**
   * Sanitize & integrate fetched notifications
   * @param {object[]} rawList
   */
  _processFetched(rawList) {
    // Rebuild map
    this._byId.clear();
    rawList.forEach(raw => {
      const note = this._sanitize(raw);
      if (note) this._byId.set(note._id, note);
    });

    // Sort descending
    this._sorted = Array.from(this._byId.values())
      .sort((a, b) => b.createdAtTime - a.createdAtTime);

    this._recount();
  }

  /**
   * @param {object} raw
   * @returns {Notification|null}
   */
  _sanitize(raw) {
    if (!raw || !raw._id) return null;
    const createdAt = raw.createdAt || new Date().toISOString();
    const createdAtTime = Date.parse(createdAt) || Date.now();

    return {
      _id: String(raw._id),
      type: raw.type || "generic",
      title: raw.title || "",
      message: raw.message || "",
      sender: raw.sender || null,
      data: raw.data || {},
      read: Boolean(raw.read),
      createdAt,
      createdAtTime,
      count: Number(raw.count) || 1
    };
  }

  /**
   * Handle incoming socket event
   * @param {string} type
   * @param {object} data
   */
  _onSocket(type, data) {
    if (!this.settings[type]) return;
    const raw = {
      _id: data._id || `bc-${Date.now()}`,
      type,
      title: data.title,
      message: data.message,
      sender: data.sender,
      data,
      read: false,
      createdAt: data.createdAt || new Date().toISOString()
    };
    const note = this._sanitize(raw);
    if (note) this._add(note, true);
  }

  /**
   * Add or bundle a notification
   * @param {Notification} note
   * @param {boolean} broadcast
   */
  _add(note, broadcast = true) {
    const now = Date.now();
    // bundling key: `${type}|${senderId}`
    const senderId = note.sender?._id || "";
    const key = `${note.type}|${senderId}`;

    // find bundle candidate
    const existing = this._sorted.find(n =>
      n.type === note.type &&
      (n.sender?._id || "") === senderId &&
      now - n.createdAtTime < BUNDLE_WINDOW_MS
    );

    if (existing) {
      existing.count += 1;
      existing.createdAt = note.createdAt;
      existing.createdAtTime = note.createdAtTime;
      existing.message = `${existing.count} new ${existing.type}${existing.count > 1 ? "s" : ""}`;
      existing.read = false;
    } else if (!this._byId.has(note._id)) {
      this._sorted.unshift(note);
      this._byId.set(note._id, note);
    }

    this._recount();
    this._notify();
    if (broadcast) this._sync("ADD", note);
    window.dispatchEvent(new CustomEvent("newNotification", { detail: note }));
  }

  /** Recompute unread count */
  _recount() {
    this.unreadCount = this._sorted.reduce((sum, n) => sum + (n.read ? 0 : 1), 0);
  }

  /** Debounced notification to listeners (runs next tick) */
  _notify() {
    queueMicrotask(() => {
      const snapshot = {
        notifications: [...this._sorted],
        unreadCount: this.unreadCount,
        loading: this.loading
      };
      this.listeners.forEach(fn => {
        try { fn(snapshot); } catch (err) { log.error("Listener error:", err); }
      });
    });
  }

  /**
   * Subscribe to state changes
   * @param {(state: object) => void} fn
   * @returns {() => void} unsubscribe
   */
  addListener(fn) {
    if (typeof fn !== "function") return () => {};
    this.listeners.add(fn);
    // send initial state
    fn({
      notifications: [...this._sorted],
      unreadCount: this.unreadCount,
      loading: this.loading
    });
    return () => this.listeners.delete(fn);
  }

  /**
   * Mark a single notification as read
   * @param {string} id
   * @param {boolean} broadcast
   */
  markAsRead(id, broadcast = true) {
    this._markReadLocal(id, broadcast);
    apiService.put("/notifications/read", { ids: [id] })
      .catch(err => log.warn("markAsRead API error:", err));
  }

  /** Internal read without API call */
  _markReadLocal(id, broadcast) {
    const note = this._byId.get(id);
    if (!note || note.read) return;
    note.read = true;
    this._recount();
    this._notify();
    if (broadcast) this._sync("READ", { notificationId: id });
  }

  /**
   * Mark all as read
   * @param {boolean} broadcast
   */
  markAllAsRead(broadcast = true) {
    if (!this.unreadCount) return;
    this._markAllLocal(broadcast);
    apiService.put("/notifications/read-all")
      .catch(err => log.warn("markAllAsRead API error:", err));
  }

  /** Internal mark-all without API call */
  _markAllLocal(broadcast) {
    for (const note of this._sorted) note.read = true;
    this._recount();
    this._notify();
    if (broadcast) this._sync("READ_ALL", null);
  }

  /**
   * Handle user clicking a notification
   * @param {Notification} note
   */
  handleClick(note) {
    if (!this.navigate) return;
    this.markAsRead(note._id);
    let path = "/dashboard";
    switch (note.type) {
      case "message":
        path = `/messages/${note.sender?._id || ""}`; break;
      case "like":
      case "match":
        path = `/user/${note.sender?._id || ""}`; break;
      case "photoRequest":
        path = "/settings?tab=privacy"; break;
      case "photoResponse":
        path = `/user/${note.sender?._id || ""}`; break;
      case "comment":
        path = `/post/${note.data.postId || note.data.referenceId || ""}`; break;
      case "story":
        return window.dispatchEvent(new CustomEvent("viewStory", { detail: note.data }));
      case "call":
        return window.dispatchEvent(new CustomEvent("startCall", { detail: note.data }));
    }
    this.navigate(path);
  }

  /** Tear down sockets, polling, broadcast, and listeners */
  cleanup() {
    // Use proper socketService methods to clean up events
    for (const evt of Object.keys(this.socketHandlers)) {
      socketService.off(evt, this.socketHandlers[evt]);
    }
    
    socketService.off("connect");
    socketService.off("disconnect");
    
    this._clearPoller();
    if (this.bc) this.bc.close();
    this.listeners.clear();
    this._byId.clear();
    this._sorted = [];
    this.unreadCount = 0;
    this.settings._init = false;
  }
}

/**
 * React hook to wire up navigation into the service
 */
export const useNotificationNavigation = () => {
  const navigate = useNavigate();
  useEffect(() => {
    log.debug("Attaching navigation to NotificationService");
    notificationService.setNavigate(navigate);
    if (notificationService.settings._init) {
      notificationService._setupSocket();
    }
  }, [navigate]);
};

export const notificationService = new NotificationService();
export default notificationService;