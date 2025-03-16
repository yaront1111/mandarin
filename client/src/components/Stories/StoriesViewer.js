"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useStories, useUser } from "../../context"
import "../../styles/stories.css"

const StoriesViewer = ({ storyId, userId, onClose }) => {
  // Allow passing either storyId or userId to the component
  const { stories = [], viewStory, loadUserStories } = useStories() || {}
  const { user } = useUser() || {}

  const [currentStoryIndex, setCurrentStoryIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userStories, setUserStories] = useState([])

  // Use ref to hold the progress interval ID
  const progressInterval = useRef(null)
  const storyDuration = 5000 // 5 seconds per story
  const progressStep = 100 / (storyDuration / 100) // Increment per 100ms

  // Load stories for specific user if userId is provided
  useEffect(() => {
    const fetchUserStories = async () => {
      if (!userId || !loadUserStories) return

      setLoading(true)
      try {
        await loadUserStories(userId)

        // Filter stories for this user
        const userSpecificStories = stories.filter(
          story => story.user && story.user._id === userId
        )

        if (userSpecificStories.length === 0) {
          setError("No stories available for this user")
        } else {
          setUserStories(userSpecificStories)
        }
      } catch (err) {
        console.error("Error loading user stories:", err)
        setError("Failed to load stories")
      } finally {
        setLoading(false)
      }
    }

    fetchUserStories()
  }, [userId, loadUserStories, stories])

  // Set starting index based on storyId if provided
  useEffect(() => {
    if (storyId && stories && stories.length > 0) {
      const index = stories.findIndex((story) => story._id === storyId)
      if (index !== -1) {
        setCurrentStoryIndex(index)
      }
      setLoading(false)
    } else if (stories && stories.length > 0) {
      setLoading(false)
    } else if (stories && stories.length === 0) {
      setLoading(false)
      setError("No stories available")
    }
  }, [storyId, stories])

  // Determine which stories to use based on whether userId is provided
  const currentStories = userId ? userStories : stories

  // Mark story as viewed when it appears
  useEffect(() => {
    if (
      viewStory &&
      currentStories &&
      currentStories.length > 0 &&
      currentStoryIndex < currentStories.length
    ) {
      const currentStory = currentStories[currentStoryIndex]
      if (currentStory && user && !currentStory.viewers?.includes(user._id)) {
        try {
          viewStory(currentStory._id)
        } catch (err) {
          console.error("Error marking story as viewed:", err)
        }
      }
    }
  }, [currentStoryIndex, currentStories, user, viewStory])

  // Handle progress bar with foolproof cleanup using useRef
  useEffect(() => {
    // Return early and clear any existing interval if conditions are not met
    if (paused || loading || error || !currentStories || currentStories.length === 0) {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
        progressInterval.current = null
      }
      return
    }

    // Reset progress before starting a new interval
    setProgress(0)

    // Clear any existing interval
    if (progressInterval.current) {
      clearInterval(progressInterval.current)
      progressInterval.current = null
    }

    // Create a new interval to update progress
    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Immediately clear the interval to stop further updates
          if (progressInterval.current) {
            clearInterval(progressInterval.current)
            progressInterval.current = null
          }
          // Move to the next story if available, otherwise close
          if (currentStories && currentStoryIndex < currentStories.length - 1) {
            setCurrentStoryIndex((prev) => prev + 1)
          } else {
            if (typeof onClose === "function") onClose()
          }
          return 0
        }
        return prev + progressStep
      })
    }, 100)

    // Cleanup: ensure interval is cleared when dependencies change or component unmounts
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
        progressInterval.current = null
      }
    }
  }, [currentStoryIndex, currentStories, paused, onClose, progressStep, loading, error])

  const handlePrevStory = useCallback(
    (e) => {
      if (e) e.stopPropagation()
      if (currentStoryIndex > 0) {
        setCurrentStoryIndex((prev) => prev - 1)
        setProgress(0)
      }
    },
    [currentStoryIndex]
  )

  const handleNextStory = useCallback(
    (e) => {
      if (e) e.stopPropagation()
      if (currentStories && currentStoryIndex < currentStories.length - 1) {
        setCurrentStoryIndex((prev) => prev + 1)
        setProgress(0)
      } else {
        if (typeof onClose === "function") onClose()
      }
    },
    [currentStoryIndex, currentStories, onClose]
  )

  const togglePause = useCallback((e) => {
    e.stopPropagation()
    setPaused((prev) => !prev)
  }, [])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") {
        handlePrevStory()
      } else if (e.key === "ArrowRight" || e.key === " " || e.key === "Spacebar") {
        handleNextStory()
      } else if (e.key === "Escape") {
        if (typeof onClose === "function") onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handlePrevStory, handleNextStory, onClose])

  const handleClose = () => {
    if (typeof onClose === "function") onClose()
  }

  if (loading) {
    return (
      <div className="stories-viewer-overlay">
        <div className="stories-viewer-container" style={{ justifyContent: "center", alignItems: "center" }}>
          <div className="spinner"></div>
          <p style={{ color: "white", marginTop: "10px" }}>Loading stories...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="stories-viewer-overlay">
        <div className="stories-viewer-container" style={{ justifyContent: "center", alignItems: "center" }}>
          <p style={{ color: "white" }}>{error}</p>
          <button
            onClick={handleClose}
            style={{
              marginTop: "20px",
              padding: "10px 20px",
              background: "#ff3366",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  if (!currentStories || currentStories.length === 0 || currentStoryIndex >= currentStories.length) {
    return (
      <div className="stories-viewer-overlay">
        <div className="stories-viewer-container" style={{ justifyContent: "center", alignItems: "center" }}>
          <p style={{ color: "white" }}>No stories available</p>
          <button
            onClick={handleClose}
            style={{
              marginTop: "20px",
              padding: "10px 20px",
              background: "#ff3366",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  const currentStory = currentStories[currentStoryIndex]

  if (!currentStory) {
    return (
      <div className="stories-viewer-overlay">
        <div className="stories-viewer-container" style={{ justifyContent: "center", alignItems: "center" }}>
          <p style={{ color: "white" }}>Story not available</p>
          <button
            onClick={handleClose}
            style={{
              marginTop: "20px",
              padding: "10px 20px",
              background: "#ff3366",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  // Utility functions for styling text stories
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

  const getFontStyle = () => {
    if (currentStory.mediaType === "text" && currentStory.fontStyle) {
      return { fontFamily: currentStory.fontStyle }
    }
    return {}
  }

  const getUsername = () => {
    return currentStory.user?.username || "User"
  }

  const getProfilePicture = () => {
    return currentStory.user?.profilePicture || "/placeholder.svg?height=40&width=40"
  }

  const formatTimestamp = () => {
    try {
      return new Date(currentStory.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch (e) {
      return "Recently"
    }
  }

  return (
    <div className="stories-viewer-overlay">
      <div className="stories-viewer-container">
        <div className="stories-viewer-header">
          <div className="stories-progress-container">
            {currentStories.map((_, index) => (
              <div key={index} className={`stories-progress-bar ${index < currentStoryIndex ? "completed" : ""}`}>
                {index === currentStoryIndex && <div className="stories-progress-fill" style={{ width: `${progress}%` }} />}
              </div>
            ))}
          </div>
          <div className="stories-user-info">
            <img src={getProfilePicture()} alt={getUsername()} className="stories-user-avatar" />
            <span className="stories-username">{getUsername()}</span>
            <span className="stories-timestamp">{formatTimestamp()}</span>
          </div>
          <button className="stories-close-btn" onClick={handleClose} aria-label="Close stories">
            ×
          </button>
        </div>

        <div className="stories-viewer-content" onClick={togglePause}>
          {currentStory.mediaType === "text" ? (
            <div className="stories-text-content" style={{ ...getBackgroundStyle(), ...getFontStyle() }}>
              {currentStory.text}
              {paused && (
                <div className="pause-indicator">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              )}
            </div>
          ) : currentStory.mediaType?.startsWith("image") ? (
            <div className="stories-image-container">
              <img
                src={currentStory.mediaUrl || "/placeholder.svg"}
                alt="Story"
                className="stories-media"
                onError={(e) => {
                  e.target.onerror = null
                  e.target.src = "/placeholder.svg"
                }}
              />
              {paused && (
                <div className="pause-indicator">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              )}
            </div>
          ) : currentStory.mediaType?.startsWith("video") ? (
            <div className="stories-video-container">
              <video
                src={currentStory.mediaUrl}
                className="stories-media"
                autoPlay
                muted
                loop
                playsInline
                onError={(e) => {
                  e.target.onerror = null
                  console.error("Video failed to load:", e)
                }}
              />
              {paused && (
                <div className="pause-indicator">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              )}
            </div>
          ) : (
            <div className="stories-text-content">
              <p>{currentStory.text || "No content available"}</p>
              {paused && (
                <div className="pause-indicator">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="stories-viewer-navigation">
          <div className="stories-nav-left" onClick={handlePrevStory}></div>
          <div className="stories-nav-right" onClick={handleNextStory}></div>
        </div>
      </div>
    </div>
  )
}

export default StoriesViewer
