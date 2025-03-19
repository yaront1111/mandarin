

// client/src/pages/UserProfile.js
import { useEffect, useState, useCallback } from "react"
import {
  FaArrowLeft,
  FaHeart,
  FaComment,
  FaEllipsisH,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaRegClock,
  FaCheck,
  FaChevronRight,
  FaChevronLeft,
  FaLock,
  FaUserAlt,
  FaTrophy,
  FaFlag,
  FaBan,
} from "react-icons/fa"
import { useParams, useNavigate } from "react-router-dom"
import { useUser, useChat, useAuth, useStories } from "../context" // Add useStories
import EmbeddedChat from "../components/EmbeddedChat"
import StoriesViewer from "../components/Stories/StoriesViewer" // Import StoriesViewer
import StoryThumbnail from "../components/Stories/StoryThumbnail" // Import StoryThumbnail
import { toast } from "react-toastify"
import apiService from "../services/apiService"

// Update the UserProfile component with a more modern design
const UserProfile = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const {
    getUser,
    currentUser: profileUser,
    loading,
    requestPhotoPermission,
    likeUser,
    unlikeUser,
    isUserLiked,
  } = useUser()
  const {} = useChat() // Will be used in future implementation
  const { loadUserStories, hasUnviewedStories } = useStories() // Add stories context

  const [showChat, setShowChat] = useState(false)
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)
  const [showActions, setShowActions] = useState(false)
  const [showAllInterests, setShowAllInterests] = useState(false)
  const [showStories, setShowStories] = useState(false) // Add state for stories viewer

  // Add state for photo permissions
  const [requestingPermission, setRequestingPermission] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState({})
  const [photoLoadError, setPhotoLoadError] = useState({})

  // Memoized function to handle image loading errors
  const handleImageError = useCallback((photoId) => {
    setPhotoLoadError((prev) => ({
      ...prev,
      [photoId]: true,
    }))
  }, [])

  // Add function to handle permission requests
  const handleRequestAccess = async (photoId, e) => {
    if (e) {
      e.stopPropagation() // Prevent event bubbling
    }

    if (!profileUser || requestingPermission) return

    setRequestingPermission(true)
    try {
      const result = await requestPhotoPermission(photoId, profileUser._id)
      if (result) {
        setPermissionStatus((prev) => ({
          ...prev,
          [photoId]: "pending",
        }))
        toast.success("Photo access requested")
      }
    } catch (error) {
      console.error("Error requesting photo access:", error)
      toast.error(error.message || "Failed to request photo access")
    } finally {
      setRequestingPermission(false)
    }
  }

  // Add useEffect to load permission statuses
  useEffect(() => {
    const loadPhotoPermissions = async () => {
      if (profileUser && profileUser.photos && profileUser.photos.length > 0) {
        try {
          // This would be an API call to get permission statuses
          const permissions = await apiService.get(`/users/${profileUser._id}/photo-permissions`)

          if (permissions.success) {
            const statusMap = {}
            permissions.data.forEach((permission) => {
              statusMap[permission.photo] = permission.status
            })
            setPermissionStatus(statusMap)
          }
        } catch (error) {
          console.error("Error loading photo permissions:", error)
        }
      }
    }

    if (profileUser) {
      loadPhotoPermissions()
    }
  }, [profileUser])

  // Load user data and messages when component mounts
  useEffect(() => {
    if (id) {
      getUser(id)
      // Load user stories
      loadUserStories(id)
    }

    // Reset states when user changes
    setActivePhotoIndex(0)
    setShowAllInterests(false)
    setShowActions(false)
    setPhotoLoadError({})

    return () => {
      // Clean up any pending operations when component unmounts
      setShowChat(false)
      setShowStories(false)
    }
  }, [id, getUser, loadUserStories])

  // Redirect if user not found after loading
  useEffect(() => {
    if (!loading && !profileUser && id) {
      toast.error("User profile not found")
      navigate("/dashboard")
    }
  }, [loading, profileUser, id, navigate])

  const handleBack = () => {
    navigate("/dashboard")
  }

  const handleLike = () => {
    if (!profileUser) return

    if (isUserLiked(profileUser._id)) {
      unlikeUser(profileUser._id, profileUser.nickname)
    } else {
      likeUser(profileUser._id, profileUser.nickname)
    }
  }

  const handleMessage = () => {
    setShowChat(true)
  }

  const handleCloseChat = () => {
    setShowChat(false)
  }

  // Handle opening stories viewer
  const handleViewStories = () => {
    setShowStories(true)
  }

  // Handle closing stories viewer
  const handleCloseStories = () => {
    setShowStories(false)
  }

  const nextPhoto = () => {
    if (profileUser?.photos && activePhotoIndex < profileUser.photos.length - 1) {
      setActivePhotoIndex(activePhotoIndex + 1)
    }
  }

  const prevPhoto = () => {
    if (activePhotoIndex > 0) {
      setActivePhotoIndex(activePhotoIndex - 1)
    }
  }

  const calculateCompatibility = () => {
    if (!profileUser || !profileUser.details || !currentUser || !currentUser.details) return 0

    let score = 0
    // Location
    if (profileUser.details.location === currentUser.details.location) {
      score += 25
    }
    // Age proximity
    const ageDiff = Math.abs((profileUser.details.age || 0) - (currentUser.details.age || 0))
    if (ageDiff <= 5) score += 25
    else if (ageDiff <= 10) score += 15
    else score += 5
    // Interests
    const profileInterests = profileUser.details?.interests || []
    const userInterests = currentUser.details?.interests || []
    const commonInterests = profileInterests.filter((i) => userInterests.includes(i))
    score += Math.min(50, commonInterests.length * 10)

    return Math.min(100, score)
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner spinner-dark"></div>
        <p className="loading-text">Loading profile...</p>
      </div>
    )
  }

  if (!profileUser) {
    return null
  }

  const compatibility = calculateCompatibility()
  const commonInterests =
    profileUser.details?.interests?.filter((interest) => currentUser.details?.interests?.includes(interest)) || []

  return (
    <div className="modern-user-profile">
      <div className="container profile-content">
        <button className="back-button" onClick={handleBack}>
          <FaArrowLeft /> Back to Discover
        </button>

        <div className="profile-layout">
          {/* Left: Photos */}
          <div className="profile-photos-section">
            {/* Add Stories Thumbnail */}
            <div className="profile-stories">
              <StoryThumbnail
                user={profileUser}
                hasUnviewedStories={hasUnviewedStories(profileUser._id)}
                onClick={handleViewStories}
              />
            </div>

            {profileUser.photos && profileUser.photos.length > 0 ? (
              <div className="photo-gallery-container">
                <div className="gallery-photo">
                  {profileUser.photos[activePhotoIndex].isPrivate &&
                  (!permissionStatus[profileUser.photos[activePhotoIndex]._id] ||
                    permissionStatus[profileUser.photos[activePhotoIndex]._id] !== "approved") ? (
                    <div className="private-photo-placeholder">
                      <FaLock className="lock-icon" />
                      <p>Private Photo</p>
                      {!permissionStatus[profileUser.photos[activePhotoIndex]._id] && (
                        <button
                          className="request-access-btn"
                          onClick={() => handleRequestAccess(profileUser.photos[activePhotoIndex]._id)}
                          disabled={requestingPermission}
                        >
                          {requestingPermission ? "Requesting..." : "Request Access"}
                        </button>
                      )}
                      {permissionStatus[profileUser.photos[activePhotoIndex]._id] === "pending" && (
                        <p className="permission-status pending">Request Pending</p>
                      )}
                      {permissionStatus[profileUser.photos[activePhotoIndex]._id] === "rejected" && (
                        <p className="permission-status rejected">Access Denied</p>
                      )}
                    </div>
                  ) : (
                    <img
                      src={profileUser.photos[activePhotoIndex].url || "/placeholder.svg"}
                      alt={profileUser.nickname}
                      onError={() => handleImageError(profileUser.photos[activePhotoIndex]._id)}
                      style={{ display: photoLoadError[profileUser.photos[activePhotoIndex]._id] ? "none" : "block" }}
                    />
                  )}
                  {photoLoadError[profileUser.photos[activePhotoIndex]._id] && (
                    <div className="image-error-placeholder">
                      <p>Image could not be loaded</p>
                    </div>
                  )}
                  {profileUser.isOnline && (
                    <div className="online-badge">
                      <span className="pulse"></span>
                      Online Now
                    </div>
                  )}
                  {profileUser.photos.length > 1 && (
                    <>
                      <button className="gallery-nav prev" onClick={prevPhoto} disabled={activePhotoIndex === 0}>
                        <FaChevronLeft />
                      </button>
                      <button
                        className="gallery-nav next"
                        onClick={nextPhoto}
                        disabled={activePhotoIndex === profileUser.photos.length - 1}
                      >
                        <FaChevronRight />
                      </button>
                    </>
                  )}
                </div>
                {profileUser.photos.length > 1 && (
                  <div className="photo-thumbnails">
                    {profileUser.photos.map((photo, index) => (
                      <div
                        key={index}
                        className={`photo-thumbnail ${index === activePhotoIndex ? "active" : ""}`}
                        onClick={() => setActivePhotoIndex(index)}
                      >
                        {photo.isPrivate ? (
                          <div className="private-thumbnail">
                            <FaLock />
                            {permissionStatus[photo._id] ? (
                              <div className={`permission-status ${permissionStatus[photo._id]}`}>
                                {permissionStatus[photo._id] === "pending" && "Request Pending"}
                                {permissionStatus[photo._id] === "approved" && "Access Granted"}
                                {permissionStatus[photo._id] === "rejected" && "Access Denied"}
                              </div>
                            ) : (
                              <button
                                className="request-access-btn"
                                onClick={(e) => handleRequestAccess(photo._id, e)}
                                disabled={requestingPermission}
                              >
                                {requestingPermission ? "Requesting..." : "Request Access"}
                              </button>
                            )}
                          </div>
                        ) : (
                          <img
                            src={photo.url || "/placeholder.svg"}
                            alt={`${profileUser.nickname} ${index + 1}`}
                            onError={() => handleImageError(photo._id)}
                          />
                        )}
                        {photoLoadError[photo._id] && (
                          <div className="thumbnail-error">
                            <FaUserAlt />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="no-photo-placeholder">
                <FaUserAlt />
                <p>No photos available</p>
              </div>
            )}
            <button
              className={`btn ${isUserLiked(profileUser._id) ? "btn-primary" : "btn-outline"}`}
              onClick={handleLike}
            >
              <FaHeart />
              <span>{isUserLiked(profileUser._id) ? "Liked" : "Like"}</span>
            </button>
            <button className="btn btn-primary" onClick={handleMessage}>
              <FaComment />
              <span>Message</span>
            </button>
            <div className="more-actions-dropdown">
              <button className="btn btn-subtle" onClick={() => setShowActions(!showActions)}>
                <FaEllipsisH />
              </button>
              {showActions && (
                <div className="actions-dropdown">
                  <button className="dropdown-item">
                    <FaFlag /> Report User
                  </button>
                  <button className="dropdown-item">
                    <FaBan /> Block User
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Details */}
          <div className="profile-details-section">
            <div className="user-headline">
              <h1>
                {profileUser.nickname}, {profileUser.details?.age || "?"}
              </h1>
              {profileUser.role === "premium" && (
                <div className="premium-badge">
                  <FaTrophy /> Premium
                </div>
              )}
            </div>
            <div className="user-location">
              <FaMapMarkerAlt />
              <span>{profileUser.details?.location || "Unknown location"}</span>
              <div className={`online-status ${profileUser.isOnline ? "online" : ""}`}>
                {profileUser.isOnline ? "Online now" : "Offline"}
              </div>
            </div>
            <div className="user-activity">
              <div className="activity-item">
                <FaRegClock />
                <span>
                  {profileUser.isOnline
                    ? "Active now"
                    : `Last active ${new Date(profileUser.lastActive).toLocaleDateString()}`}
                </span>
              </div>
              <div className="activity-item">
                <FaCalendarAlt />
                <span>Member since {new Date(profileUser.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="compatibility-section">
              <h2>Compatibility</h2>
              <div className="compatibility-score">
                <div className="score-circle">
                  <svg viewBox="0 0 100 100">
                    <circle className="score-bg" cx="50" cy="50" r="45" />
                    <circle
                      className="score-fill"
                      cx="50"
                      cy="50"
                      r="45"
                      strokeDasharray="283"
                      strokeDashoffset={283 - (283 * compatibility) / 100}
                    />
                  </svg>
                  <div className="score-value">{compatibility}%</div>
                </div>
                <div className="compatibility-details">
                  <div className="compatibility-factor">
                    <span>Location</span>
                    <div className="factor-bar">
                      <div
                        className="factor-fill"
                        style={{
                          width: profileUser.details?.location === currentUser.details?.location ? "100%" : "30%",
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className="compatibility-factor">
                    <span>Age</span>
                    <div className="factor-bar">
                      <div
                        className="factor-fill"
                        style={{
                          width:
                            Math.abs((profileUser.details?.age || 0) - (currentUser.details?.age || 0)) <= 5
                              ? "90%"
                              : Math.abs((profileUser.details?.age || 0) - (currentUser.details?.age || 0)) <= 10
                                ? "60%"
                                : "30%",
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className="compatibility-factor">
                    <span>Interests</span>
                    <div className="factor-bar">
                      <div
                        className="factor-fill"
                        style={{
                          width: `${Math.min(100, commonInterests.length * 20)}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {profileUser.details?.bio && (
              <div className="profile-section">
                <h2>About Me</h2>
                <p className="about-text">{profileUser.details.bio}</p>
              </div>
            )}

            {profileUser.details?.interests?.length > 0 && (
              <div className="profile-section">
                <h2>Interests</h2>
                <div className="interests-tags">
                  {(showAllInterests ? profileUser.details.interests : profileUser.details.interests.slice(0, 8)).map(
                    (interest) => (
                      <span
                        key={interest}
                        className={`interest-tag ${commonInterests.includes(interest) ? "common" : ""}`}
                      >
                        {interest}
                        {commonInterests.includes(interest) && <FaCheck className="common-icon" />}
                      </span>
                    ),
                  )}
                  {!showAllInterests && profileUser.details.interests.length > 8 && (
                    <button className="show-more-interests" onClick={() => setShowAllInterests(true)}>
                      +{profileUser.details.interests.length - 8} more
                    </button>
                  )}
                </div>
              </div>
            )}

            {commonInterests.length > 0 && (
              <div className="profile-section">
                <h2>Common Interests</h2>
                <div className="common-interests">
                  {commonInterests.map((interest) => (
                    <div key={interest} className="common-interest-item">
                      <FaCheck />
                      <span>{interest}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Embedded Chat */}
        {showChat && (
          <>
            <div className="chat-overlay" onClick={handleCloseChat}></div>
            <EmbeddedChat recipient={profileUser} isOpen={showChat} onClose={handleCloseChat} />
          </>
        )}

        {/* Stories Viewer */}
        {showStories && <StoriesViewer userId={profileUser._id} onClose={handleCloseStories} />}
      </div>
    </div>
  )
}

export default UserProfile
