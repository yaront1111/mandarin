// client/src/context/AuthContext.js
import React, { createContext, useReducer, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import apiService from '../services/apiService';
import socketService from '../services/socketService';

// Create auth context
const AuthContext = createContext({});

/**
 * Auth reducer to handle auth state changes
 */
const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN':
      sessionStorage.setItem('token', action.payload.token);
      return {
        ...state,
        token: action.payload.token,
        isAuthenticated: true,
        loading: false,
        user: action.payload.data,
        error: null
      };
    case 'REGISTER':
      sessionStorage.setItem('token', action.payload.token);
      return {
        ...state,
        token: action.payload.token,
        isAuthenticated: true,
        loading: false,
        user: action.payload.data,
        error: null
      };
    case 'USER_LOADED':
      return {
        ...state,
        isAuthenticated: true,
        loading: false,
        user: action.payload,
        error: null
      };
    case 'AUTH_ERROR':
    case 'LOGIN_FAIL':
    case 'REGISTER_FAIL':
      sessionStorage.removeItem('token');
      return {
        ...state,
        token: null,
        isAuthenticated: false,
        loading: false,
        user: null,
        error: action.payload
      };
    case 'LOGOUT':
      sessionStorage.removeItem('token');
      return {
        ...state,
        token: null,
        isAuthenticated: false,
        loading: false,
        user: null,
        error: null
      };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
};

/**
 * Auth provider component
 */
export const AuthProvider = ({ children }) => {
  const initialState = {
    token: sessionStorage.getItem('token'),
    isAuthenticated: null,
    loading: true,
    user: null,
    error: null,
  };

  const [state, dispatch] = useReducer(authReducer, initialState);

  /**
   * Set auth token in API service headers
   */
  const setAuthToken = useCallback((token) => {
    if (token) {
      // Set token in both apiService and global axios
      apiService.setAuthToken(token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      apiService.setAuthToken(null);
      delete axios.defaults.headers.common['Authorization'];
    }
  }, []);

  /**
   * Check if token is expired
   */
  const isTokenExpired = useCallback((token) => {
    if (!token) return true;

    try {
      // Parse the JWT payload
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));

      // Check if exp exists and if token is expired
      if (payload.exp) {
        const now = Math.floor(Date.now() / 1000);
        return payload.exp < now;
      }

      // If no exp field, assume token is valid
      return false;
    } catch (error) {
      console.warn('Error parsing JWT token:', error);
      return true;
    }
  }, []);

  /**
   * Load user data using token
   */
  const loadUser = useCallback(async () => {
    const token = sessionStorage.getItem('token');

    if (!token) {
      dispatch({ type: 'AUTH_ERROR', payload: 'No token found' });
      return null;
    }

    // Check if token is expired
    if (isTokenExpired(token)) {
      dispatch({ type: 'AUTH_ERROR', payload: 'Token expired' });
      return null;
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      setAuthToken(token);

      const result = await apiService.get('/auth/me');

      if (result.success && result.data) {
        dispatch({ type: 'USER_LOADED', payload: result.data });
        return result.data;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const errorMsg = err.error || err.message || 'Failed to authenticate';
      dispatch({ type: 'AUTH_ERROR', payload: errorMsg });
      return null;
    }
  }, [setAuthToken, isTokenExpired]);

  /**
   * Register a new user
   */
  const register = async (formData) => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const result = await apiService.post('/auth/register', formData);

      if (result.success && result.token) {
        // Store token immediately
        sessionStorage.setItem('token', result.token);
        setAuthToken(result.token);

        dispatch({ type: 'REGISTER', payload: result });
        toast.success('Registration successful');

        // Load user data
        await loadUser();
        return true;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const errorMsg = err.error || err.message || 'Registration failed';
      toast.error(errorMsg);
      dispatch({ type: 'REGISTER_FAIL', payload: errorMsg });
      return false;
    }
  };

  /**
   * Login user
   */
  const login = async (formData) => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      // Use apiService instead of axios directly
      const result = await apiService.post('/auth/login', formData);

      if (result.success && result.token) {
        // Store token immediately
        sessionStorage.setItem('token', result.token);
        setAuthToken(result.token);

        dispatch({ type: 'LOGIN', payload: result });
        toast.success('Login successful');

        // Load user data immediately after login
        await loadUser();
        return true;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const errorMsg = err.error || err.message || 'Login failed';
      toast.error(errorMsg);
      dispatch({ type: 'LOGIN_FAIL', payload: errorMsg });
      return false;
    }
  };

  /**
   * Logout user
   */
  const logout = useCallback(async () => {
    // First, ensure we disconnect from socket
    socketService.disconnect();

    try {
      if (state.token) {
        setAuthToken(state.token); // Ensure token is set for the request
        await apiService.post('/auth/logout');
      }
      toast.info('Logged out successfully');
    } catch (err) {
      console.warn('Logout error:', err.message);
    } finally {
      // Clean up local state
      setAuthToken(null);
      dispatch({ type: 'LOGOUT' });
    }
  }, [state.token, setAuthToken]);

  /**
   * Clear error messages
   */
  const clearErrors = () => dispatch({ type: 'CLEAR_ERROR' });

  // Initial authentication check
  useEffect(() => {
    const token = sessionStorage.getItem('token');

    if (token) {
      // Check if token is expired first
      if (isTokenExpired(token)) {
        sessionStorage.removeItem('token');
        dispatch({ type: 'AUTH_ERROR', payload: 'Token expired' });
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      setAuthToken(token);
      loadUser();
    } else {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [loadUser, setAuthToken, isTokenExpired]);

  // Set up periodic token validation check
  useEffect(() => {
    const validateTokenInterval = setInterval(() => {
      const token = sessionStorage.getItem('token');
      if (token && isTokenExpired(token)) {
        // Token has expired, log user out
        console.warn('Token expired during session');
        toast.error('Your session has expired. Please log in again.');
        logout();
      }
    }, 60000); // Check every minute

    return () => clearInterval(validateTokenInterval);
  }, [isTokenExpired, logout]);

  return (
    <AuthContext.Provider
      value={{
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        loading: state.loading,
        user: state.user,
        error: state.error,
        register,
        login,
        logout,
        clearErrors,
        loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to use auth context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

// Export the API service for use in other files
export const authApiService = apiService;
