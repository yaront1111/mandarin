// src/services/api.js
import axios from 'axios';
// Remove these imports to break the circular dependency
// import store from '../store';
// import { logout } from '../store/authSlice';

const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30000 // 30 second timeout
});

// Create a callback function that will be set from outside
let logoutCallback = () => {
  console.warn('Logout function not yet registered');
  // Fallback: clear localStorage as a minimum action
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login?session=expired';
};

// Function to register the logout handler
export const registerAuthHandlers = (logoutFn) => {
  logoutCallback = logoutFn;
};

// Attach JWT token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor with improved error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Network errors or timeout
    if (!error.response) {
      console.error('Network error or timeout:', error.message);
      return Promise.reject(new Error('Network error. Please check your connection and try again.'));
    }

    // Handle specific status codes
    switch (error.response.status) {
      case 401: {
        // Unauthorized - token expired or invalid
        console.warn('Authentication error (401):', error.response.data);

        // If not logging out already, trigger logout using the callback
        if (!error.config.url.includes('auth/logout')) {
          logoutCallback();

          // Optional: Redirect to login page after logout
          if (window.location.pathname !== '/login') {
            window.location.href = '/login?session=expired';
          }
        }

        return Promise.reject(new Error('Your session has expired. Please log in again.'));
      }

      case 403: {
        // Forbidden - insufficient permissions
        console.warn('Permission error (403):', error.response.data);
        return Promise.reject(new Error('You do not have permission to perform this action.'));
      }

      case 404: {
        // Not Found
        console.warn('Resource not found (404):', error.response.data);
        return Promise.reject(new Error('The requested resource was not found.'));
      }

      case 422: // Validation error
      case 400: {
        // Bad request - Using block scope for lexical declarations
        console.warn('Validation/Bad request error:', error.response.data);

        // If the server returns field-specific errors, format them for display
        if (error.response.data?.errors) {
          const errorMessages = Object.entries(error.response.data.errors)
            .map(([field, message]) => `${field}: ${message}`)
            .join('\n');
          return Promise.reject(new Error(errorMessages));
        }

        // Return the server's error message if available
        if (error.response.data?.message) {
          return Promise.reject(new Error(error.response.data.message));
        }

        return Promise.reject(new Error('Invalid request. Please check your input.'));
      }

      case 500: // Server error
      case 502: // Bad Gateway
      case 503: {
        // Service Unavailable
        console.error('Server error:', error.response.data);
        return Promise.reject(new Error('Server error. Please try again later or contact support if the problem persists.'));
      }

      default: {
        // For any other status codes
        console.error(`Error ${error.response.status}:`, error.response.data);

        // Safely extract message with proper null checking
        let message = 'An unexpected error occurred. Please try again.';
        if (error.response && error.response.data && error.response.data.message) {
          message = error.response.data.message;
        }

        return Promise.reject(new Error(message));
      }
    }
  }
);

// Helper methods for common API operations
api.helpers = {
  // GET with better error handling
  getWithErrorHandling: async (url, config = {}) => {
    try {
      const response = await api.get(url, config);
      return response.data;
    } catch (error) {
      console.error(`GET ${url} failed:`, error);
      throw error;
    }
  },

  // POST with better error handling
  postWithErrorHandling: async (url, data = {}, config = {}) => {
    try {
      const response = await api.post(url, data, config);
      return response.data;
    } catch (error) {
      console.error(`POST ${url} failed:`, error);
      throw error;
    }
  }
};

export default api;
