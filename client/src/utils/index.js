/**
 * Re-export all utilities for easy importing
 */

// Import logger to use it in this file
import logger from './logger';
// Re-export logger for external use
export { default as logger, createLogger, LogLevel } from './logger';
// Create a logger for this file
const log = logger.create("utils");

// Re-export all chat utils
export * from './chatUtils';

// i18n utilities have been removed in favor of direct t() function usage

// Re-export photo permission utilities
export * from './photoPermissions';
export { default as photoPermissions } from './photoPermissions';

// Export original mobile utilities functions from mobileInit
export {
  initializeMobileOptimizations,
  setViewportHeight,
  detectDevice,
  enablePinchZoom,
  handleOrientationChange
} from './mobileInit';

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
  log.info("🧹 User session reset completely!");

  // If we had a token before, put it back in localStorage only to ensure consistent source
  if (hasToken && token) {
    log.info("🔑 Re-saving token to localStorage only");
    localStorage.setItem('token', token);
  }

  // Show alert before reloading
  alert("Session reset completed. You'll be redirected to login page.");

  // Reload the page
  window.location.href = '/login';
};


/**
 * Enhanced validator and fixer for MongoDB ObjectIDs
 * This is the centralized function for standardizing user ID format
 * across the entire application.
 *
 * @param {string|object} id - The ID to validate or fix
 * @returns {string|null} - Valid MongoDB ObjectId string or null if unfixable
 */
