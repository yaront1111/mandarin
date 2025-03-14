// src/services/apiService.js
import axios from "axios"
import { toast } from "react-toastify"

/**
 * Logger utility with configurable log levels
 */
class Logger {
  constructor(name) {
    this.name = name
    this.logLevel = process.env.NODE_ENV === "production" ? "error" : "debug"
    this.levels = { debug: 1, info: 2, warn: 3, error: 4 }
  }

  shouldLog(level) {
    return this.levels[level] >= this.levels[this.logLevel]
  }

  prefix(level) {
    return `[${this.name}][${level.toUpperCase()}]`
  }

  debug(...args) {
    if (this.shouldLog("debug")) {
      console.debug(this.prefix("debug"), ...args)
    }
  }

  info(...args) {
    if (this.shouldLog("info")) {
      console.info(this.prefix("info"), ...args)
    }
  }

  warn(...args) {
    if (this.shouldLog("warn")) {
      console.warn(this.prefix("warn"), ...args)
    }
  }

  error(...args) {
    if (this.shouldLog("error")) {
      console.error(this.prefix("error"), ...args)
    }
  }
}

/**
 * Cache implementation for API responses
 */
class ResponseCache {
  constructor(maxSize = 100, ttl = 60000) {
    this.cache = new Map()
    this.maxSize = maxSize // Maximum number of cached responses
    this.ttl = ttl // Time-to-live in milliseconds
    this.logger = new Logger("ResponseCache")
  }

  generateKey(url, params) {
    const sortedParams = params ? JSON.stringify(Object.entries(params).sort()) : ""
    return `${url}:${sortedParams}`
  }

  set(url, params, data) {
    // Don't cache failed responses
    if (!data || !data.success) return null

    const key = this.generateKey(url, params)
    const expiresAt = Date.now() + this.ttl

    // Make room if cache is full
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry (first in Map)
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
      this.logger.debug(`Cache full, removing oldest entry: ${oldestKey}`)
    }

