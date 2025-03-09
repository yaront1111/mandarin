import React, { useState } from 'react';
import useProfile from '../hooks/useProfile';
import ProfileView from '../components/profile/ProfileView';
import ProfileEdit from '../components/profile/ProfileEdit';

export default function ProfilePage() {
  const { profile, loading, error, saveProfile } = useProfile();
  const [editing, setEditing] = useState(false);

  if (loading) return <p>Loading profile...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!profile) return <p>No profile data.</p>;

  const handleSave = (data) => {
    saveProfile(data);
    setEditing(false);
  };

  return (
    <div>
      <h1>My Profile</h1>
      {editing ? (
        <ProfileEdit profile={profile} onSave={handleSave} />
      ) : (
        <ProfileView user={profile} />
      )}
      <button onClick={() => setEditing(!editing)}>
        {editing ? 'Cancel' : 'Edit Profile'}
      </button>
    </div>
  );
}
