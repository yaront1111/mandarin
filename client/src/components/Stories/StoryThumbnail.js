"use client"

import { useMemo } from "react"
import { useUser } from "../../context"
import "../../styles/stories.css"
import UserAvatar from "../UserAvatar" // Import the UserAvatar component

const StoryThumbnail = ({ story, onClick, hasUnviewedStories }) => {
  const { user } = useUser()

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

    if (!user || !story) return false

    // Check if viewers exists and is an array
    if (!Array.isArray(story.viewers)) return false

    return story.viewers.includes(user._id)
  }, [hasUnviewedStories, user, story])

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

  // Get user ID for avatar
  const userId = storyUser._id || (typeof story.user === 'string' ? story.user : null)

  return (
    <div className="story-thumbnail" onClick={handleClick}>
      <div className={`story-avatar-border ${isViewed ? "viewed" : ""}`}>
        <UserAvatar
          userId={userId}
          name={getUserDisplayName()}
          className="story-avatar"
        />
      </div>
      <div className="story-username">{getUserDisplayName()}</div>
    </div>
  )
}

export default StoryThumbnail
