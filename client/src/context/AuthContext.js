// client/src/context/AuthContext.js
import React, { createContext, useReducer, useContext, useEffect, useCallback, useRef } from 'react';
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
    case 'TOKEN_REFRESHED':
      sessionStorage.setItem('token', action.payload);
      return {
        ...state,
        token: action.payload,
        error: null
      };
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

  // Use ref to keep track of the refresh token promise to prevent multiple refreshes
  const refreshTokenPromise = useRef(null);

  // Use ref to track if the component is still mounted (prevent memory leaks)
  const isMounted = useRef(true);

  // Set mounted/unmounted status
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

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
        // Add a small buffer (30 seconds) to account for time differences
        const now = Math.floor(Date.now() / 1000) + 30;
        return payload.exp < now;
      }

      // If no exp field, assume token is valid (safer to return true here for production)
      return false;
    } catch (error) {
      console.warn('Error parsing JWT token:', error);
      return true;
    }
  }, []);

  /**
   * Get token expiration time in seconds
   */
  const getTokenExpiryTime = useCallback((token) => {
    if (!token) return 0;

    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));

      if (payload.exp) {
        const now = Math.floor(Date.now() / 1000);
        return payload.exp - now;
      }
      return 0;
    } catch (error) {
      console.warn('Error parsing JWT token expiry:', error);
      return 0;
    }
  }, []);

  /**
   * Refresh authentication token
   */
  const refreshToken = useCallback(async () => {
    // Check if refresh is already in progress
    if (refreshTokenPromise.current !== null) {
      return refreshTokenPromise.current;
    }

    // Create new refresh promise
    refreshTokenPromise.current = (async () => {
      try {
        const currentToken = sessionStorage.getItem('token');

        if (!currentToken) {
          throw new Error('No token to refresh');
        }

        const result = await apiService.post('/auth/refresh-token', { token: currentToken });

        if (result.success && result.token) {
          // Store token and update headers
          sessionStorage.setItem('token', result.token);
          setAuthToken(result.token);

          if (isMounted.current) {
            dispatch({ type: 'TOKEN_REFRESHED', payload: result.token });
          }

          return result.token;
        } else {
          throw new Error('Failed to refresh token');
        }
      } catch (err) {
        console.error('Token refresh failed:', err);

        // On refresh failure, log user out if still mounted
        if (isMounted.current) {
          const errorMsg = err.error || err.message || 'Session expired. Please login again.';
          toast.error(errorMsg);
          logout();
        }

        throw err;
      } finally {
        refreshTokenPromise.current = null;
      }
    })();

    return refreshTokenPromise.current;
  }, [setAuthToken]);

  /**
   * Load user data using token
   */
  const loadUser = useCallback(async () => {
    const token = sessionStorage.getItem('token');

    if (!token) {
      dispatch({ type: 'AUTH_ERROR', payload: 'No token found' });
      return null;
    }

    // Check if token is expired and attempt refresh if needed
    if (isTokenExpired(token)) {
      try {
        // Try to refresh the token first
        await refreshToken();
      } catch (err) {
        // If refresh fails, return auth error
        dispatch({ type: 'AUTH_ERROR', payload: 'Session expired. Please login again.' });
        return null;
      }
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      // Get the possibly refreshed token
      const currentToken = sessionStorage.getItem('token');
      setAuthToken(currentToken);

      const result = await apiService.get('/auth/me');

      if (result.success && result.data) {
        dispatch({ type: 'USER_LOADED', payload: result.data });
        return result.data;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      // Try to refresh token if we get an auth error
      if (err.status === 401) {
        try {
          await refreshToken();
          // Retry loading user after token refresh
          return loadUser();
        } catch (refreshErr) {
          // If refresh fails, proceed with error
          const errorMsg = refreshErr.error || refreshErr.message || 'Failed to authenticate';
          dispatch({ type: 'AUTH_ERROR', payload: errorMsg });
          return null;
        }
      }

      const errorMsg = err.error || err.message || 'Failed to authenticate';
      dispatch({ type: 'AUTH_ERROR', payload: errorMsg });
      return null;
    }
  }, [setAuthToken, isTokenExpired, refreshToken]);

  /**
   * Register a new user
   */
  const register = async (formData) => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      // Ensure data is properly formatted
      const registrationData = { ...formData };

      // Handle nested properties correctly
      if (registrationData.details) {
        // Ensure interests and lookingFor are arrays
        if (registrationData.details.interests && !Array.isArray(registrationData.details.interests)) {
          registrationData.details.interests = registrationData.details.interests
            .toString()
            .split(',')
            .map(interest => interest.trim())
            .filter(Boolean);
        }

        if (registrationData.details.lookingFor && !Array.isArray(registrationData.details.lookingFor)) {
          registrationData.details.lookingFor = registrationData.details.lookingFor
            .toString()
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);
        }
      }

      const result = await apiService.post('/auth/register', registrationData);

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

        // Setup token refresh timer based on expiry
        const expiryTime = getTokenExpiryTime(result.token);
        if (expiryTime > 0) {
          // Schedule refresh before token expires (5 minutes before expiry or halfway to expiry if less than 10 minutes)
          const refreshDelay = Math.min(expiryTime - 300, Math.max(expiryTime / 2, 60)); // At least 1 minute
          setTimeout(() => {
            if (sessionStorage.getItem('token')) {
              refreshToken();
            }
          }, refreshDelay * 1000);
        }

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
        // Try to refresh token first instead of immediately removing it
        refreshToken()
          .then(() => {
            // If refresh was successful, load user data
            loadUser();
          })
          .catch(() => {
            // If refresh failed, clear token and show error
            sessionStorage.removeItem('token');
            dispatch({ type: 'AUTH_ERROR', payload: 'Session expired. Please login again.' });
            dispatch({ type: 'SET_LOADING', payload: false });
          });
      } else {
        setAuthToken(token);
        loadUser();

        // Setup token refresh timer based on expiry
        const expiryTime = getTokenExpiryTime(token);
        if (expiryTime > 0) {
          // Schedule refresh before token expires (5 minutes before expiry or halfway to expiry if less than 10 minutes)
          const refreshDelay = Math.min(expiryTime - 300, Math.max(expiryTime / 2, 60)); // At least 1 minute

          const timeoutId = setTimeout(() => {
            if (sessionStorage.getItem('token')) {
              refreshToken();
            }
          }, refreshDelay * 1000);

          return () => clearTimeout(timeoutId);
        }
      }
    } else {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [loadUser, setAuthToken, isTokenExpired, getTokenExpiryTime, refreshToken]);

  // Set up periodic token validation check with more intelligent timing
  useEffect(() => {
    let tokenCheckInterval;

    if (state.token) {
      // Calculate check interval based on token expiry time
      const expiryTime = getTokenExpiryTime(state.token);

      // If token expires in less than 10 minutes, check every minute
      // Otherwise, check every 5 minutes
      const checkInterval = expiryTime < 600 ? 60000 : 300000;

      tokenCheckInterval = setInterval(() => {
        const token = sessionStorage.getItem('token');
        if (token && isTokenExpired(token)) {
          console.warn('Token expired during session');

          // Try to refresh the token first instead of logging out immediately
          refreshToken().catch(() => {
            toast.error('Your session has expired. Please log in again.');
            logout();
          });
        }
      }, checkInterval);
    }

    return () => {
      if (tokenCheckInterval) clearInterval(tokenCheckInterval);
    };
  }, [state.token, isTokenExpired, logout, refreshToken, getTokenExpiryTime]);

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
        refreshToken,
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
