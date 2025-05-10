import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import {
  FaHeart,
  FaComment,
  FaMapMarkerAlt,
  FaClock,
  FaChevronDown,
  FaChevronUp
} from "react-icons/fa";
import { withMemo } from "./common";
import { useLanguage, useAuth } from "../context";
import { formatDate, logger, translate, translateProfile, translateTag } from "../utils";
import { usePhotoManagement } from "../hooks";
import styles from "../styles/usercard.module.css";

const log = logger.create("UserCard");

// Tag type constants
const TAG_TYPES = {
  IDENTITY: "identity",
  LOOKING_FOR: "lookingFor",
  INTO: "into",
  INTEREST: "interest",
};

/**
 * Safely gets a translation string, handling different translation formats and fallbacks
 * @deprecated Use translate() from utils/i18n.js instead
 */
const safeTranslate = (t, key, defaultValue = "") => {
  log.debug("Using deprecated safeTranslate, consider switching to translate from utils/i18n");
  // Use our new centralized translation function
  return translate(key, t, defaultValue);
};

/**
 * Returns the correct tag style class based on the tag type and content
 */
const getTagClassName = (tagType, tagContent = "") => {
  const baseClass = styles.tag;
  const text = tagContent.toLowerCase();

  // First check content-based styles that override the tag type
  if (text.includes("woman")) return `${baseClass} ${styles.identityWoman}`;
  if (text.includes("man")) return `${baseClass} ${styles.identityMan}`;
  if (text.includes("couple")) return `${baseClass} ${styles.identityCouple}`;

  // Then apply type-based styles
  switch (tagType) {
    case TAG_TYPES.IDENTITY: return `${baseClass} ${styles.identityTag}`;
    case TAG_TYPES.LOOKING_FOR: return `${baseClass} ${styles.lookingForTag}`;
    case TAG_TYPES.INTO: return `${baseClass} ${styles.intoTag}`;
    case TAG_TYPES.INTEREST: return `${baseClass} ${styles.interestTag}`;
    default: return baseClass;
  }
};

/**
 * TagGroup component for rendering a collection of tags
 */
