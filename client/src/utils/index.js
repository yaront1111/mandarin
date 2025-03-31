/**
 * Re-export all utilities for easy importing
 */

export { default as logger, createLogger, LogLevel } from './logger';

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
  if (url === '/default-avatar1.png' || url === '/placeholder.svg') {
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

// Use this function when debugging avatar issues
export const debugPhotoUrl = (url) => {
  const normalized = normalizePhotoUrl(url);
  console.log(`Original URL: ${url}\nNormalized URL: ${normalized}`);
  return normalized;
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
 * Generate a random string
 * @param {number} length - Length of the string
 * @returns {string} Random string
 */
export const randomString = (length = 10) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
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
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
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
