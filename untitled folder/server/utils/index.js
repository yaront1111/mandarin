/**
 * Re-export all utilities for easy importing
 */

export * from './errorHandler.js';
export * from './validation.js';
export * from './dbHelpers.js';
export * from './responseHandler.js';

/**
 * Safe parse JSON with error handling
 * @param {string} json - JSON string to parse
 * @param {any} defaultValue - Default value if parsing fails
 * @returns {any} - Parsed value or default
 */
export const safeJsonParse = (json, defaultValue = null) => {
  try {
    return json ? JSON.parse(json) : defaultValue;
  } catch (error) {
    return defaultValue;
  }
};

/**
 * Safely stringify a value to JSON
 * @param {any} value - Value to stringify
 * @param {any} defaultValue - Default value if stringification fails
 * @returns {string} - JSON string or default
 */
export const safeJsonStringify = (value, defaultValue = '{}') => {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return defaultValue;
  }
};

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after delay
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate a random string
 * @param {number} length - Length of the string
 * @returns {string} - Random string
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
 * Mask sensitive data from logs
 * @param {Object} data - Data object
 * @param {Array} sensitiveFields - Fields to mask
 * @returns {Object} - Masked data object
 */
export const maskSensitiveData = (data, sensitiveFields = ['password', 'token', 'secret']) => {
  if (!data || typeof data !== 'object') return data;
  
  const masked = { ...data };
  
  sensitiveFields.forEach(field => {
    if (masked[field]) {
      masked[field] = '********';
    }
  });
  
  return masked;
};