"use client"

import { useState, useEffect, useRef } from "react"
import { useStories, useUser } from "../../context"
import "../../styles/stories.css"

const StoriesViewer = ({ storyId, onClose }) => {
  const { stories, viewStory } = useStories()
  const { user } = useUser()
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const progressInterval = useRef(null)
  const storyDuration = 5000 // 5 seconds per story
  const progressStep = 100 / (storyDuration / 100) // Progress increment per 100ms

  // Find the starting index based on storyId
  useEffect(() => {
    if (storyId && stories && stories.length > 0) {
      const index = stories.findIndex((story) => story._id === storyId)
      if (index !== -1) {
        setCurrentStoryIndex(index)
      }
    }
  }, [storyId, stories])

  // Mark story as viewed
  useEffect(() => {
    if (stories && stories.length > 0 && currentStoryIndex < stories.length) {
      const currentStory = stories[currentStoryIndex]
      if (currentStory && user && !currentStory.viewers.includes(user._id)) {
        viewStory(currentStory._id)
      }
    }
  }, [currentStoryIndex, stories, user, viewStory])

  // Handle progress bar
  useEffect(() => {
    if (paused) return

    setProgress(0)

    if (progressInterval.current) {
      clearInterval(progressInterval.current)
    }

    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval.current)
          // Move to next story
          if (currentStoryIndex < stories.length - 1) {
            setCurrentStoryIndex((prev) => prev + 1)
          } else {
            onClose()
          }
          return 0
        }
        return prev + progressStep
      })
    }, 100)

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
    }
  }, [currentStoryIndex, stories, paused, onClose, progressStep])

  const handlePrevStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex((prev) => prev - 1)
    }
  }

  const handleNextStory = () => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex((prev) => prev + 1)
    } else {
      onClose()
    }
  }

  const togglePause = () => {
    setPaused((prev) => !prev)
  }

  if (!stories || stories.length === 0 || currentStoryIndex >= stories.length) {
    return null
  }

  const currentStory = stories[currentStoryIndex]

  // Get background style for text stories
  const getBackgroundStyle = () => {
    if (currentStory.mediaType === "text" && currentStory.backgroundStyle) {
      const styles = { background: currentStory.backgroundStyle }
      if (currentStory.extraStyles) {
        return { ...styles, ...currentStory.extraStyles }
      }
      return styles
    }
    return {}
  }

  // Get font style for text stories
  const getFontStyle = () => {
    if (currentStory.mediaType === "text" && currentStory.fontStyle) {
      return { fontFamily: currentStory.fontStyle }
    }
    return {}
  }

  return (
    <div className="stories-viewer-overlay">
      <div className="stories-viewer-container">
        <div className="stories-viewer-header">
          <div className="stories-progress-container">
            {stories.map((_, index) => (
              <div key={index} className={`stories-progress-bar ${index < currentStoryIndex ? "completed" : ""}`}>
                {index === currentStoryIndex && (
                  <div className="stories-progress-fill" style={{ width: `${progress}%` }} />
                )}
              </div>
            ))}
          </div>
          <div className="stories-user-info">
            <img
              src={currentStory.user.profilePicture || "/placeholder.svg?height=40&width=40"}
              alt={currentStory.user.username}
              className="stories-user-avatar"
            />
            <span className="stories-username">{currentStory.user.username}</span>
            <span className="stories-timestamp">
              {new Date(currentStory.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <button className="stories-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="stories-viewer-content" onClick={togglePause}>
          {currentStory.mediaType === "text" ? (
            <div
              className="stories-text-content"
              style={{
                ...getBackgroundStyle(),
                ...getFontStyle(),
              }}
            >
              {currentStory.text}
            </div>
          ) : currentStory.mediaType.startsWith("image") ? (
            <img src={currentStory.mediaUrl || "/placeholder.svg"} alt="Story" className="stories-media" />
          ) : currentStory.mediaType.startsWith("video") ? (
            <video src={currentStory.mediaUrl} className="stories-media" autoPlay muted loop />
          ) : (
            <div className="stories-text-content">{currentStory.text}</div>
          )}
        </div>

        <div className="stories-viewer-navigation">
          <div className="stories-nav-left" onClick={handlePrevStory}></div>
          <div className="stories-nav-right" onClick={handleNextStory}></div>
        </div>
      </div>

      {/* Add CSS for text stories */}
      <style jsx>{`
        .stories-text-content {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px;
          text-align: center;
          font-size: 24px;
          font-weight: bold;
          color: white;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          word-wrap: break-word;
          border-radius: 8px;
        }
      `}</style>
    </div>
  )
}

export default StoriesViewer
