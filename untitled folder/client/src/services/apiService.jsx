import axios from "axios"
import { toast } from "react-toastify"
import { getToken, setToken, removeToken, isTokenExpired, parseToken } from "../utils/tokenStorage"
import logger from "../utils/logger"

// Create loggers for different components
const apiLogger = logger.create("ApiService")
const cacheLogger = logger.create("ResponseCache")
const networkLogger = logger.create("NetworkMonitor")
const queueLogger = logger.create("RequestQueue")

/**
 * Cache implementation for API responses
 */
class ResponseCache {
  constructor(maxSize = 100, ttl = 60000) {
    this.cache = new Map()
    this.maxSize = maxSize // Maximum number of cached responses
    this.ttl = ttl // Time-to-live in milliseconds
  }

  generateKey(url, params) {
    const sortedParams = params ? JSON.stringify(Object.entries(params).sort()) : ""
    return `${url}:${sortedParams}`
  }

  set(url, params, data) {
    // Only cache successful responses
    if (!data || !data.success) return null
    const key = this.generateKey(url, params)
    const expiresAt = Date.now() + this.ttl
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry (first in Map)
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
      cacheLogger.debug(`Cache full, removing oldest entry: ${oldestKey}`)
    }
    this.cache.set(key, { data, expiresAt })
    cacheLogger.debug(`Cached response for: ${key}`)
    return data
  }

  get(url, params) {
    const key = this.generateKey(url, params)
    const cached = this.cache.get(key)
    if (!cached) {
      cacheLogger.debug(`Cache miss for: ${key}`)
      return null
    }
    if (cached.expiresAt < Date.now()) {
      cacheLogger.debug(`Cache expired for: ${key}`)
      this.cache.delete(key)
      return null
    }
    cacheLogger.debug(`Cache hit for: ${key}`)
    return cached.data
  }

  invalidate(url, params) {
    const key = params ? this.generateKey(url, params) : null
    if (key) {
      this.cache.delete(key)
      cacheLogger.debug(`Invalidated cache for: ${key}`)
    } else if (url) {
      for (const existingKey of this.cache.keys()) {
        if (existingKey.startsWith(`${url}:`)) {
          this.cache.delete(existingKey)
          cacheLogger.debug(`Invalidated cache for: ${existingKey}`)
        }
      }
    } else {
      this.cache.clear()
      cacheLogger.debug("Invalidated entire cache")
    }
  }
}

/**
 * Network state monitoring
 */
class NetworkMonitor {
  constructor(onStatusChange) {
    this.isOnline = navigator.onLine
    this.onStatusChange = onStatusChange
    window.addEventListener("online", this.handleOnline.bind(this))
    window.addEventListener("offline", this.handleOffline.bind(this))
    networkLogger.info(`Network monitor initialized. Online: ${this.isOnline}`)
  }

  handleOnline() {
    networkLogger.info("Network connection restored")
    this.isOnline = true
    if (this.onStatusChange) this.onStatusChange(true)
  }

  handleOffline() {
    networkLogger.warn("Network connection lost")
    this.isOnline = false
    if (this.onStatusChange) this.onStatusChange(false)
  }

  cleanup() {
    window.removeEventListener("online", this.handleOnline.bind(this))
    window.removeEventListener("offline", this.handleOffline.bind(this))
  }
}

/**
 * Request queue for offline operations
 */
class RequestQueue {
  constructor(apiInstance) {
    this.queue = []
    this.apiInstance = apiInstance
    this.isProcessing = false
    this.maxRetries = 3
    this.loadFromStorage()
  }

  add(request) {
    this.queue.push({
      ...request,
      timestamp: Date.now(),
      retries: 0,
    })
    queueLogger.debug(`Added request to queue: ${request.method} ${request.url}`)
    this.saveToStorage()
    return this.queue.length
  }

