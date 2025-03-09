// src/hooks/useAuth.js
import { useDispatch, useSelector } from 'react-redux';
import { login, registerUser, fetchCurrentUser, logout } from '../store/authSlice';

export default function useAuth() {
  const dispatch = useDispatch();
  const { user, token, loading, error } = useSelector((state) => state.auth);

  const handleLogin = (email, password) => dispatch(login({ email, password }));
  const handleRegister = (data) => dispatch(registerUser(data));
  const handleFetchUser = () => dispatch(fetchCurrentUser());
  const handleLogout = () => dispatch(logout());

  return {
    user,
    token,
    loading,
    error,
    login: handleLogin,
    registerUser: handleRegister,
    fetchCurrentUser: handleFetchUser,
    logout: handleLogout
  };
}
