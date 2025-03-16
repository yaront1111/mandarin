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

  // Instead of state, use a ref for the refresh interval.
  const refreshIntervalRef = useRef(null)
  const storyOperationsInProgress = useRef(new Set())

  // Clear error helper
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Load all stories for the feed with caching
  const loadStories = useCallback(
    async (forceRefresh = false) => {
      // If we've fetched recently and not forcing a refresh, use cached data
      const now = Date.now()
      if (!forceRefresh && stories.length > 0 && now - lastFetch < 60000) {
        console.log("Using cached stories data")
        return stories
      }

      // Prevent concurrent loadStories operations
      if (storyOperationsInProgress.current.has('loadStories')) {
        console.log("Story loading already in progress, skipping duplicate request")
        return stories
      }

      storyOperationsInProgress.current.add('loadStories')
      setLoading(true)
      setError(null)

      try {
        const response = await storiesService.getAllStories()
        if (response.success) {
          // Add an ID to track API calls in debug logs
          console.log(`[${now}] Stories loaded successfully:`, response.data?.length || 0)
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
        storyOperationsInProgress.current.delete('loadStories')
      }
    },
    // Remove 'stories' from dependencies to prevent unnecessary re-renders
    [lastFetch]
  )

  // Load stories for a specific user
  const loadUserStories = useCallback(async (userId) => {
    if (!userId) {
      console.error("Cannot load user stories: Missing userId")
      return []
    }

    const operationKey = `loadUserStories-${userId}`
    if (storyOperationsInProgress.current.has(operationKey)) {
      console.log(`User story loading for ${userId} already in progress, skipping`)
      return []
    }

    storyOperationsInProgress.current.add(operationKey)
    setLoading(true)

    try {
      const response = await storiesService.getUserStories(userId)

      if (response.success) {
        const userStories = response.data || []
        console.log(`Loaded ${userStories.length} stories for user ${userId}`)

        // Update the stories array with the new user stories WITHOUT triggering
        // a reload of all stories
        setStories((prevStories) => {
          // Create a map of existing stories by userId for efficient lookup
          const storiesByUser = new Map()

          // Only include stories from other users
          prevStories.forEach(story => {
            if (story.user && story.user._id !== userId) {
              storiesByUser.set(story.user._id, story)
            }
          })

          // Add this user's stories if they exist
          if (userStories.length > 0) {
            storiesByUser.set(userId, {
              user: userStories[0].user,
              _id: userStories[0]._id,
              createdAt: userStories[0].createdAt,
            })
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
      storyOperationsInProgress.current.delete(operationKey)
    }
  }, [])

  // Create a new story
  const createStory = useCallback(
    async (storyData, onProgress) => {
      if (!user) {
        toast.error("You must be logged in to create a story")
        return { success: false, message: "You must be logged in to create a story" }
      }

      // Prevent duplicate submissions
      if (isCreatingStory) {
        toast.info("A story is already being created, please wait")
        return { success: false, message: "Story creation already in progress" }
      }

      setIsCreatingStory(true)
      setLoading(true)

      try {
        console.log("Creating story with data:", {
          type: storyData.mediaType,
          textLength: storyData.text?.length,
          hasMedia: !!storyData.media
        })

        let response

        // Check if it's a text or media story
        if (storyData.mediaType === "text") {
          response = await storiesService.createTextStory(storyData, onProgress)
        } else {
          response = await storiesService.createStory(storyData, onProgress)
        }

        if (response.success) {
          toast.success("Story created successfully!")

          // Add a small delay before reloading stories to ensure the server has processed the new story
          setTimeout(async () => {
            await loadStories(true)
          }, 500)

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
        setIsCreatingStory(false)
      }
    },
    [user, loadStories, isCreatingStory]
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

      const operationKey = `deleteStory-${storyId}`
      if (storyOperationsInProgress.current.has(operationKey)) {
        console.log(`Story deletion for ${storyId} already in progress, skipping`)
        return { success: false, message: "Delete operation in progress" }
      }

      storyOperationsInProgress.current.add(operationKey)
      setLoading(true)

      try {
        const response = await storiesService.deleteStory(storyId)

        if (response.success) {
          // Remove the deleted story from state
          setStories((prevStories) => prevStories.filter((story) => story._id !== storyId))
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
        storyOperationsInProgress.current.delete(operationKey)
      }
    },
    [user]
  )

  // Mark a story as viewed
  const viewStory = useCallback(
    async (storyId) => {
      if (!user || !storyId) return false

      // Prevent duplicate view operations
      const operationKey = `viewStory-${storyId}`
      if (storyOperationsInProgress.current.has(operationKey)) {
        return false
      }

      storyOperationsInProgress.current.add(operationKey)

      try {
        // Check if already viewed to reduce unnecessary API calls
        if (viewedStories[storyId]) {
          return true
        }

        await storiesService.markStoryAsViewed(storyId)
        setViewedStories((prev) => ({ ...prev, [storyId]: Date.now() }))
        return true
      } catch (err) {
        console.error(`Error marking story ${storyId} as viewed:`, err)
        return false
      } finally {
        storyOperationsInProgress.current.delete(operationKey)
      }
    },
    [user, viewedStories]
  )

  // Check if a user has any unviewed stories
  const hasUnviewedStories = useCallback(
    (userId) => {
      if (!stories || !userId || !user) return false

      const userStories = stories.filter((story) => story.user && story.user._id === userId)
      if (!userStories || userStories.length === 0) return false

      return userStories.some((story) => !viewedStories[story._id])
    },
    [stories, viewedStories, user]
  )

  // React to a story (like, etc.)
  const reactToStory = useCallback(
    async (storyId, reactionType) => {
      if (!user) {
        toast.error("You must be logged in to react to a story")
        return { success: false }
      }

      const operationKey = `reactToStory-${storyId}-${reactionType}`
      if (storyOperationsInProgress.current.has(operationKey)) {
        return { success: false, message: "Reaction already in progress" }
      }

      storyOperationsInProgress.current.add(operationKey)

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
      } finally {
        storyOperationsInProgress.current.delete(operationKey)
      }
    },
    [user]
  )

  // Load viewed stories from localStorage on mount
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

  // Save viewed stories to localStorage when they change
  useEffect(() => {
    if (user && Object.keys(viewedStories).length > 0) {
      localStorage.setItem(`viewedStories_${user._id}`, JSON.stringify(viewedStories))
    }
  }, [viewedStories, user])

  // Set up periodic refresh for stories when authenticated using a ref
  useEffect(() => {
    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
      refreshIntervalRef.current = null
    }

    // Only set up refresh if user is authenticated
    if (isAuthenticated) {
      // Refresh stories every 5 minutes
      refreshIntervalRef.current = setInterval(() => {
        // Only refresh if tab is visible
        if (document.visibilityState === "visible") {
          loadStories(true).catch((err) => {
            console.error("Error refreshing stories:", err)
          })
        }
      }, 5 * 60 * 1000) // 5 minutes
    }

    // Cleanup on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
        refreshIntervalRef.current = null
      }
    }
  }, [isAuthenticated, loadStories])

  // Initial stories load when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadStories().catch((err) => {
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
