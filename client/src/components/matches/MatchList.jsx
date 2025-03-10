// src/components/matches/MatchList.jsx
import React, { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import MatchCard from './MatchCard';
import { useSelector } from 'react-redux';
import useMatches from '../../hooks/useMatches';

const MatchList = ({ onSelectMatch }) => {
  const { user } = useSelector(state => state.auth);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  // Mock matches data for testing when API is not available
  const [mockMatches, setMockMatches] = useState([]);

  useEffect(() => {
    if (mockMatches.length === 0) {
      // Generate some mock data
      const mockData = [
        {
          id: 'match-1',
          userA: {
            id: 'user-1',
            firstName: 'Sarah',
            avatar: '/images/default-avatar.png',
            isOnline: true
          },
          lastMessage: 'Hey there! How are you doing?',
          lastMessageAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          unreadCount: 2
        },
        {
          id: 'match-2',
          userB: {
            id: 'user-2',
            firstName: 'Michael',
            avatar: '/images/default-avatar.png',
            isOnline: false
          },
          lastMessage: "I'll be there in 10 minutes",
          lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          unreadCount: 0
        },
        {
          id: 'match-3',
          userA: {
            id: 'user-3',
            firstName: 'Jessica',
            avatar: '/images/default-avatar.png',
            isOnline: true
          },
          lastMessage: 'That sounds great! Looking forward to it',
          lastMessageAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          unreadCount: 0
        },
        {
          id: 'match-4',
          userB: {
            id: 'user-4',
            firstName: 'David',
            avatar: '/images/default-avatar.png',
            isOnline: false
          },
          lastMessage: 'Have you seen the new movie?',
          lastMessageAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          unreadCount: 0
        },
        {
          id: 'match-5',
          userA: {
            id: 'user-5',
            firstName: 'Emily',
            avatar: '/images/default-avatar.png',
            isOnline: false
          },
          lastMessage: "Can't wait to meet tomorrow!",
          lastMessageAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          unreadCount: 0
        }
      ];

      // Assign current user ID for proper display
      mockData.forEach(match => {
        match.currentUserId = 'current-user';
      });

      setMockMatches(mockData);
    }
  }, [mockMatches.length]);

  // Try to get matches from the hook
  const matchesData = useMatches();

  // Use real data if available, otherwise use mock data
  const matches = (matchesData.matches && matchesData.matches.length > 0)
    ? matchesData.matches
    : mockMatches;

  const loading = matchesData.loading || false;
  const error = matchesData.error || null;

  // Memoized filtered matches based on search query
  const filteredMatches = useMemo(() => {
    if (!matches || searchQuery.trim() === '') return matches;

    return matches.filter((match) => {
      // Determine the other user for display
      const otherUser = match.userA?.id !== user?.id ? match.userA : match.userB;
      if (!otherUser?.firstName) return false;

      return otherUser.firstName.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [matches, searchQuery, user?.id]);

  const handleSelectMatch = (matchId) => {
    setSelectedId(matchId);
    if (onSelectMatch && matches) {
      const selectedMatch = matches.find((m) => m.id === matchId);
      onSelectMatch(selectedMatch);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold mb-3">Your Matches</h2>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            aria-label="Search matches"
            className="w-full bg-bg-input rounded-full py-2 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-brand-pink text-text-primary"
          />
          <svg
            className="absolute right-3 top-2.5 h-4 w-4 text-text-secondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Match List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-4 text-center">
            <div className="w-8 h-8 mx-auto border-2 border-brand-pink border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-2 text-text-secondary text-sm">Loading conversations...</p>
          </div>
        )}

        {error && (
          <div className="p-4 text-center text-error">
            <p>Error loading conversations</p>
            <button
              className="mt-2 px-3 py-1 bg-brand-pink text-white rounded-md text-sm hover:bg-opacity-90"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (!filteredMatches || filteredMatches.length === 0) && (
          <div className="p-8 text-center text-text-secondary">
            <svg
              className="w-12 h-12 mx-auto mb-4 text-text-secondary opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <p>No conversations found.</p>
            <p className="mt-1 text-sm">Start matching with new people!</p>
          </div>
        )}

        {filteredMatches && filteredMatches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            isActive={selectedId === match.id}
            onClick={() => handleSelectMatch(match.id)}
          />
        ))}
      </div>
    </div>
  );
};

MatchList.propTypes = {
  onSelectMatch: PropTypes.func
};

export default React.memo(MatchList);
