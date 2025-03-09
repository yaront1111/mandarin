import React, { useEffect, useState } from 'react';
import profileService from '../../services/profileService';
import ProfileView from '../../components/profile/ProfileView';
import { useParams } from 'react-router-dom';

export default function UserProfilePage() {
  const { id: userId } = useParams();
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (userId) {
      profileService.getUserProfile(userId)
        .then((data) => setUser(data.user))
        .catch((err) => setError(err.message));
    }
  }, [userId]);

  if (error) return <p>Error: {error}</p>;
  if (!user) return <p>Loading user profile...</p>;

  return (
    <div>
      <h1>User Profile</h1>
      <ProfileView user={user} />
    </div>
  );
}
