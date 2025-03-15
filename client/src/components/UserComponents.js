"use client"

// Upgraded UserComponents.js with improved performance and accessibility
import { useState, useEffect, useCallback, memo } from "react"
import { Link } from "react-router-dom"
import { FaHeart, FaComment, FaVideo, FaLock, FaUnlock, FaTrash, FaStar } from "react-icons/fa"
import { useAuth } from "../context"
import apiService from "../services/apiService"
import { toast } from "react-toastify"

/**
 * UserCard component for displaying user information in a grid or list
 */
export const UserCard = memo(({ user, onMessageClick, onVideoClick, onLikeClick, layout = "grid" }) => {
  const [isHovered, setIsHovered] = useState(false)
  const { user: currentUser } = useAuth()
  const isCurrentUser = currentUser && user && currentUser._id === user._id

  // Format the last active time
  const formatLastActive = (lastActive) => {
    if (!lastActive) return "Unknown"

    const lastActiveDate = new Date(lastActive)
    const now = new Date()
    const diffMs = now - lastActiveDate
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`

    return lastActiveDate.toLocaleDateString()
  }

  // Get the profile photo URL
  const getProfilePhoto = () => {
    if (!user || !user.photos || user.photos.length === 0) {
      return "/placeholder.svg"
    }
    return user.photos[0].url
  }

  // Handle card actions
  const handleMessageClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (onMessageClick) onMessageClick(user)
  }

  const handleVideoClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (onVideoClick) onVideoClick(user)
  }

  const handleLikeClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (onLikeClick) onLikeClick(user)
  }

  // Render grid layout
  if (layout === "grid") {
    return (
      <div
        className="user-card"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={`${user.nickname}'s profile card`}
      >
        <Link to={`/profile/${user._id}`} className="user-card-link">
          <div className="user-card-photo-container">
            <img
              src={getProfilePhoto() || "/placeholder.svg"}
              alt={`${user.nickname}'s profile`}
              className="user-card-photo"
              loading="lazy"
            />
            {user.isOnline && <span className="online-indicator" aria-label="Online"></span>}
          </div>

          <div className="user-card-info">
            <h3 className="user-card-name">{user.nickname}</h3>
            <p className="user-card-details">
              {user.details?.age && `${user.details.age} • `}
              {user.details?.gender && `${user.details.gender} • `}
              {user.details?.location}
            </p>
            <p className="user-card-last-active">
              {user.isOnline ? "Online now" : `Last active: ${formatLastActive(user.lastActive)}`}
            </p>
          </div>

          {isHovered && !isCurrentUser && (
            <div className="user-card-actions">
              <button
                onClick={handleMessageClick}
                className="action-btn message-btn"
                aria-label={`Message ${user.nickname}`}
              >
                <FaComment />
              </button>
              <button
                onClick={handleVideoClick}
                className="action-btn video-btn"
                aria-label={`Video call ${user.nickname}`}
              >
                <FaVideo />
              </button>
              <button onClick={handleLikeClick} className="action-btn like-btn" aria-label={`Like ${user.nickname}`}>
                <FaHeart />
              </button>
            </div>
          )}
        </Link>
      </div>
    )
  }

  // Render list layout
  return (
    <div
      className="user-list-item"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={`${user.nickname}'s profile item`}
    >
      <Link to={`/profile/${user._id}`} className="user-list-link">
        <div className="user-list-photo-container">
          <img
            src={getProfilePhoto() || "/placeholder.svg"}
            alt={`${user.nickname}'s profile`}
            className="user-list-photo"
            loading="lazy"
          />
          {user.isOnline && <span className="online-indicator" aria-label="Online"></span>}
        </div>

        <div className="user-list-info">
          <h3 className="user-list-name">{user.nickname}</h3>
          <p className="user-list-details">
            {user.details?.age && `${user.details.age} • `}
            {user.details?.gender && `${user.details.gender} • `}
            {user.details?.location}
          </p>
          <p className="user-list-last-active">
            {user.isOnline ? "Online now" : `Last active: ${formatLastActive(user.lastActive)}`}
          </p>
        </div>
      </Link>

      {!isCurrentUser && (
        <div className="user-list-actions">
          <button
            onClick={handleMessageClick}
            className="action-btn message-btn"
            aria-label={`Message ${user.nickname}`}
          >
            <FaComment />
          </button>
          <button
            onClick={handleVideoClick}
            className="action-btn video-btn"
            aria-label={`Video call ${user.nickname}`}
          >
            <FaVideo />
          </button>
          <button onClick={handleLikeClick} className="action-btn like-btn" aria-label={`Like ${user.nickname}`}>
            <FaHeart />
          </button>
        </div>
      )}
    </div>
  )
})

/**
 * UserPhotoGallery component for displaying and managing user photos
 */