export const ensureValidObjectId = (id) => {
  if (!id) return null;

  // Log for debugging - comment out in production
  // log.debug(`ensureValidObjectId input: ${typeof id === 'object' ? JSON.stringify(id) : id}`);

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
  // This matches both ObjectId("id") and ObjectId('id') formats
  const objectIdMatch = idString.match(/ObjectId\(['"](.*)['"]\)/);
  if (objectIdMatch && objectIdMatch[1]) {
    const extracted = objectIdMatch[1];
    if (/^[0-9a-fA-F]{24}$/.test(extracted)) {
      return extracted;
    }
  }

  // For object with _id property (preferred format)
  if (typeof id === 'object' && id !== null && id._id) {
    return ensureValidObjectId(id._id);
  }

  // For object with id property (legacy format)
  if (typeof id === 'object' && id !== null && id.id) {
    return ensureValidObjectId(id.id);
  }

  // For object with sub property (JWT format)
  if (typeof id === 'object' && id !== null && id.sub) {
    return ensureValidObjectId(id.sub);
  }

  // For nested user objects (e.g., { user: { _id: '...' } })
  if (typeof id === 'object' && id !== null && id.user) {
    if (typeof id.user === 'object' && id.user !== null) {
      // Try _id first, then id
      if (id.user._id) {
        return ensureValidObjectId(id.user._id);
      } else if (id.user.id) {
        return ensureValidObjectId(id.user.id);
      }
    } else if (typeof id.user === 'string') {
      // Handle case where user is just the ID string
      return ensureValidObjectId(id.user);
    }
  }

  // Last resort - try to find any 24-char hex string in the object
  if (typeof id === 'object' && id !== null) {
    const jsonString = JSON.stringify(id);
    const allMatches = jsonString.match(/[0-9a-fA-F]{24}/g) || [];
    if (allMatches.length > 0) {
      // Use the first match found
      return allMatches[0];
    }
  }

  return null;
};

/**
 * A utility to directly patch MongoDB ObjectId requests into the API layer
 * This is now implemented as an interceptor in apiService.jsx
 * @deprecated Use apiService's ObjectId interceptor instead
 */
export const patchApiObjectIdRequests = () => {
  log.warn("🔧 patchApiObjectIdRequests is deprecated. Object ID format errors are now handled by apiService interceptors");
  
  // This function is kept for backward compatibility but does nothing
  return;
};

// Note: The patch is now applied in apiService.jsx as an interceptor

// Create a URL normalization cache to avoid repetitive normalization work
// and prevent duplicate network requests
const urlNormalizationCache = new Map();
const failedUrlsCache = new Set();

// Make cache accessible globally for other components that need to clear it
if (typeof window !== 'undefined') {
  window.__url_normalization_cache = urlNormalizationCache;
  window.__failed_urls_cache = failedUrlsCache;
}

/**
 * Normalize photo URLs consistently across the app with cache busting
 * @param {string} url - Photo URL to normalize
 * @param {boolean} bustCache - Whether to add a cache-busting parameter
 * @param {Object} options - Additional options
 * @param {boolean} options.isPrivate - Whether this is a private photo that requires permission
 * @param {boolean} options.hasPermission - Whether the viewer has permission to view this private photo
 * @returns {string} Normalized URL
 */
export const normalizePhotoUrl = (url, bustCache = false) => {
  // Add debug logging
  log.debug(`normalizePhotoUrl called with URL: "${url}"`);
  
  if (!url) {
    log.debug('URL is empty, returning placeholder.svg');
    return `${window.location.origin}/placeholder.svg`;
  }

  // Create a cache key that includes the bustCache parameter
  const cacheKey = `${url}:${bustCache}`;
  
  // Check cache only if we're not busting
  if (!bustCache && urlNormalizationCache.has(cacheKey)) {
    log.debug(`normalizePhotoUrl: Cache hit for "${url}", returning cached value`);
    return urlNormalizationCache.get(cacheKey);
  }
  
  // Handle gender-specific avatars and profile photos
  if (url) {
    // Gender avatars need special handling
    const isGenderAvatar = url.includes('man-avatar') || 
                          url.includes('women-avatar') || 
                          url.includes('couple-avatar') || 
                          url.includes('default-avatar');
    
    // Make sure paths are absolute for gender avatars
    if (isGenderAvatar && url.startsWith('/')) {
      log.debug(`normalizePhotoUrl: Converting avatar path to absolute URL: ${url}`);
      url = `${window.location.origin}${url}`;
    }
    
    // Similarly for profile photos
    if (url.startsWith('/uploads/')) {
      log.debug(`normalizePhotoUrl: Converting profile photo path to absolute URL: ${url}`);
      url = `${window.location.origin}${url}`;
    }
    
    // Remove any existing refresh parameters to prevent flickering
    if (url.includes('_refresh=')) {
      url = url.replace(/([?&])_refresh=\d+(&|$)/, '$1');
      // Clean up trailing ? or & if that was the only parameter
      if (url.endsWith('?') || url.endsWith('&')) {
        url = url.slice(0, -1);
      }
    }
    
    // Cache result for gender avatars
    if (isGenderAvatar) {
      urlNormalizationCache.set(cacheKey, url);
      return url;
    }
  }

  // Check if it's a known failed URL
  if (failedUrlsCache.has(url)) {
    return `${window.location.origin}/placeholder.svg`;
  }

  let result;

  // If it's the default avatar (any gender variant) or placeholder, use absolute URL
  if (url === '/default-avatar.png' || 
      url === '/default-avatar1.png' ||
      url === '/man-avatar.png' ||
      url === '/women-avatar.png' ||
      url === '/couple-avatar.png' ||
      url === '/placeholder.svg') {
    log.debug(`normalizePhotoUrl: Converting avatar path "${url}" to absolute URL`);
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
      log.debug(`Avatar URL generated: ${avatarUrl}`);
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
  // Handle uploads directory paths with or without leading /
  else if (url.includes("uploads/") || url.startsWith("/uploads/")) {
    // Make sure the URL is absolute
    const path = url.startsWith("/") ? url : `/${url}`;
    result = `${window.location.origin}${path}`;
  }
  // Special case for direct filename format (timestamp-random.png)
  else if (/^\d+-\d+.*\.(jpg|jpeg|png|gif|webp)$/i.test(url)) {
    // This is likely a direct filename from the server, treat as image in uploads
    result = `${window.location.origin}/uploads/images/${url}`;
    
    // Always add cache busting for these specific filename patterns
    // as they are likely newly uploaded images
    bustCache = true;
  }
  else {
    // Make sure all URLs are absolute
    if (url.startsWith('/')) {
      result = `${window.location.origin}${url}`;
    } else {
      result = url;
    }
  }
  
  // Add cache busting parameter if requested
  if (bustCache && result) {
    // Use the globally stored timestamp if available for consistent cache busting
    // Or fall back to a per-request timestamp
    const cacheVersion = (typeof window !== 'undefined' && window.__photo_refresh_timestamp) 
      ? window.__photo_refresh_timestamp 
      : Date.now();
    const separator = result.includes('?') ? '&' : '?';
    result = `${result}${separator}_v=${cacheVersion}`;
  }

  // Cache the normalized URL to avoid future processing
  urlNormalizationCache.set(cacheKey, result);
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
  // Determine locale from document or navigator
  let detectedLocale = 'en-US';
  try {
    if (document.documentElement.lang === 'he') {
      detectedLocale = 'he-IL';
    } else if (navigator.languages && navigator.languages.length) {
      detectedLocale = navigator.languages[0];
    } else if (navigator.language) {
      detectedLocale = navigator.language;
    }
  } catch (e) {
    log.warn('Failed to detect locale:', e);
  }

  const {
    showTime = true,
    showDate = true,
    showRelative = false,
    locale = detectedLocale
  } = options;

  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // For invalid dates
  if (isNaN(dateObj.getTime())) return '';

  if (showRelative) {
    // For Hebrew locale, use Hebrew relative time strings
    if (locale.startsWith('he')) {
      const now = new Date();
      const diffMs = now - dateObj;
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSeconds < 60) return 'זה עתה';
      if (diffMinutes < 60) return `לפני ${diffMinutes} דקות`;
      if (diffHours < 24) return `לפני ${diffHours} שעות`;
      if (diffDays < 7) return `לפני ${diffDays} ימים`;
    } else {
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
  }

  let formattedDate = '';

  if (showDate) {
    try {
      formattedDate = dateObj.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      // Fallback if the locale is not supported
      log.warn(`Locale ${locale} not supported for date formatting, falling back to default`);
      formattedDate = dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  }

  if (showTime) {
    let timeStr;
    try {
      timeStr = dateObj.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      // Fallback if the locale is not supported
      log.warn(`Locale ${locale} not supported for time formatting, falling back to default`);
      timeStr = dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    // Handle RTL languages differently for combining date and time
    if (locale.startsWith('he') || document.dir === 'rtl') {
      formattedDate = showDate ? `${timeStr} ,${formattedDate}` : timeStr;
    } else {
      formattedDate = showDate ? `${formattedDate}, ${timeStr}` : timeStr;
    }
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
