// src/routes.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// ========== Import All Pages ==========
// Auth
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';

// Discovery
import DiscoverPage from './pages/Discovery/DiscoverPage';
import MapDiscovery from './pages/Discovery/MapDiscovery';

// Matches
import MatchPage from './pages/Matches/MatchPage';
import MatchDetail from './pages/Matches/MatchDetail';
import Compatibility from './pages/Matches/Compatibility';

// Messages
import ChatPage from './pages/Messages/ChatPage';
import ChatDetail from './pages/Messages/ChatDetail';

// Stories
import StoriesPage from './pages/Stories/StoriesPage';

// Profiles
import UserProfile from './pages/Profiles/UserProfile';
import EditProfile from './pages/Profiles/EditProfile';
import PrivatePhotos from './pages/Profiles/PrivatePhotos';

// Dashboard (user-facing)
import DashboardPage from './pages/Dashboard/DashboardPage';

// Premium
import PremiumFeatures from './pages/Premium/PremiumFeatures';

// Admin
import AdminDashboard from './pages/Admin/Dashboard';
import UserManagement from './pages/Admin/UserManagement';
import ModerationQueue from './pages/Admin/ModerationQueue';
import Analytics from './pages/Admin/Analytics';

/**
 * Example of a simple "RequireAuth" guard.
 */
function RequireAuth({ children }) {
  const isAuthenticated = true; // Replace with real logic
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

/**
 * Example of a "RequireAdmin" guard for admin routes.
 */
function RequireAdmin({ children }) {
  const isAdmin = false; // Replace with real logic
  return isAdmin ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <Navigate to="/discover" replace />
            </RequireAuth>
          }
        />

        {/*
            1) /discover -> We'll show a "DiscoverPage"
            2) /map -> We show "MapDiscovery"
        */}
        <Route
          path="/discover"
          element={
            <RequireAuth>
              <DiscoverPage />
            </RequireAuth>
          }
        />
        <Route
          path="/map"
          element={
            <RequireAuth>
              <MapDiscovery />
            </RequireAuth>
          }
        />

        {/* Matches */}
        <Route
          path="/matches"
          element={
            <RequireAuth>
              <MatchPage />
            </RequireAuth>
          }
        />
        <Route
          path="/matches/:matchId"
          element={
            <RequireAuth>
              <MatchDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/matches/:matchId/compatibility"
          element={
            <RequireAuth>
              <Compatibility />
            </RequireAuth>
          }
        />

        {/* Messages */}
        <Route
          path="/messages"
          element={
            <RequireAuth>
              <ChatPage />
            </RequireAuth>
          }
        />
        <Route
          path="/messages/:conversationId"
          element={
            <RequireAuth>
              <ChatDetail />
            </RequireAuth>
          }
        />

        {/* Stories */}
        <Route
          path="/stories"
          element={
            <RequireAuth>
              <StoriesPage />
            </RequireAuth>
          }
        />

        {/* Profile
            - /profile -> The logged-in user's profile
            - /profiles/:userId -> Another user's profile
        */}
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <UserProfile />
            </RequireAuth>
          }
        />
        <Route
          path="/profiles/:userId"
          element={
            <RequireAuth>
              <UserProfile />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <RequireAuth>
              <EditProfile />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/private-photos"
          element={
            <RequireAuth>
              <PrivatePhotos />
            </RequireAuth>
          }
        />

        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />

        {/* Premium */}
        <Route
          path="/premium"
          element={
            <RequireAuth>
              <PremiumFeatures />
            </RequireAuth>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAdmin>
              <UserManagement />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/moderation"
          element={
            <RequireAdmin>
              <ModerationQueue />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <RequireAdmin>
              <Analytics />
            </RequireAdmin>
          }
        />

        {/* Catch-all for unknown routes */}
        <Route
          path="*"
          element={<h2 className="p-4 text-center">404 Page Not Found</h2>}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
