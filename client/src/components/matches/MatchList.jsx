import React from 'react';
import MatchCard from './MatchCard';

export default function MatchList({ matches = [] }) {
  if (matches.length === 0) {
    return <p>No matches found.</p>;
  }

  return (
    <div>
      {matches.map((m) => (
        <MatchCard key={m.id} match={m} />
      ))}
    </div>
  );
}
