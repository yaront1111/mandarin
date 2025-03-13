// client/src/context/AuthContext.js
import React, { createContext, useReducer, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

// Create auth context
const AuthContext = createContext({});

// Create API service with default config
const apiService = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  // Don't use withCredentials with wildcard CORS
});

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
      apiService.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete apiService.defaults.headers.common['Authorization'];
      delete axios.defaults.headers.common['Authorization'];
    }
  }, []);

  /**
   * Check if token is expired
   * More lenient approach to avoid timing issues
   */
  const isTokenExpired = useCallback((token) => {
    if (!token) return true;

    try {
      // Parse the JWT payload
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));

      // Check if exp exists and if token is expired
      // Add 5 second buffer to prevent edge timing issues
      if (payload.exp) {
        return payload.exp < (Date.now() / 1000) - 5;
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
      return;
    }

    // Skip token expiration check - let the server validate it
    // if (isTokenExpired(token)) {
    //   dispatch({ type: 'AUTH_ERROR', payload: 'Invalid or expired token' });
    //   return;
    // }

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      setAuthToken(token);
      const res = await apiService.get('/auth/me');

      if (res.data && res.data.data) {
        dispatch({ type: 'USER_LOADED', payload: res.data.data });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Auth error:', err);
      const errorMsg = err.response?.data?.error ||
                      err.response?.data?.message ||
                      err.message ||
                      'Failed to authenticate';

      dispatch({ type: 'AUTH_ERROR', payload: errorMsg });
    }
  }, [setAuthToken]);

  /**
   * Register a new user
   */
  const register = async (formData) => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const res = await apiService.post('/auth/register', formData);

      if (res.data) {
        dispatch({ type: 'REGISTER', payload: res.data });
        toast.success('Registration successful');

        // Important: Wait for state update before loading user
        setTimeout(() => {
          loadUser();
        }, 100);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error ||
                      err.response?.data?.message ||
                      err.message ||
                      'Registration failed';

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
      const res = await axios.post('/api/auth/login', formData);

      if (res.data) {
        dispatch({ type: 'LOGIN', payload: res.data });
        toast.success('Login successful');

        // Important: Set token in axios before loading user
        setAuthToken(res.data.token);

        // Add delay to ensure token is set before loading user
        setTimeout(() => {
          loadUser();
        }, 100);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Login error:', err);
      const errorMsg = err.response?.data?.error ||
                      err.response?.data?.message ||
                      err.message ||
                      'Login failed';

      toast.error(errorMsg);
      dispatch({ type: 'LOGIN_FAIL', payload: errorMsg });
    }
  };

  /**
   * Logout user
   */
  const logout = async () => {
    try {
      // Send logout request to invalidate token on server
      await axios.post('/api/auth/logout');
      toast.info('Logged out successfully');
    } catch (err) {
      console.warn('Logout error:', err.message);
      // Continue with local logout even if server request fails
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
    // Check if token exists and set it in headers
    const token = sessionStorage.getItem('token');

    if (token) {
      setAuthToken(token);

      // Only load user if we have a token - let server validate it
      loadUser();
    } else {
      // If no token exists, set loading to false
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
