// src/pages/Matches/MatchDetail.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Heart } from 'lucide-react';

import ErrorBoundary from '../../components/common/ErrorBoundary';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Header from '../../components/layout/Header';
import Navigation from '../../components/layout/Navigation';
import { userService } from '../../services/userService';
import { moderationService } from '../../services/moderationService';
import { AppContext } from '../../context/AppContext';

function MatchDetail() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { stealthMode } = React.useContext(AppContext);

  const [matchInfo, setMatchInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchMatch() {
      try {
        setLoading(true);
        // e.g. GET /matches/:id
        const data = await userService.getMatchDetail(matchId);
        setMatchInfo(data);
      } catch (err) {
        console.error('Error fetching match detail:', err);
        setError('Failed to load match details. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchMatch();
  }, [matchId]);

  const handleReportUser = async () => {
    // Possibly open a modal or just do quick submission
    if (!matchInfo) return;
    try {
      await moderationService.reportUser(matchInfo.userId, { reason: 'harassment' });
      console.log('Reported user');
    } catch (err) {
      console.error('Error reporting user:', err);
    }
  };

  const handleMessage = () => {
    // Navigate to chat
    if (matchInfo) {
      navigate(`/messages/${matchInfo.conversationId}`);
    }
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
          <Navigation
            activeTab="matches"
            onTabChange={(tab) => navigate(`/${tab}`)}
          />
        </ErrorBoundary>
      </div>
    );
  }

  if (error || !matchInfo) {
    return (
      <div className="app-container">
        <ErrorBoundary>
          <Header />
        </ErrorBoundary>
        <div className="main p-4">
          <p className="text-red-500 mb-4 text-center">{error || 'Match not found'}</p>
          <button className="btn btn-primary mx-auto block" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
        <ErrorBoundary>
          <Navigation
            activeTab="matches"
            onTabChange={(tab) => navigate(`/${tab}`)}
          />
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
        <h1 className="text-xl font-bold mb-4">Match Detail</h1>

        <div className="p-4 bg-gray-800 rounded-lg mb-4">
          <div className="flex items-center mb-2">
            <img
              src={matchInfo.avatarUrl}
              alt={matchInfo.userName}
              className="w-16 h-16 rounded-full object-cover mr-3"
            />
            <div>
              <h2 className="text-lg font-semibold">{matchInfo.userName}</h2>
              <p className="text-gray-400 text-sm">
                {matchInfo.compatibility}% Compatibility
              </p>
            </div>
          </div>
          <p className="text-gray-300">{matchInfo.bio || 'No bio provided'}</p>

          <div className="flex space-x-2 mt-3">
            <button className="btn btn-icon bg-pink-600" onClick={handleReportUser}>
              <Heart size={20} className="text-white" />
            </button>
            <button className="btn btn-icon bg-gray-700" onClick={handleMessage}>
              <MessageSquare size={20} className="text-blue-400" />
            </button>
          </div>
        </div>
      </main>

      <ErrorBoundary>
        <Navigation
          activeTab="matches"
          onTabChange={(tab) => navigate(`/${tab}`)}
        />
      </ErrorBoundary>

      {stealthMode && (
        <div className="stealth-mode-indicator">
          <div className="stealth-mode-header">
            <span className="stealth-mode-icon">🛡️</span>
            <span className="stealth-mode-text">Stealth Mode Active</span>
          </div>
          <p className="stealth-mode-description">
            You're hidden from new matches
          </p>
        </div>
      )}
    </div>
  );
}

export default MatchDetail;
