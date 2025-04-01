import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { FaHeart, FaComment, FaUser, FaMapMarkerAlt, FaClock } from "react-icons/fa";
import { Avatar, Card, Button } from "./common";
import { formatDate, normalizePhotoUrl, logger } from "../utils";
import { withMemo } from "./common";

// Constants
const TAG_TYPES = {
  LOOKING_FOR: "lookingFor",
  INTO: "into",
  INTEREST: "interest",
};

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
  const [showAllTags, setShowAllTags] = useState(false);
  const [showMoreSections, setShowMoreSections] = useState(false);

  // Navigation
  const navigate = useNavigate();

  // Helper functions
  const getTagClass = useCallback((type) => {
    switch (type) {
      case TAG_TYPES.LOOKING_FOR:
        return "looking-for-tag";
      case TAG_TYPES.INTO:
        return "into-tag";
      case TAG_TYPES.INTEREST:
        return "interest-tag";
      default:
        return "interest-tag";
    }
  }, []);

  // Event handlers
  const handleCardClick = useCallback(() => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/user/${user._id}`);
    }
  }, [onClick, navigate, user?._id]);

  // Fixed like click handler to properly pass user data
  const handleLikeClick = useCallback(
    (e) => {
      // Prevent event propagation to avoid triggering parent click
      e.stopPropagation();
      e.preventDefault();

      if (onLike) {
        logger.debug(`Like button clicked for user ${user._id}, current isLiked: ${isLiked}`);
        // Pass the user ID and name to the parent component for like handling
        onLike(user._id, user.nickname);
      }
    },
    [onLike, user?._id, user?.nickname, isLiked],
  );

  const handleMessageClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (onMessage) {
        onMessage(e, user);
      }
    },
    [onMessage, user],
  );

  const toggleShowAllTags = useCallback((e) => {
    e?.stopPropagation();
    setShowAllTags((prev) => !prev);
  }, []);

  const toggleShowMoreSections = useCallback((e) => {
    e?.stopPropagation();
    setShowMoreSections((prev) => !prev);
  }, []);

  // Memoized data calculations
  const profilePhotoUrl = useMemo(() => {
    if (!user?.photos?.length) return null;
    return user.photos[0]?.url;
  }, [user?.photos]);

  const subtitle = useMemo(() => {
    if (!user?.details) return "";
    const { age, gender, location } = user.details;
    const parts = [];
    if (age) parts.push(age);
    if (gender) parts.push(gender);
    if (location) parts.push(location);
    return parts.join(" • ");
  }, [user?.details]);

  const extendedDetails = useMemo(() => {
    if (!user?.details)
      return {
        status: null,
        identity: null,
      };

    const details = {
      status: null,
      identity: null,
    };

    const { maritalStatus, iAm } = user.details;

    if (maritalStatus) {
      details.status = maritalStatus;
    }

    if (iAm) {
      details.identity = iAm;
    }

    return details;
  }, [user?.details]);

  const tags = useMemo(() => {
    if (!user?.details) return [];

    const allTags = {
      lookingFor: [],
      into: [],
      interests: [],
    };

    const { lookingFor = [], intoTags = [], interests = [] } = user.details;

    lookingFor.forEach((item) => allTags.lookingFor.push(item));
    intoTags.forEach((item) => allTags.into.push(item));
    interests.forEach((item) => allTags.interests.push(item));

    return allTags;
  }, [user?.details]);

  // Last active formatting
  const lastActiveText = useMemo(() => {
    // If user is currently online, show "Active now" regardless of lastActive timestamp
    if (user?.isOnline) return "Active now";

    if (!user?.lastActive) return "Never active";

    return formatDate(user.lastActive, { showRelative: true, showTime: false, showDate: false });
  }, [user?.lastActive, user?.isOnline]);

  // Validation
  if (!user) return null;

  // Common action buttons for both grid and list view
  const renderActionButtons = () => (
    <>
      <button 
        onClick={handleLikeClick}
        aria-label={`${isLiked ? "Unlike" : "Like"} ${user.nickname}`}
        className={`action-btn like-btn ${isLiked ? "active" : ""}`}
      >
        <FaHeart size={18} />
        {isLiked ? 'Liked' : 'Like'}
      </button>
      <button
        onClick={handleMessageClick}
        aria-label={`Message ${user.nickname}`}
        className="action-btn message-btn"
      >
        <FaComment size={18} />
        Message
      </button>
    </>
  );

  // Render the user card
  if (viewMode === "grid") {
    return (
      <Card
        className="user-card"
        onClick={handleCardClick}
        hover={true}
        headerClassName="user-card-header"
        bodyClassName="user-card-body"
      >
        {/* User Photo */}
        <div className="user-card-photo">
          <Avatar
            src={profilePhotoUrl}
            alt={user.nickname}
            size="large"
            status={user.isOnline ? "online" : null}
            showFallback={true}
            statusPosition="top-right"
          />
        </div>

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
          {showExtendedDetails && (
            <div className="user-tags-container extended-details-container">
              <div className="extended-details-row">
                {extendedDetails.identity && (
                  <div className="extended-detail-item">
                    <span className="detail-label">I am:</span>
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
                )}
                
                {tags.lookingFor.length > 0 && (
                  <div className="extended-detail-item">
                    <span className="detail-label">Into:</span>
                    <span className={`interest-tag ${
                      tags.lookingFor[0].toLowerCase().includes("women") || tags.lookingFor[0].toLowerCase().includes("woman")
                        ? "identity-woman"
                        : tags.lookingFor[0].toLowerCase().includes("men") || tags.lookingFor[0].toLowerCase().includes("man")
                          ? "identity-man"
                          : tags.lookingFor[0].toLowerCase().includes("couple")
                            ? "identity-couple"
                            : "looking-for-tag"
                    }`}>
                      {tags.lookingFor[0]}
                    </span>
                    {tags.lookingFor.length > 1 && (
                      <span className="more-count">+{tags.lookingFor.length - 1}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* User Tags */}
          {showExtendedDetails && (
            <div className="user-tags-container">
              {/* Show More/Less Toggle for all sections */}
              {(tags.lookingFor.length > 0 || tags.into.length > 0 || tags.interests.length > 0) && (
                <div className="tags-toggle">
                  <span className="tags-toggle-btn" onClick={toggleShowMoreSections}>
                    {showMoreSections ? "Show less" : "Show more"}
                  </span>
                </div>
              )}

              {/* All sections now only visible when showMoreSections is true */}
              {showMoreSections && (
                <>
                  {/* Interests */}
                  {tags.interests.length > 0 && (
                    <div className="tag-category">
                      <h4 className="tag-category-title">Interests</h4>
                      <div className="user-interests">
                        {(showAllTags ? tags.interests : tags.interests.slice(0, 3)).map((tag, idx) => (
                          <span key={`interest-${idx}`} className={`interest-tag ${
                            tag.toLowerCase().includes("women") || tag.toLowerCase().includes("woman")
                              ? "identity-woman"
                              : tag.toLowerCase().includes("men") || tag.toLowerCase().includes("man")
                                ? "identity-man"
                                : tag.toLowerCase().includes("couple")
                                  ? "identity-couple"
                                  : ""
                          }`}>
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
                
                  {/* Into section - moved to details row above */}

                  {/* Preferences section (formerly Into) */}
                  {tags.into.length > 0 && (
                    <div className="tag-category">
                      <h4 className="tag-category-title">Preferences</h4>
                      <div className="user-interests">
                        {(showAllTags ? tags.into : tags.into.slice(0, 3)).map((tag, idx) => (
                          <span key={`into-${idx}`} className={`interest-tag ${
                            tag.toLowerCase().includes("women") || tag.toLowerCase().includes("woman")
                              ? "identity-woman"
                              : tag.toLowerCase().includes("men") || tag.toLowerCase().includes("man")
                                ? "identity-man"
                                : tag.toLowerCase().includes("couple")
                                  ? "identity-couple"
                                  : "into-tag"
                          }`}>
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
                  {(tags.lookingFor.length > 3 || tags.into.length > 3 || tags.interests.length > 3) && (
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
      </Card>
    );
  }

  // List View Rendering
  return (
    <div className="user-list-item" onClick={handleCardClick}>
      {/* User Photo - List View */}
      <div className="user-list-photo-container">
        <Avatar
          src={profilePhotoUrl}
          alt={user.nickname}
          size="medium"
          status={user.isOnline ? "online" : null}
          showFallback={true}
          statusPosition="top-right"
        />
      </div>

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

        {/* Extended Details - List View */}
        {showExtendedDetails && (
          <div className="user-tags-container extended-details-container list-view">
            <div className="extended-details-row">
              {extendedDetails.identity && (
                <div className="extended-detail-item">
                  <span className="detail-label">I am:</span>
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
              )}
              
              {tags.lookingFor.length > 0 && (
                <div className="extended-detail-item">
                  <span className="detail-label">Into:</span>
                  <span className={`interest-tag ${
                    tags.lookingFor[0].toLowerCase().includes("women") || tags.lookingFor[0].toLowerCase().includes("woman")
                      ? "identity-woman"
                      : tags.lookingFor[0].toLowerCase().includes("men") || tags.lookingFor[0].toLowerCase().includes("man")
                        ? "identity-man"
                        : tags.lookingFor[0].toLowerCase().includes("couple")
                          ? "identity-couple"
                          : "looking-for-tag"
                  }`}>
                    {tags.lookingFor[0]}
                  </span>
                  {tags.lookingFor.length > 1 && (
                    <span className="more-count">+{tags.lookingFor.length - 1}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* User Tags - List View */}
        {showExtendedDetails && (
          <div className="user-tags-container list-view">
            {/* Show More/Less Toggle for all sections */}
            {(tags.lookingFor.length > 0 || tags.into.length > 0 || tags.interests.length > 0) && (
              <div className="tags-toggle">
                <span className="tags-toggle-btn" onClick={toggleShowMoreSections}>
                  {showMoreSections ? "Show less" : "Show more"}
                </span>
              </div>
            )}

            {/* All sections now only visible when showMoreSections is true */}
            {showMoreSections && (
              <>
                {/* Interests */}
                {tags.interests.length > 0 && (
                  <div className="tag-category">
                    <h4 className="tag-category-title">Interests</h4>
                    <div className="user-interests">
                      {(showAllTags ? tags.interests : tags.interests.slice(0, 2)).map((tag, idx) => (
                        <span key={`interest-${idx}`} className={`interest-tag ${
                          tag.toLowerCase().includes("women") || tag.toLowerCase().includes("woman")
                            ? "identity-woman"
                            : tag.toLowerCase().includes("men") || tag.toLowerCase().includes("man")
                              ? "identity-man"
                              : tag.toLowerCase().includes("couple")
                                ? "identity-couple"
                                : ""
                        }`}>
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
                
                {/* Into section - moved to details row above */}

                {/* Preferences section (formerly Into) */}
                {tags.into.length > 0 && (
                  <div className="tag-category">
                    <h4 className="tag-category-title">Preferences</h4>
                    <div className="user-interests">
                      {(showAllTags ? tags.into : tags.into.slice(0, 2)).map((tag, idx) => (
                        <span key={`into-${idx}`} className={`interest-tag ${
                          tag.toLowerCase().includes("women") || tag.toLowerCase().includes("woman")
                            ? "identity-woman"
                            : tag.toLowerCase().includes("men") || tag.toLowerCase().includes("man")
                              ? "identity-man"
                              : tag.toLowerCase().includes("couple")
                                ? "identity-couple"
                                : "into-tag"
                        }`}>
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
  );
};

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
};

// Use the withMemo HOC instead of React.memo
export default withMemo(UserCard, (prevProps, nextProps) => {
  // Custom comparison function for UserCard
  return (
    prevProps.user._id === nextProps.user._id &&
    prevProps.isLiked === nextProps.isLiked &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.hasUnreadMessages === nextProps.hasUnreadMessages &&
    prevProps.unreadMessageCount === nextProps.unreadMessageCount &&
    prevProps.user.isOnline === nextProps.user.isOnline
  );
}, { debug: process.env.NODE_ENV !== 'production' });