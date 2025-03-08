// src/pages/Dashboard/DashboardPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import ErrorBoundary from '../../components/common/ErrorBoundary';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Header from '../../components/layout/Header';
import Navigation from '../../components/layout/Navigation';

// Services
import { userService } from '../../services/userService';
import { messageService } from '../../services/messageService';
// Possibly others if you want more data

// Context
import { AppContext } from '../../context/AppContext';

function DashboardPage() {
  const navigate = useNavigate();
  const { stealthMode } = React.useContext(AppContext);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Example data
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);

        // e.g. get unread message count
        const convos = await messageService.getConversations();
        const totalUnread = convos.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        setUnreadMessages(totalUnread);

        // e.g. get user matches
        const matches = await userService.getMatches();
        setMatchCount(matches.length);

      } catch (err) {
        console.error('Error loading user dashboard:', err);
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="app-container">
        <ErrorBoundary>
          <Header />
        </ErrorBoundary>
        <div className="main flex justify-center items-center">
          <LoadingSpinner size={40} color="var(--color-primary)" />
        </div>
        <ErrorBoundary>
          <Navigation activeTab="profile" onTabChange={(tab) => navigate(`/${tab}`)} />
        </ErrorBoundary>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <Header />
        <div className="main p-4 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
        <Navigation activeTab="profile" onTabChange={(tab) => navigate(`/${tab}`)} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <ErrorBoundary>
        <Header />
      </ErrorBoundary>
      <main className="main">
        <h1 className="text-xl font-bold mb-4">User Dashboard</h1>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800 p-4 rounded-md">
            <h2 className="text-sm text-gray-400 mb-1">Unread Messages</h2>
            <p className="text-xl font-bold">{unreadMessages}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-md">
            <h2 className="text-sm text-gray-400 mb-1">Matches</h2>
            <p className="text-xl font-bold">{matchCount}</p>
          </div>
        </div>

        <div className="mt-4">
          <button
            className="btn btn-primary mr-2"
            onClick={() => navigate('/matches')}
          >
            View Matches
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/messages')}
          >
            View Messages
          </button>
        </div>
      </main>
      <ErrorBoundary>
        <Navigation activeTab="profile" onTabChange={(tab) => navigate(`/${tab}`)} />
      </ErrorBoundary>

      {stealthMode && (
        <div className="stealth-mode-indicator">
          <div className="stealth-mode-header">
            <span className="stealth-mode-icon">🛡️</span>
            <span className="stealth-mode-text">Stealth Mode Active</span>
          </div>
          <p className="stealth-mode-description">
            Your profile is hidden from others
          </p>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
