// src/pages/Profiles/UserProfile.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Heart,
  MessageSquare,
  Shield,
  ArrowLeft,
  Lock
} from 'lucide-react';

// Components
import ErrorBoundary from '../../components/common/ErrorBoundary';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Header from '../../components/layout/Header';
import Navigation from '../../components/layout/Navigation';
import PrivatePhotoRequest from '../../components/privatePhotos/PrivatePhotoRequest';
import ReportModal from '../../components/moderation/ReportModal';
import IcebreakerModal from '../../components/icebreakers/IcebreakerModal';

// Services
import { userService } from '../../services/userService';
import { moderationService } from '../../services/moderationService';

// Context
import { AppContext } from '../../context/AppContext';

// Config
import {
  REPORT_REASONS,
  RELATIONSHIP_GOALS,
  RELATIONSHIP_STATUSES,
} from '../../config/constants';

function UserProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();

  // If you store stealthMode in AppContext
  const { stealthMode } = React.useContext(AppContext);

  // Local state
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [privateRequested, setPrivateRequested] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showIcebreaker, setShowIcebreaker] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        const data = await userService.getProfile(userId);
        setProfile(data);

        // Suppose your API returns a flag indicating if we already requested private photos
        setPrivateRequested(data.privatePhotoRequested || false);
      } catch (err) {
        console.error('Error loading profile:', err);
        setError('Failed to load profile. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [userId]);

  // Handlers
  const handlePrivateRequest = async () => {
    try {
      await userService.requestPrivatePhotos(userId);
      setPrivateRequested(true);
    } catch (err) {
      console.error('Error requesting private photos:', err);
      // Optionally show an error message
    }
  };

  const handleLike = async () => {
    try {
      await userService.likeUser(userId);
      // Maybe show a toast or update the UI
      console.log('Successfully liked user!');
    } catch (err) {
      console.error('Error liking profile:', err);
    }
  };

  const handleMessage = () => {
    // Navigate to a new chat with userId
    navigate(`/messages/new/${userId}`);
  };

  const handleReport = () => {
    setShowReport(true);
  };

  const handleSendIcebreaker = () => {
    setShowIcebreaker(true);
  };

  const handleSubmitReport = async (reportData) => {
    try {
      await moderationService.reportUser(userId, reportData);
      setShowReport(false);
      // Possibly show a success message
    } catch (err) {
      console.error('Error submitting report:', err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="app-container">
        <ErrorBoundary>
          <Header />
        </ErrorBoundary>
        <div className="main flex justify-center items-center">
          <LoadingSpinner size={40} color="var(--color-primary)" />
        </div>
        <ErrorBoundary>
          <Navigation
            activeTab="discover"
            onTabChange={(tab) => navigate(`/${tab}`)}
          />
        </ErrorBoundary>
      </div>
    );
  }

  // Error or no profile
  if (error || !profile) {
    return (
      <div className="app-container">
        <ErrorBoundary>
          <Header />
        </ErrorBoundary>
        <div className="main p-4">
          <div className="text-center">
            <p className="text-xl mb-4">{error || 'Profile not found'}</p>
            <button className="btn btn-primary" onClick={() => navigate(-1)}>
              Go Back
            </button>
          </div>
        </div>
        <ErrorBoundary>
          <Navigation
            activeTab="discover"
            onTabChange={(tab) => navigate(`/${tab}`)}
          />
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className="app-container">
      <ErrorBoundary>
        <Header
          // If your header needs stealthMode or notifications
        />
      </ErrorBoundary>

      <main className="main pb-16">
        {/* Back button */}
        <button
          className="btn-icon absolute top-4 left-4 z-10 bg-gray-800/70"
          onClick={() => navigate(-1)}
          aria-label="Go Back"
        >
          <ArrowLeft size={24} />
        </button>

        {/* Photos carousel */}
        <div className="relative h-96 bg-gray-800">
          {profile.photos && profile.photos.length > 0 ? (
            <img
              src={profile.photos[activePhotoIndex]}
              alt={profile.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
              <p className="text-gray-500">No photos available</p>
            </div>
          )}

          {/* Photo navigation dots */}
          {profile.photos && profile.photos.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-2">
              {profile.photos.map((_, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 rounded-full ${
                    index === activePhotoIndex ? 'bg-white' : 'bg-gray-400'
                  }`}
                  onClick={() => setActivePhotoIndex(index)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Profile info */}
        <div className="p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold">
                {profile.name}, {profile.age}
              </h1>
              <p className="text-gray-400">{profile.distance} miles away</p>
            </div>
            <div className="flex flex-col items-end">
              <div className="compatibility-value text-lg font-bold text-pink-500 mb-1">
                {profile.compatibility}% Match
              </div>
              <div className="text-sm text-gray-400">
                {profile.online ? 'Online Now' : 'Last active 2 hours ago'}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-between mb-6">
            <button
              className="btn-icon bg-gray-700"
              onClick={handleReport}
              aria-label="Report User"
            >
              <Shield size={24} className="text-gray-400" />
            </button>
            <button
              className="btn-icon bg-gray-700"
              onClick={handleSendIcebreaker}
              aria-label="Send Icebreaker"
            >
              <MessageSquare size={24} className="text-blue-400" />
            </button>
            <button
              className="btn-icon bg-pink-600"
              onClick={handleLike}
              aria-label="Like User"
            >
              <Heart size={24} className="text-white" />
            </button>
            <button
              className="btn-icon bg-gray-700"
              onClick={handleMessage}
              aria-label="Send Message"
            >
              <MessageSquare size={24} className="text-green-400" />
            </button>
          </div>

          {/* Bio */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">About Me</h2>
            <p className="text-gray-300">{profile.bio || 'No bio provided'}</p>
          </div>

          {/* Relationship info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-800 p-3 rounded-lg">
              <h3 className="text-sm text-gray-400 mb-1">Relationship Status</h3>
              <p className="font-medium">
                {RELATIONSHIP_STATUSES[profile.relationshipStatus] || 'Not specified'}
              </p>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg">
              <h3 className="text-sm text-gray-400 mb-1">Looking For</h3>
              <p className="font-medium">
                {RELATIONSHIP_GOALS[profile.lookingFor] || 'Not specified'}
              </p>
            </div>
          </div>

          {/* Interests (Kinks, Hobbies, etc.) */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Interests</h2>
            <div className="flex flex-wrap gap-2">
              {profile.interests?.length ? (
                profile.interests.map(interest => (
                  <span
                    key={interest}
                    className="px-3 py-1 bg-gray-800 rounded-full text-sm"
                  >
                    {interest}
                  </span>
                ))
              ) : (
                <p className="text-gray-400">No interests specified</p>
              )}
            </div>
          </div>

          {/* Private photos */}
          {profile.hasPrivatePhotos && (
            <div className="bg-gray-800 p-4 rounded-lg mb-6">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center">
                  <Lock size={18} className="text-pink-500 mr-2" />
                  <h2 className="text-lg font-semibold">Private Photos</h2>
                </div>
                <div className="text-sm text-gray-400">
                  {profile.privatePhotoCount} photos
                </div>
              </div>

              <PrivatePhotoRequest
                hasRequested={privateRequested}
                onRequestAccess={handlePrivateRequest}
                onCancelRequest={() => setPrivateRequested(false)}
              />
            </div>
          )}
        </div>
      </main>

      <ErrorBoundary>
        <Navigation
          activeTab="discover"
          onTabChange={(tab) => navigate(`/${tab}`)}
        />
      </ErrorBoundary>

      {/* Report Modal */}
      {showReport && (
        <ReportModal
          isOpen={showReport}
          onClose={() => setShowReport(false)}
          userName={profile.name}
          onSubmitReport={handleSubmitReport}
          reasons={Object.values(REPORT_REASONS)}
        />
      )}

      {/* Icebreaker Modal */}
      {showIcebreaker && (
        <IcebreakerModal
          isOpen={showIcebreaker}
          onClose={() => setShowIcebreaker(false)}
          onSendQuestion={(question) => {
            console.log(`Sending to ${profile.name}: ${question}`);
            // Possibly call a chat or messaging service
            setShowIcebreaker(false);
          }}
        />
      )}

      {/* Stealth Mode Overlay (if you use it here) */}
      {stealthMode && (
        <div className="stealth-mode-indicator">
          <div className="stealth-mode-header">
            <span className="stealth-mode-icon">🛡️</span>
            <span className="stealth-mode-text">Stealth Mode Active</span>
          </div>
          <p className="stealth-mode-description">Your profile is hidden from other users</p>
        </div>
      )}
    </div>
  );
}

export default UserProfilePage;
