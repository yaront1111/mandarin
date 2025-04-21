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

// --- Constants ---
const DEFAULT_BASE_URL = "/api";
const DEFAULT_TIMEOUT = 15000;
const DEFAULT_CACHE_SIZE = Number.parseInt(import.meta.env.VITE_CACHE_SIZE || "100", 10);
const DEFAULT_CACHE_TTL = Number.parseInt(import.meta.env.VITE_CACHE_TTL || "60000", 10);
const MAX_QUEUE_RETRIES = 3;

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
    if (url.match(/\/users\/[0-9a-fA-F]{24}$/)) ttl = 120000;
    else if (url.includes("/messages/")) ttl = 10000;
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
  }

  // --- Interceptors ---
  _onRequest(config) {
    config.metadata = { start: Date.now() };
    this.metrics.total++;
    const token = getToken();
    if (token && isTokenExpired(token) && !config._retryAuth) {
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
    if (!error.response) {
      const msg = navigator.onLine
        ? "Network error. Please try again."
        : "Offline — request queued.";
      toast.error(msg);
      if (cfg.method !== "get") this.queue.add(cfg);
      return Promise.reject({ success: false, error: msg });
    }
    const { status, data } = error.response;
    logger.create("ApiService").error(`✖ ${status} ${cfg.url}`, data);
    if (status === 401 && !cfg._retryAuth) {
      return this._handleAuthError(cfg);
    }
    this._notifyError(status, data?.message || error.message);
    return Promise.reject({ success: false, status, data });
  }

  // --- Auth & Token Refresh ---
  async _handleAuthError(config) {
    config._retryAuth = true;
    try {
      const token = await this._refreshToken();
      config.headers.Authorization = `Bearer ${token}`;
      return this.api.request(config);
    } catch {
      this.logout();
      return Promise.reject({ success: false });
    }
  }

  async _refreshToken() {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const old = getToken();
      if (!old) throw new Error("No token");
      const { data } = await axios.post(
        `${this.baseURL}/auth/refresh-token`,
        { token: old },
        { headers: { "x-no-cache": "true" } }
      );
      if (data.success && data.token) {
        setToken(data.token, !!localStorage.token);
        this.api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
        this._retryQueued(data.token);
        return data.token;
      }
      throw new Error("Refresh failed");
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

  // --- Public HTTP methods ---
  async get(url, params = {}, opts = {}) {
    const cached = this.cache.get(url, params);
    if (cached && opts.useCache !== false) return cached;
    return this.api.get(url, { params, ...opts });
  }
  post(url, data, opts) {
    this.cache.invalidate(url);
    return this.api.post(url, data, opts);
  }
  put(url, data, opts) {
    this.cache.invalidate(url);
    return this.api.put(url, data, opts);
  }
  delete(url, opts) {
    this.cache.invalidate(url);
    return this.api.delete(url, opts);
  }
  upload(url, formData, onProgress, opts) {
    return this.api.post(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
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
    return this.get("/auth/test-connection", {}, { timeout: 5000 });
  }
  getHealth() {
    return this.get("/health", {}, { timeout: 3000 });
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

  _notifyError(status, msg) {
    if (document.hidden) return;
    switch (status) {
      case 400: toast.error(`Bad request: ${msg}`); break;
      case 401: /* skip */ break;
      case 403: toast.error(`Forbidden: ${msg}`); break;
      case 404: toast.error(`Not found: ${msg}`); break;
      case 429: toast.error("Too many requests"); break;
      default: if (status >= 500) toast.error(`Server error (${status})`);
    }
  }
}

// --- Export singleton ---
const apiService = new ApiService();
export default apiService;
