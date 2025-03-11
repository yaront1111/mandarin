// src/components/stories/StoriesViewer.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import Spinner from '../ui/Spinner';
import { getStoriesByUser, viewStory } from '../../services/storyService';
import { formatDistanceToNow } from '../../utils/dateFormatter';

const StoriesViewer = ({ userId, onClose }) => {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStart, setTouchStart] = useState(null);

  // Refs for animation control
  const progressIntervalRef = useRef(null);
  const progressTimeoutRef = useRef(null);

  // Story duration in milliseconds (configurable)
  const storyDuration = 5000;

  // Function to move to next story
  const goToNextStory = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, onClose]);

  // Function to move to previous story
  const goToPrevStory = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  // Load stories for the user
  useEffect(() => {
    let isMounted = true;

    const fetchStories = async () => {
      try {
        setLoading(true);
        setError(null);

        const fetchedStories = await getStoriesByUser(userId);

        if (isMounted) {
          if (fetchedStories && fetchedStories.length > 0) {
            setStories(fetchedStories);

            // Mark first story as viewed
            if (fetchedStories[0]?.id) {
              viewStory(fetchedStories[0].id).catch(err => {
                console.error('Error marking story as viewed:', err);
              });
            }
          } else {
            setError('No stories available');
          }
        }
      } catch (err) {
        console.error('Error fetching stories:', err);
        if (isMounted) {
          setError('Failed to load stories. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchStories();

    return () => {
      isMounted = false;
      // Clean up timers
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
    };
  }, [userId]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        goToPrevStory();
      } else if (e.key === 'ArrowRight') {
        goToNextStory();
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ') { // Spacebar
        setIsPaused(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, goToNextStory, goToPrevStory]);

  // Progress timer
  useEffect(() => {
    if (loading || stories.length === 0 || isPaused) return;

    // Clear any existing timers
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    if (progressTimeoutRef.current) {
      clearTimeout(progressTimeoutRef.current);
    }

    // Reset progress when changing stories
    setProgress(0);

    // Start progress animation
    progressIntervalRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressIntervalRef.current);
          return 100;
        }
        return prev + (100 / storyDuration) * 100;
      });
    }, 100);

    // Move to next story when progress completes
    progressTimeoutRef.current = setTimeout(() => {
      goToNextStory();
    }, storyDuration);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
    };
  }, [currentIndex, loading, stories.length, isPaused, storyDuration, goToNextStory]);

  // Mark story as viewed when changing to a new story
  useEffect(() => {
    if (stories.length > 0 && !loading && currentIndex < stories.length) {
      const currentStory = stories[currentIndex];
      if (currentStory?.id) {
        viewStory(currentStory.id).catch(err => {
          console.error('Error marking story as viewed:', err);
        });
      }
    }
  }, [currentIndex, stories, loading]);

  // Handle touch events for mobile swipe
  const handleTouchStart = (e) => {
    setIsPaused(true);
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    if (!touchStart) return;
  };

  const handleTouchEnd = (e) => {
    setIsPaused(false);
    if (!touchStart) return;

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    // Swipe threshold - adjust as needed
    if (diff > 50) {
      // Swiped left
      goToNextStory();
    } else if (diff < -50) {
      // Swiped right
      goToPrevStory();
    }

    setTouchStart(null);
  };

  // Format creation date
  const formatCreatedAt = (dateString) => {
    if (!dateString) return '';
    try {
      return formatDistanceToNow(new Date(dateString));
    } catch (e) {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
        <Spinner size="lg" color="brand-pink" />
      </div>
    );
  }

  if (error || stories.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
        <div className="text-center p-6 bg-bg-card rounded-lg max-w-sm">
          <svg className="w-12 h-12 text-text-secondary mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-text-primary text-lg mb-4">{error || 'No stories available'}</p>
          <button
            className="px-4 py-2 bg-brand-pink text-white rounded-md hover:bg-opacity-90"
            onClick={onClose}
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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={() => setIsPaused(prev => !prev)}
    >
      {/* Close button */}
      <button
        className="absolute top-4 right-4 h-8 w-8 rounded-full bg-black bg-opacity-50 flex items-center justify-center text-white"
        onClick={(e) => {
          e.stopPropagation(); // Prevent toggling pause
          onClose();
        }}
        aria-label="Close stories"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* User info */}
      <div className="absolute top-4 left-4 right-16 flex items-center">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-brand-pink mr-2">
          <img
            src={currentStory.user?.avatar || '/images/default-avatar.png'}
            alt={currentStory.user?.firstName || 'User'}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/images/default-avatar.png';
            }}
          />
        </div>
        <div>
          <p className="text-white text-sm font-medium">
            {currentStory.user?.firstName || 'User'}
          </p>
          <p className="text-white text-xs opacity-70">
            {formatCreatedAt(currentStory.createdAt)}
          </p>
        </div>
      </div>

      {/* Progress indicators */}
      <div className="absolute top-16 left-4 right-4 flex space-x-1">
        {stories.map((_, index) => (
          <div key={index} className="flex-1 h-1 bg-gray-600 rounded-full overflow-hidden">
            {index === currentIndex ? (
              <div
                className="h-full bg-white"
                style={{ width: `${progress}%`, transition: isPaused ? 'none' : 'width 0.1s linear' }}
              ></div>
            ) : index < currentIndex ? (
              <div className="h-full bg-white w-full"></div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Navigation areas */}
      <div className="absolute inset-0 flex items-stretch" onClick={(e) => e.stopPropagation()}>
        <div
          className="w-1/3 cursor-pointer"
          onClick={goToPrevStory}
          aria-label="Previous story"
        ></div>
        <div className="w-1/3"></div>
        <div
          className="w-1/3 cursor-pointer"
          onClick={goToNextStory}
          aria-label="Next story"
        ></div>
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
            onError={(e) => {
              e.target.onerror = null;
              console.error('Failed to load story image');
              // Show error indicator
              e.target.parentNode.classList.add('bg-error', 'bg-opacity-20');
              e.target.replaceWith(document.createTextNode('Failed to load image'));
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full p-6">
            <p className="text-white text-xl font-medium text-center whitespace-pre-wrap">
              {currentStory.content}
            </p>
          </div>
        )}

        {/* Paused indicator */}
        {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
            <div className="w-16 h-16 rounded-full bg-black bg-opacity-50 flex items-center justify-center">
              <svg width="32" height="32" fill="white" viewBox="0 0 24 24">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

StoriesViewer.propTypes = {
  userId: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired
};

export default StoriesViewer;
