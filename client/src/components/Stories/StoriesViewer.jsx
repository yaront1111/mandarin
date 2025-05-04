"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useStories, useUser, useAuth } from "../../context"
import { FaHeart, FaRegHeart, FaComment, FaShare, FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaTimes } from "react-icons/fa"
import { toast } from "react-toastify"
import styles from "../../styles/stories.module.css"
import logger from "../../utils/logger"
import Avatar from "../common/Avatar"

const log = logger.create("StoriesViewer")

const StoriesViewer = ({ storyId, userId, onClose }) => {
  // Context hooks
  const { stories = [], viewStory, loadUserStories, loadStories, reactToStory } = useStories() || {}
  const { user: contextUser } = useUser() || {}
  const { user: authUser, isAuthenticated } = useAuth() || {}

  // Use a combined user reference that tries both contexts
  const user = authUser || contextUser

  // Local state
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [userStories, setUserStories] = useState([])
  const [muted, setMuted] = useState(true)
  const [reacted, setReacted] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [actionClicked, setActionClicked] = useState(false)
  const [longPressActive, setLongPressActive] = useState(false)
  const [doubleTapCoords, setDoubleTapCoords] = useState({ x: 0, y: 0 })
  const [showHeartAnimation, setShowHeartAnimation] = useState(false)

  // Progress logic
  const progressInterval = useRef(null)
  const storyDuration = 5000 // 5 seconds
  const progressStep = 100 / (storyDuration / 100)
  const videoRef = useRef(null)
  const actionsRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 })
  const lastTapRef = useRef(0)

  // Define currentStories BEFORE any useEffects that depend on it
  const currentStories = userId ? userStories : stories

  // Ensure all stories are loaded if needed
  useEffect(() => {
    if ((!stories || !stories.length) && loadStories) {
      loadStories(true).catch((err) => log.error("Error loading stories:", err))
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
          : stories.filter((st) => {
              const stUserId = typeof st.user === "string" ? st.user : st.user?._id
              return stUserId === userId
            })

        filtered.forEach((st) => {
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
        log.error("Error loading user stories:", err)
        setError("Failed to load stories")
      } finally {
        setLoading(false)
      }
    }
    fetchUserStories()
  }, [userId, loadUserStories, stories])

  // Set initial reaction state based on the current story
  useEffect(() => {
    if (currentStories.length > 0 && currentStoryIndex >= 0 && currentStoryIndex < currentStories.length) {
      const current = currentStories[currentStoryIndex]

      // Check if user has already reacted to this story
      if (current && current.reactions && Array.isArray(current.reactions) && user) {
        const hasReacted = current.reactions.some(
          (reaction) => reaction.user === user._id || (reaction.user && reaction.user._id === user._id),
        )
        setReacted(hasReacted)
      } else {
        setReacted(false)
      }
    }
  }, [currentStoryIndex, currentStories, user])

  // If storyId is provided, find its index
  useEffect(() => {
    if (storyId && (userId ? userStories : stories).length) {
      const currentArray = userId ? userStories : stories
      const idx = currentArray.findIndex((st) => st._id === storyId)
      if (idx !== -1) {
        setCurrentStoryIndex(idx)
      }
    }
  }, [storyId, userId, userStories, stories])

  // Mark story as viewed
  useEffect(() => {
    if (!viewStory || !currentStories.length) return
    const currentStory = currentStories[currentStoryIndex]
    if (currentStory && user && currentStory._id) {
      viewStory(currentStory._id).catch((err) => {
        log.error("Error marking story as viewed:", err)
      })
    }
  }, [currentStoryIndex, currentStories, user, viewStory])

  // Handle video playback
  useEffect(() => {
    if (videoRef.current) {
      if (paused) {
        videoRef.current.pause()
      } else {
        const playPromise = videoRef.current.play()

        // Handle play promise to avoid uncaught rejection errors
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            log.error("Error playing video:", error)
            // Auto-mute and try again (common solution for autoplay issues)
            if (error.name === "NotAllowedError" && !muted) {
              setMuted(true)
              videoRef.current.muted = true
              videoRef.current.play().catch((e) => log.error("Still couldn't play even with mute:", e))
            }
          })
        }
      }
    }
  }, [paused, currentStoryIndex, muted])

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

    // For video stories, use the video duration
    const currentStory = currentStories[currentStoryIndex]
    if (currentStory && (currentStory.mediaType === "video" || currentStory.type === "video") && videoRef.current) {
      // Let the video's timeupdate event handle progress
      return
    }

    // Interval logic for non-video stories
    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval.current)
          progressInterval.current = null
          if (currentStoryIndex < currentStories.length - 1) {
            setCurrentStoryIndex((prev) => prev + 1)
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
  }, [currentStoryIndex, currentStories, paused, onClose, loading, error, progressStep])

  // Handle video timeupdate for progress
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const duration = videoRef.current.duration
      const currentTime = videoRef.current.currentTime

      if (duration > 0) {
        const progressPercent = (currentTime / duration) * 100
        setProgress(progressPercent)

        // Auto-advance when video ends
        if (progressPercent >= 99.5) {
          if (currentStoryIndex < currentStories.length - 1) {
            setCurrentStoryIndex((prev) => prev + 1)
          } else {
            onClose?.()
          }
        }
      }
    }
  }, [currentStoryIndex, currentStories.length, onClose])

  // Handlers
  const handlePrevStory = useCallback(
    (e) => {
      if (e) {
        e.stopPropagation()
        e.preventDefault()
      }

      // Don't navigate if clicking on action buttons
      if (actionClicked) {
        setActionClicked(false)
        return
      }

      // Prevent rapid clicks
      if (navigating) return

      if (currentStoryIndex > 0) {
        setNavigating(true)
        setCurrentStoryIndex((i) => i - 1)
        setProgress(0)

        // Reset navigation lock after a short delay
        setTimeout(() => setNavigating(false), 300)
      }
    },
    [currentStoryIndex, navigating, actionClicked],
  )

  const handleNextStory = useCallback(
    (e) => {
      if (e) {
        e.stopPropagation()
        e.preventDefault()
      }

      // Don't navigate if clicking on action buttons
      if (actionClicked) {
        setActionClicked(false)
        return
      }

      // Prevent rapid clicks
      if (navigating) return

      setNavigating(true)

      if (currentStoryIndex < currentStories.length - 1) {
        setCurrentStoryIndex((i) => i + 1)
        setProgress(0)
      } else {
        onClose?.()
      }

      // Reset navigation lock after a short delay
      setTimeout(() => setNavigating(false), 300)
    },
    [currentStoryIndex, currentStories, onClose, navigating, actionClicked],
  )

  const toggleMute = useCallback((e) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }

    // Prevent navigation because an action was clicked
    setActionClicked(true)

    setMuted((prevMuted) => {
      const newMuted = !prevMuted

      // Update video element muted state directly
      if (videoRef.current) {
        videoRef.current.muted = newMuted
      }

      return newMuted
    })

    // Reset action clicked status after a delay
    setTimeout(() => setActionClicked(false), 300)
  }, [])

  const handleReact = useCallback(
    (e) => {
      if (e) {
        e.stopPropagation()
        e.preventDefault()
      }

      // Prevent navigation because an action was clicked
      setActionClicked(true)

      // Prevent already reacted case
      if (reacted) {
        setTimeout(() => setActionClicked(false), 300)
        return
      }

      // Check if user is authenticated using isAuthenticated from AuthContext
      if (!isAuthenticated || !user) {
        toast.error("You must be logged in to react to stories")
        setTimeout(() => setActionClicked(false), 300)
        return
      }

      if (!currentStories || currentStoryIndex >= currentStories.length) {
        setTimeout(() => setActionClicked(false), 300)
        return
      }

      const currentStory = currentStories[currentStoryIndex]
      if (!currentStory || !currentStory._id) {
        setTimeout(() => setActionClicked(false), 300)
        return
      }

      const storyId = currentStory._id
      if (storyId && reactToStory) {
        // Set immediately to prevent double-clicks
        setReacted(true)

        // Call the API
        reactToStory(storyId, "like")
          .then((response) => {
            if (!response || !response.success) {
              throw new Error(response?.message || "Failed to react to story")
            }

            // Update the local story data with the new reaction
            if (response.data && Array.isArray(response.data)) {
              // Find the current story and update its reactions
              const updatedStories = [...currentStories]
              if (updatedStories[currentStoryIndex]) {
                updatedStories[currentStoryIndex].reactions = response.data

                // If we're viewing user stories, update that array
                if (userId) {
                  setUserStories(updatedStories)
                }
              }
            }
          })
          .catch((error) => {
            log.error("Error reacting to story:", error)
            setReacted(false) // Reset on error
            toast.error("Failed to react to story")
          })
          .finally(() => {
            setTimeout(() => setActionClicked(false), 300)
          })
      } else {
        setTimeout(() => setActionClicked(false), 300)
      }
    },
    [user, isAuthenticated, currentStories, currentStoryIndex, reactToStory, reacted, userId],
  )

  const togglePause = useCallback((e) => {
    // Only toggle pause if not clicked in the action buttons area
    if (e && actionsRef.current && actionsRef.current.contains(e.target)) {
      return
    }

    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }

    setPaused((prevPaused) => !prevPaused)
  }, [])

  // Touch event handlers
  const handleTouchStart = useCallback((e) => {
    // Store touch start position and time
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    }

    // Start timer for long press
    longPressTimerRef.current = setTimeout(() => {
      setLongPressActive(true)
      setPaused(true)
    }, 500) // 500ms for long press
  }, [])

  const handleTouchMove = useCallback((e) => {
    // If significant movement, cancel long press
    const currentX = e.touches[0].clientX
    const currentY = e.touches[0].clientY
    const startX = touchStartRef.current.x
    const startY = touchStartRef.current.y

    const deltaX = Math.abs(currentX - startX)
    const deltaY = Math.abs(currentY - startY)

    // If moved more than 10px, cancel long press
    if (deltaX > 10 || deltaY > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    }
  }, [])

  const handleTouchEnd = useCallback((e) => {
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    // Handle long press end
    if (longPressActive) {
      setLongPressActive(false)
      setPaused(false)
      return
    }

    // Get touch end position
    const touchEndX = e.changedTouches[0].clientX
    const touchEndY = e.changedTouches[0].clientY
    const touchStartX = touchStartRef.current.x
    const touchStartY = touchStartRef.current.y

    // Calculate deltas
    const deltaX = touchStartX - touchEndX
    const deltaY = touchStartY - touchEndY
    const touchDuration = Date.now() - touchStartRef.current.time

    // Check for double tap (heart reaction)
    const currentTime = Date.now()
    const tapLength = currentTime - lastTapRef.current

    if (tapLength < 300 && tapLength > 0 && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      // Double tap detected - like the story if not already liked
      if (!reacted) {
        setDoubleTapCoords({
          x: touchEndX,
          y: touchEndY
        })
        setShowHeartAnimation(true)

        // Hide heart animation after 1 second
        setTimeout(() => {
          setShowHeartAnimation(false)
        }, 1000)

        // Like the story
        handleReact(e)
      }
      lastTapRef.current = 0 // Reset for next sequence
    } else {
      // Handle swipe navigation
      if (touchDuration < 300) { // Only consider quick swipes
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
          // Horizontal swipe
          if (deltaX > 0) {
            // Swipe left = next story
            handleNextStory(e)
          } else {
            // Swipe right = previous story
            handlePrevStory(e)
          }
        } else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 50) {
          // Vertical swipe
          if (deltaY > 0) {
            // Swipe up - could add functionality here
          } else {
            // Swipe down = close
            onClose?.()
          }
        } else {
          // Simple tap - toggle pause
          togglePause(e)
        }
      }

      // Update last tap time for double-tap detection
      lastTapRef.current = currentTime
    }
  }, [handleNextStory, handlePrevStory, handleReact, onClose, togglePause, longPressActive, reacted])

  // Keyboard navigation
  useEffect(() => {
    const keyHandler = (e) => {
      if (navigating) return // Prevent rapid keypresses

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
  }, [handlePrevStory, handleNextStory, onClose, navigating])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
      }
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
    }
  }, [])

  const handleClose = useCallback(() => onClose?.(), [onClose])

  // Extract current story if available
  const currentStory = useMemo(() => {
    if (currentStories && currentStories.length > 0 && currentStoryIndex < currentStories.length) {
      return currentStories[currentStoryIndex];
    }
    return null;
  }, [currentStories, currentStoryIndex]);

  // Get user display name
  const getUserDisplayName = useCallback(() => {
    if (!currentStories || !currentStories.length || currentStoryIndex >= currentStories.length) {
      return "Unknown User";
    }
    const story = currentStories[currentStoryIndex];
    if (!story) return "Unknown User";

    const storyUser = story.user || story.userData || {};
    if (!storyUser || typeof storyUser === "string") return "Unknown User";
    return storyUser.nickname || storyUser.username || storyUser.name || "User";
  }, [currentStories, currentStoryIndex]);

  // Get profile picture
  const profilePicture = useCallback(() => {
    if (!currentStories || !currentStories.length || currentStoryIndex >= currentStories.length) {
      return `/api/avatars/default`;
    }
    const story = currentStories[currentStoryIndex];
    if (!story) return `/api/avatars/default`;

    const storyUser = story.user || story.userData || {};
    if (!storyUser || typeof storyUser === "string") {
      return `/api/avatars/default`;
    }
    return storyUser.profilePicture || storyUser.avatar || `/api/avatars/${storyUser._id || "default"}`;
  }, [currentStories, currentStoryIndex]);

  // Format timestamp
  const formatTimestamp = useCallback(() => {
    if (!currentStories || !currentStories.length || currentStoryIndex >= currentStories.length) {
      return "Recently";
    }

    const story = currentStories[currentStoryIndex];
    if (!story || !story.createdAt) return "Recently";

    try {
      return new Date(story.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  }, [currentStories, currentStoryIndex]);

  // Story content renderer
  const storyContent = useCallback(() => {
    // Guard against missing story data
    if (!currentStories || !currentStories.length || currentStoryIndex >= currentStories.length) {
      return (
        <div className={styles.storiesTextContent}>
          <p>No story available</p>
        </div>
      );
    }

    const story = currentStories[currentStoryIndex];
    if (!story) {
      return (
        <div className={styles.storiesTextContent}>
          <p>Story not found</p>
        </div>
      );
    }

    // Handle text stories
    if (story.mediaType === "text" || story.type === "text") {
      const styleProps = {};
      if (story.backgroundStyle) {
        styleProps.background = story.backgroundStyle;
      } else if (story.backgroundColor) {
        styleProps.background = story.backgroundColor;
      }
      if (story.fontStyle) {
        styleProps.fontFamily = story.fontStyle;
      }

      return (
        <div className={styles.storiesTextContent} style={styleProps}>
          <div className={styles.storyUserOverlay}>
            <span className={styles.storyNickname}>{getUserDisplayName()}</span>
          </div>
          {story.text || story.content || ""}
          {paused && (
            <div className={styles.pauseIndicator}>
              <FaPlay size={24} />
            </div>
          )}
        </div>
      );
    }

    // Handle image stories
    if (
      (story.mediaType?.startsWith("image") || story.type === "image") &&
      (story.mediaUrl || story.media)
    ) {
      const mediaUrl = story.mediaUrl || story.media;
      return (
        <div className={styles.storiesImageContainer}>
          <div className={styles.storyUserOverlay}>
            <span className={styles.storyNickname}>{getUserDisplayName()}</span>
          </div>
          <img
            src={mediaUrl || "/placeholder.svg"}
            alt="Story"
            className={styles.storiesMedia}
            crossOrigin="anonymous"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/placeholder.svg";
            }}
          />
          {paused && (
            <div className={styles.pauseIndicator}>
              <FaPlay size={24} />
            </div>
          )}
          {story.content && story.content.trim() && (
            <div className={styles.storyCaption}>{story.content}</div>
          )}
        </div>
      );
    }

    // Handle video stories
    if (
      (story.mediaType?.startsWith("video") || story.type === "video") &&
      (story.mediaUrl || story.media)
    ) {
      const mediaUrl = story.mediaUrl || story.media;
      return (
        <div className={styles.storiesVideoContainer}>
          <div className={styles.storyUserOverlay}>
            <span className={styles.storyNickname}>{getUserDisplayName()}</span>
          </div>
          <video
            ref={videoRef}
            src={mediaUrl}
            className={styles.storiesMedia}
            autoPlay
            muted={muted}
            loop={false}
            playsInline
            crossOrigin="anonymous"
            onTimeUpdate={handleTimeUpdate}
            onError={(e) => {
              log.error("Video failed to load:", e);
            }}
          />
          {paused && (
            <div className={styles.pauseIndicator}>
              <FaPlay size={24} />
            </div>
          )}
          <button
            className={styles.videoControl}
            onClick={toggleMute}
            aria-label={muted ? "Unmute video" : "Mute video"}
          >
            {muted ? <FaVolumeMute size={16} /> : <FaVolumeUp size={16} />}
          </button>
          {story.content && story.content.trim() && (
            <div className={styles.storyCaption}>{story.content}</div>
          )}
        </div>
      );
    }

    // Fallback for unknown story types
    return (
      <div className={styles.storiesTextContent}>
        <div className={styles.storyUserOverlay}>
          <span className={styles.storyNickname}>{getUserDisplayName()}</span>
        </div>
        <p>{story.text || story.content || "No content available"}</p>
        {paused && (
          <div className={styles.pauseIndicator}>
            <FaPlay size={24} />
          </div>
        )}
      </div>
    );
  }, [currentStories, currentStoryIndex, paused, muted, getUserDisplayName, handleTimeUpdate, toggleMute]);

  // Determine which view state to render
  const viewState = useMemo(() => {
    if (loading) return "loading";
    if (error) return "error";
    if (!currentStories.length || currentStoryIndex >= currentStories.length) return "empty";
    if (!currentStory) return "notAvailable";
    return "normal";
  }, [loading, error, currentStories, currentStoryIndex, currentStory]);

  // Double tap heart animation
  const heartAnimation = useMemo(() => {
    if (!showHeartAnimation) return null;

    return (
      <div
        className={styles.doubleTapHeart}
        style={{
          position: 'absolute',
          left: `${doubleTapCoords.x - 40}px`,
          top: `${doubleTapCoords.y - 40}px`,
          width: '80px',
          height: '80px',
          color: '#FD1D1D',
          fontSize: '80px',
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      >
        <FaHeart />
      </div>
    );
  }, [showHeartAnimation, doubleTapCoords]);

  // Main render with a single return statement based on view state
  if (viewState === "loading") {
    return (
      <div className={styles.storiesViewerOverlay}>
        <div className={styles.storiesViewerContainer} style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div className={styles.spinner}></div>
          <p style={{ color: "white", marginTop: "15px" }}>Loading stories...</p>
        </div>
      </div>
    );
  }

  if (viewState === "error") {
    return (
      <div className={styles.storiesViewerOverlay}>
        <div className={styles.storiesViewerContainer} style={{ justifyContent: 'center', alignItems: 'center' }}>
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
    );
  }

  if (viewState === "empty") {
    return (
      <div className={styles.storiesViewerOverlay}>
        <div className={styles.storiesViewerContainer} style={{ justifyContent: 'center', alignItems: 'center' }}>
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
    );
  }

  if (viewState === "notAvailable") {
    return (
      <div className={styles.storiesViewerOverlay}>
        <div className={styles.storiesViewerContainer} style={{ justifyContent: 'center', alignItems: 'center' }}>
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
    );
  }

  // Normal view with story content
  return (
    <div className={styles.storiesViewerOverlay}>
      <div className={styles.storiesViewerContainer}>
        <div className={styles.storiesViewerHeader}>
          {/* Progress bars */}
          <div className={styles.storiesProgressContainer}>
            {currentStories.map((_, index) => (
              <div
                key={index}
                className={`${styles.storiesProgressBar} ${index < currentStoryIndex ? "completed" : ""}`}
                aria-label={`Story ${index + 1} of ${currentStories.length}`}
                role="progressbar"
                aria-valuenow={index === currentStoryIndex ? progress : (index < currentStoryIndex ? 100 : 0)}
                aria-valuemin="0"
                aria-valuemax="100"
              >
                {index === currentStoryIndex && (
                  <div
                    className={styles.storiesProgressFill}
                    style={{ width: `${progress}%` }}
                  />
                )}
                {index < currentStoryIndex && (
                  <div
                    className={styles.storiesProgressFill}
                    style={{ width: '100%' }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* User info */}
          <div className={styles.storiesUserInfo}>
            <Avatar 
              user={
                typeof currentStory?.user === "object" 
                  ? currentStory.user 
                  : currentStory?.userData || { _id: currentStory?.user, nickname: getUserDisplayName() }
              }
              alt={getUserDisplayName()}
              className={styles.storiesUserAvatar}
              size="small"
            />
            <div className={styles.storiesUserDetails}>
              <span className={styles.storiesUsername}>{getUserDisplayName()}</span>
              <span className={styles.storiesTimestamp}>{formatTimestamp()}</span>
            </div>
          </div>

          {/* Close button */}
          <button
            className={styles.storiesCloseBtn}
            onClick={handleClose}
            aria-label="Close stories"
          >
            <FaTimes />
          </button>
        </div>

        <div
          className={styles.storiesViewerContent}
          onClick={togglePause}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {storyContent()}
          {heartAnimation}
        </div>

        <div
          className={styles.storiesViewerNavigation}
          aria-label="Story navigation"
        >
          <div
            className={styles.storiesNavLeft}
            onClick={handlePrevStory}
            aria-label="Previous story"
            role="button"
            tabIndex="0"
          ></div>
          <div
            className={styles.storiesNavRight}
            onClick={handleNextStory}
            aria-label="Next story"
            role="button"
            tabIndex="0"
          ></div>
        </div>

        {/* Story actions */}
        <div
          ref={actionsRef}
          className={styles.storiesActions}
          onClick={(e) => {
            // Prevent event bubbling
            e.stopPropagation();
            e.preventDefault();
            setActionClicked(true);
          }}
        >
          <button
            className={`${styles.storyActionButton} ${reacted ? styles.active : ""}`}
            onClick={handleReact}
            aria-label="Like story"
            aria-pressed={reacted}
          >
            {reacted ? <FaHeart size={20} /> : <FaRegHeart size={20} />}
          </button>
          <button
            className={styles.storyActionButton}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setActionClicked(true);
              toast.info("Comments feature coming soon!");
              setTimeout(() => setActionClicked(false), 300);
            }}
            aria-label="Comment on story"
          >
            <FaComment size={20} />
          </button>
          <button
            className={styles.storyActionButton}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setActionClicked(true);
              toast.info("Share feature coming soon!");
              setTimeout(() => setActionClicked(false), 300);
            }}
            aria-label="Share story"
          >
            <FaShare size={20} />
          </button>
          <button
            className={styles.storyActionButton}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setActionClicked(true);
              togglePause(e);
              setTimeout(() => setActionClicked(false), 300);
            }}
            aria-label={paused ? "Play story" : "Pause story"}
          >
            {paused ? <FaPlay size={20} /> : <FaPause size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default StoriesViewer
