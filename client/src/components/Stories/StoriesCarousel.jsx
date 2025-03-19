

import { useState, useEffect, useCallback, useRef } from "react"
import { useStories } from "../../context"
import StoryThumbnail from "./StoryThumbnail"
import "../../styles/stories.css"

// Simple throttle function to limit function calls
const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

const StoriesCarousel = ({ onStoryClick }) => {
  const storiesContext = useStories() || {}
  const { stories = [], loadStories, loading: contextLoading } = storiesContext
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [processedStories, setProcessedStories] = useState([])
  const [loadAttempted, setLoadAttempted] = useState(false)
  const loadingRef = useRef(false)

  // Process stories to remove duplicates and ensure proper data structure
  useEffect(() => {
    if (stories && stories.length > 0) {
      const uniqueStories = []
      const storyIds = new Set()
      const userIds = new Set()

      // First, collect unique stories by ID
      stories.forEach((story) => {
        if (story && story._id && !storyIds.has(story._id)) {
          storyIds.add(story._id)
          uniqueStories.push(story)
        }
      })

      // Then, ensure we only show one entry per user (the most recent story)
      const userStories = []

      // Sort stories by creation date (most recent first)
      const sortedStories = [...uniqueStories].sort((a, b) => {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      })

      sortedStories.forEach((story) => {
        // Get the user ID regardless of whether it's a string or object
        const userId = story.user ?
          (typeof story.user === 'string' ? story.user : story.user._id) :
          (story.userData ? story.userData._id : null)

        if (userId && !userIds.has(userId)) {
          userIds.add(userId)
          userStories.push(story)
        }
      })

      setProcessedStories(userStories)
    } else {
      setProcessedStories([])
    }
  }, [stories])

  // Load stories when component mounts, with throttling
  useEffect(() => {
    const loadStoriesData = async () => {
      // Prevent redundant loading
      if (loadingRef.current) return;

      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        // Check if loadStories exists before calling it
        if (typeof loadStories === "function") {
          console.log("StoriesCarousel: Initiating story load");
          await loadStories(false); // Don't force refresh on initial load
          console.log("StoriesCarousel: Story load complete");
        } else {
          console.warn("Stories functionality is not available - loadStories function not found");
        }
      } catch (error) {
        console.error("Error loading stories:", error);
        setError("Failed to load stories");
      } finally {
        setLoading(false);
        loadingRef.current = false;
        setLoadAttempted(true);
      }
    };

    // Only load if we haven't attempted already
    if (!loadAttempted && !loadingRef.current && typeof loadStories === "function") {
      loadStoriesData();
    }
  }, [loadStories, loadAttempted]);

  // Safely handle story click with proper throttling
  const handleStoryClick = useCallback(
    throttle((storyId) => {
      if (typeof onStoryClick === "function") {
        onStoryClick(storyId);
      } else {
        console.warn("Story click handler not provided");
      }
    }, 300), // Throttle to 300ms
    [onStoryClick]
  );

  // Show loading state
  if ((loading || contextLoading) && !loadAttempted) {
    return (
      <div className="stories-carousel-container">
        <div className="stories-carousel-loading">
          <div className="spinner"></div>
          <p>Loading stories...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="stories-carousel-container">
        <div className="stories-carousel-error">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Show empty state
  if (!processedStories || processedStories.length === 0) {
    return (
      <div className="stories-carousel-container">
        <div className="stories-carousel-empty">
          <p>No stories available</p>
          {/* We could add a "Create Story" button here */}
        </div>
      </div>
    );
  }

  // Render stories carousel
  return (
    <div className="stories-carousel-container">
      <div className="stories-carousel">
        {processedStories.map((story) => (
          <StoryThumbnail
            key={story._id || `story-${Math.random()}`}
            story={story}
            onClick={() => handleStoryClick(story._id)}
          />
        ))}
      </div>
    </div>
  );
};

export default StoriesCarousel;
