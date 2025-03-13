// client/src/components/LayoutComponents.js
import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context';
import { Spinner } from './ChatComponents';
import { toast } from 'react-toastify';

// Navbar Component
export const Navbar = () => {
  const { isAuthenticated, logout, user } = useAuth();

  const handleLogout = async (e) => {
    e.preventDefault();
    await logout();
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">Mandarin</Link>
      </div>
      <ul className="navbar-nav">
        {isAuthenticated ? (
          <>
            <li className="nav-item">
              <Link to="/dashboard">Dashboard</Link>
            </li>
            <li className="nav-item">
              <Link to="/profile">Profile</Link>
            </li>
            <li className="nav-item">
              <a href="#!" onClick={handleLogout}>Logout</a>
            </li>
            {user && (
              <li className="nav-item user-greeting">
                Hello, {user.nickname}
              </li>
            )}
          </>
        ) : (
          <>
            <li className="nav-item">
              <Link to="/login">Login</Link>
            </li>
            <li className="nav-item">
              <Link to="/register">Register</Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
};

// Alert Component
export const Alert = ({ type, message, onClose, actions }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  // Format the message to ensure it's a string
  const formatMessage = (msg) => {
    if (msg === null || msg === undefined) {
      return '';
    }

    if (typeof msg === 'string') {
      return msg;
    }

    if (typeof msg === 'object') {
      // For error objects or objects with message property
      if (msg.message) {
        return msg.message;
      }
      // For toast-style objects
      if (msg.text) {
        return msg.text;
      }
      // Last resort - stringify the object
      try {
        return JSON.stringify(msg);
      } catch (e) {
        return 'An error occurred';
      }
    }

    // For any other type, convert to string
    return String(msg);
  };

  // Show toast instead of alert component if specified
  useEffect(() => {
    if (type === 'toast') {
      try {
        // Handle different message formats for toast
        if (typeof message === 'object' && message !== null) {
          const toastType = message.type || 'info';
          const toastMessage = message.text || formatMessage(message);
          toast[toastType](toastMessage);
        } else {
          // For string messages or other types
          toast.info(formatMessage(message));
        }

        if (onClose) onClose();
      } catch (e) {
        console.error('Error showing toast:', e);
        // Fallback to a basic toast
        toast.info('Notification');
      }
    }
  }, [type, message, onClose]);

  // Return null for toast type alerts
  if (type === 'toast') return null;

  return (
    <div className={`alert alert-${type}`}>
      <span>{formatMessage(message)}</span>
      {actions && (
        <div className="alert-actions">
          {actions.map((action, index) => (
            <button
              key={index}
              className={`btn btn-sm btn-${action.type || 'primary'}`}
              onClick={action.action}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      {onClose && (
        <button className="close-btn" onClick={onClose}>×</button>
      )}
    </div>
  );
};

// Private Route Component
export const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading, error } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login', {
        replace: true,
        state: { from: window.location.pathname }
      });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return <Spinner />;
  }

  if (error) {
    // Format error message to ensure it's a string
    const errorMessage = typeof error === 'object' && error !== null
      ? (error.message || JSON.stringify(error))
      : String(error || 'Authentication error');

    return (
      <div className="auth-error">
        <h3>Authentication Error</h3>
        <p>{errorMessage}</p>
        <button
          onClick={() => navigate('/login')}
          className="btn btn-primary"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return isAuthenticated ? children : null;
};
