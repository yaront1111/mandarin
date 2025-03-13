// src/services/apiService.js
import axios from 'axios';
import { toast } from 'react-toastify';

/**
 * API Service for making HTTP requests
 */
class ApiService {
  constructor() {
    // Use consistent API URL approach with clear fallback
    const baseURL = process.env.REACT_APP_API_URL ||
                   (window.location.hostname.includes('localhost') ?
                   'http://localhost:5000/api' : '/api');

    console.log(`API Service initialized with baseURL: ${baseURL}`);

    this.api = axios.create({
      baseURL: baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000 // 15 second timeout
    });

    this.refreshPromise = null;
    this._initializeResponseInterceptor();

    // On initialization, set auth token from session storage
    const token = sessionStorage.getItem('token');
    if (token) {
      this.setAuthToken(token);
    }

    // Add request interceptor for debugging
    this.api.interceptors.request.use(config => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`API Request: ${config.method.toUpperCase()} ${config.url}`);
        if (config.headers.Authorization) {
          console.log('Request includes auth token');
        }
      }
      return config;
    }, error => {
      console.error('Request error:', error);
      return Promise.reject(error);
    });
  }

  /**
   * Set authentication token for API requests
   * @param {string} token - JWT token
   */
  setAuthToken(token) {
    if (token) {
      this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Also set for global axios for consistency
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.api.defaults.headers.common['Authorization'];
      delete axios.defaults.headers.common['Authorization'];
    }
  }

  /**
   * Check if token is expired
   * @param {string} token - JWT token
   * @returns {boolean} - True if token is expired
   */
  isTokenExpired(token) {
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch (error) {
      console.error('Error parsing JWT token:', error);
      return true;
    }
  }

  /**
   * Initialize response interceptor
   */
  _initializeResponseInterceptor() {
    this.api.interceptors.response.use(
      this._handleResponse,
      this._handleError
    );
  }

  /**
   * Handle successful response
   * @param {Object} response - Axios response object
   * @returns {Object} - Response data
   */
  _handleResponse(response) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`API Response Success: ${response.config.url}`);
    }
    return response.data; // Return data directly to simplify usage
  }

  /**
   * Handle error response
   * @param {Object} error - Axios error object
   * @returns {Promise<Object>} - Promise that resolves to error data
   */
  _handleError = async (error) => {
    const originalRequest = error.config;

    if (process.env.NODE_ENV !== 'production') {
      console.error('API Error:', error.message, originalRequest?.url);
    }

    // Handle network errors
    if (!error.response) {
      const errorMsg = 'Network error. Please check your connection.';
      toast.error(errorMsg);
      return Promise.reject({
        success: false,
        error: errorMsg
      });
    }

    // Handle token refresh for 401 errors
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (this.refreshPromise === null) {
        this.refreshPromise = this._refreshToken();
      }

      try {
        const token = await this.refreshPromise;

        if (token) {
          this.setAuthToken(token);
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return this.api(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // If refresh fails, handle authentication error
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('token');
          toast.error('Session expired. Please log in again.');

          // Redirect to login page after a short delay
          setTimeout(() => {
            window.location.href = '/login';
          }, 1500);
        }
      } finally {
        this.refreshPromise = null;
      }
    }

    // Handle specific HTTP error codes
    const errorData = error.response.data;
    const errorMsg = errorData?.error || errorData?.message || 'An error occurred';

    switch (error.response.status) {
      case 400:
        toast.error(`Bad request: ${errorMsg}`);
        break;
      case 403:
        toast.error(`Access denied: ${errorMsg}`);
        break;
      case 404:
        toast.error(`Not found: ${errorMsg}`);
        break;
      case 422:
        toast.error(`Validation error: ${errorMsg}`);
        break;
      case 429:
        toast.error('Too many requests. Please try again later.');
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        toast.error(`Server error (${error.response.status}). Please try again later.`);
        break;
      default:
        if (!originalRequest._retry) {
          toast.error(errorMsg);
        }
    }

    return Promise.reject({
      success: false,
      error: errorMsg,
      status: error.response.status,
      data: error.response.data
    });
  };

  /**
   * Refresh authentication token
   * @returns {Promise<string|null>} - New token or null if refresh fails
   */
  async _refreshToken() {
    try {
      const response = await this.api.post('/auth/refresh-token');

      if (response.success && response.token) {
        const token = response.token;
        sessionStorage.setItem('token', token);
        return token;
      }

      throw new Error('Invalid refresh token response');
    } catch (error) {
      console.error('Token refresh failed:', error);
      sessionStorage.removeItem('token');
      return null;
    }
  }

  /**
   * Make a GET request
   * @param {string} url - Request URL
   * @param {Object} params - Query parameters
   * @param {Object} options - Request options
   * @returns {Promise<Object>} - Response data
   */
  async get(url, params = {}, options = {}) {
    try {
      const response = await this.api.get(url, { params, ...options });
      return response; // The interceptor already returns response.data
    } catch (error) {
      throw error;
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
      const response = await this.api.post(url, data, options);
      return response;
    } catch (error) {
      throw error;
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
      const response = await this.api.put(url, data, options);
      return response;
    } catch (error) {
      throw error;
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
      const response = await this.api.delete(url, options);
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Upload file with multipart/form-data
   * @param {string} url - Request URL
   * @param {FormData} formData - Form data with files
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} - Response data
   */
  async upload(url, formData, onProgress = null) {
    try {
      const response = await this.api.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: onProgress ? (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        } : undefined
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Test API connection
   * @returns {Promise<Object>} - Connection test result
   */
  async testConnection() {
    try {
      const token = sessionStorage.getItem('token');
      const result = await this.get('/auth/test-connection');
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error.error || error.message || 'Connection test failed'
      };
    }
  }
}

// Create singleton instance
const apiService = new ApiService();

export default apiService;
