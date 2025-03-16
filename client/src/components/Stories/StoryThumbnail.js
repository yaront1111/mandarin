"use client"

import React, { useState, useEffect } from "react"
import { useUser } from "../../context"
import "../../styles/stories.css"

const StoryThumbnail = ({ story, onClick, hasUnviewedStories }) => {
  const { user } = useUser()
  const [imageError, setImageError] = useState(false)

  // Handle invalid story data
  if (!story || !story.user) {
    return null
  }

  // Check if the current user has viewed this story
  // If hasUnviewedStories is explicitly provided, use that instead
  const isViewed = typeof hasUnviewedStories !== 'undefined'
    ? !hasUnviewedStories
    : (user && story.viewers && story.viewers.includes(user._id))

  // Calculate time elapsed since story was posted
  const getTimeElapsed = (createdAt) => {
    if (!createdAt) return "Recently"

    const now = new Date()
    const storyDate = new Date(createdAt)

    // Check for invalid date
    if (isNaN(storyDate.getTime())) return "Recently"

    const diffInHours = Math.floor((now - storyDate) / (1000 * 60 * 60))

    if (diffInHours < 1) {
      return "Just now"
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`
    } else {
      return `${Math.floor(diffInHours / 24)}d ago`
    }
  }

  // Handle image error
  const handleImageError = () => {
    setImageError(true)
  }

  // Get profile URL
  const getProfilePicture = () => {
    // If we already had an error loading the image, use placeholder
    if (imageError) {
      return "/placeholder.svg?height=60&width=60"
    }

    // Try to get the profile picture from story.user
    return story.user.profilePicture || "/placeholder.svg?height=60&width=60"
  }

  // Handle click with check for callback
  const handleClick = (e) => {
    e.preventDefault()
    if (typeof onClick === 'function') {
      onClick()
    }
  }

  return (
    <div className="story-thumbnail" onClick={handleClick}>
      <div className={`story-avatar-border ${isViewed ? "viewed" : ""}`}>
        <img
          src={getProfilePicture()}
          alt={story.user.username || "User"}
          className="story-avatar"
          onError={handleImageError}
        />
      </div>
      <div className="story-username">
        {story.user.username || "User"}
      </div>
      <div className="story-timestamp">
        {getTimeElapsed(story.createdAt)}
      </div>
    </div>
  )
}

export default StoryThumbnail
