// client/src/context/AuthContext.js
import React, { createContext, useReducer, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import apiService from '../services/apiService';

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
      console.log('Setting auth token in headers');
      // Set token in both apiService and global axios
      apiService.setAuthToken(token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      console.log('Removing auth token from headers');
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
    console.log('Loading user data...');
    const token = sessionStorage.getItem('token');

    if (!token) {
      console.warn('No token found in storage');
      dispatch({ type: 'AUTH_ERROR', payload: 'No token found' });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      setAuthToken(token);
      console.log('Making request to /auth/me endpoint');

      const result = await apiService.get('/auth/me');

      if (result.success && result.data) {
        dispatch({ type: 'USER_LOADED', payload: result.data });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Auth error:', err);
      const errorMsg = err.error || err.message || 'Failed to authenticate';

      dispatch({ type: 'AUTH_ERROR', payload: errorMsg });
    }
  }, [setAuthToken]);

  /**
   * Register a new user
   */
  const register = async (formData) => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      console.log('Registering new user');
      const result = await apiService.post('/auth/register', formData);

      if (result.success && result.token) {
        // Store token immediately
        sessionStorage.setItem('token', result.token);
        setAuthToken(result.token);

        dispatch({ type: 'REGISTER', payload: result });
        toast.success('Registration successful');

        // Load user data with sufficient delay
        setTimeout(() => {
          loadUser();
        }, 500);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Registration error:', err);
      const errorMsg = err.error || err.message || 'Registration failed';

      toast.error(errorMsg);
      dispatch({ type: 'REGISTER_FAIL', payload: errorMsg });
    }
  };

  /**
   * Login user
   */
  const login = async (formData) => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      console.log('Logging in user');

      // Use apiService instead of axios directly
      const result = await apiService.post('/auth/login', formData);

      if (result.success && result.token) {
        // Store token immediately
        sessionStorage.setItem('token', result.token);
        setAuthToken(result.token);

        dispatch({ type: 'LOGIN', payload: result });
        toast.success('Login successful');

        // Load user with increased delay for reliability
        setTimeout(() => {
          loadUser();
        }, 500);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Login error:', err);
      const errorMsg = err.error || err.message || 'Login failed';

      toast.error(errorMsg);
      dispatch({ type: 'LOGIN_FAIL', payload: errorMsg });
    }
  };

  /**
   * Logout user
   */
  const logout = async () => {
    try {
      console.log('Logging out user');
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
  };

  /**
   * Clear error messages
   */
  const clearErrors = () => dispatch({ type: 'CLEAR_ERROR' });

  // Initial authentication check
  useEffect(() => {
    console.log('Initial auth check');
    const token = sessionStorage.getItem('token');

    if (token) {
      console.log('Token found in storage, setting up authentication');
      setAuthToken(token);
      loadUser();
    } else {
      console.log('No token found, not authenticating');
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [loadUser, setAuthToken]);

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
