// src/components/stories/StoriesViewer.jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Spinner from '../ui/Spinner';

const StoriesViewer = ({ userId, onClose }) => {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Simulated story duration in milliseconds
  const storyDuration = 5000;

  // Load stories for the user
  useEffect(() => {
    const fetchStories = async () => {
      try {
        setLoading(true);
        // In a real app, you'd call your API here
        // const response = await fetch(`/api/stories/${userId}`);
        // const data = await response.json();

        // Simulate API response with mock data
        const mockStories = [
          {
            id: '1',
            type: 'text',
            content: 'Just having a great day! ☀️',
            backgroundColor: '#FF5588',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
          },
          {
            id: '2',
            type: 'photo',
            content: '/images/default-avatar.png', // This would be a real image URL
            backgroundColor: '#000000',
            createdAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
          }
        ];

        setStories(mockStories);
      } catch (err) {
        console.error('Error fetching stories:', err);
        setError('Failed to load stories');
      } finally {
        setLoading(false);
      }
    };

    fetchStories();
  }, [userId]);

  // Progress timer
  useEffect(() => {
    if (loading || stories.length === 0 || isPaused) return;

    let interval;
    let timeout;

    // Reset progress when changing stories
    setProgress(0);

    interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + (100 / storyDuration) * 100;
      });
    }, 100);

    // Move to next story when progress completes
    timeout = setTimeout(() => {
      goToNextStory();
    }, storyDuration);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [currentIndex, loading, stories.length, isPaused]);

  const goToNextStory = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onClose();
    }
  };

  const goToPrevStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || stories.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
        <div className="text-center p-6">
          <p className="text-white text-lg mb-4">{error || 'No stories available'}</p>
          <button
            className="px-4 py-2 bg-brand-pink text-white rounded-md"
            onClick={handleClose}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const currentStory = stories[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
      onMouseDown={() => setIsPaused(true)}
      onMouseUp={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* Close button */}
      <button
        className="absolute top-4 right-4 h-8 w-8 rounded-full bg-black bg-opacity-50 flex items-center justify-center text-white"
        onClick={handleClose}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Progress indicators */}
      <div className="absolute top-4 left-4 right-16 flex space-x-1">
        {stories.map((_, index) => (
          <div key={index} className="flex-1 h-1 bg-gray-600 rounded-full overflow-hidden">
            {index === currentIndex ? (
              <div
                className="h-full bg-white"
                style={{ width: `${progress}%` }}
              ></div>
            ) : index < currentIndex ? (
              <div className="h-full bg-white w-full"></div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Navigation areas */}
      <div className="absolute inset-0 flex items-stretch">
        <div className="w-1/3 cursor-pointer" onClick={goToPrevStory}></div>
        <div className="w-1/3 cursor-pointer"></div>
        <div className="w-1/3 cursor-pointer" onClick={goToNextStory}></div>
      </div>

      {/* Story content */}
      <div
        className="max-w-lg w-full h-[70vh] rounded-2xl overflow-hidden relative"
        style={{ backgroundColor: currentStory.backgroundColor || '#000000' }}
      >
        {currentStory.type === 'photo' ? (
          <img
            src={currentStory.content}
            alt="Story"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex items-center justify-center h-full p-6">
            <p className="text-white text-xl font-medium text-center">{currentStory.content}</p>
          </div>
        )}

        {/* Timestamp */}
        <div className="absolute bottom-4 left-4 text-white text-sm opacity-70">
          {new Date(currentStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

StoriesViewer.propTypes = {
  userId: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired
};

export default StoriesViewer;
