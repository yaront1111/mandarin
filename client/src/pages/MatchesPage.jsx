import React from 'react';
import useMatches from '../hooks/useMatches';
import MatchList from '../components/matches/MatchList';

export default function MatchesPage() {
  const { matches, loading, error } = useMatches();

  if (loading) return <p>Loading matches...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <h1>Your Matches</h1>
      <MatchList matches={matches} />
    </div>
  );
}
