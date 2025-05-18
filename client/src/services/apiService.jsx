// src/services/ApiService.js

import axios from "axios";
import { toast } from "react-toastify";
import {
  getToken,
  setToken,
  removeToken,
  isTokenExpired,
} from "../utils/tokenStorage";
import logger from "../utils/logger";
import { API, CACHE } from "../config";

// --- Constants ---
const DEFAULT_BASE_URL = API.BASE_URL;
const DEFAULT_TIMEOUT = API.TIMEOUT;
const DEFAULT_CACHE_SIZE = CACHE.SIZE;
const DEFAULT_CACHE_TTL = CACHE.TTL.DEFAULT;
const MAX_QUEUE_RETRIES = API.RETRIES.MAX_QUEUE_RETRIES;

// --- LRU + TTL Cache for GET responses ---
class ResponseCache {
  constructor(maxSize = DEFAULT_CACHE_SIZE, ttl = DEFAULT_CACHE_TTL) {
    this.ttl = ttl;
    this.map = new Map();
    this.maxSize = maxSize;
  }
  _evictIfNeeded() {
    if (this.map.size <= this.maxSize) return;
    const oldestKey = this.map.keys().next().value;
    this.map.delete(oldestKey);
  }
  _makeKey(url, params = {}) {
    const normalized = url.replace(/\/+$/, "");
    const idMatch = normalized.match(/\/([0-9a-fA-F]{24})$/);
    const base = idMatch ? normalized.replace(idMatch[1], ":id") : normalized;
    const idPart = idMatch ? `:${idMatch[1]}` : "";
    const paramString = Object.keys(params).length
      ? ":" + JSON.stringify(Object.entries(params).sort())
      : "";
    return `${base}${idPart}${paramString}`;
  }
  get(url, params) {
    const key = this._makeKey(url, params);
    const entry = this.map.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      this.map.delete(key);
      logger.create("ResponseCache").debug(`Cache miss/expired: ${key}`);
      return null;
    }
    logger.create("ResponseCache").debug(`Cache hit: ${key}`);
    return entry.data;
  }
  set(url, params, data) {
    if (!data?.success) return;
    const key = this._makeKey(url, params);
    let ttl = this.ttl;
    
    // Use TTL values from config
    if (url.match(/\/users\/[0-9a-fA-F]{24}$/)) {
      ttl = CACHE.TTL.USER_PROFILE;
    } else if (url.includes("/messages/")) {
      ttl = CACHE.TTL.MESSAGES;
    } else if (url.includes("/stories/")) {
      ttl = CACHE.TTL.STORIES;
    } else if (url.includes("/messages/conversations")) {
      ttl = CACHE.TTL.CONVERSATIONS;
    }
    
    this._evictIfNeeded();
    this.map.set(key, { data, expiresAt: Date.now() + ttl });
    logger.create("ResponseCache").debug(`Cached ${key} (TTL ${ttl}ms)`);
  }
  invalidate(url = "", params) {
    if (url && params) {
      this.map.delete(this._makeKey(url, params));
    } else if (url) {
      for (const k of this.map.keys()) {
        if (k.startsWith(url)) this.map.delete(k);
      }
    } else {
      this.map.clear();
    }
    logger.create("ResponseCache").debug(`Invalidated cache for: ${url}`);
  }
}

// --- Monitors online/offline and fires callback ---
class NetworkMonitor {
  constructor(onChange) {
    this.onChange = onChange;
    this._online = () => this._update(true);
    this._offline = () => this._update(false);
    window.addEventListener("online", this._online);
    window.addEventListener("offline", this._offline);
    this._update(navigator.onLine);
  }
  _update(isOnline) {
    logger.create("NetworkMonitor").info(`Network is ${isOnline ? "online" : "offline"}`);
    this.onChange?.(isOnline);
    window.dispatchEvent(new CustomEvent("apiConnectionStatusChange", { detail: { isOnline } }));
  }
  cleanup() {
    window.removeEventListener("online", this._online);
    window.removeEventListener("offline", this._offline);
  }
}

