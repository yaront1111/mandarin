// src/pages/Matches/MatchPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, X } from 'lucide-react';

// Components
import ErrorBoundary from '../../components/common/ErrorBoundary';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Header from '../../components/layout/Header';
import Navigation from '../../components/layout/Navigation';
import UserCard from '../../components/kinkCompatibility/UserCard';

// Services
import { userService } from '../../services/userService';

// Context
import { AppContext } from '../../context/AppContext';

function MatchPage() {
  const navigate = useNavigate();
  const { stealthMode } = React.useContext(AppContext);

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchMatches() {
      try {
        setLoading(true);
        // Suppose we have an endpoint /matches
        const data = await userService.getMatches();
        setMatches(data);
      } catch (err) {
        console.error('Error fetching matches:', err);
        setError('Failed to load matches. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchMatches();
  }, []);

  const handleReportUser = (user) => {
    // Possibly open a ReportModal
    console.log('Report user from matches:', user);
  };

  const handleSendIcebreaker = (user) => {
    // Possibly open IcebreakerModal
    console.log('Send icebreaker to:', user);
  };

  const handleLike = (user) => {
    // Could call userService.likeUser(user.id)
    console.log('Like user from matches:', user);
  };

  const handlePass = (user) => {
    // Could call userService.passUser(user.id)
    console.log('Pass on user from matches:', user);
  };

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
          <Navigation activeTab="matches" onTabChange={(tab) => navigate(`/${tab}`)} />
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className="app-container">
      <ErrorBoundary>
        <Header />
      </ErrorBoundary>

      <main className="main">
        <h1 className="text-xl font-bold mb-4">Your Matches</h1>
        {error ? (
          <div className="p-4 text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        ) : matches.length === 0 ? (
          <p className="text-center text-gray-400">No matches yet</p>
        ) : (
          <div className="user-grid">
            {matches.map((match) => (
              <UserCard
                key={match.id}
                user={match}
                onRequestPrivate={() => console.log('request private from match')}
                onReportUser={handleReportUser}
                onSendIcebreaker={handleSendIcebreaker}
                onLike={handleLike}
                onPass={handlePass}
              />
            ))}
          </div>
        )}
      </main>

      <ErrorBoundary>
        <Navigation activeTab="matches" onTabChange={(tab) => navigate(`/${tab}`)} />
      </ErrorBoundary>

      {stealthMode && (
        <div className="stealth-mode-indicator">
          <div className="stealth-mode-header">
            <span className="stealth-mode-icon">🛡️</span>
            <span className="stealth-mode-text">Stealth Mode Active</span>
          </div>
          <p className="stealth-mode-description">
            Your profile is hidden from new potential matches
          </p>
        </div>
      )}
    </div>
  );
}

export default MatchPage;
