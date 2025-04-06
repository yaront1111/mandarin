import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context';
import { FaExclamationTriangle } from 'react-icons/fa';
import { logUserRoleToConsole } from '../debug-middleware';
import '../styles/admin.css';

/**
 * A wrapper component that protects admin routes requiring admin privileges.
 * Redirects to dashboard if user is not an admin.
 */
const AdminRoute = ({ children }) => {
  const { user, isAuthenticated, loading, error } = useAuth();
  const location = useLocation();
  const [showError, setShowError] = useState(false);

  // Show error message for 3 seconds before redirecting
  useEffect(() => {
    if (error) {
      setShowError(true);
      const timer = setTimeout(() => {
        setShowError(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // If still loading auth state, show loading spinner
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p className="loading-text">Loading...</p>
      </div>
    );
  }

  // If there's an auth error, show error message
  if (showError) {
    return (
      <div className="auth-error">
        <div className="auth-error-content">
          <FaExclamationTriangle className="auth-error-icon" />
          <h3>Authentication Error</h3>
          <p>{error || "Authentication failed"}</p>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect to login with return path
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Debug user role information
  logUserRoleToConsole(user);

  // Check if user has admin role
  // The role field is likely 'admin' not a boolean isAdmin property
  if (user.role !== 'admin' && !user.roles?.includes('admin')) {
    console.log('Access denied: User does not have admin role');
    return <Navigate to="/dashboard" replace />;
  }

  // If authenticated and has admin privileges, render the protected route content
  return children;
};

export default AdminRoute;