/**
 * Re-export all utilities for easy importing
 */

export { default as logger, createLogger, LogLevel } from './logger';
export * from './chatUtils';

/**
 * Reset user session by clearing all local storage and session storage
 * Use this when the user encounters authentication issues
 * @returns {void}
 */
export const resetUserSession = () => {
  // Check if token exists before clearing
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const hasToken = !!token;
  
  // Clear tokens
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
  localStorage.removeItem('authToken');
  sessionStorage.removeItem('authToken');
  
  // Clear any user data
  localStorage.removeItem('user');
  sessionStorage.removeItem('user');
  
  // Optional: Clear everything but keep console message
  localStorage.clear();
  sessionStorage.clear();
  
  // Add console message for debugging
  console.log("🧹 User session reset completely!");
  
  // If we had a token before, put it back in localStorage only to ensure consistent source
  if (hasToken && token) {
    console.log("🔑 Re-saving token to localStorage only");
    localStorage.setItem('token', token);
  }
  
  // Show alert before reloading
  alert("Session reset completed. You'll be redirected to login page.");
  
  // Reload the page
  window.location.href = '/login';
};


/**
 * Direct validator and fixer for MongoDB ObjectIDs
 * @param {string|object} id - The ID to validate or fix
 * @returns {string|null} - Valid MongoDB ObjectId string or null if unfixable
 */
