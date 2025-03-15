"use client"
import { useUser } from "../../context"
import "../../styles/stories.css"

const StoryThumbnail = ({ story, onClick }) => {
  const { user } = useUser()

  if (!story || !story.user) {
    return null
  }

  // Check if the current user has viewed this story
  const isViewed = user && story.viewers && story.viewers.includes(user._id)

  // Calculate time elapsed since story was posted
  const getTimeElapsed = (createdAt) => {
    const now = new Date()
    const storyDate = new Date(createdAt)
    const diffInHours = Math.floor((now - storyDate) / (1000 * 60 * 60))

    if (diffInHours < 1) {
      return "Just now"
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`
    } else {
      return `${Math.floor(diffInHours / 24)}d ago`
    }
  }

  return (
    <div className="story-thumbnail" onClick={onClick}>
      <div className={`story-avatar-border ${isViewed ? "viewed" : ""}`}>
        <img
          src={story.user.profilePicture || "/placeholder.svg?height=60&width=60"}
          alt={story.user.username}
          className="story-avatar"
        />
      </div>
      <div className="story-username">{story.user.username}</div>
      <div className="story-timestamp">{getTimeElapsed(story.createdAt)}</div>
    </div>
  )
}

export default StoryThumbnail
