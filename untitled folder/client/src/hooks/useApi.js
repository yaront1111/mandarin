import { useState, useCallback, useRef } from 'react';
import apiService from '../services/apiService';

/**
 * Custom hook for making API calls with standardized handling
 * @param {Object} options - Configuration options
 * @returns {Object} API methods and state
 */
export const useApi = (options = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  
  // Keep track of active requests for cleanup
  const activeRequestsRef = useRef({});
  
  // Cancel all active requests when unmounting
  const cancelAllRequests = useCallback(() => {
    Object.values(activeRequestsRef.current).forEach(cancel => {
      if (typeof cancel === 'function') {
        cancel();
      }
    });
    activeRequestsRef.current = {};
  }, []);
  
  /**
   * Execute API call with standardized error and loading state management
   * @param {Function} apiCall - Function that returns Promise from apiService
   * @param {Object} callbacks - Success and error callbacks
   * @returns {Promise} API call result
   */
  const execute = useCallback(async (apiCall, callbacks = {}) => {
    const { onSuccess, onError, key = 'default' } = callbacks;
    
    // Set loading state
    setLoading(true);
    setError(null);
    
    try {
      // Execute the API call
      const response = await apiCall();
      
      // Handle null/undefined responses - may happen if the server returns nothing
      if (!response) {
        if (options.logErrors !== false) {
          console.warn(`API response is null or undefined`);
        }
        // Clean up this request reference
        delete activeRequestsRef.current[key];
        return null;
      }
      
      // Check if response indicates success
      if (!response.success) {
        throw new Error(response.error || 'API request failed');
      }
      
      // Update data state
      if (response.data !== undefined) {
        setData(response.data);
      }
      
      // Clean up this request reference
      delete activeRequestsRef.current[key];
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess(response.data);
      }
      
      return response.data;
    } catch (err) {
      // Format error message
      const errorMsg = err.error || err.message || 'An error occurred';
      
      // Set error state
      setError(errorMsg);
      
      // Clean up this request reference
      delete activeRequestsRef.current[key];
      
      // Call error callback if provided
      if (onError) {
        onError(errorMsg);
      }
      
      // Log error if enabled
      if (options.logErrors !== false) {
        console.error(`API error: ${errorMsg}`);
      }
      
      return null;
    } finally {
      // Always update loading state
      setLoading(false);
    }
  }, [options.logErrors]);
  
  /**
   * Make a GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @param {Object} callbacks - Success and error callbacks
   * @returns {Promise} API call result
   */
  const get = useCallback((endpoint, params, callbacks = {}) => {
    const requestKey = callbacks.key || endpoint;
    
    if (activeRequestsRef.current[requestKey]) {
      if (options.cancelDuplicates) {
        activeRequestsRef.current[requestKey]();
      }
    }
    
    // Create a request with cancel capability
    const { request, cancel } = apiService.createCancelableRequest();
    activeRequestsRef.current[requestKey] = cancel;
    
    return execute(
      () => apiService.get(endpoint, params, { request }),
      { ...callbacks, key: requestKey }
    );
  }, [execute, options.cancelDuplicates]);
  
  /**
   * Make a POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {Object} callbacks - Success and error callbacks
   * @returns {Promise} API call result
   */
  const post = useCallback((endpoint, data, callbacks = {}) => {
    const requestKey = callbacks.key || endpoint;
    
    if (activeRequestsRef.current[requestKey] && options.cancelDuplicates) {
      activeRequestsRef.current[requestKey]();
    }
    
    // Create a request with cancel capability
    const { request, cancel } = apiService.createCancelableRequest();
    activeRequestsRef.current[requestKey] = cancel;
    
    return execute(
      () => apiService.post(endpoint, data, { request }),
      { ...callbacks, key: requestKey }
    );
  }, [execute, options.cancelDuplicates]);
  
  /**
   * Make a PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {Object} callbacks - Success and error callbacks
   * @returns {Promise} API call result
   */
  const put = useCallback((endpoint, data, callbacks = {}) => {
    const requestKey = callbacks.key || endpoint;
    
    if (activeRequestsRef.current[requestKey] && options.cancelDuplicates) {
      activeRequestsRef.current[requestKey]();
    }
    
    // Create a request with cancel capability
    const { request, cancel } = apiService.createCancelableRequest();
    activeRequestsRef.current[requestKey] = cancel;
    
    return execute(
      () => apiService.put(endpoint, data, { request }),
      { ...callbacks, key: requestKey }
    );
  }, [execute, options.cancelDuplicates]);
  
  /**
   * Make a DELETE request
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @param {Object} callbacks - Success and error callbacks
   * @returns {Promise} API call result
   */
  const del = useCallback((endpoint, params, callbacks = {}) => {
    const requestKey = callbacks.key || endpoint;
    
    if (activeRequestsRef.current[requestKey] && options.cancelDuplicates) {
      activeRequestsRef.current[requestKey]();
    }
    
    // Create a request with cancel capability
    const { request, cancel } = apiService.createCancelableRequest();
    activeRequestsRef.current[requestKey] = cancel;
    
    return execute(
      () => apiService.delete(endpoint, params, { request }),
      { ...callbacks, key: requestKey }
    );
  }, [execute, options.cancelDuplicates]);
  
  /**
   * Make a file upload request
   * @param {string} endpoint - API endpoint
   * @param {FormData} formData - Form data with files
   * @param {Function} onProgress - Progress callback
   * @param {Object} callbacks - Success and error callbacks
   * @returns {Promise} API call result
   */
  const upload = useCallback((endpoint, formData, onProgress, callbacks = {}) => {
    const requestKey = callbacks.key || endpoint;
    
    if (activeRequestsRef.current[requestKey] && options.cancelDuplicates) {
      activeRequestsRef.current[requestKey]();
    }
    
    // Create a request with cancel capability
    const { request, cancel } = apiService.createCancelableRequest();
    activeRequestsRef.current[requestKey] = cancel;
    
    return execute(
      () => apiService.upload(endpoint, formData, onProgress, { request }),
      { ...callbacks, key: requestKey }
    );
  }, [execute, options.cancelDuplicates]);
  
  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  // Reset all state
  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);
  
  return {
    loading,
    error,
    data,
    get,
    post,
    put,
    delete: del, // 'delete' is a reserved word, so we use 'del' internally
    upload,
    clearError,
    reset,
    cancelAllRequests
  };
};

export default useApi;