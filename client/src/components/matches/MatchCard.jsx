import React from 'react';
import Avatar from '../ui/Avatar';

export default function MatchCard({ match }) {
  // Example: match might have userA, userB. Display the "other" user or match info
  const otherUser = match?.userA || match?.userB;

  if (!otherUser) {
    return <div>No user data</div>;
  }

  return (
    <div style={{ border: '1px solid #ddd', padding: '1rem', marginBottom: '1rem' }}>
      <Avatar src={otherUser.avatar} alt={otherUser.firstName} size={50} />
      <h4>{otherUser.firstName} {otherUser.lastName}</h4>
      <p>{otherUser.Profile?.bio}</p>
    </div>
  );
}
