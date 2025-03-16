"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useStories, useUser } from "../../context"
import "../../styles/stories.css"

const StoriesViewer = ({ storyId, onClose }) => {
  const { stories, viewStory } = useStories()
  const { user } = useUser()
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
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
      setLoading(false)
    } else if (stories && stories.length > 0) {
      setLoading(false)
    } else if (stories && stories.length === 0) {
      setLoading(false)
      setError("No stories available")
    }
  }, [storyId, stories])

  // Mark story as viewed
  useEffect(() => {
    if (stories && stories.length > 0 && currentStoryIndex < stories.length) {
      const currentStory = stories[currentStoryIndex]
      if (currentStory && user && !currentStory.viewers?.includes(user._id)) {
        try {
          viewStory(currentStory._id)
        } catch (err) {
          console.error("Error marking story as viewed:", err)
        }
      }
    }
  }, [currentStoryIndex, stories, user, viewStory])

  // Handle progress bar
  useEffect(() => {
    if (paused || loading || error) return

    setProgress(0)

    if (progressInterval.current) {
      clearInterval(progressInterval.current)
    }

    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval.current)
          // Move to next story
          if (stories && currentStoryIndex < stories.length - 1) {
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
  }, [currentStoryIndex, stories, paused, onClose, progressStep, loading, error])

  const handlePrevStory = useCallback((e) => {
    if (e) e.stopPropagation()
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex((prev) => prev - 1)
      setProgress(0)
    }
  }, [currentStoryIndex])

  const handleNextStory = useCallback((e) => {
    if (e) e.stopPropagation()
    if (stories && currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex((prev) => prev + 1)
      setProgress(0)
    } else {
      onClose()
    }
  }, [currentStoryIndex, stories, onClose])

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
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handlePrevStory, handleNextStory, onClose])

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
            onClick={onClose}
            style={{ marginTop: "20px", padding: "10px 20px", background: "#ff3366", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  if (!stories || stories.length === 0 || currentStoryIndex >= stories.length) {
    return (
      <div className="stories-viewer-overlay">
        <div className="stories-viewer-container" style={{ justifyContent: "center", alignItems: "center" }}>
          <p style={{ color: "white" }}>No stories available</p>
          <button
            onClick={onClose}
            style={{ marginTop: "20px", padding: "10px 20px", background: "#ff3366", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
          >
            Close
          </button>
        </div>
      </div>
    )
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
              src={currentStory.user?.profilePicture || "/placeholder.svg?height=40&width=40"}
              alt={currentStory.user?.username || "User"}
              className="stories-user-avatar"
            />
            <span className="stories-username">{currentStory.user?.username || "User"}</span>
            <span className="stories-timestamp">
              {new Date(currentStory.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <button className="stories-close-btn" onClick={onClose} aria-label="Close stories">
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
                  e.target.onerror = null;
                  e.target.src = "/placeholder.svg";
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
                  e.target.onerror = null;
                  console.error("Video failed to load:", e);
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
          position: relative;
        }
        
        .stories-image-container,
        .stories-video-container {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        
        .pause-indicator {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: rgba(0, 0, 0, 0.5);
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.8;
          }
          70% {
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  )
}

export default StoriesViewer
