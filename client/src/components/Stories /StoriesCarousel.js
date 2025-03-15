"use client"

import { useState, useEffect } from "react"
import { useStories } from "../../context"
import StoryThumbnail from "./StoryThumbnail"
import "../../styles/stories.css"

const StoriesCarousel = ({ onStoryClick }) => {
  const { stories, fetchStories } = useStories()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStories = async () => {
      try {
        await fetchStories()
      } catch (error) {
        console.error("Error loading stories:", error)
      } finally {
        setLoading(false)
      }
    }

    loadStories()
  }, [fetchStories])

  if (loading) {
    return (
      <div className="stories-carousel-container">
        <div className="stories-carousel-loading">
          <div className="spinner"></div>
          <p>Loading stories...</p>
        </div>
      </div>
    )
  }

  if (!stories || stories.length === 0) {
    return (
      <div className="stories-carousel-container">
        <div className="stories-carousel-empty">
          <p>No stories available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="stories-carousel-container">
      <div className="stories-carousel">
        {stories.map((story) => (
          <StoryThumbnail key={story._id} story={story} onClick={() => onStoryClick(story._id)} />
        ))}
      </div>
    </div>
  )
}

export default StoriesCarousel