  loadFromStorage() {
    try {
      const savedQueue = localStorage.getItem("api_request_queue")
      if (savedQueue) {
        this.queue = JSON.parse(savedQueue)
        queueLogger.info(`Loaded ${this.queue.length} requests from storage`)
      }
    } catch (err) {
      queueLogger.error("Failed to load queue from storage:", err)
      this.queue = []
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem("api_request_queue", JSON.stringify(this.queue))
    } catch (err) {
      queueLogger.error("Failed to save queue to storage:", err)
    }
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return
    this.isProcessing = true
    queueLogger.info(`Processing queue with ${this.queue.length} requests`)
    const completedIndices = []
    for (let i = 0; i < this.queue.length; i++) {
      const request = this.queue[i]
      try {
        queueLogger.debug(`Processing queued request: ${request.method} ${request.url}`)
        await this.apiInstance.request({
          url: request.url,
          method: request.method,
          data: request.data,
          params: request.params,
          headers: request.headers,
        })
        completedIndices.push(i)
        queueLogger.debug(`Successfully processed queued request: ${request.method} ${request.url}`)
      } catch (err) {
        request.retries++
        queueLogger.warn(
          `Failed to process queued request (attempt ${request.retries}): ${request.method} ${request.url}`,
        )
        if (request.retries >= this.maxRetries) {
          completedIndices.push(i)
          queueLogger.error(
            `Giving up on queued request after ${this.maxRetries} attempts: ${request.method} ${request.url}`,
          )
        }
      }
    }
    for (let i = completedIndices.length - 1; i >= 0; i--) {
      this.queue.splice(completedIndices[i], 1)
    }
    this.saveToStorage()
    this.isProcessing = false
    queueLogger.info(
      `Queue processing complete. ${completedIndices.length} requests processed, ${this.queue.length} remaining`,
    )
  }
}

/**
 * Enhanced API Service for making HTTP requests with advanced features
 */
