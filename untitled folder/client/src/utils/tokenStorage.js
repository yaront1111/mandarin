/**
 * Token storage and management utilities
 * 
 * Provides functionality for JWT token storage, retrieval, and validation
 */
import { logger } from './logger';

const log = logger.create('TokenStorage');

/**
 * Get token from storage (checks both sessionStorage and localStorage)
 * @returns {string|null} The stored token or null if not found
 */
export const getToken = () => {
  const token = sessionStorage.getItem("token") || localStorage.getItem("token");
  if (token) {
    log.debug('Token retrieved from storage');
  }
  return token;
};

/**
 * Set token in storage
 * @param {string} token - JWT token to store
 * @param {boolean} rememberMe - Whether to persist in localStorage
 */
export const setToken = (token, rememberMe = false) => {
  if (!token) return;

  // Always store in sessionStorage for the current session
  sessionStorage.setItem("token", token);
  log.debug('Token stored in sessionStorage');

  // Also store in localStorage if rememberMe is true
  if (rememberMe) {
    localStorage.setItem("token", token);
    log.debug('Token also stored in localStorage (remember me)');
  } else {
    localStorage.removeItem("token");
  }
};

/**
 * Remove token from all storage
 */
export const removeToken = () => {
  sessionStorage.removeItem("token");
  localStorage.removeItem("token");
  log.debug('Token removed from all storage');
};

/**
 * Check if token is expired
 * @param {string} token - JWT token to check
 * @returns {boolean} Whether the token is expired
 */
export const isTokenExpired = (token) => {
  if (!token) return true;

  try {
    // Parse token
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));

    // Check expiration (with 30-second buffer)
    const expiresAt = payload.exp * 1000;
    const now = Date.now();
    const isExpired = now >= expiresAt - 30000; // 30-second buffer
    
    if (isExpired) {
      log.debug(`Token expired at ${new Date(expiresAt).toISOString()}`);
    }
    
    return isExpired;
  } catch (error) {
    log.error("Error parsing JWT token:", error);
    return true;
  }
};

/**
 * Parse JWT token to get payload
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload or null if invalid
 */
export const parseToken = (token) => {
  if (!token) return null;
  
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch (error) {
    log.error("Error parsing JWT token:", error);
    return null;
  }
};

/**
 * Get time remaining until token expiration
 * @param {string} token - JWT token
 * @returns {number} Milliseconds until expiration (0 if expired)
 */
export const getTokenTimeRemaining = (token) => {
  if (!token) return 0;
  
  try {
    const payload = parseToken(token);
    if (!payload || !payload.exp) return 0;
    
    const expiresAt = payload.exp * 1000;
    const now = Date.now();
    return Math.max(0, expiresAt - now);
  } catch (error) {
    log.error("Error calculating token time remaining:", error);
    return 0;
  }
};
