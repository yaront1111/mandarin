"use client"

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useStories } from "../../context"
import StoryThumbnail from "./StoryThumbnail"
import styles from "../../styles/stories.module.css"
import logger from "../../utils/logger"

const log = logger.create("StoriesCarousel")

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
  // Remove processedStories state, we'll use useMemo instead
  const [loadAttempted, setLoadAttempted] = useState(false)
  const loadingRef = useRef(false)
  const carouselRef = useRef(null)
  const touchStartXRef = useRef(0)
  const isTouchActiveRef = useRef(false)

  // Add some mock "coming soon" stories with proper user data structure
  const comingSoonStories = [
    {
      _id: "coming-soon-video",
      mediaType: "video",
      user: {
        _id: "video-user",
        nickname: "Video Stories",
        details: {
          iAm: "man" // Add gender information for default avatar
        },
        gender: "male" // Fallback for older avatar logic
      },
      userData: {
        _id: "video-user",
        nickname: "Video Stories",
        details: {
          iAm: "man" // Add gender information for default avatar
        },
        gender: "male" // Fallback for older avatar logic
      }
    },
    {
      _id: "coming-soon-image",
      mediaType: "image",
      user: {
        _id: "image-user",
        nickname: "Image Stories",
        details: {
          iAm: "woman" // Add gender information for default avatar
        },
        gender: "female" // Fallback for older avatar logic
      },
      userData: {
        _id: "image-user",
        nickname: "Image Stories",
        details: {
          iAm: "woman" // Add gender information for default avatar
        },
        gender: "female" // Fallback for older avatar logic
      }
    }
  ];

  // Process stories to remove duplicates and ensure proper data structure
  const processedStories = useMemo(() => {
    if (stories && stories.length > 0) {
      // Log to help debug the data structure
      // if (process.env.NODE_ENV !== 'production') {
      //   console.debug('Stories from context:', stories.slice(0, 2));
      //   
      //   // Check how user data is structured in the stories
      //   if (stories.length > 0) {
      //     const sampleStory = stories[0];
      //     console.debug('Sample story user structure:', {
      //       userData: sampleStory.userData,
      //       user: sampleStory.user,
      //       userType: typeof sampleStory.user,
      //     });
      //   }
      // }
    
      const uniqueStories = []
      const storyIds = new Set()
      const userIds = new Set()

      // First, collect unique stories by ID
      stories.forEach((story) => {
        if (story && story._id && !storyIds.has(story._id)) {
          storyIds.add(story._id)
          
          // Ensure user data is properly structured
          const processedStory = { ...story };
          
          // If user is string ID but userData exists as object, ensure it has _id
          if (typeof story.user === 'string' && story.userData && !story.userData._id) {
            processedStory.userData = { 
              ...story.userData,
              _id: story.user // Add ID from the user field
            };
          }
          
          uniqueStories.push(processedStory)
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
            : story.user._id
          : story.userData
            ? story.userData._id
            : null

        if (userId && !userIds.has(userId)) {
          userIds.add(userId)
          userStories.push(story)
        }
      })

      // Add "coming soon" stories
      return [...userStories, ...comingSoonStories];
    } else {
      // If no stories, just show the coming soon stories
      return comingSoonStories;
    }
  }, [stories, comingSoonStories])

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
          log.warn("Stories functionality is not available - loadStories function not found")
        }
      } catch (error) {
        log.error("Error loading stories:", error)
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
        log.warn("Story click handler not provided")
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
    return processedStories.map((story) => {
      // For debugging - log the actual story data being passed to each thumbnail
      // if (process.env.NODE_ENV !== 'production') {
      //   console.debug(`Story ${story._id} user data in carousel:`, {
      //     user: story.user, 
      //     userData: story.userData,
      //     iAm: story.user?.details?.iAm || story.userData?.details?.iAm,
      //     hasDetails: !!story.user?.details || !!story.userData?.details
      //   });
      // }
      
      // Create a properly structured user object to pass explicitly
      const userObject = story.userData && typeof story.userData === 'object' ? story.userData :
                        (story.user && typeof story.user === 'object' ? story.user : 
                          (typeof story.user === 'string' ? { _id: story.user } : {}));
                          
      // If this is a coming soon story
      if (story._id === 'coming-soon-video' || story._id === 'coming-soon-image') {
        // Force the user to include the proper details needed for gender avatars
        userObject.details = userObject.details || {};
        userObject.details.iAm = story._id === 'coming-soon-video' ? 'man' : 'woman';
        userObject.gender = story._id === 'coming-soon-video' ? 'male' : 'female';
      }
      
      return (
        <StoryThumbnail
          key={story._id || `story-${Math.random()}`}
          story={story}
          user={userObject} // Explicitly pass the user object
          onClick={() => handleStoryClick(story._id)}
          hasUnviewedStories={
            typeof hasUnviewedStories === "function" && story.user
              ? hasUnviewedStories(typeof story.user === "string" ? story.user : story.user._id)
              : false
          }
          mediaType={story.mediaType}
        />
      );
    });
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

export default React.memo(StoriesCarousel)
