import React from 'react';
import Avatar from '../ui/Avatar';
import InterestTags from './InterestTags';

export default function ProfileView({ user }) {
  if (!user) return <p>No user data</p>;

  return (
    <div style={{ border: '1px solid #ddd', padding: '1rem' }}>
      <Avatar src={user.avatar} alt={user.firstName} size={80} />
      <h2>{user.firstName} {user.lastName}</h2>
      <p>{user.Profile?.bio || 'No bio provided'}</p>
      <InterestTags interests={user.Profile?.interests || []} />
    </div>
  );
}
