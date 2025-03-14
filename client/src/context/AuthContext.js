// client/src/context/AuthContext.js
// Production-level Auth Context with improved token refresh logic and axios interceptor

import React, {
  createContext,
  useReducer,
  useContext,
  useEffect,
  useCallback,
  useRef
} from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import apiService from '../services/apiService';
import socketService from '../services/socketService';

const AuthContext = createContext({});

// Reducer to manage auth state
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

export const AuthProvider = ({ children }) => {
  const initialState = {
    token: sessionStorage.getItem('token'),
    isAuthenticated: null,
    loading: true,
    user: null,
    error: null
  };

  const [state, dispatch] = useReducer(authReducer, initialState);
  const refreshTokenPromise = useRef(null);
  const tokenRefreshTimer = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (tokenRefreshTimer.current) {
        clearTimeout(tokenRefreshTimer.current);
      }
    };
  }, []);

  // Set the auth token in apiService and axios defaults
  const setAuthToken = useCallback((token) => {
    if (token) {
      apiService.setAuthToken(token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      apiService.setAuthToken(null);
      delete axios.defaults.headers.common['Authorization'];
    }
  }, []);

  // Check if the JWT token is expired (with a 30-second buffer)
  const isTokenExpired = useCallback((token) => {
    if (!token) return true;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));
      const now = Math.floor(Date.now() / 1000) + 30;
      return payload.exp < now;
    } catch (error) {
      console.warn('Error parsing JWT token:', error);
      return true;
    }
  }, []);

  // Calculate seconds until token expiry
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

  // Improved token refresh logic with proper request queuing
  const refreshToken = useCallback(async () => {
    if (refreshTokenPromise.current) {
      return refreshTokenPromise.current;
    }

    refreshTokenPromise.current = (async () => {
      try {
        const currentToken = sessionStorage.getItem('token');
        if (!currentToken) {
          throw new Error('No token available for refresh');
        }
        // Clear any existing token refresh timer
        if (tokenRefreshTimer.current) {
          clearTimeout(tokenRefreshTimer.current);
          tokenRefreshTimer.current = null;
        }
        const result = await apiService.post('/auth/refresh-token', { token: currentToken });
        if (result.success && result.token) {
          sessionStorage.setItem('token', result.token);
          setAuthToken(result.token);
          if (isMounted.current) {
            dispatch({ type: 'TOKEN_REFRESHED', payload: result.token });
          }
          // Schedule next token refresh
          const expiryTime = getTokenExpiryTime(result.token);
          if (expiryTime > 0) {
            const refreshDelay = Math.min(expiryTime - 300, Math.max(expiryTime / 2, 60));
            tokenRefreshTimer.current = setTimeout(() => {
              if (isMounted.current && sessionStorage.getItem('token')) {
                refreshToken().catch(err => console.error('Scheduled token refresh failed:', err));
              }
            }, refreshDelay * 1000);
          }
          return result.token;
        } else {
          throw new Error('Failed to refresh token');
        }
      } catch (err) {
        console.error('Token refresh failed:', err);
        if (isMounted.current) {
          const errorMsg = err.error || err.message || 'Session expired. Please login again.';
          toast.error(errorMsg);
          await logout();
        }
        throw err;
      } finally {
        refreshTokenPromise.current = null;
      }
    })();

    return refreshTokenPromise.current;
  }, [setAuthToken, getTokenExpiryTime]);

  // Axios interceptor to retry requests after refreshing token on 401 errors
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      async error => {
        const originalRequest = error.config;
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const newToken = await refreshToken();
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return axios(originalRequest);
          } catch (err) {
            return Promise.reject(err);
          }
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [refreshToken]);

  // Load user data using the current token
  const loadUser = useCallback(async () => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      dispatch({ type: 'AUTH_ERROR', payload: 'No token found' });
      return null;
    }
    if (isTokenExpired(token)) {
      try {
        await refreshToken();
      } catch (err) {
        dispatch({ type: 'AUTH_ERROR', payload: 'Session expired. Please login again.' });
        return null;
      }
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const currentToken = sessionStorage.getItem('token');
      setAuthToken(currentToken);
      const result = await apiService.get('/auth/me');
      if (result.success && result.data) {
        dispatch({ type: 'USER_LOADED', payload: result.data });
        return result.data;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      if (err.status === 401) {
        try {
          await refreshToken();
          return loadUser();
        } catch (refreshErr) {
          dispatch({ type: 'AUTH_ERROR', payload: refreshErr.message || 'Authentication failed' });
          return null;
        }
      }
      dispatch({ type: 'AUTH_ERROR', payload: err.message || 'Failed to load user' });
      return null;
    }
  }, [setAuthToken, isTokenExpired, refreshToken]);

  const register = async (formData) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const registrationData = { ...formData };
      if (registrationData.details) {
        if (registrationData.details.interests && !Array.isArray(registrationData.details.interests)) {
          registrationData.details.interests = registrationData.details.interests
            .toString()
            .split(',')
            .map(item => item.trim())
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
        sessionStorage.setItem('token', result.token);
        setAuthToken(result.token);
        dispatch({ type: 'REGISTER', payload: result });
        toast.success('Registration successful');
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

  const login = async (formData) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const result = await apiService.post('/auth/login', formData);
      if (result.success && result.token) {
        sessionStorage.setItem('token', result.token);
        setAuthToken(result.token);
        dispatch({ type: 'LOGIN', payload: result });
        toast.success('Login successful');
        await loadUser();
        // Schedule token refresh based on expiry
        const expiryTime = getTokenExpiryTime(result.token);
        if (expiryTime > 0) {
          const refreshDelay = Math.min(expiryTime - 300, Math.max(expiryTime / 2, 60));
          tokenRefreshTimer.current = setTimeout(() => {
            if (sessionStorage.getItem('token')) {
              refreshToken().catch(err => console.error('Scheduled token refresh failed:', err));
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

  const logout = useCallback(async () => {
    socketService.disconnect();
    try {
      if (state.token) {
        setAuthToken(state.token);
        await apiService.post('/auth/logout');
      }
      toast.info('Logged out successfully');
    } catch (err) {
      console.warn('Logout error:', err.message);
    } finally {
      setAuthToken(null);
      dispatch({ type: 'LOGOUT' });
    }
  }, [state.token, setAuthToken]);

  const clearErrors = () => dispatch({ type: 'CLEAR_ERROR' });

  // Initialize authentication state on app load
  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (token) {
      if (isTokenExpired(token)) {
        refreshToken()
          .then(() => loadUser())
          .catch(() => {
            sessionStorage.removeItem('token');
            dispatch({ type: 'AUTH_ERROR', payload: 'Session expired. Please login again.' });
            dispatch({ type: 'SET_LOADING', payload: false });
          });
      } else {
        setAuthToken(token);
        loadUser();
        const expiryTime = getTokenExpiryTime(token);
        if (expiryTime > 0) {
          tokenRefreshTimer.current = setTimeout(() => {
            if (sessionStorage.getItem('token')) {
              refreshToken();
            }
          }, Math.min(expiryTime - 300, Math.max(expiryTime / 2, 60)) * 1000);
        }
      }
    } else {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [loadUser, setAuthToken, isTokenExpired, getTokenExpiryTime, refreshToken]);

  // Periodic token check for long sessions
  useEffect(() => {
    let tokenCheckInterval;
    if (state.token) {
      const expiryTime = getTokenExpiryTime(state.token);
      const checkInterval = expiryTime < 600 ? 60000 : 300000;
      tokenCheckInterval = setInterval(() => {
        const token = sessionStorage.getItem('token');
        if (token && isTokenExpired(token)) {
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
 * Custom hook to access auth context.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const authApiService = apiService;
