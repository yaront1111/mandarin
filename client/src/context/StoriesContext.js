"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import storiesService from "../services/storiesService"
import { useAuth } from "./index"

// Create context
const StoriesContext = createContext()

// Stories provider component
export const StoriesProvider = ({ children }) => {
  const { user } = useAuth()
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [viewedStories, setViewedStories] = useState({})

  // Load all stories for the feed
  const loadStories = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await storiesService.getAllStories()
      if (response.success) {
        setStories(response.data)
      } else {
        setError(response.message || "Failed to load stories")
      }
    } catch (err) {
      console.error("Error loading stories:", err)
      setError(err.message || "An error occurred while loading stories")
    } finally {
      setLoading(false)
    }
  }, [])

  // Load stories for a specific user
  const loadUserStories = useCallback(async (userId) => {
    if (!userId) return

    try {
      const response = await storiesService.getUserStories(userId)
      if (response.success) {
        // Update the stories array with the new user stories
        setStories((prevStories) => {
          const updatedStories = [...prevStories]
          const userIndex = updatedStories.findIndex((s) => s.userId === userId)

          if (userIndex >= 0) {
            // Update existing user's stories
            updatedStories[userIndex] = {
              ...updatedStories[userIndex],
              stories: response.data,
            }
          } else {
            // Add new user's stories
            updatedStories.push({
              userId,
              user: response.data.length > 0 ? response.data[0].user : null,
              stories: response.data,
            })
          }

          return updatedStories
        })
      }
    } catch (err) {
      console.error(`Error loading stories for user ${userId}:`, err)
    }
  }, [])

  // Create a new story
  const createStory = useCallback(
    async (storyData, onProgress) => {
      if (!user) return { success: false, message: "You must be logged in to create a story" }

      try {
        const response = await storiesService.createStory(storyData, onProgress)
        if (response.success) {
          // Reload stories to include the new one
          loadStories()
        }
        return response
      } catch (err) {
        console.error("Error creating story:", err)
        return { success: false, message: err.message || "Failed to create story" }
      }
    },
    [user, loadStories],
  )

  // Delete a story
  const deleteStory = useCallback(
    async (storyId) => {
      if (!user) return { success: false, message: "You must be logged in to delete a story" }

      try {
        const response = await storiesService.deleteStory(storyId)
        if (response.success) {
          // Remove the deleted story from state
          setStories((prevStories) => {
            return prevStories
              .map((userStories) => ({
                ...userStories,
                stories: userStories.stories.filter((story) => story._id !== storyId),
              }))
              .filter((userStories) => userStories.stories.length > 0)
          })
        }
        return response
      } catch (err) {
        console.error(`Error deleting story ${storyId}:`, err)
        return { success: false, message: err.message || "Failed to delete story" }
      }
    },
    [user],
  )

  // Mark a story as viewed
  const markStoryAsViewed = useCallback(
    async (storyId) => {
      if (!user || !storyId) return

      try {
        await storiesService.markStoryAsViewed(storyId)

        // Update local viewed stories state
        setViewedStories((prev) => ({
          ...prev,
          [storyId]: true,
        }))
      } catch (err) {
        console.error(`Error marking story ${storyId} as viewed:`, err)
      }
    },
    [user],
  )

  // Check if a user has any unviewed stories
  const hasUnviewedStories = useCallback(
    (userId) => {
      if (!stories || !userId) return false

      const userStories = stories.find((s) => s.userId === userId)
      if (!userStories || !userStories.stories || userStories.stories.length === 0) return false

      // Check if any story is unviewed
      return userStories.stories.some((story) => !viewedStories[story._id])
    },
    [stories, viewedStories],
  )

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

  // Context value
  const value = {
    stories,
    loading,
    error,
    loadStories,
    loadUserStories,
    createStory,
    deleteStory,
    markStoryAsViewed,
    hasUnviewedStories,
    viewedStories,
  }

  return <StoriesContext.Provider value={value}>{children}</StoriesContext.Provider>
}

// Custom hook to use the stories context
export const useStories = () => {
  const context = useContext(StoriesContext)
  if (!context) {
    throw new Error("useStories must be used within a StoriesProvider")
  }
  return context
}

export default StoriesContext
