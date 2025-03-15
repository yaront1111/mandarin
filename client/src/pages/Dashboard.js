"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  FaSearch,
  FaHeart,
  FaBell,
  FaUserCircle,
  FaMapMarkerAlt,
  FaComments,
  FaThLarge,
  FaList,
  FaFilter,
} from "react-icons/fa"
import { toast } from "react-toastify"
import { useAuth } from "../context"
import { useUser } from "../context"
import { useChat } from "../context"
import EmbeddedChat from "../components/EmbeddedChat"
import { ThemeToggle } from "../components/theme-toggle.tsx"
import StoriesCarousel from "../components/Stories/StoriesCarousel" // Import StoriesCarousel

const Dashboard = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { users, getUsers, loading } = useUser()
  const { unreadMessages } = useChat()

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

  // New state for chat functionality
  const [chatUser, setChatUser] = useState(null)
  const [showChat, setShowChat] = useState(false)
  const [viewMode, setViewMode] = useState("grid") // 'grid' or 'list'
  const [imageLoadErrors, setImageLoadErrors] = useState({})

  // Handle image loading errors
  const handleImageError = useCallback((userId) => {
    setImageLoadErrors((prev) => ({
      ...prev,
      [userId]: true,
    }))
  }, [])

  // Fetch users on mount and set up periodic refresh
  useEffect(() => {
    getUsers()

    const refreshInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        getUsers()
      }
    }, 60000) // Refresh every minute when visible

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        getUsers() // Refresh immediately when tab becomes visible
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Cleanup on unmount
    return () => {
      clearInterval(refreshInterval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      // Close any open chat when unmounting
      setShowChat(false)
      setChatUser(null)
    }
  }, [getUsers])

  // Memoized filtered users to avoid recalculation on every render
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Don't show current user
      if (u._id === user?._id) return false

      const userAge = u.details?.age || 25
      if (userAge < filterValues.ageMin || userAge > filterValues.ageMax) return false
      if (filterValues.online && !u.isOnline) return false
      if (filterValues.withPhotos && (!u.photos || u.photos.length === 0)) return false
      if (filterValues.interests.length > 0) {
        const userInterests = u.details?.interests || []
        const hasMatchingInterest = filterValues.interests.some((i) => userInterests.includes(i))
        if (!hasMatchingInterest) return false
      }
      return true
    })
  }, [users, user, filterValues])

  // Memoized sorted users to avoid recalculation on every render
  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
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
      } else {
        return { ...prev, interests: [...prev.interests, interest] }
      }
    })
  }

  const navigateToUserProfile = (userId) => {
    navigate(`/user/${userId}`)
  }

  const handleMessageUser = (e, user) => {
    e.stopPropagation() // Prevent card click navigation
    setChatUser(user)
    setShowChat(true)
  }

  const closeChat = () => {
    setShowChat(false)
    setChatUser(null)
  }

  const navigateToProfile = () => {
    navigate("/profile")
  }

  // Reset image load errors when filter changes
  useEffect(() => {
    setImageLoadErrors({})
  }, [filterValues])

  // Check if a user has unread messages - with proper null/undefined checks
  const hasUnreadMessages = useCallback(
    (userId) => {
      return Array.isArray(unreadMessages) && unreadMessages.some((msg) => msg.sender === userId)
    },
    [unreadMessages],
  )

  // Count unread messages for a user - with proper null/undefined checks
  const unreadCount = useCallback(
    (userId) => {
      return Array.isArray(unreadMessages) ? unreadMessages.filter((msg) => msg.sender === userId).length : 0
    },
    [unreadMessages],
  )

  // Reset filters function
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
  }, [])

  return (
    <div className="modern-dashboard">
      {/* Header */}
      <header className="modern-header">
        <div className="container d-flex justify-content-between align-items-center">
          <div className="logo">Mandarin</div>
          <div className="main-tabs d-none d-md-flex">
            <button
              className={`tab-button ${activeTab === "discover" ? "active" : ""}`}
              onClick={() => setActiveTab("discover")}
            >
              <FaSearch className="tab-icon" />
              <span>Discover</span>
            </button>
            <button
              className={`tab-button ${activeTab === "matches" ? "active" : ""}`}
              onClick={() => setActiveTab("matches")}
            >
              <FaHeart className="tab-icon" />
              <span>Matches</span>
            </button>
          </div>
          <div className="header-actions d-flex align-items-center">
            <ThemeToggle />
            <button className="header-action-button" aria-label="Notifications">
              <FaBell />
              {unreadMessages && unreadMessages.length > 0 && (
                <span className="notification-badge">{unreadMessages.length}</span>
              )}
            </button>
            <div className="user-avatar-dropdown">
              {user?.photos?.length > 0 ? (
                <img
                  src={user.photos[0].url || "/placeholder.svg"}
                  alt={user.nickname}
                  className="user-avatar"
                  onClick={navigateToProfile}
                  onError={() => handleImageError("current-user")}
                />
              ) : (
                <FaUserCircle className="user-avatar" style={{ fontSize: "32px" }} onClick={navigateToProfile} />
              )}
              {imageLoadErrors["current-user"] && (
                <FaUserCircle className="user-avatar" style={{ fontSize: "32px" }} onClick={navigateToProfile} />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="dashboard-content">
        <div className="container">
          {/* Add Stories Carousel */}
          <StoriesCarousel />

          <div className="content-header d-flex justify-content-between align-items-center">
            <h1>{activeTab === "discover" ? "Discover People" : "Your Matches"}</h1>
            <div className="content-actions d-flex align-items-center gap-2">
              <div className="view-toggle d-none d-md-flex">
                <button
                  className={`view-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                  onClick={() => setViewMode("grid")}
                  title="Grid View"
                  aria-label="Grid view"
                >
                  <FaThLarge />
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === "list" ? "active" : ""}`}
                  onClick={() => setViewMode("list")}
                  title="List View"
                  aria-label="List view"
                >
                  <FaList />
                </button>
              </div>
              <div
                className={`filter-button d-flex ${showFilters ? "active" : ""}`}
                onClick={() => setShowFilters(!showFilters)}
                role="button"
                tabIndex={0}
                aria-expanded={showFilters}
                aria-label="Toggle filters"
              >
                <FaFilter />
                <span className="d-none d-md-inline">Filters</span>
              </div>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="filter-panel animate-fade-in">
              <div className="filter-section">
                <h3>Age Range</h3>
                <div className="filter-options">
                  <div className="range-slider">
                    <div className="range-values">
                      <span>{filterValues.ageMin}</span>
                      <span>{filterValues.ageMax}</span>
                    </div>
                    <input
                      type="range"
                      min="18"
                      max="99"
                      value={filterValues.ageMin}
                      onChange={(e) => setFilterValues({ ...filterValues, ageMin: Number.parseInt(e.target.value) })}
                      className="range-input"
                      aria-label="Minimum age"
                    />
                    <input
                      type="range"
                      min="18"
                      max="99"
                      value={filterValues.ageMax}
                      onChange={(e) => setFilterValues({ ...filterValues, ageMax: Number.parseInt(e.target.value) })}
                      className="range-input"
                      aria-label="Maximum age"
                    />
                  </div>
                </div>
              </div>

              <div className="filter-section">
                <h3>Distance</h3>
                <div className="filter-options">
                  <div className="range-slider">
                    <div className="range-value">
                      <span>{filterValues.distance} km</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={filterValues.distance}
                      onChange={(e) => setFilterValues({ ...filterValues, distance: Number.parseInt(e.target.value) })}
                      className="range-input"
                      aria-label="Maximum distance"
                    />
                  </div>
                </div>
              </div>

              <div className="filter-section">
                <h3>Show Only</h3>
                <div className="filter-options d-flex flex-column">
                  <label className="filter-option">
                    <input
                      type="checkbox"
                      checked={filterValues.online}
                      onChange={() => setFilterValues({ ...filterValues, online: !filterValues.online })}
                      aria-label="Show only online users"
                    />
                    <span>Online Now</span>
                  </label>
                  <label className="filter-option">
                    <input
                      type="checkbox"
                      checked={filterValues.verified}
                      onChange={() => setFilterValues({ ...filterValues, verified: !filterValues.verified })}
                      aria-label="Show only verified profiles"
                    />
                    <span>Verified Profiles</span>
                  </label>
                  <label className="filter-option">
                    <input
                      type="checkbox"
                      checked={filterValues.withPhotos}
                      onChange={() => setFilterValues({ ...filterValues, withPhotos: !filterValues.withPhotos })}
                      aria-label="Show only profiles with photos"
                    />
                    <span>With Photos</span>
                  </label>
                </div>
              </div>

              <div className="filter-section">
                <h3>Interests</h3>
                <div className="tags-container">
                  {availableInterests.map((interest) => (
                    <button
                      key={interest}
                      className={`filter-tag ${filterValues.interests.includes(interest) ? "active" : ""}`}
                      onClick={() => toggleInterest(interest)}
                      aria-pressed={filterValues.interests.includes(interest)}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-actions">
                <button className="btn btn-outline" onClick={resetFilters} aria-label="Reset filters">
                  Reset
                </button>
                <button className="btn btn-primary" onClick={() => setShowFilters(false)} aria-label="Apply filters">
                  Apply Filters
                </button>
              </div>
            </div>
          )}

          {/* Users Grid/List */}
          <div className={`users-${viewMode} mt-4 animate-fade-in`}>
            {loading ? (
              <div className="loading-container">
                <div className="spinner spinner-dark"></div>
                <p className="loading-text">Loading users...</p>
              </div>
            ) : sortedUsers.length > 0 ? (
              sortedUsers.map((matchedUser) => (
                <div key={matchedUser._id} className="user-card" onClick={() => navigateToUserProfile(matchedUser._id)}>
                  <div className="user-card-photo">
                    {matchedUser.photos && matchedUser.photos.length > 0 ? (
                      <>
                        <img
                          src={matchedUser.photos[0].url || "/placeholder.svg"}
                          alt={matchedUser.nickname}
                          onError={() => handleImageError(matchedUser._id)}
                          style={{ display: imageLoadErrors[matchedUser._id] ? "none" : "block" }}
                        />
                        {imageLoadErrors[matchedUser._id] && (
                          <div className="avatar-placeholder">
                            <FaUserCircle />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="avatar-placeholder">
                        <FaUserCircle />
                      </div>
                    )}
                    {matchedUser.isOnline && <div className="online-indicator"></div>}
                  </div>
                  <div className="user-card-info">
                    <div className="d-flex justify-content-between align-items-center">
                      <h3>
                        {matchedUser.nickname}, {matchedUser.details?.age || "?"}
                      </h3>
                      {hasUnreadMessages(matchedUser._id) && (
                        <span className="unread-badge">{unreadCount(matchedUser._id)}</span>
                      )}
                    </div>
                    <p className="location">
                      <FaMapMarkerAlt className="location-icon" />
                      {matchedUser.details?.location || "Unknown location"}
                    </p>

                    {matchedUser.details?.interests && matchedUser.details.interests.length > 0 && (
                      <div className="user-interests">
                        {matchedUser.details.interests.slice(0, 3).map((interest, idx) => (
                          <span key={idx} className="interest-tag">
                            {interest}
                          </span>
                        ))}
                        {matchedUser.details.interests.length > 3 && (
                          <span className="interest-more">+{matchedUser.details.interests.length - 3}</span>
                        )}
                      </div>
                    )}

                    <div className="user-actions">
                      <button
                        className="card-action-button like"
                        onClick={(e) => {
                          e.stopPropagation()
                          toast.success(`You liked ${matchedUser.nickname}`)
                        }}
                        aria-label={`Like ${matchedUser.nickname}`}
                      >
                        <FaHeart />
                      </button>
                      <button
                        className="card-action-button message"
                        onClick={(e) => handleMessageUser(e, matchedUser)}
                        aria-label={`Message ${matchedUser.nickname}`}
                      >
                        <FaComments />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-results">
                <div className="no-results-icon">
                  <FaSearch />
                </div>
                <h3>No matches found</h3>
                <p>Try adjusting your filters to see more people</p>
                <button className="btn btn-primary mt-3" onClick={resetFilters} aria-label="Reset filters">
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Embedded Chat */}
      {showChat && chatUser && (
        <>
          <div className="chat-overlay" onClick={closeChat}></div>
          <EmbeddedChat recipient={chatUser} isOpen={showChat} onClose={closeChat} />
        </>
      )}
    </div>
  )
}

export default Dashboard
