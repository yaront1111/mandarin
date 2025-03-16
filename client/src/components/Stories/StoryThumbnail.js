"use client"

import { useState, useMemo } from "react"
import { useUser } from "../../context"
import "../../styles/stories.css"

const StoryThumbnail = ({ story, onClick, hasUnviewedStories }) => {
  const { user } = useUser()
  const [imageError, setImageError] = useState(false)

  // Use useMemo to create a stable reference for storyUser
  const storyUser = useMemo(() => {
    // Check for user data in different possible locations
    if (story && story.user && typeof story.user === "object") {
      return story.user
    } else if (story && story.userData && typeof story.userData === "object") {
      return story.userData
    } else if (story && story.user && typeof story.user === "string") {
      // If user is just an ID, return an object with just the ID
      return { _id: story.user }
    }
    return {}
  }, [story])

  // Check if the current user has viewed this story
  const isViewed = useMemo(() => {
    if (typeof hasUnviewedStories !== "undefined") {
      return !hasUnviewedStories
    }
    return user && story && story.viewers && story.viewers.includes(user._id)
  }, [hasUnviewedStories, user, story])

  // Get profile picture URL with fallbacks
  const getProfilePicture = () => {
    if (imageError) {
      // If image failed to load, use a data URI for a simple avatar placeholder
      return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="%23cccccc"/><text x="50%" y="50%" font-size="20" text-anchor="middle" dy=".3em" fill="%23ffffff">?</text></svg>'
    }

    // Try all possible profile picture fields
    const possibleUrls = [
      storyUser.profilePicture,
      storyUser.profilePic,
      storyUser.avatar,
      storyUser.avatarUrl,
      storyUser.photo,
      storyUser.image,
    ].filter(Boolean) // Remove null/undefined values

    // Return the first valid URL or a data URI placeholder
    return (
      possibleUrls[0] ||
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="%23cccccc"/><text x="50%" y="50%" font-size="20" text-anchor="middle" dy=".3em" fill="%23ffffff">?</text></svg>'
    )
  }

  // Handle image error
  const handleImageError = () => {
    console.log("Image failed to load")
    setImageError(true)
  }

  // Get user display name for alt text
  const getUserDisplayName = () => {
    return storyUser.nickname || storyUser.username || storyUser.name || "User"
  }

  // Handle click with check for callback
  const handleClick = (e) => {
    e.preventDefault()
    if (typeof onClick === "function") {
      onClick()
    }
  }

  // If no story, don't render anything
  if (!story) {
    return null
  }

  return (
    <div className="story-thumbnail" onClick={handleClick}>
      <div className={`story-avatar-border ${isViewed ? "viewed" : ""}`}>
        <img
          src={getProfilePicture() || "/placeholder.svg"}
          alt={getUserDisplayName()}
          className="story-avatar"
          onError={handleImageError}
        />
      </div>
    </div>
  )
}

export default StoryThumbnail
