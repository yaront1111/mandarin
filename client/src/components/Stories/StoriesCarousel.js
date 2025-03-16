"use client"

import { useState, useEffect, useCallback } from "react"
import { useStories } from "../../context"
import StoryThumbnail from "./StoryThumbnail"
import "../../styles/stories.css"

const StoriesCarousel = ({ onStoryClick }) => {
  const { stories = [], loadStories, loading: contextLoading } = useStories() || {}
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load stories when component mounts
  useEffect(() => {
    const loadStoriesData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Check if loadStories exists before calling it
        if (typeof loadStories === "function") {
          await loadStories()
        } else {
          console.warn("Stories functionality is not available - loadStories function not found")
        }

        // We still set loading to false even if loadStories doesn't exist
        // This allows the component to degrade gracefully
        setLoading(false)
      } catch (error) {
        console.error("Error loading stories:", error)
        setError("Failed to load stories")
        setLoading(false)
      }
    }

    loadStoriesData()
  }, [loadStories])

  // Safely handle story click
  const handleStoryClick = useCallback(
    (storyId) => {
      if (typeof onStoryClick === "function") {
        onStoryClick(storyId)
      } else {
        console.warn("Story click handler not provided")
      }
    },
    [onStoryClick],
  )

  // Show loading state
  if (loading || contextLoading) {
    return (
      <div className="stories-carousel-container">
        <div className="stories-carousel-loading">
          <div className="spinner"></div>
          <p>Loading stories...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="stories-carousel-container">
        <div className="stories-carousel-error">
          <p>{error}</p>
        </div>
      </div>
    )
  }

  // Show empty state
  if (!stories || stories.length === 0) {
    return (
      <div className="stories-carousel-container">
        <div className="stories-carousel-empty">
          <p>No stories available</p>
          {/* We could add a "Create Story" button here */}
        </div>
      </div>
    )
  }

  // Render stories carousel
  return (
    <div className="stories-carousel-container">
      <div className="stories-carousel">
        {(() => {
          // Filter out duplicate stories by ID
          const uniqueStories = []
          const storyIds = new Set()

          stories.forEach((story) => {
            if (story._id && !storyIds.has(story._id)) {
              storyIds.add(story._id)
              uniqueStories.push(story)
            }
          })

          return uniqueStories.map((story) => (
            <StoryThumbnail
              key={story._id || `story-${Math.random()}`}
              story={story}
              onClick={() => handleStoryClick(story._id)}
            />
          ))
        })()}
      </div>
    </div>
  )
}

export default StoriesCarousel