    this.cache.set(key, { data, expiresAt })
    this.logger.debug(`Cached response for: ${key}`)
    return data
  }

  get(url, params) {
    const key = this.generateKey(url, params)
    const cached = this.cache.get(key)

    if (!cached) {
      this.logger.debug(`Cache miss for: ${key}`)
      return null
    }

    // Check if entry has expired
    if (cached.expiresAt < Date.now()) {
      this.logger.debug(`Cache expired for: ${key}`)
      this.cache.delete(key)
      return null
    }

    this.logger.debug(`Cache hit for: ${key}`)
    return cached.data
  }

  invalidate(url, params) {
    const key = params ? this.generateKey(url, params) : null

    if (key) {
      // Invalidate specific entry
      this.cache.delete(key)
      this.logger.debug(`Invalidated cache for: ${key}`)
    } else if (url) {
      // Invalidate all entries with matching URL prefix
      for (const existingKey of this.cache.keys()) {
        if (existingKey.startsWith(`${url}:`)) {
          this.cache.delete(existingKey)
          this.logger.debug(`Invalidated cache for: ${existingKey}`)
        }
      }
    } else {
      // Invalidate entire cache
      this.cache.clear()
      this.logger.debug("Invalidated entire cache")
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
    this.logger = new Logger("NetworkMonitor")

    // Set up event listeners
    window.addEventListener("online", this.handleOnline.bind(this))
    window.addEventListener("offline", this.handleOffline.bind(this))

    this.logger.info(`Network monitor initialized. Online: ${this.isOnline}`)
  }

  handleOnline() {
    this.logger.info("Network connection restored")
    this.isOnline = true
    if (this.onStatusChange) this.onStatusChange(true)
  }

  handleOffline() {
    this.logger.warn("Network connection lost")
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
    this.logger = new Logger("RequestQueue")

    // Restore queue from storage if available
    this.loadFromStorage()
  }

  add(request) {
    this.queue.push({
      ...request,
      timestamp: Date.now(),
      retries: 0,
    })
    this.logger.debug(`Added request to queue: ${request.method} ${request.url}`)
    this.saveToStorage()
    return this.queue.length
  }

  loadFromStorage() {
    try {
      const savedQueue = localStorage.getItem("api_request_queue")
      if (savedQueue) {
        this.queue = JSON.parse(savedQueue)
        this.logger.info(`Loaded ${this.queue.length} requests from storage`)
      }
    } catch (err) {
      this.logger.error("Failed to load queue from storage:", err)
      this.queue = []
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem("api_request_queue", JSON.stringify(this.queue))
    } catch (err) {
      this.logger.error("Failed to save queue to storage:", err)
    }
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return

    this.isProcessing = true
    this.logger.info(`Processing queue with ${this.queue.length} requests`)

    const completedIndices = []

    for (let i = 0; i < this.queue.length; i++) {
      const request = this.queue[i]

      try {
        this.logger.debug(`Processing queued request: ${request.method} ${request.url}`)

        // Execute the request using the API instance
        await this.apiInstance.request({
          url: request.url,
          method: request.method,
          data: request.data,
          params: request.params,
          headers: request.headers,
        })

        completedIndices.push(i)
        this.logger.debug(`Successfully processed queued request: ${request.method} ${request.url}`)
      } catch (err) {
        request.retries++
        this.logger.warn(
          `Failed to process queued request (attempt ${request.retries}): ${request.method} ${request.url}`,
        )

        if (request.retries >= this.maxRetries) {
          completedIndices.push(i)
          this.logger.error(
            `Giving up on queued request after ${this.maxRetries} attempts: ${request.method} ${request.url}`,
          )
        }
      }
    }

    // Remove completed requests (in reverse order to avoid index issues)
    for (let i = completedIndices.length - 1; i >= 0; i--) {
      this.queue.splice(completedIndices[i], 1)
    }

    this.saveToStorage()
    this.isProcessing = false
    this.logger.info(
      `Queue processing complete. ${completedIndices.length} requests processed, ${this.queue.length} remaining`,
    )
  }
}

/**
 * Enhanced API Service for making HTTP requests with advanced features
 */