export const ensureValidObjectId = (id) => {
  if (!id) return null;
  
  // If already a valid ObjectId string, return it unchanged
  const idString = typeof id === 'string' ? id : String(id);
  if (/^[0-9a-fA-F]{24}$/.test(idString)) {
    return idString;
  }
  
  // If it's longer than 24 chars, try to extract a valid ObjectId
  if (idString.length > 24) {
    // Look for a 24-character hex sequence
    const match = idString.match(/([0-9a-fA-F]{24})/);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Handle corrupted toString() results that might include "ObjectId(...)"
  const objectIdMatch = idString.match(/ObjectId\(['"](.*)['"]\)/);
  if (objectIdMatch && objectIdMatch[1]) {
    const extracted = objectIdMatch[1];
    if (/^[0-9a-fA-F]{24}$/.test(extracted)) {
      return extracted;
    }
  }
  
  // For object with _id property
  if (typeof id === 'object' && id !== null && id._id) {
    return ensureValidObjectId(id._id);
  }
  
  // For object with id property
  if (typeof id === 'object' && id !== null && id.id) {
    return ensureValidObjectId(id.id);
  }
  
  return null;
};

/**
 * A utility to directly patch MongoDB ObjectId requests into the API layer
 * This is a more targeted version of the emergency fix that can be used in specific contexts
 */
export const patchApiObjectIdRequests = () => {
  // Only run this once
  if (window._objectIdRequestsPatched) return;
  window._objectIdRequestsPatched = true;
  
  console.log("🔧 Installing API ObjectId request patch");
  
  // Intercept axios requests to fix ObjectId format issues
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function() {
    this.addEventListener('readystatechange', function() {
      if (this.readyState === 4 && this.status === 400) {
        try {
          const response = JSON.parse(this.responseText);
          
          // Check if error is related to user ID format
          if (response.error && (
              response.error === 'Invalid user ID format' || 
              response.error === 'Invalid authenticated user ID format' || 
              response.error === 'Invalid user ID format in request'
          )) {
            console.warn("⚠️ Caught ObjectId validation error:", response.error);
            
            // Try to auto-recover using the emergency fix
            if (confirm("Session ID format error detected. Apply emergency fix?")) {
              emergencyUserIdFix();
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    });
    originalOpen.apply(this, arguments);
  };
  
  console.log("✅ API ObjectId request patch installed");
};

// Install the patch immediately
patchApiObjectIdRequests();

// Create a URL normalization cache to avoid repetitive normalization work
// and prevent duplicate network requests
const urlNormalizationCache = new Map();
const failedUrlsCache = new Set();

/**
 * Normalize photo URLs consistently across the app
 * @param {string} url - Photo URL to normalize
 * @returns {string} Normalized URL
 */
export const normalizePhotoUrl = (url) => {
  if (!url) return `${window.location.origin}/placeholder.svg`;
  
  // First check if we've normalized this URL before
  if (urlNormalizationCache.has(url)) {
    return urlNormalizationCache.get(url);
  }
  
  // Check if it's a known failed URL
  if (failedUrlsCache.has(url)) {
    return `${window.location.origin}/placeholder.svg`;
  }

  let result;
  
  // If it's the default avatar or placeholder, use absolute URL
  if (url === '/default-avatar.png' || url === '/placeholder.svg') {
    result = `${window.location.origin}${url}`;
  }
  // If it's already a full URL, return it
  else if (url.startsWith("http")) {
    result = url;
  }
  // Special case for userId avatar pattern (mongodb ObjectId format)
  else if (/^[0-9a-f]{24}$/i.test(url)) {
    // Return with proper API path prefix - try the /avatars version first
    // This uses a dual-mounted endpoint to ensure backward compatibility
    const apiBase = window.location.origin;
    const avatarUrl = `${apiBase}/api/avatars/${url}`;
    // Only log in development mode
    if (import.meta.env.MODE !== 'production') {
      console.log(`Avatar URL generated: ${avatarUrl}`);
    }
    result = avatarUrl;
  }
  // If it's a path that starts with /uploads/
  else if (url.startsWith("/uploads/")) {
    result = `${window.location.origin}${url}`;
  }
  // For server-side photo paths to match client expectations
  else if (url.includes("/images/") || url.includes("/photos/")) {
    // Ensure it starts with /uploads/ if it doesn't already
    const path = url.startsWith("/uploads") ? url : `/uploads${url.startsWith("/") ? "" : "/"}${url}`;
    result = `${window.location.origin}${path}`;
  }
  else {
    // Make sure all URLs are absolute
    if (url.startsWith('/')) {
      result = `${window.location.origin}${url}`;
    } else {
      result = url;
    }
  }

  // Cache the normalized URL to avoid future processing
  urlNormalizationCache.set(url, result);
  return result;
};


/**
 * Mark a URL as failed in the cache so we don't try it again
 * @param {string} url - URL that failed to load
 */
export const markUrlAsFailed = (url) => {
  failedUrlsCache.add(url);
  return `${window.location.origin}/placeholder.svg`;
};

/**
 * Format a date with options
 * @param {string|Date} date - Date to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date
 */
export const formatDate = (date, options = {}) => {
  const {
    showTime = true,
    showDate = true,
    showRelative = false,
    locale = 'en-US'
  } = options;
  
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // For invalid dates
  if (isNaN(dateObj.getTime())) return '';
  
  if (showRelative) {
    const now = new Date();
    const diffMs = now - dateObj;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSeconds < 60) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
  }
  
  let formattedDate = '';
  
  if (showDate) {
    formattedDate = dateObj.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  if (showTime) {
    const timeStr = dateObj.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    formattedDate = showDate ? `${formattedDate}, ${timeStr}` : timeStr;
  }
  
  return formattedDate;
};

/**
 * Truncate text to a specific length
 * @param {string} text - Text to truncate
 * @param {number} length - Maximum length
 * @param {string} suffix - Suffix to add when truncated
 * @returns {string} Truncated text
 */
export const truncateText = (text, length = 100, suffix = '...') => {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.substring(0, length - suffix.length) + suffix;
};

/**
 * Safely parse JSON with error handling
 * @param {string} json - JSON string to parse
 * @param {any} defaultValue - Default value if parsing fails
 * @returns {any} Parsed value or default
 */
export const safeJsonParse = (json, defaultValue = null) => {
  try {
    return json ? JSON.parse(json) : defaultValue;
  } catch (error) {
    logger.warn('Failed to parse JSON:', error);
    return defaultValue;
  }
};


/**
 * Calculate file size with appropriate units
 * @param {number} bytes - File size in bytes
 * @param {number} decimals - Decimal precision
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
};

/**
 * Debounce a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Debounce delay in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle a function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit = 300) => {
  let inThrottle;
  let lastResult;
  
  return function executedFunction(...args) {
    if (!inThrottle) {
      lastResult = func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    
    return lastResult;
  };
};
