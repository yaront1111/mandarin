"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useStories } from "../../context"
import StoryThumbnail from "./StoryThumbnail"
import styles from "../../styles/stories.module.css"

// Improved throttle function with proper cleanup
const throttle = (func, limit) => {
  let lastFunc
  let lastRan
  return function() {
    const context = this
    const args = arguments
    if (!lastRan) {
      func.apply(context, args)
      lastRan = Date.now()
    } else {
      clearTimeout(lastFunc)
      lastFunc = setTimeout(function() {
        if ((Date.now() - lastRan) >= limit) {
          func.apply(context, args)
          lastRan = Date.now()
        }
      }, limit - (Date.now() - lastRan))
    }
  }
}

const StoriesCarousel = ({ onStoryClick }) => {
  const storiesContext = useStories() || {}
  const { stories = [], loadStories, loading: contextLoading, hasUnviewedStories } = storiesContext
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [processedStories, setProcessedStories] = useState([])
  const [loadAttempted, setLoadAttempted] = useState(false)
  const loadingRef = useRef(false)
  const carouselRef = useRef(null)
  const touchStartXRef = useRef(0)
  const isTouchActiveRef = useRef(false)

  // Add some mock "coming soon" stories
  const comingSoonStories = [
    {
      id: "coming-soon-video",
      mediaType: "video",
      user: {
        id: "video-user",
        nickname: "Video Stories"
      }
    },
    {
      id: "coming-soon-image",
      mediaType: "image",
      user: {
        id: "image-user",
        nickname: "Image Stories"
      }
    }
  ];

  // Process stories to remove duplicates and ensure proper data structure
  useEffect(() => {
    if (stories && stories.length > 0) {
      const uniqueStories = []
      const storyIds = new Set()
      const userIds = new Set()

      // First, collect unique stories by ID
      stories.forEach((story) => {
        if (story && story.id && !storyIds.has(story.id)) {
          storyIds.add(story.id)
          uniqueStories.push(story)
        }
      })

      // Then, ensure we only show one entry per user (the most recent story)
      const userStories = []

      // Sort stories by creation date (most recent first)
      const sortedStories = [...uniqueStories].sort((a, b) => {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      })

      sortedStories.forEach((story) => {
        // Get the user ID regardless of whether it's a string or object
        const userId = story.user
          ? typeof story.user === "string"
            ? story.user
            : story.user.id
          : story.userData
            ? story.userData.id
            : null

        if (userId && !userIds.has(userId)) {
          userIds.add(userId)
          userStories.push(story)
        }
      })

      // Add "coming soon" stories
      const allStories = [...userStories, ...comingSoonStories];
      setProcessedStories(allStories)
    } else {
      // If no stories, just show the coming soon stories
      setProcessedStories(comingSoonStories)
    }
  }, [stories])

  // Load stories when component mounts, with throttling
  useEffect(() => {
    const loadStoriesData = async () => {
      // Prevent redundant loading
      if (loadingRef.current) return

      loadingRef.current = true
      setLoading(true)
      setError(null)

      try {
        // Check if loadStories exists before calling it
        if (typeof loadStories === "function") {
          await loadStories(false) // Don't force refresh on initial load
        } else {
          console.warn("Stories functionality is not available - loadStories function not found")
        }
      } catch (error) {
        console.error("Error loading stories:", error)
        setError("Failed to load stories")
      } finally {
        setLoading(false)
        loadingRef.current = false
        setLoadAttempted(true)
      }
    }

    // Only load if we haven't attempted already
    if (!loadAttempted && !loadingRef.current && typeof loadStories === "function") {
      loadStoriesData()
    }
  }, [loadStories, loadAttempted])

  // Safely handle story click with proper throttling
  const handleStoryClick = useCallback(
    throttle((storyId) => {
      if (typeof onStoryClick === "function") {
        onStoryClick(storyId)
      } else {
        console.warn("Story click handler not provided")
      }
    }, 300), // Throttle to 300ms
    [onStoryClick],
  )

  // Scroll carousel left/right
  const scrollCarousel = useCallback((direction) => {
    if (!carouselRef.current) return

    const scrollAmount = 300 // Adjust as needed
    const currentScroll = carouselRef.current.scrollLeft

    carouselRef.current.scrollTo({
      left: direction === "right" ? currentScroll + scrollAmount : currentScroll - scrollAmount,
      behavior: "smooth",
    })
  }, [])

  // Touch event handlers for mobile swipe
  const handleTouchStart = useCallback((e) => {
    touchStartXRef.current = e.touches[0].clientX
    isTouchActiveRef.current = true
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (!isTouchActiveRef.current) return
    // Prevent default to disable browser scroll when swiping stories
    e.preventDefault()
  }, [])

  const handleTouchEnd = useCallback((e) => {
    if (!isTouchActiveRef.current) return

    const touchEndX = e.changedTouches[0].clientX
    const diffX = touchStartXRef.current - touchEndX

    // Threshold for considering it a swipe (20px)
    if (Math.abs(diffX) > 20) {
      if (diffX > 0) {
        // Swipe left, scroll right
        scrollCarousel("right")
      } else {
        // Swipe right, scroll left
        scrollCarousel("left")
      }
    }

    isTouchActiveRef.current = false
  }, [scrollCarousel])

  // Setup touch events for the carousel
  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) return

    carousel.addEventListener('touchstart', handleTouchStart, { passive: false })
    carousel.addEventListener('touchmove', handleTouchMove, { passive: false })
    carousel.addEventListener('touchend', handleTouchEnd)

    return () => {
      carousel.removeEventListener('touchstart', handleTouchStart)
      carousel.removeEventListener('touchmove', handleTouchMove)
      carousel.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  // Generate memoized thumbnail components
  const storyThumbnails = useMemo(() => {
    return processedStories.map((story) => (
      <StoryThumbnail
        key={story.id || `story-${Math.random()}`}
        story={story}
        onClick={() => handleStoryClick(story.id)}
        hasUnviewedStories={
          typeof hasUnviewedStories === "function" && story.user
            ? hasUnviewedStories(typeof story.user === "string" ? story.user : story.user.id)
            : false
        }
        mediaType={story.mediaType}
      />
    ))
  }, [processedStories, handleStoryClick, hasUnviewedStories])

  // Show loading state
  if ((loading || contextLoading) && !loadAttempted) {
    return (
      <div className={styles.storiesCarouselContainer}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Loading stories...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className={styles.storiesCarouselContainer}>
        <div className={styles.errorContainer}>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  // Render stories carousel
  return (
    <div className={styles.storiesCarouselContainer} role="region" aria-label="Stories">
      {processedStories.length > 4 && (
        <button
          className={`${styles.carouselNavButton} ${styles.carouselNavButtonLeft}`}
          onClick={() => scrollCarousel("left")}
          aria-label="Scroll stories left"
        >
          ‹
        </button>
      )}

      <div
        className={styles.storiesCarousel}
        ref={carouselRef}
        style={{ overscrollBehavior: 'contain' }}
      >
        {storyThumbnails}
      </div>

      {processedStories.length > 4 && (
        <button
          className={`${styles.carouselNavButton} ${styles.carouselNavButtonRight}`}
          onClick={() => scrollCarousel("right")}
          aria-label="Scroll stories right"
        >
          ›
        </button>
      )}
    </div>
  )
}

export default StoriesCarousel
