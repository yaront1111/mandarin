// src/services/api.js
import { API_TIMEOUT } from '../config/constants';

// Example base URL. In production, set REACT_APP_API_BASE_URL in your .env file.
const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://api.mandarinapp.com';

/**
 * Helper function to handle fetch with:
 * - Base URL concatenation
 * - JSON headers and optional token injection
 * - Abort controller for timeouts
 * - Error handling and JSON parsing
 */
async function request(endpoint, { method = 'GET', body, token, ...customConfig } = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), API_TIMEOUT);

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...customConfig.headers,
  };

  const config = {
    method,
    headers,
    signal: controller.signal,
    ...customConfig,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, config);
  } catch (error) {
    clearTimeout(id);
    // If it's an AbortError or network error, throw an appropriate error.
    throw new Error(error.name === 'AbortError' ? 'Request timed out' : error.message);
  }

  clearTimeout(id);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP error! status: ${response.status}`);
  }

  // Attempt to parse JSON. If parsing fails, return an empty object.
  try {
    return await response.json();
  } catch (parseError) {
    return {};
  }
}

/**
 * Convenient wrappers for common HTTP methods.
 * Each function calls `request` with the corresponding HTTP method.
 */
export const api = {
  get: (endpoint, config) => request(endpoint, { method: 'GET', ...config }),
  post: (endpoint, body, config) => request(endpoint, { method: 'POST', body, ...config }),
  put: (endpoint, body, config) => request(endpoint, { method: 'PUT', body, ...config }),
  patch: (endpoint, body, config) => request(endpoint, { method: 'PATCH', body, ...config }),
  delete: (endpoint, config) => request(endpoint, { method: 'DELETE', ...config }),
};
