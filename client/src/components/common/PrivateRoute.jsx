import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';
import { FaExclamationTriangle } from 'react-icons/fa';
import logger from '../../utils/logger';

const log = logger.create('PrivateRoute');

/**
 * Enhanced PrivateRoute component that protects routes requiring authentication.
 * Redirects to login if user is not authenticated.
 * Shows loading and error states appropriately.
 * 
 * @param {Object} props Component props
 * @param {React.ReactNode} props.children The components to render if authenticated
 * @param {boolean} props.useNavigateHook Whether to use navigate hook instead of Navigate component
 */
const PrivateRoute = ({ children, useNavigateHook = false }) => {
  const { user, isAuthenticated, loading, error } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showError, setShowError] = useState(false);
  
  // For Navigate component approach - show error message for 3 seconds before redirecting
  useEffect(() => {
    if (error) {
      setShowError(true);
      const timer = setTimeout(() => {
        setShowError(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);
  
  // For useNavigate hook approach - redirect if not authenticated
  useEffect(() => {
    if (useNavigateHook && !loading && !isAuthenticated) {
      log.debug("Not authenticated, redirecting to login");
      navigate("/login", {
        replace: true,
        state: { from: location.pathname },
      });
    }
  }, [isAuthenticated, loading, navigate, location.pathname, useNavigateHook]);

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
  if (error || showError) {
    const errorMessage =
      typeof error === "object" && error !== null
        ? error.message || JSON.stringify(error)
        : String(error || "Authentication error");
        
    return (
      <div className="auth-error">
        <div className="auth-error-content">
          <FaExclamationTriangle className="auth-error-icon" />
          <h3>Authentication Error</h3>
          <p>{errorMessage}</p>
          <button 
            onClick={() => navigate("/login")} 
            className="btn btn-primary"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // If using Navigate component and not authenticated, redirect to login
  if (!useNavigateHook && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // If authenticated, render the protected route content
  return isAuthenticated ? children : null;
};

export default PrivateRoute;