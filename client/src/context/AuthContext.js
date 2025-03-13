import React, { createContext, useReducer, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext();

axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN':
      localStorage.setItem('token', action.payload.token);
      return { ...state, isAuthenticated: true, loading: false, user: action.payload.data };
    case 'REGISTER':
      localStorage.setItem('token', action.payload.token);
      return { ...state, isAuthenticated: true, loading: false, user: action.payload.data };
    case 'USER_LOADED':
      return { ...state, isAuthenticated: true, loading: false, user: action.payload };
    case 'AUTH_ERROR':
    case 'LOGIN_FAIL':
    case 'REGISTER_FAIL':
    case 'LOGOUT':
      localStorage.removeItem('token');
      return { ...state, token: null, isAuthenticated: false, loading: false, user: null, error: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const initialState = {
    token: localStorage.getItem('token'),
    isAuthenticated: null,
    loading: true,
    user: null,
    error: null,
  };

  const [state, dispatch] = useReducer(authReducer, initialState);

  // Set the token in Axios headers
  const setAuthToken = (token) => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      console.log('Auth token set in axios:', token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      console.log('Auth token removed from axios');
    }
  };

  // Load user using token from localStorage
  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    console.log('Loading user with token:', token);
    if (!token) {
      dispatch({ type: 'AUTH_ERROR', payload: 'No token found' });
      return;
    }
    try {
      setAuthToken(token);
      const res = await axios.get('/auth/me');
      console.log('User loaded:', res.data.data);
      dispatch({ type: 'USER_LOADED', payload: res.data.data });
    } catch (err) {
      console.error('Error loading user:', err.response?.data || err.message);
      dispatch({ type: 'AUTH_ERROR', payload: err.response?.data.error || 'Server Error' });
    }
  }, []);

  const register = async (formData) => {
    try {
      const res = await axios.post('/auth/register', formData);
      dispatch({ type: 'REGISTER', payload: res.data });
      loadUser();
    } catch (err) {
      console.error('Registration error:', err.response?.data || err.message);
      dispatch({ type: 'REGISTER_FAIL', payload: err.response?.data.error || 'Server Error' });
    }
  };

  const login = async (formData) => {
    try {
      const res = await axios.post('/auth/login', formData);
      dispatch({ type: 'LOGIN', payload: res.data });
      loadUser();
    } catch (err) {
      console.error('Login error:', err.response?.data || err.message);
      dispatch({ type: 'LOGIN_FAIL', payload: err.response?.data.error || 'Server Error' });
    }
  };

  const logout = async () => {
    try {
      await axios.get('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err.message);
    }
    dispatch({ type: 'LOGOUT' });
  };

  const clearErrors = () => dispatch({ type: 'CLEAR_ERROR' });

  useEffect(() => {
    const token = localStorage.getItem('token');
    setAuthToken(token);
    if (token) {
      loadUser();
    }
  }, [loadUser]);

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

export const useAuth = () => useContext(AuthContext);
