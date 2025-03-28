"use client"

import React, { useState, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import PropTypes from "prop-types"
import { FaHeart, FaComment, FaUser, FaMapMarkerAlt, FaClock } from "react-icons/fa"

// Constants
const TAG_TYPES = {
  LOOKING_FOR: "lookingFor",
  INTO: "into",
  INTEREST: "interest",
}

/**
 * UserCard Component - Displays user information in grid or list view
 */
const UserCard = ({
  user,
  isLiked = false,
  onLike,
  viewMode = "grid",
  onMessage,
  onClick,
  showExtendedDetails = true,
  unreadMessageCount = 0,
  hasUnreadMessages = false,
}) => {
  // Component state
  const [imageError, setImageError] = useState(false)
  const [showAllTags, setShowAllTags] = useState(false)
  const [showMoreSections, setShowMoreSections] = useState(false)

  // Navigation
  const navigate = useNavigate()

  // Helper functions
  const normalizePhotoUrl = useCallback((url) => {
    if (!url) return null
    if (url.startsWith("http://") || url.startsWith("https://")) return url

    // Fix for avatar URLs - use full API URL
    if (url.startsWith("/api/")) {
      return `${process.env.REACT_APP_API_URL || "http://localhost:5000"}${url.substring(4)}`
    }

    return url.startsWith("/") ? url : `/${url}`
  }, [])

  const getTagClass = useCallback((type) => {
    switch (type) {
      case TAG_TYPES.LOOKING_FOR:
        return "looking-for-tag"
      case TAG_TYPES.INTO:
        return "into-tag"
      case TAG_TYPES.INTEREST:
        return "interest-tag"
      default:
        return "interest-tag"
    }
  }, [])

  // Event handlers
  const handleCardClick = useCallback(() => {
    if (onClick) {
      onClick()
    } else {
      navigate(`/user/${user._id}`)
    }
  }, [onClick, navigate, user?._id])

  const handleLikeClick = useCallback(
    (e) => {
      e.stopPropagation()
      if (onLike) {
        console.log(`Like button clicked for user ${user._id}, current isLiked: ${isLiked}`)
        // Pass the current like state to the parent component
        onLike(user._id, user.nickname)
      }
    },
    [onLike, user?._id, user?.nickname, isLiked],
  )

  const handleMessageClick = useCallback(
    (e) => {
      e.stopPropagation()
      if (onMessage) {
        onMessage(e, user)
      }
    },
    [onMessage, user],
  )

  const toggleShowAllTags = useCallback((e) => {
    e?.stopPropagation()
    setShowAllTags((prev) => !prev)
  }, [])

  const toggleShowMoreSections = useCallback((e) => {
    e?.stopPropagation()
    setShowMoreSections((prev) => !prev)
  }, [])

  // Memoized data calculations
  const profilePhotoUrl = useMemo(() => {
    if (!user?.photos?.length) return null
    return normalizePhotoUrl(user.photos[0]?.url)
  }, [user?.photos, normalizePhotoUrl])

  const subtitle = useMemo(() => {
    if (!user?.details) return ""
    const { age, gender, location } = user.details
    const parts = []
    if (age) parts.push(age)
    if (gender) parts.push(gender)
    if (location) parts.push(location)
    return parts.join(" • ")
  }, [user?.details])

  const extendedDetails = useMemo(() => {
    if (!user?.details)
      return {
        status: null,
        identity: null,
      }

    const details = {
      status: null,
      identity: null,
    }

    const { maritalStatus, iAm } = user.details

    if (maritalStatus) {
      details.status = maritalStatus
    }

    if (iAm) {
      details.identity = iAm
    }

    return details
  }, [user?.details])

  const tags = useMemo(() => {
    if (!user?.details) return []

    const allTags = {
      lookingFor: [],
      into: [],
      interests: [],
    }

    const { lookingFor = [], intoTags = [], interests = [] } = user.details

    lookingFor.forEach((item) => allTags.lookingFor.push(item))
    intoTags.forEach((item) => allTags.into.push(item))
    interests.forEach((item) => allTags.interests.push(item))

    return allTags
  }, [user?.details])

  // Last active formatting
  const lastActiveText = useMemo(() => {
    // If user is currently online, show "Active now" regardless of lastActive timestamp
    if (user?.isOnline) return "Active now"

    if (!user?.lastActive) return "Never active"

    // Create a simple last active text (could be expanded with proper date formatting)
    const lastActive = new Date(user.lastActive)
    const now = new Date()
    const diffHours = Math.floor((now - lastActive) / (1000 * 60 * 60))

    if (diffHours < 1) return "Active just now"
    if (diffHours < 24) return `Active ${diffHours}h ago`

    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `Active ${diffDays}d ago`

    return `Active ${lastActive.toLocaleDateString()}`
  }, [user?.lastActive, user?.isOnline])

  // Validation
  if (!user) return null

  // Common action buttons for both grid and list view
  const renderActionButtons = () => (
    <>
      <button
        className={`card-action-button like ${isLiked ? "active" : ""}`}
        onClick={handleLikeClick}
        aria-label={`${isLiked ? "Unlike" : "Like"} ${user.nickname}`}
        style={{
          color: isLiked ? "#ff4757" : "#aaa",
          background: isLiked ? "rgba(255, 71, 87, 0.1)" : "transparent",
        }}
      >
        <FaHeart />
      </button>
      <button
        className="card-action-button message"
        onClick={handleMessageClick}
        aria-label={`Message ${user.nickname}`}
      >
        <FaComment />
      </button>
    </>
  )

  // Common photo rendering for both views
  const renderUserPhoto = (containerClass, imageClass = "") => (
    <div className={containerClass}>
      {user.photos?.length > 0 ? (
        <>
          <img
            src={profilePhotoUrl || "/placeholder.svg"}
            alt={user.nickname}
            onError={() => setImageError(true)}
            style={{ display: imageError ? "none" : "block" }}
            className={imageClass}
            loading="lazy"
          />
          {imageError && (
            <div className="avatar-placeholder">
              <FaUser />
            </div>
          )}
        </>
      ) : (
        <div className="avatar-placeholder">
          <FaUser />
        </div>
      )}
      {user.isOnline && <div className="online-indicator"></div>}
    </div>
  )

  // Rendering based on view mode
  if (viewMode === "grid") {
    return (
      <div className="user-card" onClick={handleCardClick}>
        {/* User Photo */}
        {renderUserPhoto("user-card-photo")}

        {/* User Info */}
        <div className="user-card-info">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <h3 className="user-card-name">
              {user.nickname}
              {user.details?.age && <span>, {user.details.age}</span>}
            </h3>
            {hasUnreadMessages && <span className="unread-badge">{unreadMessageCount}</span>}
          </div>

          {/* Last Active Status */}
          <p className="user-card-last-active">
            <FaClock style={{ marginRight: "4px", fontSize: "0.8em", opacity: 0.7 }} />
            {lastActiveText}
          </p>

          <p className="location">
            <FaMapMarkerAlt className="location-icon" />
            {user.details?.location || "Unknown location"}
          </p>

          {/* Extended Details Section */}
          {showExtendedDetails && (extendedDetails.status || extendedDetails.identity) && (
            <div className="user-tags-container">
              {extendedDetails.status && (
                <div className="tag-category">
                  <h4 className="tag-category-title">Status</h4>
                  <div className="user-interests">
                    <span className="interest-tag status-tag">{extendedDetails.status}</span>
                  </div>
                </div>
              )}

              {extendedDetails.identity && (
                <div className="tag-category">
                  <h4 className="tag-category-title">I am</h4>
                  <div className="user-interests">
                    <span
                      className={`interest-tag identity-tag ${
                        extendedDetails.identity.toLowerCase().includes("woman")
                          ? "identity-woman"
                          : extendedDetails.identity.toLowerCase().includes("man")
                            ? "identity-man"
                            : extendedDetails.identity.toLowerCase().includes("couple")
                              ? "identity-couple"
                              : ""
                      }`}
                    >
                      {extendedDetails.identity}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Tags */}
          {showExtendedDetails && (
            <div className="user-tags-container">
              {/* Interests always visible */}
              {tags.interests.length > 0 && (
                <div className="tag-category">
                  <h4 className="tag-category-title">Interests</h4>
                  <div className="user-interests">
                    {(showAllTags ? tags.interests : tags.interests.slice(0, 3)).map((tag, idx) => (
                      <span key={`interest-${idx}`} className="interest-tag">
                        {tag}
                      </span>
                    ))}
                    {tags.interests.length > 3 && !showAllTags && (
                      <span className="interest-more" onClick={toggleShowAllTags}>
                        +{tags.interests.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Show More/Less Toggle for additional sections */}
              {(tags.lookingFor.length > 0 || tags.into.length > 0) && (
                <div className="tags-toggle">
                  <span className="tags-toggle-btn" onClick={toggleShowMoreSections}>
                    {showMoreSections ? "Show less" : "Show more"}
                  </span>
                </div>
              )}

              {/* Looking For and Into sections - only visible when showMoreSections is true */}
              {showMoreSections && (
                <>
                  {tags.lookingFor.length > 0 && (
                    <div className="tag-category">
                      <h4 className="tag-category-title">Looking for</h4>
                      <div className="user-interests">
                        {(showAllTags ? tags.lookingFor : tags.lookingFor.slice(0, 3)).map((tag, idx) => (
                          <span key={`lookingFor-${idx}`} className="interest-tag looking-for-tag">
                            {tag}
                          </span>
                        ))}
                        {tags.lookingFor.length > 3 && !showAllTags && (
                          <span className="interest-more" onClick={toggleShowAllTags}>
                            +{tags.lookingFor.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {tags.into.length > 0 && (
                    <div className="tag-category">
                      <h4 className="tag-category-title">Into</h4>
                      <div className="user-interests">
                        {(showAllTags ? tags.into : tags.into.slice(0, 3)).map((tag, idx) => (
                          <span key={`into-${idx}`} className="interest-tag into-tag">
                            {tag}
                          </span>
                        ))}
                        {tags.into.length > 3 && !showAllTags && (
                          <span className="interest-more" onClick={toggleShowAllTags}>
                            +{tags.into.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Global More/Less Toggle for all tags */}
                  {showMoreSections &&
                    (tags.lookingFor.length > 3 || tags.into.length > 3 || tags.interests.length > 3) && (
                      <div className="tags-toggle">
                        <span className="tags-toggle-btn" onClick={toggleShowAllTags}>
                          {showAllTags ? "Show less tags" : "Show all tags"}
                        </span>
                      </div>
                    )}
                </>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="user-actions">{renderActionButtons()}</div>
        </div>
      </div>
    )
  }

  // List View Rendering
  return (
    <div className="user-list-item" onClick={handleCardClick}>
      {/* User Photo - List View */}
      {renderUserPhoto("user-list-photo-container", "user-list-photo")}

      {/* User Info - List View */}
      <div className="user-list-info">
        <div className="user-list-header">
          <h3 className="user-list-name">
            {user.nickname}
            {user.details?.age && <span>, {user.details.age}</span>}
          </h3>
          {hasUnreadMessages && <span className="unread-badge">{unreadMessageCount}</span>}
        </div>

        {/* Last Active Status */}
        <p className="user-list-last-active">
          <FaClock style={{ marginRight: "4px", fontSize: "0.8em", opacity: 0.7 }} />
          {lastActiveText}
        </p>

        <p className="location">
          <FaMapMarkerAlt className="location-icon" />
          {user.details?.location || "Unknown location"}
        </p>

        {/* Extended Details Section - List View */}
        {showExtendedDetails && (extendedDetails.status || extendedDetails.identity) && (
          <div className="user-tags-container list-view">
            {extendedDetails.status && (
              <div className="tag-category">
                <h4 className="tag-category-title">Status</h4>
                <div className="user-interests">
                  <span className="interest-tag status-tag">{extendedDetails.status}</span>
                </div>
              </div>
            )}

            {extendedDetails.identity && (
              <div className="tag-category">
                <h4 className="tag-category-title">I am</h4>
                <div className="user-interests">
                  <span
                    className={`interest-tag identity-tag ${
                      extendedDetails.identity.toLowerCase().includes("woman")
                        ? "identity-woman"
                        : extendedDetails.identity.toLowerCase().includes("man")
                          ? "identity-man"
                          : extendedDetails.identity.toLowerCase().includes("couple")
                            ? "identity-couple"
                            : ""
                    }`}
                  >
                    {extendedDetails.identity}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* User Tags - List View */}
        {showExtendedDetails && (
          <div className="user-tags-container list-view">
            {/* Interests are always visible */}
            {tags.interests.length > 0 && (
              <div className="tag-category">
                <h4 className="tag-category-title">Interests</h4>
                <div className="user-interests">
                  {(showAllTags ? tags.interests : tags.interests.slice(0, 2)).map((tag, idx) => (
                    <span key={`interest-${idx}`} className="interest-tag">
                      {tag}
                    </span>
                  ))}
                  {tags.interests.length > 2 && !showAllTags && (
                    <span className="interest-more" onClick={toggleShowAllTags}>
                      +{tags.interests.length - 2}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Show More/Less Toggle for additional sections */}
            {(tags.lookingFor.length > 0 || tags.into.length > 0) && (
              <div className="tags-toggle">
                <span className="tags-toggle-btn" onClick={toggleShowMoreSections}>
                  {showMoreSections ? "Show less" : "Show more"}
                </span>
              </div>
            )}

            {/* Looking For and Into sections - only visible when showMoreSections is true */}
            {showMoreSections && (
              <>
                {tags.lookingFor.length > 0 && (
                  <div className="tag-category">
                    <h4 className="tag-category-title">Looking for</h4>
                    <div className="user-interests">
                      {(showAllTags ? tags.lookingFor : tags.lookingFor.slice(0, 2)).map((tag, idx) => (
                        <span key={`lookingFor-${idx}`} className="interest-tag looking-for-tag">
                          {tag}
                        </span>
                      ))}
                      {tags.lookingFor.length > 2 && !showAllTags && (
                        <span className="interest-more" onClick={toggleShowAllTags}>
                          +{tags.lookingFor.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {tags.into.length > 0 && (
                  <div className="tag-category">
                    <h4 className="tag-category-title">Into</h4>
                    <div className="user-interests">
                      {(showAllTags ? tags.into : tags.into.slice(0, 2)).map((tag, idx) => (
                        <span key={`into-${idx}`} className="interest-tag into-tag">
                          {tag}
                        </span>
                      ))}
                      {tags.into.length > 2 && !showAllTags && (
                        <span className="interest-more" onClick={toggleShowAllTags}>
                          +{tags.into.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Global More/Less Toggle for all tags */}
                {(tags.lookingFor.length > 2 || tags.into.length > 2 || tags.interests.length > 2) && (
                  <div className="tags-toggle">
                    <span className="tags-toggle-btn" onClick={toggleShowAllTags}>
                      {showAllTags ? "Show less tags" : "Show all tags"}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons - List View */}
      <div className="user-list-actions">{renderActionButtons()}</div>
    </div>
  )
}

// PropTypes for better type checking
UserCard.propTypes = {
  user: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    nickname: PropTypes.string.isRequired,
    isOnline: PropTypes.bool,
    lastActive: PropTypes.string,
    photos: PropTypes.arrayOf(
      PropTypes.shape({
        url: PropTypes.string,
      }),
    ),
    details: PropTypes.shape({
      age: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      gender: PropTypes.string,
      location: PropTypes.string,
      maritalStatus: PropTypes.string,
      iAm: PropTypes.string,
      lookingFor: PropTypes.arrayOf(PropTypes.string),
      intoTags: PropTypes.arrayOf(PropTypes.string),
      interests: PropTypes.arrayOf(PropTypes.string),
    }),
  }).isRequired,
  isLiked: PropTypes.bool,
  onLike: PropTypes.func,
  viewMode: PropTypes.oneOf(["grid", "list"]),
  onMessage: PropTypes.func,
  onClick: PropTypes.func,
  showExtendedDetails: PropTypes.bool,
  unreadMessageCount: PropTypes.number,
  hasUnreadMessages: PropTypes.bool,
}

export default React.memo(UserCard)
