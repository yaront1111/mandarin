// src/hooks/useAuth.js
import { useContext } from 'react';
import { AuthContext } from '@/context/AuthContext';

/**
 * useAuth
 * A custom hook to access authentication state and methods
 * anywhere in your component tree, without manually
 * importing and calling useContext(AuthContext).
 *
 * Usage:
 * const {
 *   isAuthenticated, authLoading, authError, currentUser,
 *   login, logout
 * } = useAuth();
 */
export default function useAuth() {
  return useContext(AuthContext);
}
