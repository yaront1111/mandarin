// server/socket/enhanced/backoff.js
// Exponential backoff utility for Socket.IO connections

import logger from "../../logger.js";

// Create a logger instance for the backoff module
const log = {
  info: (...args) => console.log("[socket:backoff]", ...args),
  error: (...args) => console.error("[socket:backoff]", ...args),
  warn: (...args) => console.warn("[socket:backoff]", ...args),
  debug: (...args) => console.debug("[socket:backoff]", ...args)
};

/**
 * Implements an advanced sliding-window rate limiter with exponential backoff.
 * Provides backoff functionality for connection attempts and other socket operations.
 */
class ExponentialBackoffLimiter {
  /**
   * Create a new limiter
   * @param {Object} options Limiter configuration
   * @param {number} options.initialDelay Initial delay in ms
   * @param {number} options.maxDelay Maximum delay in ms
   * @param {number} options.factor Multiplication factor for each step (default: 2)
   * @param {number} options.jitter Random jitter factor (0-1) to add to delay
   * @param {number} options.maxAttempts Maximum attempts before triggering cooldown
   * @param {number} options.cooldownTime Cooldown time in ms after max attempts
   * @param {boolean} options.trackIpHistory Whether to track IP history for more accurate rate limiting
   * @param {string} options.name Limiter name for logging purposes
   */
  constructor({
    initialDelay = 1000,
    maxDelay = 60000,
    factor = 2,
    jitter = 0.2,
    maxAttempts = 5,
    cooldownTime = 15 * 60 * 1000, // 15 minutes
    trackIpHistory = false,
    name = "default"
  }) {
    this.initialDelay = initialDelay;
    this.maxDelay = maxDelay;
    this.factor = factor;
    this.jitter = jitter;
    this.maxAttempts = maxAttempts;
    this.cooldownTime = cooldownTime;
    this.trackIpHistory = trackIpHistory;
    this.name = name;
    
    // Maps IP or key to attempt history
    this.attempts = new Map();
    
    // Maps IP or key to cooldown end time
    this.cooldowns = new Map();
    
    // Optional IP history tracking for more advanced rate limiting
    this.ipHistory = trackIpHistory ? new Map() : null;
    
    // Set up cleanup interval, using .unref() to prevent keeping process alive
    this._cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
    
    log.info(`Created ${name} backoff limiter: initialDelay=${initialDelay}ms, maxDelay=${maxDelay}ms, factor=${factor}, maxAttempts=${maxAttempts}`);
  }
  
  /**
   * Calculate the exponential backoff delay for a specific attempt number
   * @param {number} attempt Current attempt number
   * @returns {number} Delay in milliseconds
   */
  calculateDelay(attempt) {
    if (attempt <= 0) return 0;
    
    // Calculate exponential backoff
    let delay = this.initialDelay * Math.pow(this.factor, attempt - 1);
    
    // Apply maximum
    delay = Math.min(delay, this.maxDelay);
    
    // Add random jitter to prevent "thundering herd"
    if (this.jitter > 0) {
      const jitterAmount = delay * this.jitter;
      delay += Math.random() * jitterAmount;
    }
    
    return Math.floor(delay);
  }
  
  /**
   * Record an attempt for a specific key and get the recommended delay
   * @param {string} key Key to track (can be IP, user ID, etc.)
   * @param {string} [ip] Optional IP address for enhanced tracking
   * @returns {Object} Result containing delay and limited status
   */
  recordAttempt(key, ip = null) {
    const now = Date.now();
    
    // Check if in cooldown
    if (this.cooldowns.has(key)) {
      const cooldownEnd = this.cooldowns.get(key);
      if (now < cooldownEnd) {
        const remainingCooldown = cooldownEnd - now;
        log.debug(`${this.name}: Key ${key} in cooldown for ${Math.ceil(remainingCooldown/1000)}s more`);
        return {
          limited: true,
          delay: remainingCooldown,
          attempt: this.maxAttempts,
          cooldown: true,
          cooldownRemaining: remainingCooldown
        };
      } else {
        // Cooldown expired
        this.cooldowns.delete(key);
      }
    }
    
    // Track IP association if enabled and IP provided
    if (this.trackIpHistory && ip) {
      if (!this.ipHistory.has(ip)) {
        this.ipHistory.set(ip, new Set());
      }
      this.ipHistory.get(ip).add(key);
    }
    
    // Get current attempts or initialize
    let entry = this.attempts.get(key);
    if (!entry) {
      entry = {
        count: 0,
        lastAttempt: now,
        delays: []
      };
    }
    
    // Increment attempt counter
    entry.count += 1;
    entry.lastAttempt = now;
    
    // Calculate delay
    const delay = this.calculateDelay(entry.count);
    entry.delays.push(delay);
    
    // Store updated entry
    this.attempts.set(key, entry);
    
    // Check if max attempts reached
    if (entry.count >= this.maxAttempts) {
      log.warn(`${this.name}: Key ${key} reached max attempts (${this.maxAttempts}), entering cooldown`);
      
      // Set cooldown
      this.cooldowns.set(key, now + this.cooldownTime);
      
      return {
        limited: true,
        delay,
        attempt: entry.count,
        cooldown: true,
        cooldownRemaining: this.cooldownTime
      };
    }
    
    log.debug(`${this.name}: Key ${key} - attempt ${entry.count}, delay ${delay}ms`);
    
    return {
      limited: false,
      delay,
      attempt: entry.count,
      cooldown: false
    };
  }
  
