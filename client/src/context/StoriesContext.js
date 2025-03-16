"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react"
import storiesService from "../services/storiesService"
import { useAuth } from "./AuthContext"
import { toast } from "react-toastify"

// Create context
const StoriesContext = createContext()

// Stories provider component
export const StoriesProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth()
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [viewedStories, setViewedStories] = useState({})
  const [lastFetch, setLastFetch] = useState(0)
  const [isCreatingStory, setIsCreatingStory] = useState(false)

  // Use refs for tracking operations in progress
  const refreshIntervalRef = useRef(null)
  const storyOperationsInProgress = useRef(new Set())
  const pendingRefreshRef = useRef(false)
  const loadingRef = useRef(false) // Add ref to track loading state

  // Debounce function to limit multiple calls
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Clear error helper
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Load all stories for the feed with improved caching and deduplication
  const loadStories = useCallback(
    async (forceRefresh = false) => {
      console.log(`loadStories called with forceRefresh=${forceRefresh}`);

      // If already loading, queue for later to prevent concurrent requests
      if (loadingRef.current) {
        console.log("Story loading already in progress, queuing refresh for later");
        pendingRefreshRef.current = true;
        return stories;
      }

      // Check cache only if not forcing refresh
      const now = Date.now();
      const cacheAge = now - lastFetch;
      if (!forceRefresh && stories.length > 0 && cacheAge < 60000) {
        console.log(`Using cached stories (age: ${cacheAge}ms)`);
        return stories;
      }

      // Set loading state both in state and ref
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        console.log(`Fetching fresh stories data at ${now}`);
        const response = await storiesService.getAllStories();

        if (response.success) {
          // Add timestamp for tracking
          console.log(`[${now}] Stories loaded successfully:`, response.data?.length || 0);

          if (Array.isArray(response.data)) {
            setStories(response.data);
            setLastFetch(now);
            return response.data;
          } else {
            console.error("Invalid stories data format:", response.data);
            setError("Invalid data format received from server");
            return [];
          }
        } else {
          console.error("Failed to load stories:", response.message);
          setError(response.message || "Failed to load stories");
          return [];
        }
      } catch (err) {
        console.error("Error loading stories:", err);
        setError(err.message || "An error occurred while loading stories");
        return [];
      } finally {
        loadingRef.current = false;
        setLoading(false);

        // If there was a pending refresh request, process it with delay
        if (pendingRefreshRef.current) {
          pendingRefreshRef.current = false;
          setTimeout(() => loadStories(true), 500);
        }
      }
    },
    [lastFetch, stories]
  );

  // Debounced version of loadStories to prevent too frequent refreshes
  const debouncedLoadStories = useCallback(
    debounce((forceRefresh) => {
      loadStories(forceRefresh);
    }, 200),
    [loadStories]
  );

  // Load stories for a specific user with better error handling
  const loadUserStories = useCallback(async (userId) => {
    if (!userId) {
      console.error("Cannot load user stories: Missing userId");
      return [];
    }

    const operationKey = `loadUserStories-${userId}`;
    if (storyOperationsInProgress.current.has(operationKey)) {
      console.log(`User story loading for ${userId} already in progress, skipping`);
      return [];
    }

    storyOperationsInProgress.current.add(operationKey);
    setLoading(true);

    try {
      const response = await storiesService.getUserStories(userId);

      if (response.success) {
        const userStories = response.data || [];
        console.log(`Loaded ${userStories.length} stories for user ${userId}`);
        return [...userStories]; // Return copy to avoid reference issues
      } else {
        console.error(`Failed to load stories for user ${userId}:`, response.message);
        return [];
      }
    } catch (err) {
      console.error(`Error loading stories for user ${userId}:`, err);
      return [];
    } finally {
      setLoading(false);
      storyOperationsInProgress.current.delete(operationKey);
    }
  }, []);

  // Create a new story with robust error handling
  const createStory = useCallback(
    async (storyData, onProgress) => {
      if (!user) {
        toast.error("You must be logged in to create a story");
        return { success: false, message: "You must be logged in to create a story" };
      }

      // Prevent duplicate submissions
      if (isCreatingStory) {
        toast.info("A story is already being created, please wait");
        return { success: false, message: "Story creation already in progress" };
      }

      setIsCreatingStory(true);
      setLoading(true);

      try {
        console.log("Creating story with data:", {
          type: storyData.mediaType,
          textLength: storyData.content?.length || storyData.text?.length,
          hasMedia: !!storyData.media
        });

        let response;

        // Check if it's a text or media story and use appropriate endpoint
        if (storyData.mediaType === "text") {
          // Ensure content field is set (server expects content, not text)
          const textStoryData = {
            ...storyData,
            content: storyData.content || storyData.text
          };
          response = await storiesService.createTextStory(textStoryData, onProgress);
        } else {
          response = await storiesService.createStory(storyData, onProgress);
        }

        if (response.success) {
          toast.success("Story created successfully!");

          // Add a small delay before reloading stories to ensure the server has processed the new story
          setTimeout(() => {
            debouncedLoadStories(true);
          }, 1000);

          return response;
        } else {
          throw new Error(response.message || "Failed to create story");
        }
      } catch (err) {
        console.error("Error creating story:", err);
        toast.error(err.message || "Failed to create story");
        return { success: false, message: err.message || "Failed to create story" };
      } finally {
        setLoading(false);
        setIsCreatingStory(false);
      }
    },
    [user, debouncedLoadStories, isCreatingStory]
  );

  // Additional utilities remain the same...
  // (Other methods from your existing context would continue here)

  // Load viewed stories from localStorage on mount with throttling
  useEffect(() => {
    if (user) {
      // Load viewed stories from localStorage, but only once
      try {
        const storedViewedStories = localStorage.getItem(`viewedStories_${user._id}`);
        if (storedViewedStories) {
          const parsedStories = JSON.parse(storedViewedStories);
          setViewedStories(parsedStories);
        }
      } catch (err) {
        console.error("Error parsing viewed stories from localStorage:", err);
      }
    }
  }, [user]);

  // Save viewed stories to localStorage when they change, with debouncing
  useEffect(() => {
    const saveToStorage = debounce(() => {
      if (user && Object.keys(viewedStories).length > 0) {
        try {
          localStorage.setItem(`viewedStories_${user._id}`, JSON.stringify(viewedStories));
        } catch (err) {
          console.error("Error saving viewed stories to localStorage:", err);
        }
      }
    }, 1000);

    saveToStorage();

    return () => {
      // Save immediately on unmount
      if (user && Object.keys(viewedStories).length > 0) {
        try {
          localStorage.setItem(`viewedStories_${user._id}`, JSON.stringify(viewedStories));
        } catch (err) {
          console.error("Error saving viewed stories to localStorage:", err);
        }
      }
    };
  }, [viewedStories, user]);

  // Set up periodic refresh for stories when authenticated
  useEffect(() => {
    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    // Only set up refresh if user is authenticated
    if (isAuthenticated) {
      // Initial load with delay to prevent UI freeze on page load
      setTimeout(() => {
        if (isAuthenticated) {
          debouncedLoadStories(false);
        }
      }, 500);

      // Much longer refresh interval - 5 minutes
      refreshIntervalRef.current = setInterval(() => {
        // Only refresh if tab is visible and no operation is in progress
        if (document.visibilityState === "visible" && !loadingRef.current) {
          debouncedLoadStories(true);
        }
      }, 5 * 60 * 1000); // 5 minutes
    }

    // Cleanup on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, debouncedLoadStories]);

  // Add remaining methods from your context
  const deleteStory = useCallback(
    async (storyId) => {
      if (!user) {
        toast.error("You must be logged in to delete a story");
        return { success: false, message: "You must be logged in to delete a story" };
      }

      if (!storyId) {
        toast.error("Invalid story ID");
        return { success: false, message: "Invalid story ID" };
      }

      const operationKey = `deleteStory-${storyId}`;
      if (storyOperationsInProgress.current.has(operationKey)) {
        console.log(`Story deletion for ${storyId} already in progress, skipping`);
        return { success: false, message: "Delete operation in progress" };
      }

      storyOperationsInProgress.current.add(operationKey);
      setLoading(true);

      try {
        const response = await storiesService.deleteStory(storyId);

        if (response.success) {
          // Remove the deleted story from state
          setStories((prevStories) => prevStories.filter((story) => story._id !== storyId));
          toast.success("Story deleted successfully");
          return response;
        } else {
          throw new Error(response.message || "Failed to delete story");
        }
      } catch (err) {
        console.error(`Error deleting story ${storyId}:`, err);
        toast.error(err.message || "Failed to delete story");
        return { success: false, message: err.message || "Failed to delete story" };
      } finally {
        setLoading(false);
        storyOperationsInProgress.current.delete(operationKey);
      }
    },
    [user]
  );

  // Mark a story as viewed with improved error handling
  const viewStory = useCallback(
    async (storyId) => {
      if (!user || !storyId) return false;

      // Prevent duplicate view operations
      const operationKey = `viewStory-${storyId}`;
      if (storyOperationsInProgress.current.has(operationKey)) {
        return false;
      }

      storyOperationsInProgress.current.add(operationKey);

      try {
        // Check if already viewed to reduce unnecessary API calls
        if (viewedStories[storyId]) {
          return true;
        }

        const response = await storiesService.markStoryAsViewed(storyId);

        if (response.success) {
          setViewedStories((prev) => ({ ...prev, [storyId]: Date.now() }));
          return true;
        } else {
          console.error(`Error marking story ${storyId} as viewed:`, response.message);
          return false;
        }
      } catch (err) {
        console.error(`Error marking story ${storyId} as viewed:`, err);
        return false;
      } finally {
        storyOperationsInProgress.current.delete(operationKey);
      }
    },
    [user, viewedStories]
  );

  // Check if a user has any unviewed stories
  const hasUnviewedStories = useCallback(
    (userId) => {
      if (!stories || !userId || !user) return false;

      const userStories = stories.filter((story) => {
        const storyUserId = story.user && (typeof story.user === 'string' ? story.user : story.user._id);
        return storyUserId === userId;
      });

      if (!userStories || userStories.length === 0) return false;

      return userStories.some((story) => !viewedStories[story._id]);
    },
    [stories, viewedStories, user]
  );

  // React to a story (like, etc.)
  const reactToStory = useCallback(
    async (storyId, reactionType) => {
      if (!user) {
        toast.error("You must be logged in to react to a story");
        return { success: false };
      }

      const operationKey = `reactToStory-${storyId}-${reactionType}`;
      if (storyOperationsInProgress.current.has(operationKey)) {
        return { success: false, message: "Reaction already in progress" };
      }

      storyOperationsInProgress.current.add(operationKey);

      try {
        const response = await storiesService.reactToStory(storyId, reactionType);
        if (response.success) {
          toast.success("Reaction added!");
        }
        return response;
      } catch (err) {
        console.error("Error reacting to story:", err);
        toast.error("Failed to add reaction");
        return { success: false };
      } finally {
        storyOperationsInProgress.current.delete(operationKey);
      }
    },
    [user]
  );

  // Context value
  const value = {
    stories,
    loading,
    error,
    clearError,
    loadStories,
    loadUserStories,
    createStory,
    deleteStory,
    viewStory,
    reactToStory,
    hasUnviewedStories,
    viewedStories,
  };

  return <StoriesContext.Provider value={value}>{children}</StoriesContext.Provider>;
};

// Custom hook to use the stories context
export const useStories = () => {
  const context = useContext(StoriesContext);
  if (context === undefined) {
    console.warn("useStories must be used within a StoriesProvider");
    return null;
  }
  return context;
};

export default StoriesContext;