export const UserPhotoGallery = ({ userId, editable = false, onPhotoClick }) => {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const { user: currentUser } = useAuth()
  const isCurrentUser = currentUser && userId === currentUser._id

  // Fetch user photos
  const fetchPhotos = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiService.get(`/users/${userId}`)
      if (response.success && response.data.user) {
        setPhotos(response.data.user.photos || [])
      } else {
        throw new Error(response.error || "Failed to fetch photos")
      }
    } catch (err) {
      setError(err.message || "Failed to fetch photos")
      toast.error(err.message || "Failed to fetch photos")
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Load photos on mount
  useEffect(() => {
    fetchPhotos()
  }, [fetchPhotos])

  // Handle photo upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"]
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload a JPEG, PNG, or GIF image.")
      return
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 5MB.")
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append("photo", file)
      formData.append("isPrivate", false)

      const response = await apiService.upload("/users/photos", formData, (progress) => {
        setUploadProgress(progress)
      })

      if (response.success) {
        toast.success("Photo uploaded successfully!")
        fetchPhotos()
      } else {
        throw new Error(response.error || "Failed to upload photo")
      }
    } catch (err) {
      setError(err.message || "Failed to upload photo")
      toast.error(err.message || "Failed to upload photo")
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      e.target.value = null // Reset file input
    }
  }

  // Handle setting photo as profile photo
  const handleSetAsProfile = async (photoId) => {
    try {
      const response = await apiService.put(`/users/photos/${photoId}/profile`)
      if (response.success) {
        toast.success("Profile photo updated!")
        fetchPhotos()
      } else {
        throw new Error(response.error || "Failed to update profile photo")
      }
    } catch (err) {
      toast.error(err.message || "Failed to update profile photo")
    }
  }

  // Handle toggling photo privacy
  const handleTogglePrivacy = async (photoId, isCurrentlyPrivate) => {
    try {
      const response = await apiService.put(`/users/photos/${photoId}/privacy`, {
        isPrivate: !isCurrentlyPrivate,
      })
      if (response.success) {
        toast.success(`Photo is now ${!isCurrentlyPrivate ? "private" : "public"}`)
        fetchPhotos()
      } else {
        throw new Error(response.error || "Failed to update photo privacy")
      }
    } catch (err) {
      toast.error(err.message || "Failed to update photo privacy")
    }
  }

  // Handle deleting a photo
  const handleDeletePhoto = async (photoId) => {
    if (!window.confirm("Are you sure you want to delete this photo?")) return

    try {
      const response = await apiService.delete(`/users/photos/${photoId}`)
      if (response.success) {
        toast.success("Photo deleted successfully!")
        fetchPhotos()
      } else {
        throw new Error(response.error || "Failed to delete photo")
      }
    } catch (err) {
      toast.error(err.message || "Failed to delete photo")
    }
  }

  // Handle photo click
  const handlePhotoClick = (photo) => {
    if (onPhotoClick) onPhotoClick(photo)
  }

  if (loading && photos.length === 0) {
    return <div className="loading-spinner">Loading photos...</div>
  }

  if (error && photos.length === 0) {
    return <div className="error-message">Error: {error}</div>
  }

  return (
    <div className="photo-gallery">
      {photos.length === 0 ? (
        <div className="no-photos">
          <p>No photos available</p>
          {isCurrentUser && editable && (
            <div className="upload-container">
              <label htmlFor="photo-upload" className="upload-btn">
                Upload your first photo
              </label>
              <input
                id="photo-upload"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif"
                onChange={handlePhotoUpload}
                style={{ display: "none" }}
              />
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="photo-grid">
            {photos.map((photo, index) => (
              <div key={photo._id} className="photo-item">
                <div
                  className="photo-container"
                  onClick={() => handlePhotoClick(photo)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Photo ${index + 1}${photo.isPrivate ? " (Private)" : ""}`}
                >
                  <img src={photo.url || "/placeholder.svg"} alt={`User photo ${index + 1}`} loading="lazy" />
                  {photo.isPrivate && (
                    <div className="private-indicator">
                      <FaLock />
                    </div>
                  )}
                </div>

                {isCurrentUser && editable && (
                  <div className="photo-actions">
                    {index !== 0 && (
                      <button
                        onClick={() => handleSetAsProfile(photo._id)}
                        className="photo-action-btn profile-btn"
                        title="Set as profile photo"
                        aria-label="Set as profile photo"
                      >
                        <FaStar />
                      </button>
                    )}
                    <button
                      onClick={() => handleTogglePrivacy(photo._id, photo.isPrivate)}
                      className="photo-action-btn privacy-btn"
                      title={photo.isPrivate ? "Make public" : "Make private"}
                      aria-label={photo.isPrivate ? "Make public" : "Make private"}
                    >
                      {photo.isPrivate ? <FaUnlock /> : <FaLock />}
                    </button>
                    <button
                      onClick={() => handleDeletePhoto(photo._id)}
                      className="photo-action-btn delete-btn"
                      title="Delete photo"
                      aria-label="Delete photo"
                    >
                      <FaTrash />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {isCurrentUser && editable && photos.length < 10 && (
            <div className="upload-container">
              {isUploading ? (
                <div className="upload-progress">
                  <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                  <span>{uploadProgress}%</span>
                </div>
              ) : (
                <>
                  <label htmlFor="photo-upload" className="upload-btn">
                    Upload Photo
                  </label>
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif"
                    onChange={handlePhotoUpload}
                    style={{ display: "none" }}
                  />
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * UserPhotoViewer component for viewing photos with privacy controls
 */
export const UserPhotoViewer = ({ photo, userId, onClose, onNext, onPrevious, isPrivate, hasAccess }) => {
  const [requestingAccess, setRequestingAccess] = useState(false)
  const { user } = useAuth()
  const isCurrentUser = user && userId === user._id

  // Handle requesting access to private photo
  const handleRequestAccess = async () => {
    if (!user || isCurrentUser) return

    setRequestingAccess(true)
    try {
      const response = await apiService.post(`/users/photos/${photo._id}/request`, { userId })
      if (response.success) {
        toast.success("Access requested. The user will be notified.")
      } else {
        throw new Error(response.error || "Failed to request access")
      }
    } catch (err) {
      toast.error(err.message || "Failed to request access")
    } finally {
      setRequestingAccess(false)
    }
  }

  return (
    <div className="photo-viewer-overlay" onClick={onClose}>
      <div className="photo-viewer-container" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose} aria-label="Close photo viewer">
          &times;
        </button>

        {isPrivate && !hasAccess && !isCurrentUser ? (
          <div className="private-photo-container">
            <div className="private-photo-message">
              <FaLock size={48} />
              <h3>This photo is private</h3>
              <p>You need permission from the user to view this photo.</p>
              <button onClick={handleRequestAccess} disabled={requestingAccess} className="request-access-btn">
                {requestingAccess ? "Requesting..." : "Request Access"}
              </button>
            </div>
          </div>
        ) : (
          <div className="photo-viewer-content">
            <img src={photo.url || "/placeholder.svg"} alt="Full size" />

            <div className="photo-viewer-controls">
              <button onClick={onPrevious} className="nav-btn prev-btn" aria-label="Previous photo">
                &lt;
              </button>
              <button onClick={onNext} className="nav-btn next-btn" aria-label="Next photo">
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * UserList component for displaying a list of users with filtering
 */
export const UserList = memo(({ users, onUserClick, loading, error, layout = "grid" }) => {
  if (loading) {
    return <div className="loading-spinner">Loading users...</div>
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>
  }

  if (!users || users.length === 0) {
    return <div className="no-users">No users found</div>
  }

  return (
    <div className={`user-${layout === "grid" ? "grid" : "list"}`}>
      {users.map((user) => (
        <UserCard key={user._id} user={user} onMessageClick={onUserClick} layout={layout} />
      ))}
    </div>
  )
})

/**
 * UserFilter component for filtering users
 */
export const UserFilter = ({ onFilter, initialFilters = {} }) => {
  const [filters, setFilters] = useState({
    gender: initialFilters.gender || "",
    minAge: initialFilters.minAge || "",
    maxAge: initialFilters.maxAge || "",
    location: initialFilters.location || "",
    interests: initialFilters.interests || "",
    onlineOnly: initialFilters.onlineOnly || false,
  })

  // Handle filter changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFilters((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  // Apply filters
  const applyFilters = (e) => {
    e.preventDefault()
    if (onFilter) onFilter(filters)
  }

  // Reset filters
  const resetFilters = () => {
    setFilters({
      gender: "",
      minAge: "",
      maxAge: "",
      location: "",
      interests: "",
      onlineOnly: false,
    })
    if (onFilter) onFilter({})
  }

  return (
    <form className="user-filter-form" onSubmit={applyFilters}>
      <div className="filter-row">
        <div className="filter-group">
          <label htmlFor="gender">Gender</label>
          <select id="gender" name="gender" value={filters.gender} onChange={handleChange}>
            <option value="">Any</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non-binary">Non-binary</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="minAge">Min Age</label>
          <input
            type="number"
            id="minAge"
            name="minAge"
            min="18"
            max="120"
            value={filters.minAge}
            onChange={handleChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="maxAge">Max Age</label>
          <input
            type="number"
            id="maxAge"
            name="maxAge"
            min="18"
            max="120"
            value={filters.maxAge}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="filter-row">
        <div className="filter-group">
          <label htmlFor="location">Location</label>
          <input
            type="text"
            id="location"
            name="location"
            value={filters.location}
            onChange={handleChange}
            placeholder="City, Country"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="interests">Interests</label>
          <input
            type="text"
            id="interests"
            name="interests"
            value={filters.interests}
            onChange={handleChange}
            placeholder="Separate with commas"
          />
        </div>

        <div className="filter-group checkbox-group">
          <label htmlFor="onlineOnly">
            <input
              type="checkbox"
              id="onlineOnly"
              name="onlineOnly"
              checked={filters.onlineOnly}
              onChange={handleChange}
            />
            Online Only
          </label>
        </div>
      </div>

      <div className="filter-actions">
        <button type="submit" className="apply-filter-btn">
          Apply Filters
        </button>
        <button type="button" className="reset-filter-btn" onClick={resetFilters}>
          Reset
        </button>
      </div>
    </form>
  )
}

export default {
  UserCard,
  UserPhotoGallery,
  UserPhotoViewer,
  UserList,
  UserFilter,
}
