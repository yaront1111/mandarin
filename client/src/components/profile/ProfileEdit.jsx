import React, { useState } from 'react';

export default function ProfileEdit({ profile, onSave }) {
  const [bio, setBio] = useState(profile?.bio || '');
  const [interests, setInterests] = useState(profile?.interests || []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSave) {
      onSave({ bio, interests });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>Bio</label>
      <textarea
        rows={4}
        style={{ width: '100%', marginBottom: '1rem' }}
        value={bio}
        onChange={(e) => setBio(e.target.value)}
      />
      <label>Interests (comma separated)</label>
      <input
        style={{ width: '100%', marginBottom: '1rem' }}
        value={interests.join(', ')}
        onChange={(e) =>
          setInterests(e.target.value.split(',').map((s) => s.trim()))
        }
      />
      <button type="submit">Save</button>
    </form>
  );
}