class ApiService {
  constructor() {
    this.logger = new Logger("ApiService")

    // Determine base URL with fallbacks
    this.baseURL =
      process.env.REACT_APP_API_URL ||
      (window.location.hostname.includes("localhost") ? "http://localhost:5000/api" : "/api")

    this.logger.info(`Initializing with baseURL: ${this.baseURL}`)

    // Create axios instance
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 15000, // 15 second timeout
    })

    // Initialize state
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

    // Initialize cache
    this.cache = new ResponseCache(
      Number.parseInt(process.env.REACT_APP_CACHE_SIZE || "100"),
      Number.parseInt(process.env.REACT_APP_CACHE_TTL || "60000"),
    )

    // Setup request queue for offline operations
    this.requestQueue = new RequestQueue(this.api)

    // Track network state
    this.networkMonitor = new NetworkMonitor(this._handleNetworkStatusChange.bind(this))

    // Setup interceptors
    this._initializeInterceptors()

    // Load auth token from storage
    this._loadAuthToken()
  }

  /**
   * Handle network status changes
   * @param {boolean} isOnline - Whether the client is online
   */
  _handleNetworkStatusChange(isOnline) {
    if (isOnline) {
      // If connection restored, process queued requests
      this.logger.info("Network connection restored. Processing request queue...")
      setTimeout(() => this.requestQueue.processQueue(), 1000)
    } else {
      this.logger.warn("Network offline. Requests will be queued.")
    }

    // Notify the app about connection status
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(
        new CustomEvent("apiConnectionStatusChange", {
          detail: { isOnline },
        }),
      )
    }
  }

  /**
   * Load auth token from storage
   */
  _loadAuthToken() {
    const token = sessionStorage.getItem("token")
    if (token) {
      // Set token in both axios instance and global axios
      this.api.defaults.headers.common["Authorization"] = `Bearer ${token}`
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`

      if (this.isTokenExpired(token)) {
        this.refreshToken().catch((err) => {
          console.warn("Token refresh failed on initialization:", err)
        })
      }
      return token
    }
    return null
  }

  /**
   * Get stored auth token from sessionStorage or localStorage
   * @returns {string|null} - The stored token or null
   */
  _getStoredToken() {
    // Try to get token from sessionStorage first, then localStorage
    const token = sessionStorage.getItem("token") || localStorage.getItem("token")
    return token
  }

  /**
   * Store token in storage
   * @param {string} token - JWT token
   * @param {boolean} rememberMe - Whether to use localStorage for persistence
   */
  _storeToken(token, rememberMe = false) {
    if (!token) return

    // Always store in sessionStorage
    sessionStorage.setItem("token", token)

    // Also store in localStorage if rememberMe is true
    if (rememberMe) {
      localStorage.setItem("token", token)
    } else {
      localStorage.removeItem("token")
    }
  }

  /**
   * Remove token from all storage
   */
  _removeToken() {
    sessionStorage.removeItem("token")
    localStorage.removeItem("token")
  }

  /**
   * Set authentication token for API requests
   * @param {string} token - JWT token
   */
  setAuthToken(token) {
    if (token) {
      this.api.defaults.headers.common["Authorization"] = `Bearer ${token}`
      this.logger.debug("Auth token set")
    } else {
      delete this.api.defaults.headers.common["Authorization"]
      this.logger.debug("Auth token removed")
    }
  }

  /**
   * Check if token is expired
   * @param {string} token - JWT token
   * @returns {boolean} - True if token is expired
   */
  isTokenExpired(token) {
    if (!token) return true

    try {
      // Parse token
      const base64Url = token.split(".")[1]
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
      const payload = JSON.parse(atob(base64))

      // Check expiration (with 30-second buffer)
      const expiresAt = payload.exp * 1000
      const now = Date.now()
      const isExpired = now >= expiresAt - 30000 // 30-second buffer

      if (isExpired) {
        this.logger.debug("Token is expired or expiring soon")
      }

      return isExpired
    } catch (error) {
      this.logger.error("Error parsing JWT token:", error)
      return true
    }
  }

  /**
   * Initialize request and response interceptors
   */
  _initializeInterceptors() {
    // Request interceptor
    this.api.interceptors.request.use(this._handleRequest.bind(this), this._handleRequestError.bind(this))

    // Response interceptor
    this.api.interceptors.response.use(this._handleResponse.bind(this), this._handleResponseError.bind(this))
  }

  /**
   * Handle outgoing request
   * @param {Object} config - Request config
   * @returns {Object} - Modified config
   */
  _handleRequest(config) {
    // Generate unique request ID
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    config.requestId = requestId
    config.startTime = Date.now()

    // Track pending request
    this.pendingRequests.set(requestId, { config, timestamp: Date.now() })

    // Update metrics
    this.metrics.totalRequests++

    // Add cache buster to GET requests if needed
    if (config.method.toLowerCase() === "get" && config.headers["x-no-cache"]) {
      config.params = config.params || {}
      config.params["_"] = Date.now()
    }

    // Check if request should bypass the cache
    const shouldCache = config.method.toLowerCase() === "get" && !config.headers["x-no-cache"]

    // Try to get from cache
    if (shouldCache) {
      const cachedResponse = this.cache.get(config.url, config.params)
      if (cachedResponse) {
        // Cancel the actual request and return cached data
        const source = axios.CancelToken.source()
        config.cancelToken = source.token
        setTimeout(() => source.cancel("Request served from cache"), 0)
      }
    }

    // Check token before request
    const token = this._getStoredToken()
    if (token && this.isTokenExpired(token) && !config.url.includes("/auth/refresh-token")) {
      // Queue request to be retried after token refresh
      if (!config._tokenRefreshRetry) {
        // Mark request for retry and prevent infinite retry loop
        config._tokenRefreshRetry = true
        this.logger.debug(`Token expired before request. Queueing request: ${config.method} ${config.url}`)
        this.requestsToRetry.push(config)

        // Trigger token refresh
        this.refreshToken()

        // Cancel current request
        const source = axios.CancelToken.source()
        config.cancelToken = source.token
        setTimeout(() => source.cancel("Token expired. Request will be retried."), 0)
      }
    }

    this.logger.debug(
      `Request: ${config.method.toUpperCase()} ${config.url}`,
      config.params ? `Params: ${JSON.stringify(config.params)}` : "",
    )

    return config
  }

  /**
   * Handle request error
   * @param {Error} error - Request error
   * @returns {Promise<Error>} - Rejected promise with error
   */
  _handleRequestError(error) {
    this.logger.error("Request error:", error.message)
    this.metrics.failedRequests++
    return Promise.reject(error)
  }

  /**
   * Handle successful response
   * @param {Object} response - Response object
   * @returns {Object} - Response data
   */
  _handleResponse(response) {
    // Calculate response time
    const requestTime = Date.now() - response.config.startTime

    // Update metrics
    this.metrics.successfulRequests++
    this.metrics.avgResponseTime =
      (this.metrics.avgResponseTime * (this.metrics.successfulRequests - 1) + requestTime) /
      this.metrics.successfulRequests

    // Clean up from pendingRequests
    if (response.config.requestId) {
      this.pendingRequests.delete(response.config.requestId)
    }

    this.logger.debug(
      `Response success: ${response.config.method.toUpperCase()} ${response.config.url} (${requestTime}ms)`,
    )

    // Cache successful GET responses if not explicitly disabled
    if (response.config.method.toLowerCase() === "get" && !response.config.headers["x-no-cache"]) {
      this.cache.set(response.config.url, response.config.params, response.data)
    }

    return response.data
  }

  /**
   * Handle response error
   * @param {Error} error - Response error
   * @returns {Promise<Error>} - Rejected promise with error
   */
  _handleResponseError(error) {
    // Handle canceled requests (e.g. from cache)
    if (axios.isCancel(error)) {
      this.logger.debug(`Request canceled: ${error.message}`)

      // If canceled due to cache hit, try to find and return cached response
      if (error.message === "Request served from cache" && error.config) {
        const cachedResponse = this.cache.get(error.config.url, error.config.params)
        if (cachedResponse) {
          return Promise.resolve(cachedResponse)
        }
      }

      return Promise.reject({
        success: false,
        error: "Request canceled",
        isCanceled: true,
      })
    }

    // Update metrics
    this.metrics.failedRequests++

    // Clean up from pendingRequests
    if (error.config?.requestId) {
      this.pendingRequests.delete(error.config.requestId)
    }

    // Handle network errors (no response)
    if (!error.response) {
      const errorMsg = navigator.onLine
        ? "Network error. Please check your connection."
        : "You are currently offline. Request has been queued."

      // If offline, queue non-GET requests for later
      if (!navigator.onLine && error.config && error.config.method !== "get") {
        this.logger.warn(`Offline detected. Queueing request: ${error.config.method} ${error.config.url}`)
        this.requestQueue.add({
          url: error.config.url,
          method: error.config.method,
          data: error.config.data,
          params: error.config.params,
          headers: error.config.headers,
        })

        // Show queued notification
        toast.info("You are offline. Your action will be processed when connection is restored.")
      } else {
        toast.error(errorMsg)
      }

      return Promise.reject({
        success: false,
        error: errorMsg,
        isOffline: !navigator.onLine,
      })
    }

    // Handle actual HTTP error responses
    return this._processHttpError(error)
  }

  /**
   * Process HTTP error response
   * @param {Error} error - HTTP error
   * @returns {Promise<Error>} - Rejected promise with error
   */
  async _processHttpError(error) {
    const originalRequest = error.config
    const status = error.response.status

    this.logger.error(
      `Response error: ${originalRequest.method.toUpperCase()} ${originalRequest.url}`,
      `Status: ${status}`,
      error.response.data,
    )

    // Handle token refresh for 401 errors
    if (status === 401 && !originalRequest._retry) {
      return this._handleAuthError(error)
    }

    // Format error data
    const errorData = error.response.data
    const errorMsg = errorData?.error || errorData?.message || "An error occurred"
    const errorCode = errorData?.code || null

    // Handle specific HTTP error codes with toast notifications
    this._showErrorNotification(status, errorMsg, errorCode)

    // Return standardized error object
    return Promise.reject({
      success: false,
      error: errorMsg,
      code: errorCode,
      status,
      data: error.response.data,
    })
  }

  /**
   * Handle authentication error (401)
   * @param {Error} error - Auth error
   * @returns {Promise} - Promise that resolves to retried request or rejects
   */
  async _handleAuthError(error) {
    const originalRequest = error.config
    originalRequest._retry = true

    // Don't retry refresh token requests
    if (originalRequest.url.includes("/auth/refresh-token")) {
      this.logger.warn("Refresh token request failed")
      this._handleLogout("Session expired. Please log in again.")
      return Promise.reject({
        success: false,
        error: "Authentication failed",
        status: 401,
      })
    }

    this.logger.debug("Received 401 error. Attempting token refresh...")

    try {
      // Wait for token refresh
      const newToken = await this.refreshToken()

      if (newToken) {
        this.logger.debug("Token refreshed successfully. Retrying original request.")

        // Update authorization header
        originalRequest.headers.Authorization = `Bearer ${newToken}`

        // Retry the original request
        return this.api(originalRequest)
      } else {
        throw new Error("Failed to refresh token")
      }
    } catch (refreshError) {
      this.logger.error("Token refresh failed:", refreshError)
      this._handleLogout("Session expired. Please log in again.")

      return Promise.reject({
        success: false,
        error: "Authentication failed",
        status: 401,
      })
    }
  }

  /**
   * Show appropriate error notifications based on status code
   * @param {number} status - HTTP status code
   * @param {string} message - Error message
   * @param {string} code - Error code (optional)
   */
  _showErrorNotification(status, message, code) {
    // Only show toast for requests in foreground
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

  /**
   * Handle logout process
   * @param {string} message - Message to display
   */
  _handleLogout(message) {
    // Clear tokens
    this._removeToken()
    this.setAuthToken(null)

    // Show notification
    toast.error(message)

    // Redirect to login page after a short delay
    setTimeout(() => {
      // Dispatch logout event
      if (typeof window !== "undefined" && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent("authLogout"))
      }

      // Redirect to login
      window.location.href = "/login"
    }, 1500)
  }

  /**
   * Refresh authentication token
   * @returns {Promise<string|null>} - New token or null if refresh fails
   */
  async refreshToken() {
    // If a refresh is already in progress, return that promise
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise
    }

    // Create new refresh promise
    this.refreshTokenPromise = (async () => {
      try {
        this.logger.debug("Refreshing authentication token...")

        // Get current token
        const currentToken = this._getStoredToken()
        if (!currentToken) {
          throw new Error("No token available for refresh")
        }

        // Clear any existing token refresh timer
        if (this.tokenRefreshTimer.current) {
          clearTimeout(this.tokenRefreshTimer.current)
          this.tokenRefreshTimer.current = null
        }

        // Make refresh request
        const response = await this.api.post(
          "/auth/refresh-token",
          {
            token: currentToken,
          },
          {
            // Special options for refresh request
            headers: { "x-no-cache": "true" },
            _isRefreshRequest: true,
          },
        )

        if (response.success && response.token) {
          const token = response.token

          // Store new token
          this._storeToken(token, localStorage.getItem("token") !== null)
          this.setAuthToken(token)

          this.logger.debug("Token refreshed successfully")

          // Process queued requests
          this._retryQueuedRequests(token)

          return token
        } else {
          throw new Error("Invalid refresh token response")
        }
      } catch (error) {
        this.logger.error("Token refresh failed:", error)

        // Clear tokens on refresh failure
        this._removeToken()
        this.setAuthToken(null)

        // Notify user about authentication failure
        toast.error("Your session has expired. Please log in again.")

        // Redirect to login after a short delay
        setTimeout(() => {
          window.location.href = "/login"
        }, 1500)

        return null
      } finally {
        // Clear refresh promise to allow future refresh attempts
        this.refreshTokenPromise = null
      }
    })()

    return this.refreshTokenPromise
  }

  /**
   * Retry requests that were queued during token refresh
   * @param {string} token - New auth token
   */
  _retryQueuedRequests(token) {
    const requestsToRetry = [...this.requestsToRetry]
    this.requestsToRetry = []

    this.logger.debug(`Retrying ${requestsToRetry.length} queued requests with new token`)

    // Retry each request with the new token
    requestsToRetry.forEach((config) => {
      config.headers.Authorization = `Bearer ${token}`
      this.api(config).catch((err) => {
        this.logger.error(`Error retrying queued request: ${config.method} ${config.url}`, err)
      })
    })
  }

  /**
   * Make a GET request with caching
   * @param {string} url - Request URL
   * @param {Object} params - Query parameters
   * @param {Object} options - Request options
   * @returns {Promise<Object>} - Response data
   */
  async get(url, params = {}, options = {}) {
    try {
      // Check if this is a force refresh request
      const forceRefresh = options.forceRefresh === true
      if (forceRefresh) {
        options.headers = { ...options.headers, "x-no-cache": "true" }
      }

      // Check if we should try cache
      if (!forceRefresh && options.useCache !== false) {
        const cachedResponse = this.cache.get(url, params)
        if (cachedResponse) {
          return cachedResponse
        }
      }

      // Make the request
      const response = await this.api.get(url, {
        params,
        ...options,
        cancelToken: options.cancelToken,
      })

      return response
    } catch (error) {
      // If error is a canceled request due to cache hit, return the error
      // because the interceptor will resolve with cached data
      if (axios.isCancel(error) && error.message === "Request served from cache") {
        throw error
      }

      // Otherwise, log and propagate the error
      this.logger.error(`GET request failed: ${url}`, error)
      throw error
    }
  }

  /**
   * Make a POST request
   * @param {string} url - Request URL
   * @param {Object} data - Request body
   * @param {Object} options - Request options
   * @returns {Promise<Object>} - Response data
   */
  async post(url, data = {}, options = {}) {
    try {
      // Invalidate cache for resource when making POST request
      if (options.invalidateCache !== false) {
        this.cache.invalidate(url)
      }

      const response = await this.api.post(url, data, {
        ...options,
        cancelToken: options.cancelToken,
      })

      return response
    } catch (error) {
      this.logger.error(`POST request failed: ${url}`, error)
      throw error
    }
  }

  /**
   * Make a PUT request
   * @param {string} url - Request URL
   * @param {Object} data - Request body
   * @param {Object} options - Request options
   * @returns {Promise<Object>} - Response data
   */
  async put(url, data = {}, options = {}) {
    try {
      // Invalidate cache for resource when making PUT request
      if (options.invalidateCache !== false) {
        this.cache.invalidate(url)
      }

      const response = await this.api.put(url, data, {
        ...options,
        cancelToken: options.cancelToken,
      })

      return response
    } catch (error) {
      this.logger.error(`PUT request failed: ${url}`, error)
      throw error
    }
  }

  /**
   * Make a DELETE request
   * @param {string} url - Request URL
   * @param {Object} options - Request options
   * @returns {Promise<Object>} - Response data
   */
  async delete(url, options = {}) {
    try {
      // Invalidate cache for resource when making DELETE request
      if (options.invalidateCache !== false) {
        this.cache.invalidate(url)
      }

      const response = await this.api.delete(url, {
        ...options,
        cancelToken: options.cancelToken,
      })

      return response
    } catch (error) {
      this.logger.error(`DELETE request failed: ${url}`, error)
      throw error
    }
  }

  /**
   * Upload file with progress tracking
   * @param {string} url - Request URL
   * @param {FormData} formData - Form data with files
   * @param {Function} onProgress - Progress callback
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Response data
   */
  async upload(url, formData, onProgress = null, options = {}) {
    try {
      // Create cancel token
      const source = axios.CancelToken.source()

      const response = await this.api.post(url, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: onProgress
          ? (progressEvent) => {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              onProgress(percentCompleted)
            }
          : undefined,
        cancelToken: source.token,
        ...options,
      })

      return response
    } catch (error) {
      this.logger.error(`Upload failed: ${url}`, error)
      throw error
    }
  }

  /**
   * Download file with progress tracking
   * @param {string} url - Request URL
   * @param {Object} params - Query parameters
   * @param {Function} onProgress - Progress callback
   * @param {Object} options - Additional options
   * @returns {Promise<Blob>} - Response blob
   */
  async download(url, params = {}, onProgress = null, options = {}) {
    try {
      // Create cancel token
      const source = axios.CancelToken.source()

      const response = await this.api.get(url, {
        params,
        responseType: "blob",
        onDownloadProgress: onProgress
          ? (progressEvent) => {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              onProgress(percentCompleted)
            }
          : undefined,
        cancelToken: source.token,
        ...options,
      })

      return response
    } catch (error) {
      this.logger.error(`Download failed: ${url}`, error)
      throw error
    }
  }

  /**
   * Create a request cancellation token
   * @returns {Object} - Cancellation token source
   */
  createCancelToken() {
    return axios.CancelToken.source()
  }

  /**
   * Check if error is due to request cancellation
   * @param {Error} error - Error to check
   * @returns {boolean} - True if error is due to cancellation
   */
  isCancel(error) {
    return axios.isCancel(error)
  }

  /**
   * Cancel all pending requests
   * @param {string} reason - Cancellation reason
   */
  cancelAllRequests(reason = "Request canceled by user") {
    const pendingCount = this.pendingRequests.size

    if (pendingCount > 0) {
      this.logger.debug(`Canceling ${pendingCount} pending requests: ${reason}`)

      // Create new cancel token for each request
      for (const [requestId, requestData] of this.pendingRequests.entries()) {
        const source = axios.CancelToken.source()
        source.cancel(reason)
        this.pendingRequests.delete(requestId)
      }
    }
  }

  /**
   * Test API connection
   * @returns {Promise<Object>} - Connection test result
   */
  async testConnection() {
    try {
      const source = this.createCancelToken()

      // Set timeout to cancel if it takes too long
      const timeout = setTimeout(() => {
        source.cancel("Connection test timeout")
      }, 5000)

      const result = await this.get(
        "/auth/test-connection",
        {},
        {
          cancelToken: source.token,
        },
      )

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

  /**
   * Get API health status
   * @returns {Promise<Object>} - Health status
   */
  async getHealthStatus() {
    try {
      const result = await this.get(
        "/health",
        {},
        {
          timeout: 3000,
        },
      )

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      return {
        success: false,
        error: error.error || error.message || "Health check failed",
      }
    }
  }

  /**
   * Get API metrics
   * @returns {Object} - API metrics
   */
  getMetrics() {
    return { ...this.metrics }
  }

  /**
   * Clear response cache
   * @param {string} url - URL pattern to clear (optional)
   */
  clearCache(url = null) {
    this.cache.invalidate(url)
  }

  /**
   * Process offline request queue
   */
  processQueue() {
    if (navigator.onLine) {
      this.requestQueue.processQueue()
    }
  }

  /**
   * Clean up resources (call on app unmount)
   */
  cleanup() {
    // Cancel all pending requests
    this.cancelAllRequests("API service cleanup")

    // Clean up network monitor
    if (this.networkMonitor) {
      this.networkMonitor.cleanup()
    }
  }

  /**
   * Login helper
   * @param {Object} credentials - Login credentials
   * @param {boolean} rememberMe - Whether to remember login
   * @returns {Promise<Object>} - Login result
   */
  async login(credentials, rememberMe = false) {
    try {
      const response = await this.post("/auth/login", credentials)

      if (response.success && response.token) {
        // Store token
        this._storeToken(response.token, rememberMe)
        this.setAuthToken(response.token)
        return response
      }

      throw new Error("Invalid login response")
    } catch (error) {
      throw error
    }
  }

  /**
   * Logout helper
   */
  async logout() {
    try {
      // Call logout endpoint if authenticated
      const token = this._getStoredToken()
      if (token) {
        await this.post("/auth/logout")
      }
    } catch (error) {
      this.logger.warn("Logout request failed:", error)
    } finally {
      // Clear tokens and cancel requests
      this._removeToken()
      this.setAuthToken(null)
      this.cancelAllRequests("User logout")
      this.clearCache()
    }
  }

  _handleConnectionFailure() {
    // Prevent multiple concurrent reconnection timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    toast.error("Could not establish connection. Retrying...")

    const backoffTime = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts))
    this.reconnectAttempts++
    console.log(`Reconnect attempt ${this.reconnectAttempts} scheduled in ${backoffTime / 1000}s`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        if (this.userId) {
          const token = sessionStorage.getItem("token")
          if (token) {
            this.init(this.userId, token)
          } else {
            console.error("No token available for reconnection")
            toast.error("Authentication expired. Please refresh the page.")
          }
        }
      } else {
        toast.error("Could not reconnect. Please refresh the page.")
      }
    }, backoffTime)
  }

  // Improve token refresh mechanism with proper request queuing
  async refreshToken() {
    // If a refresh is already in progress, return that promise
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise
    }

    // Create new refresh promise
    this.refreshTokenPromise = (async () => {
      try {
        this.logger.debug("Refreshing authentication token...")

        // Get current token
        const currentToken = this._getStoredToken()
        if (!currentToken) {
          throw new Error("No token available for refresh")
        }

        // Clear any existing token refresh timer
        if (this.tokenRefreshTimer.current) {
          clearTimeout(this.tokenRefreshTimer.current)
          this.tokenRefreshTimer.current = null
        }

        // Make refresh request
        const response = await this.api.post(
          "/auth/refresh-token",
          {
            token: currentToken,
          },
          {
            // Special options for refresh request
            headers: { "x-no-cache": "true" },
            _isRefreshRequest: true,
          },
        )

        if (response.success && response.token) {
          const token = response.token

          // Store new token
          this._storeToken(token, localStorage.getItem("token") !== null)
          this.setAuthToken(token)

          this.logger.debug("Token refreshed successfully")

          // Process queued requests
          this._retryQueuedRequests(token)

          return token
        } else {
          throw new Error("Invalid refresh token response")
        }
      } catch (error) {
        this.logger.error("Token refresh failed:", error)

        // Clear tokens on refresh failure
        this._removeToken()
        this.setAuthToken(null)

        // Notify user about authentication failure
        toast.error("Your session has expired. Please log in again.")

        // Redirect to login after a short delay
        setTimeout(() => {
          window.location.href = "/login"
        }, 1500)

        return null
      } finally {
        // Clear refresh promise to allow future refresh attempts
        this.refreshTokenPromise = null
      }
    })()

    return this.refreshTokenPromise
  }
}

// Create singleton instance
const apiService = new ApiService()

// Register cleanup on window unload
if (typeof window !== "undefined") {
  window.addEventListener("unload", () => {
    apiService.cleanup()
  })
}

export default apiService
