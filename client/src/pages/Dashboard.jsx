"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { FaSearch, FaThLarge, FaList, FaFilter, FaPlus, FaSpinner } from "react-icons/fa"
import { toast } from "react-toastify"
import { useTranslation } from "react-i18next"
import { useAuth, useUser, useStories, useLanguage } from "../context"
import EmbeddedChat from "../components/EmbeddedChat"
import { Navbar } from "../components/LayoutComponents"
import StoriesCarousel from "../components/Stories/StoriesCarousel"
import StoriesViewer from "../components/Stories/StoriesViewer"
import StoryCreator from "../components/Stories/StoryCreator"
import UserProfileModal from "../components/UserProfileModal"
import UserCard from "../components/UserCard" // Import the enhanced UserCard component
import styles from "../styles/dashboard.module.css" // Import the dashboard module CSS

const Dashboard = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    users,
    getUsers,
    loading,
    likeUser,
    unlikeUser,
    isUserLiked,
    likesLoading, // Added from optimized UserContext
    getLikedUsers, // Add this to the destructured values
  } = useUser()
  // unreadMessages is no longer available from ChatContext
  const unreadMessages = 0
  const { createStory } = useStories()
  const { t } = useTranslation()
  const { isRTL } = useLanguage()

  // Infinite scrolling states
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const observer = useRef()
  const lastUserElementRef = useRef(null)

  const [activeTab, setActiveTab] = useState("discover")
  const [showFilters, setShowFilters] = useState(false)
  const [filterValues, setFilterValues] = useState({
    ageMin: 18,
    ageMax: 99,
    distance: 100,
    online: false,
    verified: false,
    withPhotos: false,
    interests: [],
  })

  // Chat, story, and profile modal state
  const [chatUser, setChatUser] = useState(null)
  const [showChat, setShowChat] = useState(false)
  const [viewMode, setViewMode] = useState("grid") // "grid" or "list"
  const [imageLoadErrors, setImageLoadErrors] = useState({})
  const [showStoryCreator, setShowStoryCreator] = useState(false)
  const [viewingStoryId, setViewingStoryId] = useState(null)
  const [creatingStory, setCreatingStory] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [showUserProfileModal, setShowUserProfileModal] = useState(false)
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)

  // Reset image error for a specific user
  const handleImageError = useCallback((userId) => {
    setImageLoadErrors((prev) => ({ ...prev, [userId]: true }))
  }, [])

  // Load initial users
  useEffect(() => {
    loadUsers(1).then(() => {
      setInitialLoadComplete(true)
    })
  }, [filterValues]) // Reload when filters change

  // Function to load users with pagination
  const loadUsers = useCallback(
    async (pageNum) => {
      if (pageNum === 1) {
        setLoadingMore(false)
      } else {
        setLoadingMore(true)
      }

      try {
        const result = await getUsers(pageNum, 20)
        setHasMore(result.hasMore)
        setPage(pageNum)
        return result
      } catch (error) {
        console.error("Error loading users:", error)
        toast.error("Failed to load users. Please try again.")
        return null
      } finally {
        setLoadingMore(false)
      }
    },
    [getUsers],
  )

  // Load more users function
  const loadMoreUsers = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadUsers(page + 1)
    }
  }, [loadingMore, hasMore, page, loadUsers])

  // Intersection observer for infinite scrolling
  useEffect(() => {
    const currentObserver = observer.current

    if (currentObserver) {
      currentObserver.disconnect()
    }

    observer.current = new IntersectionObserver(
      (entries) => {
        // If the last element is visible and we have more users to load
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMoreUsers()
        }
      },
      {
        root: null,
        threshold: 0.1,
        rootMargin: "100px",
      },
    )

    // If we have a last element ref, observe it
    if (lastUserElementRef.current && hasMore) {
      observer.current.observe(lastUserElementRef.current)
    }

    return () => {
      if (currentObserver) {
        currentObserver.disconnect()
      }
    }
  }, [hasMore, loadingMore, loading, loadMoreUsers, users.length])

  // Periodic refresh when tab is visible
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadUsers(1) // Reset to first page on refresh
      }
    }, 300000) // Refresh every 5 minutes

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadUsers(1)
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      clearInterval(refreshInterval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      // Close open chat when unmounting
      setShowChat(false)
      setChatUser(null)
    }
  }, [loadUsers])

  // Filter and sort users efficiently.
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (u._id === user?._id) return false
      const userAge = u.details?.age || 25
      if (userAge < filterValues.ageMin || userAge > filterValues.ageMax) return false
      if (filterValues.online && !u.isOnline) return false
      if (filterValues.withPhotos && (!u.photos || u.photos.length === 0)) return false
      if (filterValues.interests.length > 0) {
        const userInterests = u.details?.interests || []
        const hasMatch = filterValues.interests.some((i) => userInterests.includes(i))
        if (!hasMatch) return false
      }
      return true
    })
  }, [users, user, filterValues])

  // FIX: Deduplicate and sort users to prevent key errors
  const sortedUsers = useMemo(() => {
    // First create a map to deduplicate users by ID
    const uniqueUsersMap = new Map()

    // Add each user to the map with _id as key (overwrites duplicates)
    filteredUsers.forEach((user) => {
      if (user && user._id) {
        uniqueUsersMap.set(user._id, user)
      }
    })

    // Convert the map values back to an array
    const uniqueUsers = Array.from(uniqueUsersMap.values())

    // Sort the unique users
    return uniqueUsers.sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1
      if (!a.isOnline && b.isOnline) return 1
      return new Date(b.lastActive) - new Date(a.lastActive)
    })
  }, [filteredUsers])

  const availableInterests = [
    "Dating",
    "Casual",
    "Friendship",
    "Long-term",
    "Travel",
    "Outdoors",
    "Movies",
    "Music",
    "Fitness",
    "Food",
    "Art",
  ]

  const toggleInterest = (interest) => {
    setFilterValues((prev) => {
      if (prev.interests.includes(interest)) {
        return { ...prev, interests: prev.interests.filter((i) => i !== interest) }
      }
      return { ...prev, interests: [...prev.interests, interest] }
    })
  }

  // Open the user profile modal.
  const handleUserCardClick = (userId) => {
    setSelectedUserId(userId)
    setShowUserProfileModal(true)
  }

  // Open chat with a user.
  const handleMessageUser = (e, user) => {
    e.stopPropagation() // Prevent card click
    setChatUser(user)
    setShowChat(true)
  }

  const closeChat = () => {
    setShowChat(false)
    setChatUser(null)
  }

  // Handle story creation ensuring no duplicate submissions.
  const handleCreateStory = (storyData) => {
    if (!createStory || creatingStory) {
      toast.info(
        creatingStory ? "Story creation in progress, please wait..." : "Story creation is not available right now",
      )
      return
    }
    setCreatingStory(true)
    createStory(storyData)
      .then((response) => {
        // Check for different valid response formats
        if (response && (response.success === true || response._id || (response.data && response.data._id))) {
          toast.success("Your story has been created!")
          setShowStoryCreator(false)
        } else {
          toast.error((response && response.error) || "Failed to create story")
        }
      })
      .catch((error) => {
        toast.error("An error occurred while creating your story")
        console.error("Story creation error:", error)
      })
      .finally(() => {
        setCreatingStory(false)
      })
  }

  // Reset image errors when filter values change.
  useEffect(() => {
    setImageLoadErrors({})
  }, [filterValues])

  // Check for unread messages from a given user.
  const hasUnreadMessagesFrom = useCallback(
    (userId) => Array.isArray(unreadMessages) && unreadMessages.some((msg) => msg.sender === userId),
    [unreadMessages],
  )

  const countUnreadMessages = useCallback(
    (userId) => (Array.isArray(unreadMessages) ? unreadMessages.filter((msg) => msg.sender === userId).length : 0),
    [unreadMessages],
  )

  // Reset filter values.
  const resetFilters = useCallback(() => {
    setFilterValues({
      ageMin: 18,
      ageMax: 99,
      distance: 100,
      online: false,
      verified: false,
      withPhotos: false,
      interests: [],
    })

    // Reset pagination
    setPage(1)
    setHasMore(true)
  }, [])

  // Handle scroll event for mobile
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >= document.documentElement.scrollHeight - 300 &&
        hasMore &&
        !loadingMore &&
        !loading
      ) {
        loadMoreUsers()
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [hasMore, loadingMore, loading, loadMoreUsers])

  // Like/Unlike Handler - Works with the optimized UserContext
  const handleLikeUser = useCallback(
    (userId, userName) => {
      // Check if liked using the context function
      const currentlyLiked = isUserLiked(userId)

      if (currentlyLiked) {
        // If already liked, unlike
        unlikeUser(userId, userName).then((success) => {
          if (success) {
            // Force refresh likes to ensure UI is updated
            setTimeout(() => getLikedUsers(true), 300)
          }
        })
      } else {
        // If not liked, like
        likeUser(userId, userName).then((success) => {
          if (success) {
            // Force refresh likes to ensure UI is updated
            setTimeout(() => getLikedUsers(true), 300)
          }
        })
      }
    },
    [isUserLiked, unlikeUser, likeUser, getLikedUsers],
  )

  // Determine if we're in a loading state
  const isLoading = (loading || likesLoading) && page === 1 && !initialLoadComplete

  return (
    <div className={`${styles.dashboardPage} ${isRTL ? 'rtl-layout' : ''}`}>
      <Navbar />

      <main className={styles.dashboardContent}>
        <div className={styles.container}>
          <div className={styles.gradientBar}></div>
          {/* Stories Section */}
          <div className={styles.storiesSection}>
            <div className={styles.storiesHeader}>
              <h2 className={styles.storiesTitle}>{t('stories.myStories')}</h2>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => !creatingStory && setShowStoryCreator(true)}
                aria-label="Create a new story"
                disabled={creatingStory}
              >
                <FaPlus />
                <span>{creatingStory ? t('common.loading') : t('stories.createStory')}</span>
              </button>
            </div>
            <StoriesCarousel
              onStoryClick={(storyId) => {
                if (!viewingStoryId) {
                  setViewingStoryId(storyId)
                }
              }}
            />
          </div>

          {/* Content Header with Filters and View Toggle */}
          <div className={styles.dashboardHeader}>
            <div>
              <h1 className={styles.dashboardTitle}>{activeTab === "discover" ? t('dashboard.browseUsers') : t('dashboard.yourMatches')}</h1>
              <p className={styles.dashboardSubtitle}>{t('dashboard.findMatches')}</p>
            </div>
            <div className={styles.dashboardActions}>
              <div className={styles.viewToggle}>
                <button
                  className={`${styles.viewToggleButton} ${viewMode === "grid" ? styles.active : ""}`}
                  onClick={() => setViewMode("grid")}
                  title="Grid View"
                  aria-label="Grid view"
                >
                  <FaThLarge />
                </button>
                <button
                  className={`${styles.viewToggleButton} ${viewMode === "list" ? styles.active : ""}`}
                  onClick={() => setViewMode("list")}
                  title="List View"
                  aria-label="List view"
                >
                  <FaList />
                </button>
              </div>
              <button
                className={`${styles.filterButton} ${showFilters ? styles.active : ""}`}
                onClick={() => setShowFilters(!showFilters)}
                aria-expanded={showFilters}
                aria-label="Toggle filters"
              >
                <FaFilter />
                <span>{t('common.filter')}</span>
              </button>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className={`${styles.filterPanel} animate-fade-in`}>
              {/* Age Range Filter */}
              <div className={styles.filterSection}>
                <h3>{t('profile.age')} {t('common.range')}</h3>
                <div className={styles.filterOptions}>
                  <div className={styles.rangeSlider}>
                    <div className={styles.rangeValues}>
                      <span>{filterValues.ageMin}</span>
                      <span>{filterValues.ageMax}</span>
                    </div>
                    <input
                      type="range"
                      min="18"
                      max="99"
                      value={filterValues.ageMin}
                      onChange={(e) =>
                        setFilterValues({
                          ...filterValues,
                          ageMin: Number.parseInt(e.target.value),
                        })
                      }
                      className={styles.rangeInput}
                      aria-label="Minimum age"
                    />
                    <input
                      type="range"
                      min="18"
                      max="99"
                      value={filterValues.ageMax}
                      onChange={(e) =>
                        setFilterValues({
                          ...filterValues,
                          ageMax: Number.parseInt(e.target.value),
                        })
                      }
                      className={styles.rangeInput}
                      aria-label="Maximum age"
                    />
                  </div>
                </div>
              </div>

              {/* Distance Filter */}
              <div className={styles.filterSection}>
                <h3>{t('profile.distance')}</h3>
                <div className={styles.filterOptions}>
                  <div className={styles.rangeSlider}>
                    <div className={styles.rangeValue}>
                      <span>{filterValues.distance} km</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={filterValues.distance}
                      onChange={(e) =>
                        setFilterValues({
                          ...filterValues,
                          distance: Number.parseInt(e.target.value),
                        })
                      }
                      className={styles.rangeInput}
                      aria-label="Maximum distance"
                    />
                  </div>
                </div>
              </div>

              {/* Show Only Filters */}
              <div className={styles.filterSection}>
                <h3>{t('common.showOnly')}</h3>
                <div className={`${styles.filterOptions} d-flex flex-column`}>
                  <label className={styles.filterOption}>
                    <input
                      type="checkbox"
                      checked={filterValues.online}
                      onChange={() =>
                        setFilterValues({
                          ...filterValues,
                          online: !filterValues.online,
                        })
                      }
                      aria-label="Show only online users"
                    />
                    <span>{t('common.online')}</span>
                  </label>
                  <label className={styles.filterOption}>
                    <input
                      type="checkbox"
                      checked={filterValues.verified}
                      onChange={() =>
                        setFilterValues({
                          ...filterValues,
                          verified: !filterValues.verified,
                        })
                      }
                      aria-label="Show only verified profiles"
                    />
                    <span>{t('profile.verified')}</span>
                  </label>
                  <label className={styles.filterOption}>
                    <input
                      type="checkbox"
                      checked={filterValues.withPhotos}
                      onChange={() =>
                        setFilterValues({
                          ...filterValues,
                          withPhotos: !filterValues.withPhotos,
                        })
                      }
                      aria-label="Show only profiles with photos"
                    />
                    <span>{t('profile.withPhotos')}</span>
                  </label>
                </div>
              </div>

              {/* Interests Filter */}
              <div className={styles.filterSection}>
                <h3>{t('profile.interests')}</h3>
                <div className={styles.tagsContainer}>
                  {availableInterests.map((interest) => (
                    <button
                      key={interest}
                      className={`${styles.filterTag} ${filterValues.interests.includes(interest) ? styles.active : ""}`}
                      onClick={() => toggleInterest(interest)}
                      aria-pressed={filterValues.interests.includes(interest)}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter Actions */}
              <div className={styles.filterActions}>
                <button className="btn btn-outline" onClick={resetFilters} aria-label="Reset filters">
                  {t('common.reset')}
                </button>
                <button className="btn btn-primary" onClick={() => setShowFilters(false)} aria-label="Apply filters">
                  {t('common.apply')} {t('common.filter')}
                </button>
              </div>
            </div>
          )}

          {/* Users Grid/List Display using enhanced UserCard component */}
          <div className={styles.usersSection}>
            <div className={viewMode === "grid" ? styles.usersGrid : styles.usersList}>
              {isLoading ? (
              <div className={styles.contentLoader}>
                <div className={styles.loadingContainer}>
                  <div className={styles.spinner}></div>
                  <p className={styles.loadingText}>{t('dashboard.loadingUsers')}...</p>
                </div>
              </div>
            ) : sortedUsers.length > 0 ? (
              <>
                {sortedUsers.map((matchedUser, index) => {
                  // Apply ref to the last element for infinite scroll detection
                  const isLastElement = index === sortedUsers.length - 1

                  return (
                    <div
                      key={matchedUser._id}
                      className={styles.userCardWrapper}
                      ref={isLastElement ? lastUserElementRef : null}
                    >
                      <UserCard
                        user={matchedUser}
                        isLiked={isUserLiked(matchedUser._id)}
                        onLike={handleLikeUser}
                        viewMode={viewMode}
                        onMessage={(e) => handleMessageUser(e, matchedUser)}
                        onClick={() => handleUserCardClick(matchedUser._id)}
                        showExtendedDetails={true}
                        hasUnreadMessages={hasUnreadMessagesFrom(matchedUser._id)}
                        unreadMessageCount={countUnreadMessages(matchedUser._id)}
                      />
                    </div>
                  )
                })}

                {/* Loading indicator at the bottom when loading more */}
                {loadingMore && (
                  <div className={styles.contentLoader} style={{minHeight: "100px"}}>
                    <div className={styles.loadingContainer}>
                      <div className={styles.spinner}></div>
                      <p className={styles.loadingText}>{t('dashboard.loadingMoreUsers')}...</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              // No Results Found
              <div className={styles.contentLoader}>
                <div className={styles.loadingContainer}>
                  <div className={styles.noResultsIcon}>
                    <FaSearch />
                  </div>
                  <h3>{t('dashboard.noMatches')}</h3>
                  <p>{t('dashboard.tryAdjustingFilters')}</p>
                  <button className="btn btn-primary" onClick={resetFilters} aria-label="Reset filters">
                    {t('common.reset')} {t('common.filter')}
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </main>

      {/* Embedded Chat Modal */}
      {showChat && chatUser && (
        <>
          {/* Overlay to close chat */}
          <div className={styles.chatOverlay} onClick={closeChat}></div>
          <EmbeddedChat recipient={chatUser} isOpen={showChat} onClose={closeChat} />
        </>
      )}

      {/* Story Creator Modal */}
      {showStoryCreator && <StoryCreator onClose={() => setShowStoryCreator(false)} onSubmit={handleCreateStory} />}

      {/* Stories Viewer Modal */}
      {viewingStoryId && <StoriesViewer storyId={viewingStoryId} onClose={() => setViewingStoryId(null)} />}

      {/* User Profile Modal */}
      {showUserProfileModal && (
        <UserProfileModal
          userId={selectedUserId}
          isOpen={showUserProfileModal}
          onClose={() => setShowUserProfileModal(false)}
        />
      )}

    </div>
  )
}

export default Dashboard
