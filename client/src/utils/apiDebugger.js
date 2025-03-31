/**
 * API Debugger utility for diagnosing API and authentication issues
 */
import axios from 'axios';
import { logger } from './logger';
import { getToken, parseToken, isTokenExpired } from './tokenStorage';

const log = logger.create('ApiDebugger');

/**
 * API Debugger to help diagnose authentication and API issues
 */
class ApiDebugger {
  constructor() {
    this.isActive = true;
    log.info('API Debugger initialized');
    this._setupInterceptors();
  }

  /**
   * Setup axios interceptors for debugging
   */
  _setupInterceptors() {
    // Request interceptor
    axios.interceptors.request.use((config) => {
      if (!this.isActive) return config;
      
      log.debug(`📤 API Request: ${config.method.toUpperCase()} ${config.url}`);
      
      // Use logger's group functionality for detailed logging
      const details = {
        headers: this._sanitizeHeaders(config.headers),
        authPresent: !!config.headers.Authorization
      };
      
      if (config.data) {
        details.data = this._sanitizeData(config.data);
      }
      
      log.debug('Request details:', details);
      
      return config;
    }, (error) => {
      if (this.isActive) {
        log.error('Request Error:', error);
      }
      return Promise.reject(error);
    });

    // Response interceptor
    axios.interceptors.response.use((response) => {
      if (!this.isActive) return response;

      log.debug(`📥 API Response: ${response.config.method.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data
      });

      return response;
    }, (error) => {
      if (this.isActive) {
        const errorInfo = {
          message: error.message
        };
        
        if (error.response) {
          errorInfo.status = error.response.status;
          errorInfo.data = error.response.data;
          errorInfo.headers = this._sanitizeHeaders(error.response.headers);
        } else if (error.request) {
          errorInfo.request = 'Request was made but no response received';
        }
        
        log.error('❌ API Error:', errorInfo);
      }
      return Promise.reject(error);
    });
  }

  /**
   * Sanitize headers for display (hide sensitive info)
   * @param {Object} headers - Request/response headers
   * @returns {Object} Sanitized headers
   */
  _sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    if (sanitized.Authorization) {
      sanitized.Authorization = sanitized.Authorization.substring(0, 20) + '...';
    }
    return sanitized;
  }

  /**
   * Sanitize request data (hide passwords)
   * @param {Object} data - Request data
   * @returns {Object} Sanitized data
   */
  _sanitizeData(data) {
    if (typeof data !== 'object' || data === null) return data;

    const sanitized = { ...data };
    if (sanitized.password) {
      sanitized.password = '********';
    }
    return sanitized;
  }

  /**
   * Test API connection with current auth
   * @param {string} endpoint - API endpoint to test
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection(endpoint = '/api/auth/test-connection') {
    log.info('Testing API connection...');

    // Get the token
    const token = getToken();
    log.debug('Token available:', !!token);

    // Make a test request
    try {
      const response = await axios.get(endpoint, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      log.info('✅ Connection test successful');
      log.debug('Connection response:', response.data);
      
      return { 
        success: true, 
        data: response.data,
        ping: response.data.timestamp ? new Date() - new Date(response.data.timestamp) : null
      };
    } catch (error) {
      log.error('❌ Connection test failed:', error.message);
      
      return {
        success: false,
        error: error.message,
        response: error.response?.data || null,
        status: error.response?.status,
        isNetworkError: !error.response
      };
    }
  }

  /**
   * Test authentication with current token
   * @param {string} endpoint - Auth endpoint to test
   * @returns {Promise<Object>} Authentication test result
   */
  async testAuth(endpoint = '/api/auth/me') {
    log.info('Testing authentication...');

    const token = getToken();
    if (!token) {
      log.warn('No token available for auth test');
      return { success: false, error: 'No token available' };
    }

    try {
      const response = await axios.get(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      log.info('✅ Authentication test successful');
      log.debug('Auth response:', response.data);
      
      return { success: true, data: response.data };
    } catch (error) {
      log.error('❌ Authentication test failed:', error.message);
      
      return {
        success: false,
        error: error.message,
        response: error.response?.data || null,
        status: error.response?.status
      };
    }
  }

  /**
   * Check token validity
   * @returns {Object} Token validity status
   */
  checkToken() {
    const token = getToken();
    if (!token) {
      log.warn('No token found in storage');
      return { valid: false, reason: 'No token found' };
    }

    try {
      // Parse token payload
      const payload = parseToken(token);
      if (!payload) {
        return { valid: false, reason: 'Invalid token format or content' };
      }
      
      log.debug('Token payload:', payload);

      // Check expiration
      if (isTokenExpired(token)) {
        const now = Math.floor(Date.now() / 1000);
        return {
          valid: false,
          reason: 'Token expired',
          expiry: new Date(payload.exp * 1000).toLocaleString(),
          now: new Date(now * 1000).toLocaleString(),
          expiresIn: Math.max(0, (payload.exp * 1000) - Date.now())
        };
      }

      return {
        valid: true,
        userId: payload.id || payload.sub,
        expiry: payload.exp ? new Date(payload.exp * 1000).toLocaleString() : 'No expiry',
        expiresIn: payload.exp ? (payload.exp * 1000) - Date.now() : null,
        roles: payload.roles || [],
        scope: payload.scope || null
      };
    } catch (error) {
      log.error('Error checking token:', error);
      return { valid: false, reason: 'Token validation error', error: error.message };
    }
  }

  /**
   * Enable or disable debugger
   * @param {boolean} active - Whether to enable the debugger
   */
  setActive(active) {
    this.isActive = active;
    log.info(`API Debugger ${active ? 'enabled' : 'disabled'}`);
  }
}

// Create singleton instance
const apiDebugger = new ApiDebugger();
export default apiDebugger;