// --- Queues non-GET when offline ---
class RequestQueue {
  constructor(api) {
    this.api = api;
    this.queue = JSON.parse(localStorage.getItem("api_request_queue") || "[]");
    this.processing = false;
  }
  add(req) {
    this.queue.push({ ...req, retries: 0 });
    localStorage.setItem("api_request_queue", JSON.stringify(this.queue));
    logger.create("RequestQueue").debug(`Queued ${req.method} ${req.url}`);
  }
  async process() {
    if (this.processing || !navigator.onLine) return;
    this.processing = true;
    const pending = [...this.queue];
    this.queue = [];
    for (const r of pending) {
      try {
        await this.api.request(r);
        logger.create("RequestQueue").info(`Processed queued: ${r.method} ${r.url}`);
      } catch {
        r.retries++;
        if (r.retries < MAX_QUEUE_RETRIES) this.queue.push(r);
        else logger.create("RequestQueue").error(`Dropped after retries: ${r.method} ${r.url}`);
      }
    }
    localStorage.setItem("api_request_queue", JSON.stringify(this.queue));
    this.processing = false;
  }
}

// --- Main API Service Singleton ---
class ApiService {
  constructor() {
    this.baseURL = DEFAULT_BASE_URL;
    this.metrics = { total: 0, success: 0, fail: 0, avgTime: 0 };
    this.refreshPromise = null;
    this.retryQueue = [];

    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: DEFAULT_TIMEOUT,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
    });

    this.cache = new ResponseCache();
    this.queue = new RequestQueue(this.api);
    this.network = new NetworkMonitor(online => {
      if (online) this.queue.process();
    });

    this._loadToken();
    this.api.interceptors.request.use(this._onRequest.bind(this), err => Promise.reject(err));
    this.api.interceptors.response.use(this._onResponse.bind(this), this._onError.bind(this));
    
    // Add ObjectId error interceptor
    this._addObjectIdInterceptor();
  }

  // --- Interceptors ---
  _onRequest(config) {
    config.metadata = { start: Date.now() };
    this.metrics.total++;
    const token = getToken();
    
    // Skip auth refresh logic for specific requests that should proceed regardless of token state
    // This prevents loops in refresh token logic
    if (token && isTokenExpired(token) && !config._retryAuth && !config._skipAuthRefresh) {
      config._retryAuth = true;
      this.retryQueue.push(config);
      this._refreshToken().catch(() => {});
      const source = axios.CancelToken.source();
      config.cancelToken = source.token;
      source.cancel("Token expired");
    }
    
    if (config.method === "get" && config.headers["x-no-cache"]) {
      config.params = { ...(config.params || {}), _: Date.now() };
    }
    if (token) config.headers.Authorization = `Bearer ${token}`;
    logger.create("ApiService").debug(`→ ${config.method.toUpperCase()} ${config.url}`);
    return config;
  }

  _onResponse(response) {
    const took = Date.now() - response.config.metadata.start;
    this.metrics.success++;
    this.metrics.avgTime =
      (this.metrics.avgTime * (this.metrics.success - 1) + took) / this.metrics.success;
    logger.create("ApiService").debug(
      `← ${response.status} ${response.config.url} (${took}ms)`
    );
    if (
      response.config.method === "get" &&
      !response.config.headers["x-no-cache"]
    ) {
      this.cache.set(response.config.url, response.config.params, response.data);
    }
    return response.data;
  }

  async _onError(error) {
    if (axios.isCancel(error)) return Promise.reject({ canceled: true });
    this.metrics.fail++;
    const cfg = error.config || {};

    // Silence specific URLs completely - don't even log the error
    const url = cfg.url || '';
    const silentUrls = [
      '/users/photo-permissions',
      '/users/photo-permissions/pending',
      '/photo-permissions',
      '/photo-access',
      '/blocked'
    ];

    // Check if this is a URL we want to silence completely
    const shouldSilence = silentUrls.some(pattern => url.includes(pattern));

    if (shouldSilence) {
      // Don't log anything for these URLs - completely silent rejection
      return Promise.reject({ success: false, silenced: true });
    }

    if (!error.response) {
      const msg = navigator.onLine
        ? "Network error. Please try again."
        : "Offline — request queued.";
      toast.error(msg);
      if (cfg.method !== "get") this.queue.add(cfg);
      return Promise.reject({ success: false, error: msg });
    }

    const { status, data } = error.response;

    // Only log errors for non-silenced URLs
    logger.create("ApiService").error(`✖ ${status} ${cfg.url}`, data);

    if (status === 401 && !cfg._retryAuth) {
      return this._handleAuthError(cfg);
    }

    this._notifyError(status, data?.message || error.message);
    return Promise.reject({ success: false, status, data });
  }

  // --- Auth & Token Refresh ---
  async _handleAuthError(config) {
    // Don't retry if we're already trying to refresh token
    if (config._skipAuthRefresh) {
      return Promise.reject({ success: false });
    }
    
    config._retryAuth = true;
    try {
      const token = await this._refreshToken();
      config.headers.Authorization = `Bearer ${token}`;
      return this.api.request(config);
    } catch (error) {
      // Only logout if there was a token and it failed to refresh
      const hasToken = !!getToken();
      if (hasToken) {
        this.logout();
      }
      return Promise.reject({ success: false });
    }
  }

  async _refreshToken() {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const old = getToken();
      if (!old) {
        // If there's no token, don't attempt refresh - just fail silently
        this.refreshPromise = null;
        throw new Error("No token");
      }
      
      try {
        // Use the api instance itself to do the request, but avoid any interceptors that would cause a loop
        const response = await this.api.post(
          API.ENDPOINTS.AUTH.REFRESH,
          { token: old },
          { 
            headers: { "x-no-cache": "true" },
            _skipAuthRefresh: true // Special flag to avoid interceptor loops
          }
        );
        
        const data = response;
        if (data.success && data.token) {
          setToken(data.token, !!localStorage.token);
          this.api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
          this._retryQueued(data.token);
          return data.token;
        }
        throw new Error("Refresh failed");
      } catch (error) {
        logger.create("ApiService").error("Token refresh failed:", error);
        // Clear the token if refresh fails
        setToken(null, true);
        this.api.defaults.headers.common.Authorization = "";
        throw error;
      }
    })();
    this.refreshPromise.finally(() => (this.refreshPromise = null));
    return this.refreshPromise;
  }

  _retryQueued(token) {
    const q = [...this.retryQueue];
    this.retryQueue = [];
    q.forEach(cfg => {
      cfg.headers.Authorization = `Bearer ${token}`;
      this.api.request(cfg).catch(() => {});
    });
  }

  _loadToken() {
    const t = getToken();
    if (t) this.api.defaults.headers.common.Authorization = `Bearer ${t}`;
  }

  logout() {
    removeToken();
    delete this.api.defaults.headers.common.Authorization;
    window.dispatchEvent(new CustomEvent("authLogout"));
  }

  // --- Request batching system ---
  _batchRequests = new Map(); // Map of batch keys to request lists
  _batchTimers = new Map(); // Map of batch keys to timeout IDs
  _pendingBatches = new Map(); // Map of batch keys to batch promise

  /**
   * Add a request to a batch
   * @param {string} batchKey - Key to identify the batch
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {Object} data - Request data
   * @param {Object} options - Request options
   * @returns {Promise} - Promise that resolves with the response
   */
  _addToBatch(batchKey, method, url, data, options = {}) {
    if (!this._batchRequests.has(batchKey)) {
      this._batchRequests.set(batchKey, []);
    }

    // Create a promise that will be resolved when the batch is processed
    const requestPromise = new Promise((resolve, reject) => {
      this._batchRequests.get(batchKey).push({ method, url, data, options, resolve, reject });
    });

    // Set up timeout to process batch
    if (!this._batchTimers.has(batchKey)) {
      const timeoutId = setTimeout(() => this._processBatch(batchKey), 50); // 50ms debounce
      this._batchTimers.set(batchKey, timeoutId);
    }

    return requestPromise;
  }

  /**
   * Process a batch of requests
   * @param {string} batchKey - Batch key
   */
  async _processBatch(batchKey) {
    // Clear the timer
    clearTimeout(this._batchTimers.get(batchKey));
    this._batchTimers.delete(batchKey);

    // Get the requests
    const requests = this._batchRequests.get(batchKey) || [];
    this._batchRequests.delete(batchKey);

    if (requests.length === 0) return;

    // If only one request in batch, process it normally
    if (requests.length === 1) {
      const { method, url, data, options, resolve, reject } = requests[0];
      try {
        const result = await this._executeSingleRequest(method, url, data, options);
        resolve(result);
      } catch (error) {
        reject(error);
      }
      return;
    }

    // Multiple requests - group by endpoint
    logger.create("ApiService").debug(`Batching ${requests.length} requests for ${batchKey}`);
    
    try {
      // Process each request in the batch
      const results = await Promise.all(
        requests.map(({ method, url, data, options }) => 
          this._executeSingleRequest(method, url, data, options)
        )
      );
      
      // Resolve each request with its result
      requests.forEach(({ resolve }, index) => {
        resolve(results[index]);
      });
    } catch (error) {
      // If batch fails, reject all requests
      requests.forEach(({ reject }) => {
        reject(error);
      });
    }
  }

  /**
   * Execute a single request
   * @private
   */
  _executeSingleRequest(method, url, data, options) {
    switch (method.toLowerCase()) {
      case 'get':
        const cached = this.cache.get(url, options.params || {});
        if (cached && options.useCache !== false) return cached;
        return this.api.get(url, { params: options.params, ...options });
      case 'post':
        this.cache.invalidate(url);
        return this.api.post(url, data, options);
      case 'put':
        this.cache.invalidate(url);
        return this.api.put(url, data, options);
      case 'delete':
        this.cache.invalidate(url);
        return this.api.delete(url, options);
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }

  // --- Public HTTP methods ---
  async get(url, params = {}, opts = {}) {
    if (opts.batch) {
      const batchKey = opts.batchKey || 'default';
      return this._addToBatch(batchKey, 'get', url, null, { ...opts, params });
    }
    
    const cached = this.cache.get(url, params);
    if (cached && opts.useCache !== false) return cached;
    return this.api.get(url, { params, ...opts });
  }
  
  post(url, data, opts = {}) {
    if (opts.batch) {
      const batchKey = opts.batchKey || 'default';
      return this._addToBatch(batchKey, 'post', url, data, opts);
    }
    
    this.cache.invalidate(url);
    return this.api.post(url, data, opts);
  }
  
  put(url, data, opts = {}) {
    if (opts.batch) {
      const batchKey = opts.batchKey || 'default';
      return this._addToBatch(batchKey, 'put', url, data, opts);
    }
    
    this.cache.invalidate(url);
    return this.api.put(url, data, opts);
  }
  
  delete(url, opts = {}) {
    if (opts.batch) {
      const batchKey = opts.batchKey || 'default';
      return this._addToBatch(batchKey, 'delete', url, null, opts);
    }
    
    this.cache.invalidate(url);
    return this.api.delete(url, opts);
  }
  upload(url, formData, onProgress, opts) {
    // Get token and add to headers if it exists
    const token = getToken();
    const headers = { 
      "Content-Type": "multipart/form-data" 
    };
    
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    return this.api.post(url, formData, {
      headers,
      onUploadProgress: onProgress,
      ...opts,
    });
  }
  download(url, params, onProgress, opts) {
    return this.api.get(url, {
      params,
      responseType: "blob",
      onDownloadProgress: onProgress,
      ...opts,
    });
  }

  // --- **NEW**: createCancelableRequest for useApi hook
  createCancelableRequest() {
    const source = axios.CancelToken.source();
    return {
      request: { cancelToken: source.token },
      cancel: () => source.cancel("Request canceled"),
    };
  }

  // --- Utilities ---
  cancelAll(reason = "Canceled") {
    // If any outstanding cancel tokens exist, cancel them
    // (you can track them via createCancelableRequest in your hooks)
    this.api.defaults.cancelToken?.cancel(reason);
  }

  testConnection() {
    return this.get(API.ENDPOINTS.AUTH.TEST, {}, { timeout: API.HEALTH_CHECK.CONNECTION_TEST_TIMEOUT });
  }
  getHealth() {
    return this.get("/health", {}, { timeout: API.HEALTH_CHECK.TIMEOUT });
  }
  getMetrics() {
    return { ...this.metrics };
  }
  clearCache(path) {
    this.cache.invalidate(path);
  }
  cleanup() {
    this.network.cleanup();
    this.cancelAll("Cleanup");
  }

  /**
   * Add interceptor to handle ObjectId format errors
   * This standardizes user ID formats across the application
   */
  _addObjectIdInterceptor() {
    const log = logger.create("ApiObjectId");

    // Add a response interceptor specifically for ObjectId errors
    this.api.interceptors.response.use(
      response => response, // Let successful responses pass through
      error => {
        // Only handle 400 errors potentially related to ObjectId format issues
        if (error.response && error.response.status === 400) {
          const data = error.response.data;

          // Check if error is related to user ID format
          if (data && data.error && (
            data.error === 'Invalid user ID format' ||
            data.error === 'Invalid authenticated user ID format' ||
            data.error === 'Invalid user ID format in request'
          )) {
            log.warn("⚠️ Caught ObjectId validation error:", data.error);

            // Instead of using emergencyUserIdFix, we now use a standardized approach
            log.info("Standardized user ID format is now used across the application");

            // Log helpful message to console for debugging
            console.warn(`ObjectId validation error: ${data.error}. This should be handled by the standardized ID format system.`);
          }
        }

        // Continue with rejection so other error handlers can process
        return Promise.reject(error);
      }
    );

    log.info("✅ API ObjectId interceptor installed");
  }

  _notifyError(status, msg) {
    // Don't show errors when page is hidden
    if (document.hidden) return;

    // Extract request information
    const configUrl = msg?.config?.url || "";
    const url = typeof configUrl === 'string' ? configUrl : '';

    // Skip error notifications for known unimplemented endpoints
    // This is an expanded list that covers all endpoints that might be missing
    if (
      // Photo permissions endpoints
      url.includes("/photo-permissions") ||
      url.includes("/photo-access") ||
      url.includes("/users/photo-permissions") ||

      // Other known missing endpoints
      url.endsWith("/blocked") ||
      url.includes("/permissions/pending")
    ) {
      // These endpoints are known to be unimplemented, so we'll handle the errors silently
      // The code has fallbacks for these endpoints
      const log = logger.create("ApiService");
      log.debug(`Silently handling error for unimplemented endpoint: ${url}`);
      return;
    }

    // Don't show errors for story creation to avoid duplicate messages
    if (msg && (msg.includes("story") || msg.includes("Story")) && status === 429) {
      // Skip story rate limiting messages - they're handled by the stories service
      return;
    }

    // Don't show 404 errors for specific API endpoints that we know might not exist
    if (status === 404 && (
      url.includes("/api/users/photo-permissions") ||
      url.includes("/api/users/photo-access")
    )) {
      return;
    }

    switch (status) {
      case 400:
        // Handle 400 for known missing endpoints silently
        if (url.includes("/users/photo-permissions") || url.includes("/photo-permissions")) {
          return;
        }
        toast.error(`Bad request: ${msg}`);
        break;
      case 401: /* skip */ break;
      case 403: toast.error(`Forbidden: ${msg}`); break;
      case 404: toast.error(`Not found: ${msg}`); break;
      case 429: toast.error(msg || "Please wait before posting again"); break;
      default: if (status >= 500) toast.error(`Server error (${status})`);
    }
  }
}

// --- Export singleton ---
const apiService = new ApiService();
export default apiService;
