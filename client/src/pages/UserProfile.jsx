// client/src/pages/UserProfile.jsx
import { useEffect, useState, useCallback, useRef } from "react"
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
  FaStar,
  FaCamera,
  FaSpinner
} from "react-icons/fa"
import { useParams, useNavigate } from "react-router-dom"
import { useUser, useChat, useAuth, useStories } from "../context"
import { EmbeddedChat } from "../components"

// Simple local Spinner component
const Spinner = () => (
  <div className="spinner">
    <FaSpinner className="spinner-icon" size={32} />
  </div>
)
import StoriesViewer from "../components/Stories/StoriesViewer"
import StoryThumbnail from "../components/Stories/StoryThumbnail"
import { toast } from "react-toastify"
import apiService from "../services/apiService.jsx"

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
    error
  } = useUser()
  const { } = useChat() // Using empty destructuring to avoid missing methods
  const { loadUserStories, hasUnviewedStories } = useStories()
  const [userStories, setUserStories] = useState([])

  const [showChat, setShowChat] = useState(false)
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)
  const [showActions, setShowActions] = useState(false)
  const [showAllInterests, setShowAllInterests] = useState(false)
  const [showStories, setShowStories] = useState(false)
  const [loadingPermission, setLoadingPermission] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState({})
  const [photoLoadError, setPhotoLoadError] = useState({})
  const [isLiking, setIsLiking] = useState(false)
  const [isChatInitiating, setIsChatInitiating] = useState(false)
  const profileRef = useRef(null)

  // Load user data
  useEffect(() => {
    if (id) {
      getUser(id)

      // Load user stories safely
      try {
        loadUserStories?.(id)
          .then(stories => {
            if (stories && Array.isArray(stories)) {
              setUserStories(stories)
            }
          })
          .catch(err => console.error("Error loading stories:", err))
      } catch (error) {
        console.log("Stories functionality not available")
      }

      fetchPhotoPermissions()
    }

    // Reset states when user changes
    setActivePhotoIndex(0)
    setShowAllInterests(false)
    setShowActions(false)
    setPhotoLoadError({})

    return () => {
      setShowChat(false)
      setShowStories(false)
    }
  }, [id, getUser, loadUserStories])

  // Fetch photo permissions
  const fetchPhotoPermissions = async () => {
    try {
      const response = await apiService.get(`/users/${id}/photo-permissions`)
      if (response.success) {
        const statusMap = {}
        response.data.forEach(permission => {
          statusMap[permission.photo] = permission.status
        })
        setPermissionStatus(statusMap)
      }
    } catch (error) {
      console.error("Error loading photo permissions:", error)
    }
  }

  // Handle image loading errors
  const handleImageError = useCallback((photoId) => {
    setPhotoLoadError((prev) => ({
      ...prev,
      [photoId]: true,
    }))
  }, [])

  // Request access to private photos
  const handleRequestAccess = async (photoId, e) => {
    if (e) e.stopPropagation()

    if (!profileUser || loadingPermission) return

    setLoadingPermission(true)
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
      setLoadingPermission(false)
    }
  }

  // Go back to previous page
  const handleBack = () => {
    navigate("/dashboard")
  }

  // Handle liking/unliking users
  const handleLike = async () => {
    if (!profileUser || isLiking) return

    setIsLiking(true)
    try {
      if (isUserLiked(profileUser._id)) {
        await unlikeUser(profileUser._id, profileUser.nickname)
      } else {
        await likeUser(profileUser._id, profileUser.nickname)
      }
    } catch (error) {
      console.error("Error toggling like:", error)
    } finally {
      setIsLiking(false)
    }
  }

  // Handle starting chat
  const handleMessage = () => {
    setIsChatInitiating(true)
    // Simply open the chat dialog without using the initiateChat function
    setTimeout(() => {
      setShowChat(true)
      setIsChatInitiating(false)
    }, 500) // Small delay to show the loading state
  }

  // Close chat window
  const handleCloseChat = () => {
    setShowChat(false)
  }

  // View user stories
  const handleViewStories = () => {
    setShowStories(true)
  }

  // Close stories viewer
  const handleCloseStories = () => {
    setShowStories(false)
  }

  // Navigate through photos
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

  // Calculate compatibility score between users
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
    const commonInterests = profileInterests.filter(i => userInterests.includes(i))
    score += Math.min(50, commonInterests.length * 10)

    return Math.min(100, score)
  }

  // Handle errors and loading states
  if (loading) {
    return (
      <div className="loading-container">
        <Spinner />
        <p className="loading-text">Loading profile...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Error Loading Profile</h3>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={handleBack}>Return to Dashboard</button>
      </div>
    )
  }

  if (!profileUser) {
    return (
      <div className="not-found-container">
        <h3>User Not Found</h3>
        <p>The user you're looking for doesn't exist or has been removed.</p>
        <button className="btn btn-primary" onClick={handleBack}>Return to Dashboard</button>
      </div>
    )
  }

  const compatibility = calculateCompatibility()
  const commonInterests = profileUser.details?.interests?.filter(
    interest => currentUser.details?.interests?.includes(interest)
  ) || []

  return (
    <div className="modern-user-profile" ref={profileRef}>
      <div className="container profile-content">
        <button className="back-button" onClick={handleBack}>
          <FaArrowLeft /> Back to Discover
        </button>

        <div className="profile-layout">
          {/* Left: Photos */}
          <div className="profile-photos-section">
            {/* Stories Thumbnail */}
            {userStories && userStories.length > 0 && (
              <div className="profile-stories">
                <StoryThumbnail
                  user={profileUser}
                  hasUnviewedStories={hasUnviewedStories(profileUser._id)}
                  onClick={handleViewStories}
                />
              </div>
            )}

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
                          disabled={loadingPermission}
                        >
                          {loadingPermission ? "Requesting..." : "Request Access"}
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
                      <FaCamera size={48} />
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
                        key={photo._id || index}
                        className={`photo-thumbnail ${index === activePhotoIndex ? "active" : ""}`}
                        onClick={() => setActivePhotoIndex(index)}
                      >
                        {photo.isPrivate ? (
                          <div className="private-thumbnail">
                            <FaLock />
                            {permissionStatus[photo._id] ? (
                              <div className={`permission-status ${permissionStatus[photo._id]}`}>
                                {permissionStatus[photo._id] === "pending" && "Pending"}
                                {permissionStatus[photo._id] === "approved" && "Access Granted"}
                                {permissionStatus[photo._id] === "rejected" && "Denied"}
                              </div>
                            ) : (
                              <button
                                className="request-access-btn small"
                                onClick={(e) => handleRequestAccess(photo._id, e)}
                                disabled={loadingPermission}
                              >
                                Request
                              </button>
                            )}
                          </div>
                        ) : (
                          <img
                            src={photo.url || "/placeholder.svg"}
                            alt={`${profileUser.nickname} ${index + 1}`}
                            onError={() => handleImageError(photo._id)}
                            style={{ display: photoLoadError[photo._id] ? "none" : "block" }}
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
                <FaUserAlt size={64} />
                <p>No photos available</p>
              </div>
            )}

            <div className="profile-actions">
              <button
                className={`btn profile-action-btn ${isUserLiked(profileUser._id) ? "liked" : ""}`}
                onClick={handleLike}
                disabled={isLiking}
              >
                {isLiking ? <FaSpinner className="spinner-icon" /> : <FaHeart />}
                <span>{isUserLiked(profileUser._id) ? "Liked" : "Like"}</span>
              </button>
              <button
                className="btn btn-primary profile-action-btn"
                onClick={handleMessage}
                disabled={isChatInitiating}
              >
                {isChatInitiating ? <FaSpinner className="spinner-icon" /> : <FaComment />}
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
          </div>

          {/* Right: User Details */}
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

            {profileUser?.details?.iAm && (
              <div className="profile-section">
                <h4>I am a</h4>
                <p>{profileUser.details.iAm}</p>
              </div>
            )}

            {profileUser?.details?.lookingFor?.length > 0 && (
              <div className="profile-section">
                <h4>Looking for</h4>
                <div className="interests-tags">
                  {profileUser.details.lookingFor.map((item) => (
                    <span key={item} className="interest-tag">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profileUser?.details?.intoTags?.length > 0 && (
              <div className="profile-section">
                <h4>I'm into</h4>
                <div className="interests-tags">
                  {profileUser.details.intoTags.map((tag) => (
                    <span key={tag} className="interest-tag tag-purple">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profileUser?.details?.turnOns?.length > 0 && (
              <div className="profile-section">
                <h4>It turns me on</h4>
                <div className="interests-tags">
                  {profileUser.details.turnOns.map((tag) => (
                    <span key={tag} className="interest-tag tag-pink">
                      {tag}
                    </span>
                  ))}
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
