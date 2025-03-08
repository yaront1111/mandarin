// src/context/AuthContext.js
import React, {
  createContext, useState, useEffect, useCallback
} from 'react';
import PropTypes from 'prop-types';
// import { loginService, logoutService, getCurrentUser } from '@/services/authService';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Example: user object from your API
  const [currentUser, setCurrentUser] = useState(null);

  // On mount, check existing token or session
  useEffect(() => {
    // (Pseudo-code) Attempt to read token from storage:
    // const tokenFromStorage = localStorage.getItem('authToken');
    // if (tokenFromStorage) {
    //   setAuthToken(tokenFromStorage);
    //   setIsAuthenticated(true);
    //   // Maybe fetch user data...
    // }
    setAuthLoading(false);
  }, []);

  const login = useCallback(async (credentials) => {
    try {
      setAuthLoading(true);
      setAuthError(null);
      // const { token, user } = await loginService(credentials);
      // setAuthToken(token);
      // setCurrentUser(user);
      // localStorage.setItem('authToken', token);
      setIsAuthenticated(true);
    } catch (error) {
      setAuthError(error.message || 'Login failed');
      setIsAuthenticated(false);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    // await logoutService();
    // localStorage.removeItem('authToken');
    setAuthToken(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
  }, []);

  const contextValue = {
    isAuthenticated,
    authToken,
    authLoading,
    authError,
    currentUser,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
