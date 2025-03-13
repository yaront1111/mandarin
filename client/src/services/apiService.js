// src/services/apiService.js
import axios from 'axios';
import { toast } from 'react-toastify';

/**
 * API Service for making HTTP requests
 */
class ApiService {
  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000 // 15 second timeout
    });

    this.refreshPromise = null;
    this._initializeResponseInterceptor();
  }

  /**
   * Set authentication token for API requests
   * @param {string} token - JWT token
   */
  setAuthToken(token) {
    if (token) {
      this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.api.defaults.headers.common['Authorization'];
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
    return response;
  }

  /**
   * Handle error response
   * @param {Object} error - Axios error object
   * @returns {Promise<Object>} - Promise that resolves to error data
   */
  _handleError = async (error) => {
    const originalRequest = error.config;

    // Handle network errors
    if (!error.response) {
      toast.error('Network error. Please check your connection.');
      return Promise.reject({
        message: 'Network error. Please check your connection.'
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
        // If refresh fails, handle authentication error
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('token');
          // You might want to redirect to login here or dispatch a Redux action
        }
      } finally {
        this.refreshPromise = null;
      }
    }

    // Handle specific HTTP error codes
    switch (error.response.status) {
      case 400:
        toast.error('Bad request: ' + (error.response.data.error || 'Please check your data'));
        break;
      case 403:
        toast.error('Access denied: ' + (error.response.data.error || 'You do not have permission'));
        break;
      case 404:
        toast.error('Not found: ' + (error.response.data.error || 'The requested resource was not found'));
        break;
      case 422:
        toast.error('Validation error: ' + (error.response.data.error || 'Please check your data'));
        break;
      case 429:
        toast.error('Too many requests. Please try again later.');
        break;
      case 500:
        toast.error('Server error. Please try again later.');
        break;
      default:
        if (error.response.status >= 500) {
          toast.error('Server error. Please try again later.');
        } else if (!originalRequest._retry) {
          toast.error(error.response.data.error || 'An error occurred');
        }
    }

    return Promise.reject(error.response?.data || error);
  };

  /**
   * Refresh authentication token
   * @returns {Promise<string|null>} - New token or null if refresh fails
   */
  async _refreshToken() {
    try {
      const response = await this.api.post('/auth/refresh-token');

      if (response.data && response.data.token) {
        const token = response.data.token;
        sessionStorage.setItem('token', token);
        return token;
      }

      return null;
    } catch (error) {
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
      return response.data;
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
      return response.data;
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
      return response.data;
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
      return response.data;
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
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

// Create singleton instance
const apiService = new ApiService();

export default apiService;
