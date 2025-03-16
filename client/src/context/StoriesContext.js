"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
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
  const [refreshInterval, setRefreshInterval] = useState(null)

  // Clear error helper
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Load all stories for the feed with caching
  const loadStories = useCallback(async (forceRefresh = false) => {
    // If we've fetched recently and not forcing a refresh, use cached data
    const now = Date.now()
    if (!forceRefresh && stories.length > 0 && now - lastFetch < 60000) {
      console.log('Using cached stories data')
      return stories
    }

    setLoading(true)
    setError(null)

    try {
      const response = await storiesService.getAllStories()
      if (response.success) {
        setStories(response.data || [])
        setLastFetch(now)
        return response.data || []
      } else {
        setError(response.message || "Failed to load stories")
        return []
      }
    } catch (err) {
      console.error("Error loading stories:", err)
      setError(err.message || "An error occurred while loading stories")
      return []
    } finally {
      setLoading(false)
    }
  }, [stories, lastFetch])

  // Load stories for a specific user
  const loadUserStories = useCallback(async (userId) => {
    if (!userId) {
      console.error("Cannot load user stories: Missing userId")
      return []
    }

    try {
      setLoading(true)
      const response = await storiesService.getUserStories(userId)

      if (response.success) {
        const userStories = response.data || []

        // Update the stories array with the new user stories
        setStories(prevStories => {
          // Create a map of existing stories by userId for efficient lookup
          const storiesByUser = new Map(
            prevStories.map(story => [story.user?._id, story])
          )

          // Add or update the stories for this user
          if (userStories.length > 0) {
            storiesByUser.set(userId, {
              user: userStories[0].user,
              _id: userStories[0]._id,
              createdAt: userStories[0].createdAt
            })
          } else if (storiesByUser.has(userId)) {
            // Remove this user's stories if there are none
            storiesByUser.delete(userId)
          }

          // Convert map back to array
          return Array.from(storiesByUser.values())
        })

        return userStories
      } else {
        console.error(`Failed to load stories for user ${userId}:`, response.message)
        return []
      }
    } catch (err) {
      console.error(`Error loading stories for user ${userId}:`, err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // Create a new story
  const createStory = useCallback(
    async (storyData, onProgress) => {
      if (!user) {
        toast.error("You must be logged in to create a story")
        return { success: false, message: "You must be logged in to create a story" }
      }

      try {
        setLoading(true)
        let response

        // Check if it's a text or media story
        if (storyData.mediaType === "text") {
          response = await storiesService.createTextStory(storyData, onProgress)
        } else {
          response = await storiesService.createStory(storyData, onProgress)
        }

        if (response.success) {
          toast.success("Story created successfully!")

          // Reload stories to include the new one
          await loadStories(true)
          return response
        } else {
          throw new Error(response.message || "Failed to create story")
        }
      } catch (err) {
        console.error("Error creating story:", err)
        toast.error(err.message || "Failed to create story")
        return { success: false, message: err.message || "Failed to create story" }
      } finally {
        setLoading(false)
      }
    },
    [user, loadStories]
  )

  // Delete a story
  const deleteStory = useCallback(
    async (storyId) => {
      if (!user) {
        toast.error("You must be logged in to delete a story")
        return { success: false, message: "You must be logged in to delete a story" }
      }

      if (!storyId) {
        toast.error("Invalid story ID")
        return { success: false, message: "Invalid story ID" }
      }

      try {
        setLoading(true)
        const response = await storiesService.deleteStory(storyId)

        if (response.success) {
          // Remove the deleted story from state
          setStories(prevStories => {
            // Filter out the deleted story
            return prevStories.filter(story => story._id !== storyId)
          })

          toast.success("Story deleted successfully")
          return response
        } else {
          throw new Error(response.message || "Failed to delete story")
        }
      } catch (err) {
        console.error(`Error deleting story ${storyId}:`, err)
        toast.error(err.message || "Failed to delete story")
        return { success: false, message: err.message || "Failed to delete story" }
      } finally {
        setLoading(false)
      }
    },
    [user]
  )

  // Mark a story as viewed
  const viewStory = useCallback(
    async (storyId) => {
      if (!user || !storyId) return false

      try {
        // Call API to mark story as viewed
        await storiesService.markStoryAsViewed(storyId)

        // Update local viewed stories state
        setViewedStories(prev => ({
          ...prev,
          [storyId]: Date.now()
        }))

        return true
      } catch (err) {
        console.error(`Error marking story ${storyId} as viewed:`, err)
        return false
      }
    },
    [user]
  )

  // Check if a user has any unviewed stories
  const hasUnviewedStories = useCallback(
    (userId) => {
      if (!stories || !userId || !user) return false

      // Find stories for this user
      const userStories = stories.filter(story =>
        story.user && story.user._id === userId
      )

      if (!userStories || userStories.length === 0) return false

      // Check if any story is unviewed
      return userStories.some(story => !viewedStories[story._id])
    },
    [stories, viewedStories, user]
  )

  // React to a story (like, etc.)
  const reactToStory = useCallback(async (storyId, reactionType) => {
    if (!user) {
      toast.error("You must be logged in to react to a story")
      return { success: false }
    }

    try {
      const response = await storiesService.reactToStory(storyId, reactionType)
      if (response.success) {
        toast.success("Reaction added!")
      }
      return response
    } catch (err) {
      console.error("Error reacting to story:", err)
      toast.error("Failed to add reaction")
      return { success: false }
    }
  }, [user])

  // Load viewed stories from local storage on mount
  useEffect(() => {
    if (user) {
      const storedViewedStories = localStorage.getItem(`viewedStories_${user._id}`)
      if (storedViewedStories) {
        try {
          setViewedStories(JSON.parse(storedViewedStories))
        } catch (err) {
          console.error("Error parsing viewed stories from localStorage:", err)
        }
      }
    }
  }, [user])

  // Save viewed stories to local storage when they change
  useEffect(() => {
    if (user && Object.keys(viewedStories).length > 0) {
      localStorage.setItem(`viewedStories_${user._id}`, JSON.stringify(viewedStories))
    }
  }, [viewedStories, user])

  // Set up periodic refresh for stories when authenticated
  useEffect(() => {
    // Clear existing interval if any
    if (refreshInterval) {
      clearInterval(refreshInterval)
    }

    // Only set up refresh if user is authenticated
    if (isAuthenticated) {
      // Refresh stories every 5 minutes
      const interval = setInterval(() => {
        // Only refresh if tab is visible
        if (document.visibilityState === 'visible') {
          loadStories(true).catch(err => {
            console.error("Error refreshing stories:", err)
          })
        }
      }, 5 * 60 * 1000) // 5 minutes

      setRefreshInterval(interval)
    }

    // Cleanup on unmount
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [isAuthenticated, loadStories, refreshInterval])

  // Initial stories load
  useEffect(() => {
    // Only load stories if user is authenticated
    if (isAuthenticated) {
      loadStories().catch(err => {
        console.error("Error in initial stories load:", err)
      })
    }
  }, [isAuthenticated, loadStories])

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
  }

  return <StoriesContext.Provider value={value}>{children}</StoriesContext.Provider>
}

// Custom hook to use the stories context
export const useStories = () => {
  const context = useContext(StoriesContext)
  if (context === undefined) {
    console.warn("useStories must be used within a StoriesProvider")
    return null
  }
  return context
}

export default StoriesContext
