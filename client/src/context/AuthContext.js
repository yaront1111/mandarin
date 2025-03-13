import React, { createContext, useReducer, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';

/**
 * @typedef {Object} User
 * @property {string} id - User ID
 * @property {string} name - User name
 * @property {string} email - User email
 * @property {string} [role] - User role
 */

/**
 * @typedef {Object} AuthState
 * @property {string|null} token - JWT token
 * @property {boolean|null} isAuthenticated - Authentication status
 * @property {boolean} loading - Loading status
 * @property {User|null} user - User data
 * @property {string|null} error - Error message
 */

/**
 * @typedef {Object} AuthContextType
 * @property {string|null} token - JWT token
 * @property {boolean|null} isAuthenticated - Authentication status
 * @property {boolean} loading - Loading status
 * @property {User|null} user - User data
 * @property {string|null} error - Error message
 * @property {function(Object): Promise<void>} register - Register function
 * @property {function(Object): Promise<void>} login - Login function
 * @property {function(): Promise<void>} logout - Logout function
 * @property {function(): void} clearErrors - Clear errors function
 */

// Create auth context
const AuthContext = createContext(/** @type {AuthContextType} */ ({}));

// Create API service with default config
const apiService = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable sending cookies with requests
});

/**
 * Auth reducer to handle auth state changes
 * @param {AuthState} state - Current auth state
 * @param {Object} action - Dispatch action
 * @returns {AuthState} - New auth state
 */
const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN':
      // In production, prefer httpOnly cookies set by the server
      // This is a fallback for APIs that don't support cookies
      if (action.payload.token) {
        sessionStorage.setItem('token', action.payload.token);
      }
      return {
        ...state,
        isAuthenticated: true,
        loading: false,
        user: action.payload.data,
        error: null
      };
    case 'REGISTER':
      if (action.payload.token) {
        sessionStorage.setItem('token', action.payload.token);
      }
      return {
        ...state,
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
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element} - Auth provider component
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
   * @param {string|null} token - JWT token
   */
  const setAuthToken = useCallback((token) => {
    if (token) {
      apiService.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete apiService.defaults.headers.common['Authorization'];
    }
  }, []);

  /**
   * Check if token is expired
   * @param {string} token - JWT token
   * @returns {boolean} - True if token is expired
   */
  const isTokenExpired = useCallback((token) => {
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp < Date.now() / 1000;
    } catch (error) {
      return true;
    }
  }, []);

  /**
   * Load user data using token
   * @returns {Promise<void>}
   */
  const loadUser = useCallback(async () => {
    const token = sessionStorage.getItem('token');

    if (!token || isTokenExpired(token)) {
      dispatch({ type: 'AUTH_ERROR', payload: 'Invalid or expired token' });
      return;
    }

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
      const errorMsg = err.response?.data?.error ||
                      err.response?.data?.message ||
                      err.message ||
                      'Failed to authenticate';

      dispatch({ type: 'AUTH_ERROR', payload: errorMsg });
    }
  }, [isTokenExpired, setAuthToken]);

  /**
   * Register a new user
   * @param {Object} formData - Registration data
   * @returns {Promise<void>}
   */
  const register = async (formData) => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const res = await apiService.post('/auth/register', formData);

      if (res.data) {
        dispatch({ type: 'REGISTER', payload: res.data });
        await loadUser();
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error ||
                      err.response?.data?.message ||
                      err.message ||
                      'Registration failed';

      dispatch({ type: 'REGISTER_FAIL', payload: errorMsg });
    }
  };

  /**
   * Login user
   * @param {Object} formData - Login credentials
   * @returns {Promise<void>}
   */
  const login = async (formData) => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const res = await apiService.post('/auth/login', formData);

      if (res.data) {
        dispatch({ type: 'LOGIN', payload: res.data });
        await loadUser();
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error ||
                      err.response?.data?.message ||
                      err.message ||
                      'Login failed';

      dispatch({ type: 'LOGIN_FAIL', payload: errorMsg });
    }
  };

  /**
   * Refresh auth token
   * @returns {Promise<boolean>} - Success status
   */
  const refreshToken = async () => {
    try {
      const res = await apiService.post('/auth/refresh-token');

      if (res.data && res.data.token) {
        sessionStorage.setItem('token', res.data.token);
        setAuthToken(res.data.token);
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  };

  /**
   * Logout user
   * @returns {Promise<void>}
   */
  const logout = async () => {
    try {
      // Send logout request to invalidate token on server
      await apiService.post('/auth/logout');
    } catch (err) {
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

  // Set up API request interceptor for handling token expiration
  useEffect(() => {
    const requestInterceptor = apiService.interceptors.request.use(
      async (config) => {
        const token = sessionStorage.getItem('token');

        if (token && isTokenExpired(token)) {
          const refreshed = await refreshToken();

          if (!refreshed) {
            dispatch({ type: 'AUTH_ERROR', payload: 'Session expired' });
            return Promise.reject(new Error('Session expired'));
          }

          // Update token in the current request
          const newToken = sessionStorage.getItem('token');
          if (newToken) {
            config.headers.Authorization = `Bearer ${newToken}`;
          }
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Set up API response interceptor for handling auth errors
    const responseInterceptor = apiService.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Handle 401 Unauthorized errors
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          const refreshed = await refreshToken();

          if (refreshed) {
            const newToken = sessionStorage.getItem('token');
            if (newToken) {
              setAuthToken(newToken);
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return apiService(originalRequest);
            }
          }

          // If refresh failed, log the user out
          dispatch({ type: 'AUTH_ERROR', payload: 'Session expired' });
        }

        return Promise.reject(error);
      }
    );

    // Initial auth check
    const token = sessionStorage.getItem('token');
    if (token && !isTokenExpired(token)) {
      setAuthToken(token);
      loadUser();
    } else if (token && isTokenExpired(token)) {
      // Try to refresh the token if it's expired
      refreshToken().then(refreshed => {
        if (refreshed) {
          loadUser();
        } else {
          dispatch({ type: 'AUTH_ERROR', payload: 'Session expired' });
        }
      });
    } else {
      dispatch({ type: 'SET_LOADING', payload: false });
    }

    // Clean up interceptors on unmount
    return () => {
      apiService.interceptors.request.eject(requestInterceptor);
      apiService.interceptors.response.eject(responseInterceptor);
    };
  }, [loadUser, isTokenExpired, setAuthToken]);

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
 * @returns {AuthContextType} - Auth context
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
