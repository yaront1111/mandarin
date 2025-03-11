// src/hooks/useAuth.js
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { login, registerUser, fetchCurrentUser, logout, refreshAccessToken, setupTokenRefresh } from '../store/authSlice';

export default function useAuth() {
  const dispatch = useDispatch();
  const { user, token, refreshToken, loading, error } = useSelector((state) => state.auth);

  // Set up token refresh on initial component mount
  useEffect(() => {
    if (token && refreshToken) {
      dispatch(setupTokenRefresh());
    }
  }, [dispatch, token, refreshToken]);

  const handleLogin = (email, password) => dispatch(login({ email, password }));
  const handleRegister = (data) => dispatch(registerUser(data));
  const handleFetchUser = () => dispatch(fetchCurrentUser());
  const handleLogout = () => dispatch(logout());
  const handleRefreshToken = () => dispatch(refreshAccessToken());

  return {
    user,
    token,
    loading,
    error,
    login: handleLogin,
    registerUser: handleRegister,
    fetchCurrentUser: handleFetchUser,
    refreshToken: handleRefreshToken,
    logout: handleLogout,
    isAuthenticated: !!token
  };
}
