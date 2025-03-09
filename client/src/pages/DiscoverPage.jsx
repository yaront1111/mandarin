// src/pages/DiscoverPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import MainLayout from '../components/layouts/MainLayout';
import CompatibilityMeter from '../components/ui/CompatibilityMeter';
import InterestTags from '../components/profile/InterestTags';
import { useNavigate } from 'react-router-dom';
import matchService from '../services/matchService';

export default function DiscoverPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [animateDirection, setAnimateDirection] = useState(null);
  const cardRef = useRef(null);

  // Load potential matches
  useEffect(() => {
    const loadProfiles = async () => {
      try {
        setLoading(true);
        // Try to fetch profiles, or use mock data if API not ready
        let potentialMatches = [];
        try {
          potentialMatches = await matchService.getPotentialMatches();
        } catch (error) {
          console.log('getPotentialMatches not implemented yet, using mock data');
          // Mock data if API call fails
          potentialMatches = [
            {
              id: '1',
              firstName: 'Sophia',
              age: 28,
              occupation: 'Fashion Designer',
              distance: '5km away',
              bio: 'Creative spirit with a passion for art and spontaneous adventures. Looking for someone who appreciates deep conversations and new experiences.',
              interests: ['Photography', 'Art', 'Travel', 'Music'],
              compatibilityScore: 87,
              photos: ['/images/default-avatar.png']
            }
          ];
        }
        setProfiles(potentialMatches);
      } catch (error) {
        console.error('Error loading potential matches:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfiles();
  }, []);

  const currentProfile = profiles[currentIndex];

  // Handle profile actions
  const handleLike = async () => {
    if (!currentProfile) return;

    setAnimateDirection('right');

    try {
      let result = null;
      try {
        result = await matchService.likeUser(currentProfile.id);
      } catch (error) {
        console.log('likeUser not implemented yet');
      }

      // If it's a match, show the match notification
      if (result && result.match) {
        // You can implement a match notification here
        console.log("It's a match!", result.match);
      }

      // Move to next profile after a delay
      setTimeout(() => {
        setAnimateDirection(null);
        goToNextProfile();
      }, 300);

    } catch (error) {
      console.error('Error liking profile:', error);
      setAnimateDirection(null);
    }
  };

  const handlePass = () => {
    if (!currentProfile) return;

    setAnimateDirection('left');

    // Move to next profile after a delay
    setTimeout(() => {
      setAnimateDirection(null);
      goToNextProfile();
    }, 300);
  };

  const handleChat = () => {
    if (!currentProfile) return;
    navigate(`/messages/${currentProfile.id}`);
  };

  // Manual swipe with keyboard
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      handlePass();
    } else if (e.key === 'ArrowRight') {
      handleLike();
    }
  };

  // Add/remove event listener for keyboard navigation
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  const goToNextProfile = () => {
    if (currentIndex < profiles.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentPhotoIndex(0); // Reset photo index for new profile
    } else {
      // No more profiles to show
      setProfiles([]); // Clear profiles to show empty state
    }
  };

  // Photo navigation
  const nextPhoto = (e) => {
    e.stopPropagation();
    if (!currentProfile?.photos) return;

    if (currentPhotoIndex < currentProfile.photos.length - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
    } else {
      setCurrentPhotoIndex(0);
    }
  };

  const prevPhoto = (e) => {
    e.stopPropagation();
    if (!currentProfile?.photos) return;

    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1);
    } else {
      setCurrentPhotoIndex(currentProfile.photos.length - 1);
    }
  };

  // Animation class based on swipe direction
  const getCardAnimationClass = () => {
    if (animateDirection === 'left') return 'animate-swipe-left';
    if (animateDirection === 'right') return 'animate-swipe-right';
    return '';
  };

  // Render loading state
  if (loading) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-screen p-6">
          <div className="w-16 h-16 border-t-4 border-brand-pink border-solid rounded-full animate-spin"></div>
          <p className="mt-4 text-text-secondary">Finding potential matches...</p>
        </div>
      </MainLayout>
    );
  }

  // Render empty state
  if (!currentProfile) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center p-6 min-h-screen">
          <div className="max-w-md w-full p-8 rounded-2xl bg-bg-card text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-bg-input flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.5 12.5719L12 19.9999L4.5 12.5719C2.5 10.5719 2.5 7.07192 4.5 5.07192C6.5 3.07192 10 3.07192 12 5.07192C14 3.07192 17.5 3.07192 19.5 5.07192C21.5 7.07192 21.5 10.5719 19.5 12.5719Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">No More Profiles</h2>
            <p className="text-text-secondary mb-6">
              We&apos;ve run out of potential matches based on your preferences. Check back later!
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-brand-pink text-white rounded-full hover:bg-opacity-90 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center p-6 min-h-screen bg-bg-dark">
        <h1 className="text-3xl font-bold mb-8 text-text-primary">Discover</h1>

        {/* Discovery Card */}
        <div
          className={`mandarin-card max-w-md w-full rounded-2xl overflow-hidden shadow-lg bg-bg-card ${getCardAnimationClass()}`}
          ref={cardRef}
          // Simple touch event handlers for mobile
          onTouchStart={(e) => {
            cardRef.current.touchStartX = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (!cardRef.current) return;

            const touchEndX = e.changedTouches[0].clientX;
            const diffX = touchEndX - cardRef.current.touchStartX;

            // Swipe threshold - adjust as needed
            if (diffX > 75) {
              handleLike();
            } else if (diffX < -75) {
              handlePass();
            }
          }}
        >
          {/* Profile Image with Navigation */}
          <div className="h-96 relative">
            {/* Photo Gallery */}
            <img
              src={currentProfile.photos?.[currentPhotoIndex] || '/images/default-avatar.png'}
              alt={`${currentProfile.firstName}'s profile`}
              className="w-full h-full object-cover"
            />

            {/* Photo Navigation Buttons (if multiple photos) */}
            {currentProfile.photos?.length > 1 && (
              <>
                <button
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 w-10 h-10 rounded-full bg-black bg-opacity-50 flex items-center justify-center text-white"
                  onClick={prevPhoto}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 w-10 h-10 rounded-full bg-black bg-opacity-50 flex items-center justify-center text-white"
                  onClick={nextPhoto}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {/* Photo indicators */}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1">
                  {currentProfile.photos.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full ${index === currentPhotoIndex ? 'bg-white' : 'bg-white bg-opacity-50'}`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Gradient Overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-bg-dark to-transparent"></div>

            {/* Looking For Indicator */}
            {currentProfile.lookingFor && (
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-brand-pink text-white text-sm font-medium">
                {currentProfile.lookingFor}
              </div>
            )}
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
            {currentProfile.interests && (
              <div className="mb-4">
                <InterestTags interests={currentProfile.interests} />
              </div>
            )}

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

        {/* Swipe instructions */}
        <div className="mt-6 text-text-secondary text-sm text-center">
          <p>Swipe right to like, left to pass, or use arrow keys ← →</p>
        </div>
      </div>
    </MainLayout>
  );
}
