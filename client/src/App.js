// src/App.js
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchCurrentUser, setupTokenRefresh, logout } from './store/authSlice';
import { registerAuthHandlers } from './services/api';
import PropTypes from 'prop-types';

// Import Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import DiscoverPage from './pages/DiscoverPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import MatchesPage from './pages/MatchesPage';
import MessagesPage from './pages/MessagesPage';
import HomePage from './pages/DashboardPage';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { token } = useSelector((state) => state.auth);

  if (!token) {
    // Redirect to login if not authenticated
    return <Navigate to="/login" />;
  }

  return children;
};

// PropTypes for ProtectedRoute
ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired
};

// Public Only Route (redirect to dashboard if already logged in)
const PublicOnlyRoute = ({ children }) => {
  const { token } = useSelector((state) => state.auth);

  if (token) {
    // Redirect to dashboard if already authenticated
    return <Navigate to="/dashboard" />;
  }

  return children;
};

// PropTypes for PublicOnlyRoute
PublicOnlyRoute.propTypes = {
  children: PropTypes.node.isRequired
};

const App = () => {
  const dispatch = useDispatch();
  const { token, loading } = useSelector((state) => state.auth);

  // Register the logout handler for API auth errors
  useEffect(() => {
    registerAuthHandlers(() => {
      dispatch(logout());
    });
  }, [dispatch]);

  // Fetch current user on app load if token exists and set up token refresh
  useEffect(() => {
    if (token) {
      dispatch(fetchCurrentUser());
      dispatch(setupTokenRefresh()); // Set up automatic token refresh
    }
  }, [dispatch, token]);

  // Show loading indicator while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-brand-pink border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />

        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <RegisterPage />
            </PublicOnlyRoute>
          }
        />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/discover"
          element={
            <ProtectedRoute>
              <DiscoverPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/matches"
          element={
            <ProtectedRoute>
              <MatchesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/messages/:id"
          element={
            <ProtectedRoute>
              <MessagesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <MessagesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/users/:id"
          element={
            <ProtectedRoute>
              {/* You'll need to implement this page or use the existing one */}
              <div>User Profile Page</div>
            </ProtectedRoute>
          }
        />

        {/* Landing page should be HomePage for logged out users and Dashboard for logged in users */}
        <Route
          path="/"
          element={
            token ? <Navigate to="/dashboard" replace /> : <HomePage />
          }
        />

        {/* Catch all - Redirect to home/dashboard */}
        <Route
          path="*"
          element={
            token ? <Navigate to="/dashboard" replace /> : <Navigate to="/" replace />
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