const TagGroup = ({ title, tags, tagType, translationNamespace, t, showAll, toggleShowAll, maxVisible = 3 }) => {
  if (!tags || tags.length === 0) return null;

  const getTranslatedTag = (namespace, tag) => {
    if (!tag) return "";

    // Extract the tag type from the namespace (e.g., 'profile.intoTags' -> 'intoTags')
    const tagType = namespace.split('.').pop();

    // Use our centralized translateTag function from utils/i18n.js
    const translated = translateTag(tagType, tag, t);
    if (translated) return translated;

    // If translateTag doesn't find a match, we'll try legacy paths
    // Format key for translation patterns
    const nestedKey = `${namespace}.${tag.toLowerCase().replace(/\s+/g, '_')}`;
    const prefixKey = namespace === 'profile.intoTags'
      ? `profile.intoTag_${tag.toLowerCase().replace(/\s+/g, '_')}`
      : namespace === 'profile.turnOns'
      ? `profile.turnOn_${tag.toLowerCase().replace(/\s+/g, '_')}`
      : namespace === 'profile.interests'
      ? `profile.interests${tag.charAt(0).toUpperCase() + tag.slice(1).replace(/\s+/g, '_')}`
      : null;

    // Try each translation pattern using our centralized translate function
    if (prefixKey) {
      const prefixTranslation = translate(prefixKey, t);
      if (prefixTranslation && prefixTranslation !== prefixKey) {
        return prefixTranslation;
      }
    }

    const nestedTranslation = translate(nestedKey, t);
    if (nestedTranslation && nestedTranslation !== nestedKey) {
      return nestedTranslation;
    }

    // Fallback: Clean up and return the tag
    return tag.charAt(0).toUpperCase() + tag.slice(1).replace(/_/g, ' ');
  };

  const visibleTags = showAll ? tags : tags.slice(0, maxVisible);
  const hasMoreTags = tags.length > maxVisible;

  return (
    <div className={styles.tagCategory}>
      {title && <h4 className={styles.categoryTitle}>{title}</h4>}
      <div className={styles.tagsGroup}>
        {visibleTags.map((tag, idx) => (
          <span key={`${tagType}-${idx}`} className={getTagClassName(tagType, tag)}>
            {getTranslatedTag(translationNamespace, tag)}
          </span>
        ))}
        {hasMoreTags && !showAll && (
          <span className={styles.moreCount} onClick={toggleShowAll}>
            +{tags.length - maxVisible}
          </span>
        )}
      </div>
    </div>
  );
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

  // Hooks
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user: currentUser } = useAuth();
  const { normalizePhotoUrl, getProfilePhotoUrl, handlePhotoLoadError, refreshAllAvatars } = usePhotoManagement();
  
  // Listen for avatar refresh events
  useEffect(() => {
    const handleAvatarRefresh = () => {
      // Force a re-render when avatar refresh event is triggered
      log.debug(`Avatar refresh event received for user ${user.nickname}`);
    };
    
    window.addEventListener('avatar:refresh', handleAvatarRefresh);
    
    return () => {
      window.removeEventListener('avatar:refresh', handleAvatarRefresh);
    };
  }, [user.nickname]);

  // Event Handlers
  const handleCardClick = useCallback((e) => {
    // Don't navigate if the click was on a button
    if (e?.target?.closest('button')) {
      return;
    }

    if (onClick) {
      onClick();
    } else if (user?._id) {
      navigate(`/user/${user._id}`);
    }
  }, [onClick, navigate, user?._id]);

  const handleLikeClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();

    if (onLike && user?._id) {
      log.debug(`Like button clicked for user ${user._id}, current isLiked: ${isLiked}`);
      onLike(user._id, user.nickname);
    }
  }, [onLike, user?._id, user?.nickname, isLiked]);

  const handleMessageClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();

    if (onMessage) {
      onMessage(e, user);
    } else if (user) {
      // Create an embedded chat dialog with this user
      const chatEvent = new CustomEvent('openChat', {
        detail: { recipient: user }
      });
      window.dispatchEvent(chatEvent);
    }
  }, [onMessage, user]);

  const toggleShowAllTags = useCallback((e) => {
    e?.stopPropagation();
    setShowAllTags(prev => !prev);
  }, []);

  const toggleShowMoreSections = useCallback((e) => {
    e?.stopPropagation();
    setShowMoreSections(prev => !prev);
  }, []);

  // Check if a photo is private (based on privacy setting or isPrivate flag)
  const isPhotoPrivate = useCallback((photo) => {
    if (!photo) return false;
    
    // Check for privacy status using new privacy enum
    if (photo.privacy === 'private') return true;
    
    // Also check legacy isPrivate flag for backward compatibility
    if (photo.isPrivate) return true;
    
    return false;
  }, []);

  // Check if the current user is the owner of the photo
  const isOwnProfile = useMemo(() => {
    return currentUser && user && currentUser._id === user._id;
  }, [currentUser, user]);

  // Determine photo URL based on privacy and ownership
  const profilePhotoUrl = useMemo(() => {
    if (!user?.photos?.length) return `${window.location.origin}/default-avatar.png`;
    
    const profilePhoto = user.photos.find(p => p.isProfile) || user.photos[0];
    
    // If it's a private photo AND not the user's own profile
    if (isPhotoPrivate(profilePhoto) && !isOwnProfile) {
      // Use private photo placeholder for others' private photos
      return `${window.location.origin}/private-photo.png`; 
    }
    
    // For own private photos or public photos, use normal URL handling
    return getProfilePhotoUrl(user);
  }, [user, getProfilePhotoUrl, isPhotoPrivate, isOwnProfile]);
  
  // Need to create a CSS class for private images
  useEffect(() => {
    // Add CSS for private photos if it doesn't exist yet
    if (!document.getElementById('private-photo-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'private-photo-styles';
      styleEl.innerHTML = `
        .private-photo-placeholder {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
          border-radius: 4px !important;
        }
      `;
      document.head.appendChild(styleEl);
    }
  }, []);

  const userDetails = useMemo(() => {
    if (!user?.details) {
      return {
        age: null,
        location: null,
        identity: null,
        status: null,
        tags: {
          lookingFor: [],
          into: [],
          interests: []
        }
      };
    }

    const {
      age,
      location,
      iAm,
      maritalStatus,
      lookingFor = [],
      intoTags = [],
      interests = []
    } = user.details;

    return {
      age,
      location: location || translate('profile.unknownLocation', t, 'Unknown location'),
      identity: iAm || null,
      status: maritalStatus || null,
      tags: {
        lookingFor,
        into: intoTags,
        interests
      }
    };
  }, [user?.details, t]);

  // Last active formatting
  const lastActiveText = useMemo(() => {
    // If user is currently online, show "Active now"
    if (user?.isOnline) return translate('common.activeNow', t, 'Active now');

    if (!user?.lastActive) return translate('common.neverActive', t, 'Never active');

    return formatDate(user.lastActive, {
      showRelative: true,
      showTime: false,
      showDate: false
    });
  }, [user?.lastActive, user?.isOnline, t]);

  // Validation
  if (!user) return null;

  // Common action buttons for both grid and list view
  const renderActionButtons = () => (
    <>
      <button
        onClick={handleLikeClick}
        aria-label={`${isLiked ? "Unlike" : "Like"} ${user.nickname}`}
        className={`${styles.actionBtn} ${styles.likeBtn} ${isLiked ? styles.active : ""}`}
      >
        <FaHeart />
        {isLiked
          ? translate('common.liked', t, 'Liked')
          : translate('common.like', t, 'Like')}
      </button>
      <button
        onClick={handleMessageClick}
        aria-label={`Message ${user.nickname}`}
        className={`${styles.actionBtn} ${styles.messageBtn}`}
      >
        <FaComment />
        {translate('common.message', t, 'Message')}
      </button>
    </>
  );

  // Common component for rendering tag toggle buttons
  const renderTagsToggle = ({ isShowingMore, onToggle, showMoreText, showLessText }) => (
    <div className={styles.tagsToggle}>
      <span className={styles.toggleBtn} onClick={onToggle}>
        {isShowingMore ? (
          <>
            {showLessText} <FaChevronUp size={12} />
          </>
        ) : (
          <>
            {showMoreText} <FaChevronDown size={12} />
          </>
        )}
      </span>
    </div>
  );

  // Render basic user identity and details
  const renderUserDetails = () => (
    <div className={styles.tagsContainer}>
      <div className={styles.detailsRow}>
        {userDetails.identity && (
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>
              {translateProfile('iAm', t, 'I am')}:
            </span>
            <span className={getTagClassName(TAG_TYPES.IDENTITY, userDetails.identity)}>
              {translateTag('identity', userDetails.identity, t)}
            </span>
          </div>
        )}

        {userDetails.tags.lookingFor.length > 0 && (
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>
              {translateProfile('lookingFor', t, 'Looking for')}:
            </span>
            <span className={getTagClassName(TAG_TYPES.LOOKING_FOR, userDetails.tags.lookingFor[0])}>
              {translateTag('lookingFor', userDetails.tags.lookingFor[0], t)}
            </span>
            {userDetails.tags.lookingFor.length > 1 && (
              <span className={styles.moreCount}>
                +{userDetails.tags.lookingFor.length - 1}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Render the extended tags section
  const renderExtendedTags = () => (
    <>
      {(userDetails.tags.lookingFor.length > 0 ||
        userDetails.tags.into.length > 0 ||
        userDetails.tags.interests.length > 0) && (
        renderTagsToggle({
          isShowingMore: showMoreSections,
          onToggle: toggleShowMoreSections,
          showMoreText: translate('common.viewMore', t, 'View more'),
          showLessText: translate('common.viewLess', t, 'View less')
        })
      )}

      {showMoreSections && (
        <>
          <TagGroup
            title={translateProfile('interests', t, 'Interests')}
            tags={userDetails.tags.interests}
            tagType={TAG_TYPES.INTEREST}
            translationNamespace="profile.interests"
            t={t}
            showAll={showAllTags}
            toggleShowAll={toggleShowAllTags}
            maxVisible={viewMode === "grid" ? 3 : 2}
          />

          <TagGroup
            title={translateProfile('preferences', t, 'Preferences')}
            tags={userDetails.tags.into}
            tagType={TAG_TYPES.INTO}
            translationNamespace="profile.intoTags"
            t={t}
            showAll={showAllTags}
            toggleShowAll={toggleShowAllTags}
            maxVisible={viewMode === "grid" ? 3 : 2}
          />

          {/* Show all tags toggle */}
          {(userDetails.tags.lookingFor.length > (viewMode === "grid" ? 3 : 2) ||
            userDetails.tags.into.length > (viewMode === "grid" ? 3 : 2) ||
            userDetails.tags.interests.length > (viewMode === "grid" ? 3 : 2)) && (
            renderTagsToggle({
              isShowingMore: showAllTags,
              onToggle: toggleShowAllTags,
              showMoreText: translate('common.showAllTags', t, 'Show all tags'),
              showLessText: translate('common.showLessTags', t, 'Show less tags')
            })
          )}
        </>
      )}
    </>
  );

  // Render the user card in grid view
  if (viewMode === "grid") {
    return (
      <div
        className={styles.userCard}
        onClick={handleCardClick}
        data-userid={user._id}
      >
        {/* User Photo */}
        <div className={styles.cardPhoto}>
          {/* Get the primary photo to check privacy */}
          {(() => {
            const profilePhoto = user.photos?.find(p => p.isProfile) || user.photos?.[0];
            const isPrivate = isPhotoPrivate(profilePhoto);
            const opacity = isPrivate && isOwnProfile ? 0.7 : 1; // Reduce opacity for own private photos
            
            return (
              <img
                src={profilePhotoUrl}
                alt={user.nickname}
                loading="lazy"
                crossOrigin="anonymous"
                className={profilePhotoUrl.includes('private-photo.png') ? 'private-photo-placeholder' : ''}
                style={{ 
                  opacity,
                  objectFit: 'cover',
                  width: '100%',
                  height: '100%'
                }}
                onError={(e) => {
                  e.target.onerror = null;
                  const fallbackUrl = `${window.location.origin}/default-avatar.png`;
                  e.target.src = fallbackUrl;
                  
                  // Use the shared photo error handler to mark the URL as failed and refresh avatars
                  if (profilePhoto?._id) {
                    handlePhotoLoadError(profilePhoto._id, profilePhotoUrl);
                  }
                }}
              />
            );
          })()}
          {user.isOnline && <span className={`${styles.statusIndicator} ${styles.online}`}></span>}
        </div>

        {/* User Info */}
        <div className={styles.userInfo}>
          <div className={styles.userNameRow}>
            <h3 className={styles.userName}>
              {user.nickname}
              {userDetails.age && <span className={styles.userAge}>, {userDetails.age}</span>}
            </h3>
            {hasUnreadMessages && <span className={styles.unreadBadge}>{unreadMessageCount}</span>}
          </div>

          {/* Last Active Status */}
          <p className={styles.lastActive}>
            <FaClock className={styles.icon} />
            {lastActiveText}
          </p>

          <p className={styles.location}>
            <FaMapMarkerAlt className={styles.icon} />
            {userDetails.location}
          </p>

          {/* User Details & Tags */}
          {showExtendedDetails && (
            <>
              {renderUserDetails()}
              <div className={styles.tagsContainer}>
                {renderExtendedTags()}
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className={styles.actions}>{renderActionButtons()}</div>
        </div>
      </div>
    );
  }

  // List View Rendering
  return (
    <div className={styles.listItem} onClick={handleCardClick} data-userid={user._id}>
      {/* User Photo - List View */}
      <div className={styles.listPhotoContainer}>
        {/* Get the primary photo to check privacy */}
        {(() => {
          const profilePhoto = user.photos?.find(p => p.isProfile) || user.photos?.[0];
          const isPrivate = isPhotoPrivate(profilePhoto);
          const opacity = isPrivate && isOwnProfile ? 0.7 : 1; // Reduce opacity for own private photos
          
          return (
            <img
              src={profilePhotoUrl}
              alt={user.nickname}
              loading="lazy"
              crossOrigin="anonymous"
              className={`${styles.listPhoto} ${profilePhotoUrl.includes('private-photo.png') ? 'private-photo-placeholder' : ''}`}
              style={{ 
                opacity,
                objectFit: 'cover'
              }}
              onError={(e) => {
                e.target.onerror = null;
                const fallbackUrl = `${window.location.origin}/default-avatar.png`;
                e.target.src = fallbackUrl;
                
                // Use the shared photo error handler to mark the URL as failed and refresh avatars
                if (profilePhoto?._id) {
                  handlePhotoLoadError(profilePhoto._id, profilePhotoUrl);
                }
              }}
            />
          );
        })()}
        {user.isOnline && <span className={`${styles.statusIndicator} ${styles.online}`}></span>}
      </div>

      {/* User Info - List View */}
      <div className={styles.listInfo}>
        <div className={styles.listHeader}>
          <h3 className={styles.listName}>
            {user.nickname}
            {userDetails.age && <span className={styles.userAge}>, {userDetails.age}</span>}
          </h3>
          {hasUnreadMessages && <span className={styles.unreadBadge}>{unreadMessageCount}</span>}
        </div>

        {/* Last Active Status */}
        <p className={styles.listLastActive}>
          <FaClock className={styles.icon} />
          {lastActiveText}
        </p>

        <p className={styles.location}>
          <FaMapMarkerAlt className={styles.icon} />
          {userDetails.location}
        </p>

        {/* User Details & Tags */}
        {showExtendedDetails && (
          <>
            {renderUserDetails()}
            <div className={styles.tagsContainer}>
              {renderExtendedTags()}
            </div>
          </>
        )}
      </div>

      {/* Action Buttons - List View */}
      <div className={styles.listActions}>{renderActionButtons()}</div>
    </div>
  );
};

// PropTypes for type checking
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

// PropTypes for the TagGroup component
TagGroup.propTypes = {
  title: PropTypes.string,
  tags: PropTypes.arrayOf(PropTypes.string).isRequired,
  tagType: PropTypes.string.isRequired,
  translationNamespace: PropTypes.string.isRequired,
  t: PropTypes.func.isRequired,
  showAll: PropTypes.bool.isRequired,
  toggleShowAll: PropTypes.func.isRequired,
  maxVisible: PropTypes.number
};

// Use the withMemo HOC for efficient re-rendering
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
