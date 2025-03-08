// src/pages/Stories/StoriesPage.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Heart, MessageSquare, Send, Plus } from 'lucide-react';

// Components
import ErrorBoundary from '../../components/common/ErrorBoundary';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Header from '../../components/layout/Header';
import Navigation from '../../components/layout/Navigation';
import StoriesSection from '../../components/stories/StoriesSection';

// Services
import { storyService } from '../../services/storyService';

// Context
import { AppContext } from '../../context/AppContext';

// Config
import { MAX_STORY_VIDEO_LENGTH } from '../../config/constants';

function StoriesPage() {
  const navigate = useNavigate();
  const { stealthMode } = React.useContext(AppContext);

  // State
  const [stories, setStories] = useState([]); // Array of { id, userName, avatarUrl, stories: [{url, ...}], ... }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewingStory, setViewingStory] = useState(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch stories
  useEffect(() => {
    async function fetchAllStories() {
      try {
        setLoading(true);
        const data = await storyService.fetchStories();
        setStories(data);
      } catch (err) {
        console.error('Error loading stories:', err);
        setError('Failed to load stories. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchAllStories();
  }, []);

  // Auto advance story after 5 seconds
  useEffect(() => {
    if (!viewingStory) return;
    const timer = setTimeout(() => {
      handleNextStory();
    }, 5000);
    return () => clearTimeout(timer);
  }, [viewingStory, storyIndex]);

  // Handlers
  const handleViewStory = (storyData) => {
    setViewingStory(storyData);
    setStoryIndex(0);
  };

  const handleCloseStory = () => {
    setViewingStory(null);
    setStoryIndex(0);
    setReplyText('');
  };

  const handlePrevStory = () => {
    if (!viewingStory) return;
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
    } else {
      // Move to previous user's last story
      const i = stories.findIndex((s) => s.id === viewingStory.id);
      if (i > 0) {
        const prevUser = stories[i - 1];
        setViewingStory(prevUser);
        setStoryIndex(prevUser.stories.length - 1);
      } else {
        // No previous story, close
        handleCloseStory();
      }
    }
  };

  const handleNextStory = () => {
    if (!viewingStory) return;
    const currentStories = viewingStory.stories;
    if (storyIndex < currentStories.length - 1) {
      setStoryIndex(storyIndex + 1);
    } else {
      // Move to next user's first story
      const i = stories.findIndex((s) => s.id === viewingStory.id);
      if (i < stories.length - 1) {
        setViewingStory(stories[i + 1]);
        setStoryIndex(0);
      } else {
        // End of all stories
        handleCloseStory();
      }
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !viewingStory) return;
    try {
      // For example: reply to the user's story with text
      await storyService.replyToStory(viewingStory.id, {
        text: replyText,
        storyIndex,
      });
      setReplyText('');
      // Optionally show confirmation
    } catch (err) {
      console.error('Error sending reply:', err);
    }
  };

  const handleUploadStory = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check if it's an image or video
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      alert('Please select an image or video file');
      return;
    }

    // If it's a video, validate duration
    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = async () => {
        window.URL.revokeObjectURL(video.src);
        if (video.duration > MAX_STORY_VIDEO_LENGTH) {
          alert(`Video must be ${MAX_STORY_VIDEO_LENGTH} seconds or less`);
          return;
        }
        await uploadFile(file);
      };
      video.src = URL.createObjectURL(file);
    } else {
      // If it's an image
      await uploadFile(file);
    }
  };

  const uploadFile = async (file) => {
    try {
      setUploading(true);
      await storyService.uploadStory(file);
      // Refresh stories
      const data = await storyService.fetchStories();
      setStories(data);
    } catch (err) {
      console.error('Error uploading story:', err);
      alert('Failed to upload story. Please try again.');
    } finally {
      setUploading(false);
    }
  };

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
            activeTab="stories"
            onTabChange={(tab) => navigate(`/${tab}`)}
          />
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className="app-container">
      <ErrorBoundary>
        <Header />
      </ErrorBoundary>

      <main className="main">
        <h1 className="text-xl font-bold mb-4 p-4">Stories</h1>

        {error ? (
          <div className="p-4 text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Try Again
            </button>
          </div>
        ) : (
          <ErrorBoundary>
            <div className="mb-6 px-4">
              {/* Add Story Button */}
              <button
                className="btn btn-primary w-full flex items-center justify-center"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <LoadingSpinner size={20} color="#FFFFFF" />
                ) : (
                  <>
                    <Plus size={20} className="mr-2" />
                    Add Your Story
                  </>
                )}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUploadStory}
                accept="image/*,video/*"
                className="hidden"
              />
            </div>

            {/* Stories List */}
            <StoriesSection
              stories={stories}
              onClickStory={handleViewStory}
            />
          </ErrorBoundary>
        )}
      </main>

      <ErrorBoundary>
        <Navigation
          activeTab="stories"
          onTabChange={(tab) => navigate(`/${tab}`)}
        />
      </ErrorBoundary>

      {/* Story Viewer Modal */}
      {viewingStory && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
          {/* Story Header */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center">
              <img
                src={viewingStory.avatarUrl}
                alt={viewingStory.userName}
                className="w-8 h-8 rounded-full mr-2"
              />
              <div>
                <p className="font-medium">{viewingStory.userName}</p>
                <p className="text-xs text-gray-400">Posted 2h ago</p>
              </div>
            </div>
            <button className="btn-icon" onClick={handleCloseStory}>
              <X size={24} className="text-white" />
            </button>
          </div>

          {/* Progress Bars */}
          <div className="flex space-x-1 px-4">
            {viewingStory.stories.map((_, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full overflow-hidden bg-gray-600"
              >
                <div
                  className={`h-full bg-white ${
                    i === storyIndex 
                      ? 'animate-pulse' 
                      : i < storyIndex 
                        ? 'w-full' 
                        : 'w-0'
                  }`}
                ></div>
              </div>
            ))}
          </div>

          {/* Story Content */}
          <div className="flex-1 relative">
            {/* Navigation Buttons */}
            <button
              className="absolute left-0 top-1/2 -translate-y-1/2 p-4 z-10"
              onClick={handlePrevStory}
              aria-label="Previous Story"
            >
              <ChevronLeft size={36} className="text-white/50" />
            </button>

            <button
              className="absolute right-0 top-1/2 -translate-y-1/2 p-4 z-10"
              onClick={handleNextStory}
              aria-label="Next Story"
            >
              <ChevronRight size={36} className="text-white/50" />
            </button>

            {/* Content */}
            <div className="h-full flex items-center justify-center">
              <img
                src={viewingStory.stories[storyIndex]?.url}
                alt="Story"
                className="max-h-full max-w-full"
              />
            </div>
          </div>

          {/* Story Actions */}
          <div className="p-4">
            <div className="flex space-x-4 mb-4">
              <button className="btn-icon bg-transparent" aria-label="Like Story">
                <Heart size={24} className="text-white" />
              </button>
              <button className="btn-icon bg-transparent" aria-label="React with Message">
                <MessageSquare size={24} className="text-white" />
              </button>
            </div>

            {/* Reply Input */}
            <div className="flex">
              <input
                type="text"
                className="flex-1 bg-gray-800 border-0 rounded-l-lg px-4 py-2 focus:outline-none focus:ring-1 focus:ring-pink-500 text-white"
                placeholder="Reply to story..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
              <button
                className="bg-pink-600 rounded-r-lg px-4 flex items-center"
                onClick={handleSendReply}
                disabled={!replyText.trim()}
                aria-label="Send Reply"
              >
                <Send size={20} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stealth Mode Overlay */}
      {stealthMode && (
        <div className="stealth-mode-indicator">
          <div className="stealth-mode-header">
            <span className="stealth-mode-icon">🛡️</span>
            <span className="stealth-mode-text">Stealth Mode Active</span>
          </div>
          <p className="stealth-mode-description">Your stories are hidden from other users</p>
        </div>
      )}
    </div>
  );
}

export default StoriesPage;
