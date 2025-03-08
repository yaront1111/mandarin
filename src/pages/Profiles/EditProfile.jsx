// src/pages/Profiles/EditProfile.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../../services/userService';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Header from '../../components/layout/Header';
import Navigation from '../../components/layout/Navigation';
import { AppContext } from '../../context/AppContext';

function EditProfilePage() {
  const navigate = useNavigate();
  const { stealthMode } = React.useContext(AppContext);

  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Suppose userId is known from AuthContext or a param
  const userId = 'currentUserId'; // or from context

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        const data = await userService.getProfile(userId);
        setProfileData(data);
      } catch (err) {
        console.error('Error loading profile for edit:', err);
        setError('Cannot load profile data.');
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [userId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!profileData) return;

    try {
      setSaving(true);
      await userService.updateProfile(userId, profileData);
      navigate(`/profiles/${userId}`);
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('Failed to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="app-container">
        <Header />
        <div className="main flex justify-center items-center">
          <LoadingSpinner size={40} color="var(--color-primary)" />
        </div>
        <Navigation activeTab="profile" onTabChange={(tab) => navigate(`/${tab}`)} />
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="app-container">
        <Header />
        <div className="main p-4">
          <p className="text-red-500 mb-4 text-center">{error || 'No data'}</p>
          <button className="btn btn-primary mx-auto block" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
        <Navigation activeTab="profile" onTabChange={(tab) => navigate(`/${tab}`)} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header />
      <main className="main">
        <h1 className="text-xl font-bold mb-4">Edit Profile</h1>

        <form onSubmit={handleSubmit} className="max-w-md bg-gray-800 p-4 rounded-md">
          <div className="mb-3">
            <label className="block text-sm text-gray-400 mb-1" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              name="name"
              className="w-full bg-gray-700 rounded-md border-0 p-2
                         focus:outline-none focus:ring-1 focus:ring-pink-500"
              value={profileData.name || ''}
              onChange={handleChange}
              required
            />
          </div>
          {/* Additional fields: bio, age, relationshipGoals, etc. */}
          <div className="mb-3">
            <label className="block text-sm text-gray-400 mb-1" htmlFor="bio">
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              rows="3"
              className="w-full bg-gray-700 rounded-md border-0 p-2
                         focus:outline-none focus:ring-1 focus:ring-pink-500"
              value={profileData.bio || ''}
              onChange={handleChange}
            />
          </div>
          {error && <p className="text-red-500 mb-2">{error}</p>}
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={saving}
          >
            {saving ? <LoadingSpinner size={20} color="#FFFFFF" /> : 'Save Changes'}
          </button>
        </form>
      </main>
      <Navigation activeTab="profile" onTabChange={(tab) => navigate(`/${tab}`)} />

      {stealthMode && (
        <div className="stealth-mode-indicator">
          <div className="stealth-mode-header">
            <span className="stealth-mode-icon">🛡️</span>
            <span className="stealth-mode-text">Stealth Mode Active</span>
          </div>
          <p className="stealth-mode-description">
            Profile edits are still saved, but others can’t see your profile yet
          </p>
        </div>
      )}
    </div>
  );
}

export default EditProfilePage;
