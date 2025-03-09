// src/components/matches/MatchList.jsx
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import MatchCard from './MatchCard';
import useMatches from '../../hooks/useMatches';

const MatchList = ({ onSelectMatch }) => {
  const { matches, loading, error } = useMatches();
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Memoized filtered matches based on search query
  const filteredMatches = useMemo(() => {
    if (!matches || searchQuery.trim() === '') return matches;
    return matches.filter((match) => {
      // Determine the other user for display (assuming match.userA or match.userB)
      const otherUser = match.userA || match.userB;
      if (!otherUser?.firstName) return false;
      return otherUser.firstName.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [matches, searchQuery]);

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
            placeholder="Search matches..."
            aria-label="Search matches"
            className="w-full bg-bg-input rounded-full py-2 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-brand-pink"
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
        {loading && <div className="p-4 text-center">Loading matches...</div>}
        {error && <div className="p-4 text-center text-error">Error: {error}</div>}

        {!loading && !error && (!filteredMatches || filteredMatches.length === 0) && (
          <div className="p-4 text-center text-text-secondary">
            No matches found. Start discovering!
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
  onSelectMatch: PropTypes.func,
};

export default React.memo(MatchList);
