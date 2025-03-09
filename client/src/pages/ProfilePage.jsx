// src/pages/ProfilePage.jsx
import React, { useState } from 'react';
import MainLayout from '../components/layouts/MainLayout';
import useProfile from '../hooks/useProfile';
import ProfileView from '../components/profile/ProfileView';
import ProfileEdit from '../components/profile/ProfileEdit';

export default function ProfilePage() {
  const { profile, loading, error, saveProfile } = useProfile();
  const [editing, setEditing] = useState(false);

  const handleSave = (data) => {
    saveProfile(data);
    setEditing(false);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="w-12 h-12 rounded-full border-4 border-brand-pink border-t-transparent animate-spin"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="bg-error bg-opacity-10 text-error p-4 rounded-lg">
            <p>Error: {error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 bg-error text-white rounded-md hover:bg-opacity-90"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    if (!profile) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-text-secondary mb-4">No profile data available.</p>
            <button 
              onClick={() => setEditing(true)}
              className="px-6 py-2 bg-brand-pink text-white rounded-md hover:bg-opacity-90"
            >
              Create Profile
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto w-full p-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-text-primary">My Profile</h1>
          <button 
            onClick={() => setEditing(!editing)}
            className={`px-6 py-2 rounded-md ${
              editing 
                ? 'bg-transparent border border-brand-pink text-brand-pink hover:bg-brand-pink hover:bg-opacity-10' 
                : 'bg-brand-pink text-white hover:bg-opacity-90'
            } transition-colors`}
          >
            {editing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>
        
        <div className="bg-bg-card rounded-xl overflow-hidden shadow-lg">
          {editing ? (
            <div className="p-6">
              <ProfileEdit 
                profile={profile} 
                onSave={handleSave} 
                onCancel={() => setEditing(false)}
              />
            </div>
          ) : (
            <ProfileView profile={profile} isCurrentUser={true} />
          )}
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      {renderContent()}
    </MainLayout>
  );
}