  /**
   * Reset attempts for a specific key
   * @param {string} key Key to reset
   */
  reset(key) {
    this.attempts.delete(key);
    this.cooldowns.delete(key);
    log.debug(`${this.name}: Reset key ${key}`);
  }
  
  /**
   * Check if a key is rate limited without recording an attempt
   * @param {string} key Key to check
   * @returns {boolean} True if limited
   */
  isLimited(key) {
    const now = Date.now();
    
    // Check cooldown
    if (this.cooldowns.has(key) && now < this.cooldowns.get(key)) {
      return true;
    }
    
    const entry = this.attempts.get(key);
    return entry && entry.count >= this.maxAttempts;
  }
  
  /**
   * Get the current attempt count for a key
   * @param {string} key Key to check
   * @returns {number} Current attempt count
   */
  getAttemptCount(key) {
    const entry = this.attempts.get(key);
    return entry ? entry.count : 0;
  }
  
  /**
   * Get all keys associated with an IP address (if tracking enabled)
   * @param {string} ip IP address to check
   * @returns {Set|null} Set of keys or null if tracking disabled
   */
  getKeysByIp(ip) {
    if (!this.trackIpHistory) return null;
    return this.ipHistory.get(ip) || new Set();
  }
  
  /**
   * Clean up expired entries to prevent memory leaks
   */
  cleanup() {
    const now = Date.now();
    let expiredCount = 0;
    let expiredCooldowns = 0;
    
    // Clean up attempts that haven't been seen in the last hour
    for (const [key, entry] of this.attempts.entries()) {
      if (now - entry.lastAttempt > 60 * 60 * 1000) { // 1 hour
        this.attempts.delete(key);
        expiredCount++;
      }
    }
    
    // Clean up expired cooldowns
    for (const [key, endTime] of this.cooldowns.entries()) {
      if (now > endTime) {
        this.cooldowns.delete(key);
        expiredCooldowns++;
      }
    }
    
    // Clean up IP history if enabled
    if (this.trackIpHistory) {
      let expiredIps = 0;
      for (const [ip, keys] of this.ipHistory.entries()) {
        // Check if all keys for this IP have been removed from attempts
        let allExpired = true;
        for (const key of keys) {
          if (this.attempts.has(key)) {
            allExpired = false;
            break;
          }
        }
        
        if (allExpired) {
          this.ipHistory.delete(ip);
          expiredIps++;
        }
      }
      
      if (expiredIps > 0) {
        log.debug(`${this.name}: Cleaned up ${expiredIps} expired IP records`);
      }
    }
    
    if (expiredCount > 0 || expiredCooldowns > 0) {
      log.debug(`${this.name}: Cleaned up ${expiredCount} expired attempts and ${expiredCooldowns} expired cooldowns`);
    }
  }
  
  /**
   * Get memory usage statistics for this limiter
   * @returns {Object} Memory usage stats
   */
  getStats() {
    return {
      name: this.name,
      activeKeys: this.attempts.size,
      cooldownKeys: this.cooldowns.size,
      trackedIps: this.trackIpHistory ? this.ipHistory.size : 0
    };
  }
  
  /**
   * Destroy the limiter and clear all intervals
   */
  destroy() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }
    
    this.attempts.clear();
    this.cooldowns.clear();
    
    if (this.ipHistory) {
      this.ipHistory.clear();
    }
    
    log.info(`${this.name} backoff limiter destroyed`);
  }
}

/**
 * Create a default connection limiter
 * @returns {ExponentialBackoffLimiter} Connection limiter
 */
export function createConnectionLimiter() {
  return new ExponentialBackoffLimiter({
    initialDelay: 500,    // Start with 0.5s
    maxDelay: 60000,      // Max 60s delay
    factor: 2,            // Double each time
    jitter: 0.25,         // 25% random jitter
    maxAttempts: 10,      // 10 attempts before cooldown
    cooldownTime: 15 * 60 * 1000, // 15 minute cooldown
    trackIpHistory: true, // Track IP associations
    name: "connection"
  });
}

/**
 * Create a messaging rate limiter
 * @returns {ExponentialBackoffLimiter} Message rate limiter
 */
export function createMessageLimiter() {
  return new ExponentialBackoffLimiter({
    initialDelay: 200,    // Start with 200ms
    maxDelay: 10000,      // Max 10s delay
    factor: 1.5,          // 1.5x each time
    jitter: 0.1,          // 10% random jitter
    maxAttempts: 50,      // 50 messages before cooldown
    cooldownTime: 5 * 60 * 1000, // 5 minute cooldown
    trackIpHistory: false, // No need for IP tracking
    name: "message"
  });
}

/**
 * Create a call rate limiter
 * @returns {ExponentialBackoffLimiter} Call rate limiter
 */
export function createCallLimiter() {
  return new ExponentialBackoffLimiter({
    initialDelay: 1000,   // Start with 1s
    maxDelay: 30000,      // Max 30s delay
    factor: 2,            // Double each time
    jitter: 0.2,          // 20% random jitter
    maxAttempts: 5,       // 5 calls before cooldown
    cooldownTime: 10 * 60 * 1000, // 10 minute cooldown
    trackIpHistory: true, // Track IP associations
    name: "call"
  });
}

export default {
  ExponentialBackoffLimiter,
  createConnectionLimiter,
  createMessageLimiter,
  createCallLimiter
};