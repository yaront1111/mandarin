// src/pages/Profiles/PrivatePhotos.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Components
import ErrorBoundary from '../../components/common/ErrorBoundary';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Header from '../../components/layout/Header';
import Navigation from '../../components/layout/Navigation';

// Services
import { userService } from '../../services/userService';
// If you separate out privatePhoto logic into a separate service, import it here

// Context
import { AppContext } from '../../context/AppContext';

// Config
import { MAX_PHOTO_UPLOAD_SIZE } from '../../config/constants';

function PrivatePhotosPage() {
  const navigate = useNavigate();
  const { stealthMode } = React.useContext(AppContext);

  // State
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef(null);

  // Suppose we get the userId from AuthContext or similar
  const userId = 'currentUserId'; // Replace with real ID from context

  useEffect(() => {
    async function fetchPrivatePhotos() {
      try {
        setLoading(true);
        const data = await userService.getPrivatePhotos(userId);
        setPhotos(data);
      } catch (err) {
        console.error('Error loading private photos:', err);
        setError('Failed to load private photos.');
      } finally {
        setLoading(false);
      }
    }

    fetchPrivatePhotos();
  }, [userId]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_PHOTO_UPLOAD_SIZE) {
      alert(`File exceeds the ${MAX_PHOTO_UPLOAD_SIZE / (1024 * 1024)}MB limit.`);
      return;
    }

    setUploading(true);
    try {
      // userService.uploadPrivatePhoto or similar method
      await userService.uploadPrivatePhoto(userId, file);
      // Reload the photos after upload
      const data = await userService.getPrivatePhotos(userId);
      setPhotos(data);
    } catch (err) {
      console.error('Error uploading photo:', err);
      alert('Failed to upload. Please try again.');
    } finally {
      setUploading(false);
      // Reset the file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async (photoId) => {
    if (!window.confirm('Are you sure you want to remove this photo?')) return;
    try {
      // userService.removePrivatePhoto(photoId)
      await userService.removePrivatePhoto(photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      console.error('Error removing photo:', err);
    }
  };

  // Possibly handle incoming requests: userService.getPrivateAccessRequests(userId)
  // Then you can map over requests and show them with "Grant / Deny"

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
            activeTab="profile"
            onTabChange={(tab) => navigate(`/${tab}`)}
          />
        </ErrorBoundary>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <Header />
        <div className="main p-4 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
        <Navigation
          activeTab="profile"
          onTabChange={(tab) => navigate(`/${tab}`)}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      <ErrorBoundary>
        <Header />
      </ErrorBoundary>

      <main className="main">
        <h1 className="text-xl font-bold mb-4">Manage Private Photos</h1>
        <div className="mb-4">
          <button
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload Photo'}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
        </div>

        {photos.length === 0 ? (
          <p className="text-gray-400">You have no private photos.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="relative">
                <img
                  src={photo.url}
                  alt="Private"
                  className="w-full h-32 object-cover rounded-lg"
                />
                <button
                  className="btn btn-icon absolute top-2 right-2"
                  onClick={() => handleRemovePhoto(photo.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Example: Show Access Requests (if you want to manage them here) */}
        {/* <PrivateAccessRequests /> */}
      </main>

      <ErrorBoundary>
        <Navigation
          activeTab="profile"
          onTabChange={(tab) => navigate(`/${tab}`)}
        />
      </ErrorBoundary>

      {stealthMode && (
        <div className="stealth-mode-indicator">
          <div className="stealth-mode-header">
            <span className="stealth-mode-icon">🛡️</span>
            <span className="stealth-mode-text">Stealth Mode Active</span>
          </div>
          <p className="stealth-mode-description">
            Your profile (including private photos) is hidden from other users
          </p>
        </div>
      )}
    </div>
  );
}

export default PrivatePhotosPage;
