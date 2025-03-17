"use client"
import { useMemo } from "react"
import { useUser } from "../../context"
import "../../styles/stories.css"
import UserAvatar from "../UserAvatar" // Import your UserAvatar component if you have it

const StoryThumbnail = ({ story, onClick, hasUnviewedStories }) => {
  const { user } = useUser()

  // Derive user object from story
  const storyUser = useMemo(() => {
    if (!story) return {}
    if (typeof story.user === "object") return story.user
    if (story.userData && typeof story.userData === "object") return story.userData
    if (typeof story.user === "string") return { _id: story.user }
    return {}
  }, [story])

  // Check if this story is viewed by the current user
  const isViewed = useMemo(() => {
    if (typeof hasUnviewedStories !== "undefined") {
      // If parent told us there are unviewed stories for this user, we trust that
      return !hasUnviewedStories
    }
    if (!user || !user._id || !story?.viewers) return false
    if (!Array.isArray(story.viewers)) return false
    return story.viewers.includes(user._id)
  }, [hasUnviewedStories, user, story])

  const getUserDisplayName = () => {
    if (!storyUser) return "Unknown User"
    return storyUser.nickname || storyUser.username || storyUser.name || "User"
  }

  const handleClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (typeof onClick === "function") onClick()
  }

  if (!story) return null

  // Get user ID for avatar
  const userId = storyUser._id
  // Try to get a direct avatar property
  const avatarSrc = storyUser.profilePicture || storyUser.avatar || null

  return (
    <div className="story-thumbnail" onClick={handleClick}>
      <div className={`story-avatar-border ${isViewed ? "viewed" : ""}`}>
        <UserAvatar
          userId={userId}
          name={getUserDisplayName()}
          className="story-avatar"
          src={avatarSrc}
        />
      </div>
      <div className="story-username">{getUserDisplayName()}</div>
    </div>
  )
}

export default StoryThumbnail
