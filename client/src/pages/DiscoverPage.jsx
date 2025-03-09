// src/pages/DiscoverPage.jsx
import React, { useState } from 'react';
import MainLayout from '../components/layouts/MainLayout';
import CompatibilityMeter from '../components/ui/CompatibilityMeter';

export default function DiscoverPage() {
  // Mock profile data; replace with API data in production.
  const [currentProfile, setCurrentProfile] = useState({
    id: '1',
    firstName: 'Sophia',
    age: 28,
    occupation: 'Fashion Designer',
    distance: '5km away',
    bio: 'Creative spirit with a passion for art and spontaneous adventures. Looking for someone who appreciates deep conversations and new experiences.',
    interests: ['Photography', 'Art', 'Travel', 'Music'],
    compatibilityScore: 87,
    photos: ['/images/default-avatar.png']
  });

  const handleLike = () => {
    console.log('Liked profile');
    // TODO: Integrate API call to record the like and fetch next profile.
  };

  const handlePass = () => {
    console.log('Passed profile');
    // TODO: Integrate API call to record the pass and fetch next profile.
  };

  const handleChat = () => {
    console.log('Open chat');
    // TODO: Navigate to the chat page or open a chat modal.
  };

  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center p-6 min-h-screen bg-bg-dark">
        <h1 className="text-3xl font-bold mb-8 text-text-primary">Discover</h1>

        {/* Discovery Card */}
        <div className="mandarin-card max-w-md w-full rounded-2xl overflow-hidden shadow-lg bg-bg-card">
          {/* Profile Image */}
          <div className="h-96 relative">
            <img
              src={currentProfile.photos[0]}
              alt={`${currentProfile.firstName}'s profile`}
              className="w-full h-full object-cover"
            />
            {/* Gradient Overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-bg-dark to-transparent"></div>
          </div>

          {/* Profile Info */}
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-text-primary">
                  {currentProfile.firstName}, {currentProfile.age}
                </h2>
                <p className="text-text-secondary">
                  {currentProfile.occupation} • {currentProfile.distance}
                </p>
              </div>
              <CompatibilityMeter score={currentProfile.compatibilityScore} />
            </div>

            {/* Interests/Tags */}
            <div className="flex flex-wrap gap-2 mb-4">
              {currentProfile.interests.map((interest, index) => (
                <span key={index} className="px-3 py-1 bg-bg-input rounded-full text-sm text-text-primary">
                  {interest}
                </span>
              ))}
            </div>

            <p className="text-text-primary mb-6">{currentProfile.bio}</p>

            {/* Action Buttons */}
            <div className="flex justify-center gap-4">
              <button
                onClick={handlePass}
                className="w-14 h-14 rounded-full bg-bg-input flex items-center justify-center hover:bg-opacity-80 transition-colors"
                aria-label="Pass"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              <button
                onClick={handleLike}
                className="w-16 h-16 rounded-full bg-brand-pink flex items-center justify-center hover:bg-opacity-90 transition-colors"
                aria-label="Like"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.5 12.5719L12 19.9999L4.5 12.5719C2.5 10.5719 2.5 7.07192 4.5 5.07192C6.5 3.07192 10 3.07192 12 5.07192C14 3.07192 17.5 3.07192 19.5 5.07192C21.5 7.07192 21.5 10.5719 19.5 12.5719Z" fill="white"/>
                </svg>
              </button>

              <button
                onClick={handleChat}
                className="w-14 h-14 rounded-full bg-brand-purple flex items-center justify-center hover:bg-opacity-80 transition-colors"
                aria-label="Chat"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