class ApiService {
  constructor() {
    this.baseURL =
      import.meta.env.VITE_API_URL ||
      (window.location.hostname.includes("localhost") ? "http://localhost:5000/api" : "/api")
    apiLogger.info(`Initializing with baseURL: ${this.baseURL}`)

    // Create axios instance
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 15000,
    })

    // Initialize state and metrics
    this.refreshTokenPromise = null
    this.requestsToRetry = []
    this.pendingRequests = new Map()
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retries: 0,
      avgResponseTime: 0,
    }

    // Initialize cache using environment variables for size and TTL
    this.cache = new ResponseCache(
      Number.parseInt(import.meta.env.VITE_CACHE_SIZE || "100"),
      Number.parseInt(import.meta.env.VITE_CACHE_TTL || "60000"),
    )

    // Setup request queue for offline operations
    this.requestQueue = new RequestQueue(this.api)

    // Track network state
    this.networkMonitor = new NetworkMonitor(this._handleNetworkStatusChange.bind(this))

    // Setup interceptors
    this._initializeInterceptors()

    // Load authentication token from storage
    this._loadAuthToken()
  }

  _handleNetworkStatusChange(isOnline) {
    if (isOnline) {
      apiLogger.info("Network connection restored. Processing request queue...")
      setTimeout(() => this.requestQueue.processQueue(), 1000)
    } else {
      apiLogger.warn("Network offline. Requests will be queued.")
    }
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("apiConnectionStatusChange", { detail: { isOnline } }))
    }
  }

  _initializeInterceptors() {
    this.api.interceptors.request.use(this._handleRequest.bind(this), this._handleRequestError.bind(this))
    this.api.interceptors.response.use(this._handleResponse.bind(this), this._handleResponseError.bind(this))
  }

  _handleRequest(config) {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    config.requestId = requestId
    config.startTime = Date.now()
    this.pendingRequests.set(requestId, { config, timestamp: Date.now() })
    this.metrics.totalRequests++
    if (config.method.toLowerCase() === "get" && config.headers["x-no-cache"]) {
      config.params = config.params || {}
      config.params["_"] = Date.now()
    }
    const token = this._getStoredToken()
    if (token && isTokenExpired(token) && !config.url.includes("/auth/refresh-token") && !config._isRefreshRequest) {
      if (!config._tokenRefreshRetry) {
        config._tokenRefreshRetry = true
        apiLogger.debug(`Token expired before request. Queueing request: ${config.method} ${config.url}`)
        this.requestsToRetry.push(config)
        this.refreshToken().catch((err) => {
          apiLogger.warn("Token refresh failed in request handler:", err.message)
        })
        const source = axios.CancelToken.source()
        config.cancelToken = source.token
        setTimeout(() => source.cancel("Token expired. Request will be retried."), 0)
      }
    }
    apiLogger.debug(
      `Request: ${config.method.toUpperCase()} ${config.url}`,
      config.params ? `Params: ${JSON.stringify(config.params)}` : "",
    )
    return config
  }

  _handleRequestError(error) {
    apiLogger.error("Request error:", error.message)
    this.metrics.failedRequests++
    return Promise.reject(error)
  }

  _handleResponse(response) {
    const requestTime = Date.now() - response.config.startTime
    this.metrics.successfulRequests++
    this.metrics.avgResponseTime =
      (this.metrics.avgResponseTime * (this.metrics.successfulRequests - 1) + requestTime) /
      this.metrics.successfulRequests
    if (response.config.requestId) {
      this.pendingRequests.delete(response.config.requestId)
    }
    apiLogger.debug(
      `Response success: ${response.config.method.toUpperCase()} ${response.config.url} (${requestTime}ms)`,
    )
    if (response.config.method.toLowerCase() === "get" && !response.config.headers["x-no-cache"]) {
      this.cache.set(response.config.url, response.config.params, response.data)
    }
    return response.data
  }

  _handleResponseError(error) {
    if (axios.isCancel(error)) {
      apiLogger.debug(`Request canceled: ${error.message}`)
      return Promise.reject({ success: false, error: "Request canceled", isCanceled: true })
    }
    if (error.config?.requestId) {
      this.pendingRequests.delete(error.config.requestId)
    }
    if (!error.response) {
      const isOffline = !navigator.onLine
      const errorMsg = isOffline
        ? "You are currently offline. Please check your connection."
        : "Network error. Please try again."
      if (!isOffline || error.config?.method === "get") {
        toast.error(errorMsg)
      }
      return Promise.reject({ success: false, error: errorMsg, isOffline, originalError: error })
    }
    return this._processHttpError(error)
  }

  async _processHttpError(error) {
    const originalRequest = error.config
    const status = error.response.status
    apiLogger.error(
      `Response error: ${originalRequest.method.toUpperCase()} ${originalRequest.url}`,
      `Status: ${status}`,
      error.response.data,
    )
    if (status === 401 && !originalRequest._retry) {
      return this._handleAuthError(error)
    }
    const errorData = error.response.data
    const errorMsg =
      errorData?.error ||
      errorData?.message ||
      errorData?.msg ||
      (error.response.status === 400 && originalRequest.url.includes("/like")
        ? "You've already liked this user or reached your daily limit"
        : "An error occurred")
    const errorCode = errorData?.code || null
    this._showErrorNotification(status, errorMsg, errorCode)
    return Promise.reject({ success: false, error: errorMsg, code: errorCode, status, data: error.response.data })
  }

  async _handleAuthError(error) {
    const originalRequest = error.config
    originalRequest._retry = true
    if (originalRequest.url.includes("/auth/refresh-token")) {
      apiLogger.warn("Refresh token request failed")
      this._handleLogout("Session expired. Please log in again.")
      return Promise.reject({ success: false, error: "Authentication failed", status: 401 })
    }
    apiLogger.debug("Received 401 error. Attempting token refresh...")
    try {
      const newToken = await this.refreshToken()
      if (newToken) {
        apiLogger.debug("Token refreshed successfully. Retrying original request.")
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        originalRequest.headers["x-auth-token"] = newToken
        return this.api(originalRequest)
      } else {
        apiLogger.warn("Token refresh returned null")
        if (this._getStoredToken()) {
          this._handleLogout("Session expired. Please log in again.")
        }
        throw new Error("Failed to refresh token")
      }
    } catch (refreshError) {
      apiLogger.error("Token refresh failed:", refreshError)
      if (this._getStoredToken()) {
        this._handleLogout("Session expired. Please log in again.")
      }
      return Promise.reject({ success: false, error: "Authentication failed", status: 401 })
    }
  }

  _showErrorNotification(status, message, code) {
    if (document.hidden) return
    switch (status) {
      case 400:
        toast.error(`Request error: ${message}`)
        break
      case 403:
        toast.error(`Access denied: ${message}`)
        break
      case 404:
        toast.error(`Not found: ${message}`)
        break
      case 422:
        toast.error(`Validation error: ${message}`)
        break
      case 429:
        toast.error("Too many requests. Please try again later.")
        break
      case 500:
      case 502:
      case 503:
      case 504:
        toast.error(`Server error (${status}). Please try again later.`)
        break
      default:
        toast.error(message)
    }
  }

  _handleLogout(message) {
    this._removeToken()
    this.setAuthToken(null)
    toast.error(message)
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("authLogout"))
    }
  }

  _getStoredToken() {
    return getToken()
  }

  _storeToken(token, rememberMe = false) {
    if (!token) return
    setToken(token, rememberMe)
  }

  _removeToken() {
    removeToken()
  }

  _loadAuthToken() {
    const token = this._getStoredToken()
    if (token) {
      this.setAuthToken(token)
      if (isTokenExpired(token)) {
        apiLogger.info("Token expired, attempting to refresh")
        this.refreshToken().catch((err) => {
          apiLogger.warn("Token refresh failed on initialization:", err)
        })
      }
      return token
    }
    return null
  }

  setAuthToken(token) {
    if (token) {
      this.api.defaults.headers.common["Authorization"] = `Bearer ${token}`
      this.api.defaults.headers.common["x-auth-token"] = token
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`
      axios.defaults.headers.common["x-auth-token"] = token
      apiLogger.debug("Auth token set in all API instances")
    } else {
      delete this.api.defaults.headers.common["Authorization"]
      delete this.api.defaults.headers.common["x-auth-token"]
      delete axios.defaults.headers.common["Authorization"]
      delete axios.defaults.headers.common["x-auth-token"]
      apiLogger.debug("Auth token removed from all API instances")
    }
  }

  async refreshToken() {
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise
    }
    this.refreshTokenPromise = (async () => {
      try {
        apiLogger.info("Refreshing authentication token...")
        const currentToken = this._getStoredToken()
        if (!currentToken) {
          apiLogger.warn("No token available for refresh")
          return null
        }
        const response = await axios.post(
          `${this.baseURL}/auth/refresh-token`,
          { token: currentToken },
          {
            headers: { "Content-Type": "application/json", "x-no-cache": "true" },
          },
        )
        if (response.data && response.data.success && response.data.token) {
          const token = response.data.token
          this._storeToken(token, localStorage.getItem("token") !== null)
          this.setAuthToken(token)
          apiLogger.info("Token refreshed successfully")
          this._retryQueuedRequests(token)
          try {
            const payload = JSON.parse(atob(token.split(".")[1]))
            if (payload.exp) {
              const expiresIn = payload.exp * 1000 - Date.now() - 60000
              if (expiresIn > 0) {
                this.tokenRefreshTimer = setTimeout(() => this.refreshToken(), expiresIn)
                apiLogger.debug(`Scheduled next token refresh in ${Math.round(expiresIn / 1000)} seconds`)
              }
            }
          } catch (e) {
            apiLogger.error("Error scheduling token refresh:", e)
          }
          return token
        } else {
          apiLogger.warn("Invalid refresh token response:", response.data)
          throw new Error("Invalid refresh token response")
        }
      } catch (error) {
        apiLogger.error("Token refresh failed:", error)
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          this._removeToken()
          this.setAuthToken(null)
          toast.error("Your session has expired. Please log in again.")
          if (typeof window !== "undefined" && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent("authLogout"))
          }
        }
        return null
      } finally {
        setTimeout(() => {
          this.refreshTokenPromise = null
        }, 1000)
      }
    })()
    return this.refreshTokenPromise
  }

  _retryQueuedRequests(token) {
    const requestsToRetry = [...this.requestsToRetry]
    this.requestsToRetry = []
    apiLogger.info(`Retrying ${requestsToRetry.length} queued requests with new token`)
    requestsToRetry.forEach((config) => {
      config.headers.Authorization = `Bearer ${token}`
      config.headers["x-auth-token"] = token
      this.api(config).catch((err) => {
        apiLogger.error(`Error retrying queued request: ${config.method} ${config.url}`, err)
      })
    })
  }

  // Add a helper method to process API responses consistently
  _processResponse(response) {
    // If the response is already in our expected format, return it
    if (response && typeof response.success === "boolean") {
      return response
    }

    // If the response is an error object with a message
    if (response && response.error) {
      return {
        success: false,
        error: response.error,
        data: response,
      }
    }

    // Otherwise, transform it to our expected format
    return {
      success: true,
      data: response,
    }
  }

  // Enhanced utility to validate and sanitize MongoDB ObjectIds
  isValidObjectId = (id) => {
    if (!id) return false;
    
    // If it's already a valid ObjectId string format, return true
    if (typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id)) {
      return true;
    }
    
    // Try to extract a valid ObjectId from complex formats
    try {
      // Convert to string first
      const idStr = String(id);
      
      // If it's a clean 24-char string, check directly
      if (idStr.length === 24 && /^[0-9a-fA-F]{24}$/.test(idStr)) {
        return true;
      }
      
      // Look for a 24-character hex sequence embedded in a longer string
      const match = idStr.match(/([0-9a-fA-F]{24})/);
      if (match && match[1]) {
        return true;
      }
      
      // Check for ObjectId wrapping pattern
      const objectIdMatch = idStr.match(/ObjectId\(['"](.*)['"]\)/);
      if (objectIdMatch && objectIdMatch[1] && /^[0-9a-fA-F]{24}$/.test(objectIdMatch[1])) {
        return true;
      }
    } catch (err) {
      apiLogger.debug(`ObjectId validation error: ${err.message}`);
    }
    
    return false;
  }
  
  // Extract a valid ObjectId string from various formats
  sanitizeObjectId = (id) => {
    if (!id) return null;
    
    try {
      // If already a string in the correct format, return as is
      if (typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id)) {
        return id;
      }
      
      // Convert to string
      const idStr = String(id);
      
      // Extract valid ObjectId if embedded in a longer string
      const match = idStr.match(/([0-9a-fA-F]{24})/);
      if (match && match[1]) {
        return match[1];
      }
      
      // Handle ObjectId wrapper format
      const objectIdMatch = idStr.match(/ObjectId\(['"](.*)['"]\)/);
      if (objectIdMatch && objectIdMatch[1] && /^[0-9a-fA-F]{24}$/.test(objectIdMatch[1])) {
        return objectIdMatch[1];
      }
      
      // Handle object with _id property
      if (typeof id === 'object' && id !== null) {
        if (id._id) return this.sanitizeObjectId(id._id);
        if (id.id) return this.sanitizeObjectId(id.id);
      }
      
      // If all else fails, return null
      return null;
    } catch (err) {
      apiLogger.error(`Failed to sanitize ObjectId: ${err.message}`);
      return null;
    }
  }

  // Update the get method to use the _processResponse helper and sanitize ObjectIds
  async get(url, params = {}, options = {}) {
    try {
      // Check if the endpoint contains an ID parameter (common pattern: /users/:id, /messages/:id)
      const idMatch = url.match(/\/([^/]+)$/)
      if (idMatch && idMatch[1] && !url.includes("?") && !url.endsWith("/")) {
        const potentialId = idMatch[1]
        
        // Try to sanitize the ID first if it might be an ObjectId
        if (potentialId.length >= 24 || potentialId.includes("ObjectId")) {
          const sanitizedId = this.sanitizeObjectId(potentialId);
          if (sanitizedId && sanitizedId !== potentialId) {
            // Replace the invalid ID with the sanitized one
            apiLogger.debug(`Sanitized ObjectId in URL: ${potentialId} -> ${sanitizedId}`);
            url = url.replace(potentialId, sanitizedId);
          } else if (potentialId.length === 24 && !this.isValidObjectId(potentialId)) {
            apiLogger.error(`Invalid ObjectId in request: ${potentialId}`)
            return {
              success: false,
              error: "Invalid ID format",
              status: 400,
            }
          }
        }
      }
      
      // Sanitize any ID params in the request
      const sanitizedParams = { ...params };
      for (const key in sanitizedParams) {
        if (key.toLowerCase().includes('id') && sanitizedParams[key]) {
          const sanitizedId = this.sanitizeObjectId(sanitizedParams[key]);
          if (sanitizedId) {
            apiLogger.debug(`Sanitized param ${key}: ${sanitizedParams[key]} -> ${sanitizedId}`);
            sanitizedParams[key] = sanitizedId;
          }
        }
      }

      // Continue with the original request using sanitized values
      const response = await this.api.get(url, {
        params: sanitizedParams,
        ...options,
        cancelToken: options.request?.cancelToken || options.cancelToken,
      })
      return this._processResponse(response)
    } catch (error) {
      apiLogger.error(`GET request failed: ${url}`, error)
      throw error
    }
  }

  // Update the post method to use the _processResponse helper and sanitize ObjectIds
  async post(url, data = {}, options = {}) {
    try {
      if (options.invalidateCache !== false) {
        this.cache.invalidate(url)
      }
      
      // Sanitize any ID fields in the request body
      const sanitizedData = { ...data };
      this._sanitizeObjectInPlace(sanitizedData);
      
      const response = await this.api.post(url, sanitizedData, {
        ...options,
        cancelToken: options.request?.cancelToken || options.cancelToken,
      })
      return this._processResponse(response)
    } catch (error) {
      apiLogger.error(`POST request failed: ${url}`, error)
      throw error
    }
  }
  
  // Helper method to recursively sanitize object IDs within an object
  _sanitizeObjectInPlace(obj) {
    if (!obj || typeof obj !== 'object') return;
    
    Object.keys(obj).forEach(key => {
      // If this is an ID field, sanitize it
      if ((key === '_id' || key === 'id' || key.endsWith('Id')) && obj[key]) {
        const sanitizedId = this.sanitizeObjectId(obj[key]);
        if (sanitizedId) {
          obj[key] = sanitizedId;
        }
      } 
      // Recursively process nested objects and arrays
      else if (obj[key] && typeof obj[key] === 'object') {
        if (Array.isArray(obj[key])) {
          // Process array items
          obj[key].forEach(item => {
            if (item && typeof item === 'object') {
              this._sanitizeObjectInPlace(item);
            }
          });
        } else {
          // Process nested object
          this._sanitizeObjectInPlace(obj[key]);
        }
      }
    });
  }

  // Update the put method to use the _processResponse helper and sanitize ObjectIds
  async put(url, data = {}, options = {}) {
    try {
      if (options.invalidateCache !== false) {
        this.cache.invalidate(url)
      }
      
      // Sanitize any ID fields in the request body
      const sanitizedData = { ...data };
      this._sanitizeObjectInPlace(sanitizedData);
      
      const response = await this.api.put(url, sanitizedData, {
        ...options,
        cancelToken: options.request?.cancelToken || options.cancelToken,
      })
      return this._processResponse(response)
    } catch (error) {
      apiLogger.error(`PUT request failed: ${url}`, error)
      throw error
    }
  }

  // Update the delete method to use the _processResponse helper and sanitize ObjectIds
  async delete(url, options = {}) {
    try {
      if (options.invalidateCache !== false) {
        this.cache.invalidate(url)
      }
      
      // Check if the endpoint contains an ID parameter and sanitize if needed
      const idMatch = url.match(/\/([^/]+)$/)
      if (idMatch && idMatch[1] && !url.includes("?") && !url.endsWith("/")) {
        const potentialId = idMatch[1]
        
        // Try to sanitize the ID first if it might be an ObjectId
        if (potentialId.length >= 24 || potentialId.includes("ObjectId")) {
          const sanitizedId = this.sanitizeObjectId(potentialId);
          if (sanitizedId && sanitizedId !== potentialId) {
            // Replace the invalid ID with the sanitized one
            apiLogger.debug(`Sanitized ObjectId in DELETE URL: ${potentialId} -> ${sanitizedId}`);
            url = url.replace(potentialId, sanitizedId);
          }
        }
      }
      
      const response = await this.api.delete(url, {
        ...options,
        cancelToken: options.request?.cancelToken || options.cancelToken,
      })
      return this._processResponse(response)
    } catch (error) {
      apiLogger.error(`DELETE request failed: ${url}`, error)
      throw error
    }
  }

  async upload(url, formData, onProgress = null, options = {}) {
    try {
      const cancelToken = options.request?.cancelToken || options.cancelToken || axios.CancelToken.source().token;
      const response = await this.api.post(url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: onProgress
          ? (progressEvent) => {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              onProgress(percentCompleted)
            }
          : undefined,
        cancelToken: cancelToken,
        ...options,
      })
      return response
    } catch (error) {
      apiLogger.error(`Upload failed: ${url}`, error)
      throw error
    }
  }

  async download(url, params = {}, onProgress = null, options = {}) {
    try {
      const cancelToken = options.request?.cancelToken || options.cancelToken || axios.CancelToken.source().token;
      const response = await this.api.get(url, {
        params,
        responseType: "blob",
        onDownloadProgress: onProgress
          ? (progressEvent) => {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              onProgress(percentCompleted)
            }
          : undefined,
        cancelToken: cancelToken,
        ...options,
      })
      return response
    } catch (error) {
      apiLogger.error(`Download failed: ${url}`, error)
      throw error
    }
  }

  createCancelToken() {
    return axios.CancelToken.source()
  }

  /**
   * Creates a cancelable request object that can be used with the useApi hook
   * @returns {Object} An object with request and cancel properties
   */
  createCancelableRequest() {
    const source = axios.CancelToken.source();
    return {
      request: { cancelToken: source.token },
      cancel: () => source.cancel('Request canceled')
    };
  }

  isCancel(error) {
    return axios.isCancel(error)
  }

  cancelAllRequests(reason = "Request canceled by user") {
    const pendingCount = this.pendingRequests.size
    if (pendingCount > 0) {
      apiLogger.info(`Canceling ${pendingCount} pending requests: ${reason}`)
      for (const [requestId, requestData] of this.pendingRequests.entries()) {
        const source = axios.CancelToken.source()
        source.cancel(reason)
        this.pendingRequests.delete(requestId)
      }
    }
  }

  async testConnection() {
    try {
      const { request, cancel } = this.createCancelableRequest();
      const timeout = setTimeout(() => {
        cancel("Connection test timeout")
      }, 5000)
      const result = await this.get("/auth/test-connection", {}, { request })
      clearTimeout(timeout)
      return {
        success: true,
        data: result,
        ping: result.timestamp ? new Date() - new Date(result.timestamp) : null,
      }
    } catch (error) {
      return {
        success: false,
        error: error.error || error.message || "Connection test failed",
        isOffline: !navigator.onLine,
      }
    }
  }

  async getHealthStatus() {
    try {
      const result = await this.get("/health", {}, { timeout: 3000 })
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error.error || error.message || "Health check failed" }
    }
  }

  getMetrics() {
    return { ...this.metrics }
  }

  clearCache(url = null) {
    this.cache.invalidate(url)
  }

  processQueue() {
    if (navigator.onLine) {
      this.requestQueue.processQueue()
    }
  }

  cleanup() {
    this.cancelAllRequests("API service cleanup")
    if (this.networkMonitor) {
      this.networkMonitor.cleanup()
    }
  }

  async login(credentials, rememberMe = false) {
    try {
      const response = await this.post("/auth/login", credentials)
      if (response.success && response.token) {
        this._storeToken(response.token, rememberMe)
        this.setAuthToken(response.token)
        return response
      }
      throw new Error(response.error || "Invalid login response")
    } catch (error) {
      throw error
    }
  }

  async logout() {
    try {
      const token = this._getStoredToken()
      if (token) {
        await this.post("/auth/logout")
      }
    } catch (error) {
      apiLogger.warn("Logout request failed:", error)
    } finally {
      this._removeToken()
      this.setAuthToken(null)
      this.cancelAllRequests("User logout")
      this.clearCache()
    }
  }
}

// Create singleton instance
const apiService = new ApiService()

// Register cleanup on window unload
if (typeof window !== "undefined") {
  window.addEventListener("unload", () => {
    apiService.pendingRequests.forEach((request) => {
      if (request.config?.cancelToken?.cancel) {
        request.config.cancelToken.cancel("Navigation canceled request")
      }
    })
  })
}

export default apiService
