

import { useState, useEffect, useRef, useCallback } from "react"
import { useStories, useUser } from "../../context"
import "../../styles/stories.css"

const StoriesViewer = ({ storyId, userId, onClose }) => {
  // Context hooks
  const { stories = [], viewStory, loadUserStories, loadStories } = useStories() || {}
  const { user } = useUser() || {}

  // Local state
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [userStories, setUserStories] = useState([])

  // Progress logic
  const progressInterval = useRef(null)
  const storyDuration = 5000 // 5 seconds
  const progressStep = 100 / (storyDuration / 100)

  // Ensure all stories are loaded if needed
  useEffect(() => {
    if ((!stories || !stories.length) && loadStories) {
      // Optionally fetch all stories if you want
      // loadStories(true).catch(err => console.error("Error loading stories:", err))
    }
  }, [stories, loadStories])

  // Load user stories if userId is provided
  useEffect(() => {
    const fetchUserStories = async () => {
      if (!userId || !loadUserStories) return
      setLoading(true)
      try {
        const result = await loadUserStories(userId)
        const uniqueStories = []
        const storyIds = new Set()

        // Filter or unify
        const filtered = Array.isArray(result)
          ? result
          : stories.filter(st => {
              const stUserId = typeof st.user === "string" ? st.user : st.user?._id
              return stUserId === userId
            })

        filtered.forEach(st => {
          if (st._id && !storyIds.has(st._id)) {
            storyIds.add(st._id)
            uniqueStories.push(st)
          }
        })

        if (!uniqueStories.length) {
          setError("No stories available for this user")
        }
        setUserStories(uniqueStories)
      } catch (err) {
        console.error("Error loading user stories:", err)
        setError("Failed to load stories")
      } finally {
        setLoading(false)
      }
    }
    fetchUserStories()
  }, [userId, loadUserStories, stories])

  // If storyId is provided, find its index
  useEffect(() => {
    if (storyId && (userId ? userStories : stories).length) {
      const currentArray = userId ? userStories : stories
      const idx = currentArray.findIndex(st => st._id === storyId)
      if (idx !== -1) {
        setCurrentStoryIndex(idx)
      }
    }
  }, [storyId, userId, userStories, stories])

  // Decide which stories to display
  const currentStories = userId ? userStories : stories

  // Mark story as viewed
  useEffect(() => {
    if (!viewStory || !currentStories.length) return
    const currentStory = currentStories[currentStoryIndex]
    if (currentStory && user && currentStory._id) {
      viewStory(currentStory._id).catch(err => {
        console.error("Error marking story as viewed:", err)
      })
    }
  }, [currentStoryIndex, currentStories, user, viewStory])

  // Progress bar auto-advance
  useEffect(() => {
    if (paused || loading || error || !currentStories.length) {
      // Clear progress interval if not active
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
        progressInterval.current = null
      }
      return
    }

    // Start fresh
    setProgress(0)
    if (progressInterval.current) {
      clearInterval(progressInterval.current)
      progressInterval.current = null
    }

    // Interval logic
    progressInterval.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval.current)
          progressInterval.current = null
          if (currentStoryIndex < currentStories.length - 1) {
            setCurrentStoryIndex(prev => prev + 1)
          } else {
            onClose?.()
          }
          return 0
        }
        return prev + progressStep
      })
    }, 100)

    // Cleanup
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
        progressInterval.current = null
      }
    }
  }, [
    currentStoryIndex,
    currentStories,
    paused,
    onClose,
    loading,
    error,
    progressStep
  ])

  // Handlers
  const handlePrevStory = useCallback(
    (e) => {
      e?.stopPropagation()
      if (currentStoryIndex > 0) {
        setCurrentStoryIndex(i => i - 1)
        setProgress(0)
      }
    },
    [currentStoryIndex]
  )

  const handleNextStory = useCallback(
    (e) => {
      e?.stopPropagation()
      if (currentStoryIndex < currentStories.length - 1) {
        setCurrentStoryIndex(i => i + 1)
        setProgress(0)
      } else {
        onClose?.()
      }
    },
    [currentStoryIndex, currentStories, onClose]
  )

  const togglePause = useCallback(e => {
    e.stopPropagation()
    setPaused(p => !p)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const keyHandler = (e) => {
      if (e.key === "ArrowLeft") {
        handlePrevStory()
      } else if (e.key === "ArrowRight" || e.key === " " || e.key === "Spacebar") {
        handleNextStory()
      } else if (e.key === "Escape") {
        onClose?.()
      }
    }
    document.addEventListener("keydown", keyHandler)
    return () => document.removeEventListener("keydown", keyHandler)
  }, [handlePrevStory, handleNextStory, onClose])

  const handleClose = () => onClose?.()

  // Loading or Error states
  if (loading) {
    return (
      <div className="stories-viewer-overlay">
        <div className="stories-viewer-container" style={{ justifyContent: "center", alignItems: "center" }}>
          <div className="spinner"></div>
          <p style={{ color: "white" }}>Loading stories...</p>
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

  // No stories found or out of range
  if (!currentStories.length || currentStoryIndex >= currentStories.length) {
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

  // Helpers
  const getUserDisplayName = () => {
    const storyUser = currentStory.user || currentStory.userData || {}
    if (!storyUser || typeof storyUser === "string") return "Unknown User"
    return storyUser.nickname || storyUser.username || storyUser.name || "User"
  }

  const getProfilePicture = () => {
    const storyUser = currentStory.user || currentStory.userData || {}
    if (!storyUser || typeof storyUser === "string") {
      return `/api/avatar/default`
    }
    return storyUser.profilePicture || storyUser.avatar || `/api/avatar/${storyUser._id || "default"}`
  }

  const formatTimestamp = () => {
    try {
      return new Date(currentStory.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return "Recently"
    }
  }

  // Render content
  const getStoryContent = () => {
    // TEXT
    if (
      currentStory.mediaType === "text" ||
      currentStory.type === "text"
    ) {
      const styleProps = {}
      if (currentStory.backgroundStyle) {
        styleProps.background = currentStory.backgroundStyle
      } else if (currentStory.backgroundColor) {
        styleProps.background = currentStory.backgroundColor
      }
      if (currentStory.fontStyle) {
        styleProps.fontFamily = currentStory.fontStyle
      }

      return (
        <div className="stories-text-content" style={styleProps}>
          <div className="story-user-overlay">
            <span className="story-nickname">{getUserDisplayName()}</span>
          </div>
          {currentStory.text || currentStory.content}
          {paused && (
            <div className="pause-indicator">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </div>
      )
    }

    // IMAGE
    if (
      (currentStory.mediaType?.startsWith("image") || currentStory.type === "image") &&
      (currentStory.mediaUrl || currentStory.media)
    ) {
      return (
        <div className="stories-image-container">
          <div className="story-user-overlay">
            <span className="story-nickname">{getUserDisplayName()}</span>
          </div>
          <img
            src={currentStory.mediaUrl || currentStory.media || "/placeholder.svg"}
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
      )
    }

    // VIDEO
    if (
      (currentStory.mediaType?.startsWith("video") || currentStory.type === "video") &&
      (currentStory.mediaUrl || currentStory.media)
    ) {
      return (
        <div className="stories-video-container">
          <div className="story-user-overlay">
            <span className="story-nickname">{getUserDisplayName()}</span>
          </div>
          <video
            src={currentStory.mediaUrl || currentStory.media}
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
      )
    }

    // Fallback
    return (
      <div className="stories-text-content">
        <div className="story-user-overlay">
          <span className="story-nickname">{getUserDisplayName()}</span>
        </div>
        <p>{currentStory.text || currentStory.content || "No content available"}</p>
        {paused && (
          <div className="pause-indicator">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="stories-viewer-overlay">
      <div className="stories-viewer-container">
        <div className="stories-viewer-header">
          {/* Progress bars */}
          <div className="stories-progress-container">
            {currentStories.map((_, index) => (
              <div
                key={index}
                className={`stories-progress-bar ${index < currentStoryIndex ? "completed" : ""}`}
              >
                {index === currentStoryIndex && (
                  <div className="stories-progress-fill" style={{ width: `${progress}%` }} />
                )}
              </div>
            ))}
          </div>

          {/* User info */}
          <div className="stories-user-info">
            <img
              src={getProfilePicture()}
              alt={getUserDisplayName()}
              className="stories-user-avatar"
              onError={(e) => {
                e.target.onerror = null
                e.target.src = "/placeholder.svg"
              }}
            />
            <div className="stories-user-details">
              <span className="stories-username">{getUserDisplayName()}</span>
              <span className="stories-timestamp">{formatTimestamp()}</span>
            </div>
          </div>

          {/* Close button */}
          <button
            className="stories-close-btn"
            onClick={handleClose}
            aria-label="Close stories"
          >
            ×
          </button>
        </div>

        <div className="stories-viewer-content" onClick={togglePause}>
          {getStoryContent()}
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
