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
import { formatDate, logger, markUrlAsFailed } from "../utils";
import apiService from "../services/apiService";
// No longer using translation utilities - using direct t() function
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

// This function was deprecated and has been removed - using direct t() function

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

    // Simple translation approach - use direct t() function or fallback to original tag
    return t(tag) || tag;
  };

  const visibleTags = showAll ? tags : tags.slice(0, maxVisible);
  const hasMoreTags = tags.length > maxVisible;

  return (
    <div className={styles.tagCategory}>
      {title && <h4 className={styles.categoryTitle}>{title}</h4>}
      <div className={styles.tagsGroup}>
        {visibleTags.map((tag, idx) => (
          <span key={`${tagType}-${idx}`} className={getTagClassName(tagType, tag)}>
            {getTranslatedTag("", tag)}
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
  const [photoAccessStatus, setPhotoAccessStatus] = useState(null);
  const [isLoadingAccess, setIsLoadingAccess] = useState(false);

  // Hooks
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user: currentUser } = useAuth();
  const { normalizePhotoUrl, getProfilePhotoUrl, handlePhotoLoadError, refreshAllAvatars } = usePhotoManagement();

  // Memoized translations using direct t() function
  const translations = useMemo(() => ({
    like: t('like') || 'like',
    liked: t('liked') || 'liked',
    message: t('message') || 'message',
    online: t('online') || 'online',
    offline: t('offline') || 'offline',
    lastActive: t('lastActive') || 'Last active',
    viewProfile: t('view') || 'View',
    showMore: t('showMore') || 'Show more',
    showLess: t('showLess') || 'Show less'
  }), [t]);
  
  // State to trigger re-renders when photos update
  const [refreshKey, setRefreshKey] = useState(Date.now());
  
  // Listen for avatar refresh events
  useEffect(() => {
    const handleAvatarRefresh = (event) => {
      // Force a re-render when avatar refresh event is triggered
      
      // Get the timestamp from the event or use current time
      const timestamp = event?.detail?.timestamp || Date.now();
      
      // Update refresh key to force re-render
      setRefreshKey(timestamp);
      
      // Ensure the global refresh timestamp is updated
      if (typeof window !== 'undefined') {
        window.__photo_refresh_timestamp = timestamp;
      }
    };
    
    window.addEventListener('avatar:refresh', handleAvatarRefresh);
    
    return () => {
      window.removeEventListener('avatar:refresh', handleAvatarRefresh);
    };
  }, [user.nickname]);

  // Listen for photo access cache invalidation
  useEffect(() => {
    // Create a broadcast channel to listen for cache invalidation messages
    const channel = new BroadcastChannel('photo-access-cache');
    
    const handleCacheUpdate = (event) => {
      if (event.data.type === 'invalidate' && event.data.userId === user?._id) {
        // Force a re-check of photo access
        setPhotoAccessStatus(null);
        setIsLoadingAccess(false);
      }
    };
    
    channel.addEventListener('message', handleCacheUpdate);
    
    return () => {
      channel.removeEventListener('message', handleCacheUpdate);
      channel.close();
    };
  }, [user?._id]);
  
  // Check photo access status when user changes or when cache is invalidated
  useEffect(() => {
    if (!user?._id || user._id === currentUser?._id) {
      return;
    }
    
    if (isLoadingAccess) {
      return;
    }
    
    // Check localStorage first for cached status
    try {
      const storedPermissions = JSON.parse(localStorage.getItem('photo-permissions-status') || '{}');
      const cached = storedPermissions[user._id];
      
      const cacheMaxAge = 5 * 60 * 1000; // 5 minutes
      if (cached && cached.timestamp && Date.now() - cached.timestamp < cacheMaxAge) {
        setPhotoAccessStatus(cached.status);
        return;
      }
    } catch (error) {
      log.error("Failed to read localStorage:", error);
    }
    
    // Fetch from API
    setIsLoadingAccess(true);
    
    const apiUrl = `/users/${user._id}/photo-access-status`;
    
    apiService.get(apiUrl)
      .then(response => {
        let status = 'none';
        
        // The apiService returns the response directly
        if (response && response.success) {
          status = response.status || 'none';
        }
        
        setPhotoAccessStatus(status);
        
        // Cache the result only if it's not "none" (temporary state)
        if (status !== 'none') {
          try {
            const storedPermissions = JSON.parse(localStorage.getItem('photo-permissions-status') || '{}');
            storedPermissions[user._id] = {
              status: status,
              timestamp: Date.now()
            };
            localStorage.setItem('photo-permissions-status', JSON.stringify(storedPermissions));
          } catch (error) {
            log.error("Failed to update localStorage:", error);
          }
        }
      })
      .catch(error => {
        log.error("Failed to fetch photo access status:", error);
        setPhotoAccessStatus('none');
      })
      .finally(() => {
        setIsLoadingAccess(false);
      });
  }, [user?._id, currentUser?._id, photoAccessStatus]);

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
      onLike(user._id, user.nickname);
    }
  }, [onLike, user?._id, user?.nickname]);

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
    
    // Check photo privacy fields
    
    // Check for privacy status using new privacy enum
    if (photo.privacy === 'private') return true;
    
    // Also check legacy isPrivate flag for backward compatibility
    if (photo.isPrivate) return true;
    
    // Default to treating photos as private if no privacy field is set
    // This is a safe default until all photos have privacy fields
    if (!('privacy' in photo) && !('isPrivate' in photo)) {
      return true;
    }
    
    return false;
  }, []);

  // Check if the current user is the owner of the photo
  const isOwnProfile = useMemo(() => {
    return currentUser && user && currentUser._id === user._id;
  }, [currentUser, user]);

  // Helper function to get gender-specific default avatar
  const getGenderSpecificAvatar = useCallback((user) => {
    if (!user) return `${window.location.origin}/default-avatar.png`;
    
    // Check user's identity from details.iAm
    if (user.details && user.details.iAm) {
      if (user.details.iAm === 'woman') {
        return `${window.location.origin}/women-avatar.png`;
      } else if (user.details.iAm === 'man') {
        return `${window.location.origin}/man-avatar.png`;
      } else if (user.details.iAm === 'couple') {
        return `${window.location.origin}/couple-avatar.png`;
      }
    }
    
    // Default to generic avatar
    return `${window.location.origin}/default-avatar.png`;
  }, []);
  
  // Determine photo URL based on privacy and ownership
  const profilePhotoUrl = useMemo(() => {
    if (!user?.photos?.length) {
      // No photos, use gender-specific default avatar
      return getGenderSpecificAvatar(user);
    }
    
    const profilePhoto = user.photos.find(p => p.isProfile) || user.photos[0];
    
    
    // If it's a private photo AND not the user's own profile
    if (isPhotoPrivate(profilePhoto) && !isOwnProfile) {
      
      // If we're still loading access status, show placeholder for now
      if (isLoadingAccess || photoAccessStatus === null) {
        return `${window.location.origin}/private-photo.png`;
      }
      // Only show placeholder if access is explicitly not approved
      if (photoAccessStatus !== 'approved') {
        return `${window.location.origin}/private-photo.png`;
      }
    }
    
    // For own private photos, public photos, or when access is granted, use normal URL handling
    // Get URL with cache busting to ensure freshness
    const timestamp = window.__photo_refresh_timestamp || refreshKey || Date.now();
    const url = getProfilePhotoUrl(user);
    
    // Add cache busting parameter if not already present
    if (url && !url.includes('_v=') && !url.includes('&_t=')) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}_v=${timestamp}`;
    }
    
    return url;
  }, [user, getProfilePhotoUrl, isPhotoPrivate, isOwnProfile, refreshKey, getGenderSpecificAvatar, photoAccessStatus, isLoadingAccess]);
  
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
      location: location || t('unknownLocation') || 'Unknown location',
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
    if (user?.isOnline) return translations.online;

    if (!user?.lastActive) return t('inactive') || 'Never active';

    return formatDate(user.lastActive, {
      showRelative: true,
      showTime: false,
      showDate: false
    });
  }, [user?.lastActive, user?.isOnline, t, translations]);

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
          ? translations.liked
          : translations.like}
      </button>
      <button
        onClick={handleMessageClick}
        aria-label={`Message ${user.nickname}`}
        className={`${styles.actionBtn} ${styles.messageBtn}`}
      >
        <FaComment />
        {translations.message}
      </button>
    </>
  );

  // Common component for rendering tag toggle buttons
  const renderTagsToggle = ({ isShowingMore, onToggle, showMoreText, showLessText }) => (
    <div className={styles.tagsToggle}>
      <span className={styles.toggleBtn} onClick={onToggle}>
        {isShowingMore ? (
          <>
            {showLessText || translations.showLess} <FaChevronUp size={12} />
          </>
        ) : (
          <>
            {showMoreText || translations.showMore} <FaChevronDown size={12} />
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
              {t('iAm') || 'I am'}:
            </span>
            <span className={getTagClassName(TAG_TYPES.IDENTITY, userDetails.identity)}>
              {t(userDetails.identity) || userDetails.identity}
            </span>
          </div>
        )}

        {userDetails.tags.lookingFor.length > 0 && (
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>
              {t('lookingFor') || 'Looking for'}:
            </span>
            <span className={getTagClassName(TAG_TYPES.LOOKING_FOR, userDetails.tags.lookingFor[0])}>
              {t(userDetails.tags.lookingFor[0]) || userDetails.tags.lookingFor[0]}
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
          showMoreText: translations.showMore,
          showLessText: translations.showLess
        })
      )}

      {showMoreSections && (
        <>
          <TagGroup
            title={t('interests') || 'Interests'}
            tags={userDetails.tags.interests}
            tagType={TAG_TYPES.INTEREST}
            translationNamespace=""
            t={t}
            showAll={showAllTags}
            toggleShowAll={toggleShowAllTags}
            maxVisible={viewMode === "grid" ? 3 : 2}
          />

          <TagGroup
            title={t('preferences') || 'Preferences'}
            tags={userDetails.tags.into}
            tagType={TAG_TYPES.INTO}
            translationNamespace=""
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
              showMoreText: t('showMore') || 'Show more',
              showLessText: t('showLess') || 'Show less'
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
            
            // Create a unique key to force re-render when profile photo changes
            const imgKey = `user-${user._id}-photo-${profilePhoto?._id || '0'}-${window.__photo_refresh_timestamp || refreshKey || Date.now()}`;
            
            return (
              <img
                key={imgKey}
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
                  // Prevent infinite retries by limiting to 3 attempts
                  const retryCount = parseInt(e.target.dataset.retryCount || '0');
                  if (retryCount >= 3) {
                    e.target.onerror = null;
                    // Mark this URL as permanently failed so we don't retry it
                    markUrlAsFailed(e.target.src);
                    markUrlAsFailed(profilePhotoUrl);
                    
                    const fallbackUrl = getGenderSpecificAvatar(user);
                    e.target.src = fallbackUrl;
                    return;
                  }
                  
                  // Increment retry count
                  e.target.dataset.retryCount = (retryCount + 1).toString();
                  
                  // Try with timestamp to bypass cache
                  const currentSrc = e.target.src;
                  const url = new URL(currentSrc);
                  url.searchParams.set('_v', Date.now().toString());
                  e.target.src = url.toString();
                  
                  // Use the shared photo error handler to mark the URL as failed and refresh avatars
                  if (profilePhoto?._id && retryCount === 2) {
                    handlePhotoLoadError(profilePhoto._id, profilePhotoUrl);
                    // Force a refresh of all avatars to ensure consistent display
                    refreshAllAvatars();
                  }
                }}
              />
            );
          })()}
          {user.isOnline && <span className={`${styles.onlineStatusIndicator} ${styles.online}`}></span>}
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
          
          // Create a unique key to force re-render when profile photo changes
          const imgKey = `list-user-${user._id}-photo-${profilePhoto?._id || '0'}-${window.__photo_refresh_timestamp || refreshKey || Date.now()}`;
          
          return (
            <img
              key={imgKey}
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
                // Prevent infinite retries by limiting to 3 attempts
                const retryCount = parseInt(e.target.dataset.retryCount || '0');
                if (retryCount >= 3) {
                  e.target.onerror = null;
                  // Mark this URL as permanently failed so we don't retry it
                  markUrlAsFailed(e.target.src);
                  markUrlAsFailed(profilePhotoUrl);
                  
                  const fallbackUrl = getGenderSpecificAvatar(user);
                  e.target.src = fallbackUrl;
                  return;
                }
                
                // Increment retry count
                e.target.dataset.retryCount = (retryCount + 1).toString();
                
                // Try with timestamp to bypass cache
                const currentSrc = e.target.src;
                const url = new URL(currentSrc);
                url.searchParams.set('_v', Date.now().toString());
                e.target.src = url.toString();
                
                // Use the shared photo error handler to mark the URL as failed and refresh avatars
                if (profilePhoto?._id && retryCount === 2) {
                  handlePhotoLoadError(profilePhoto._id, profilePhotoUrl);
                  // Force a refresh of all avatars to ensure consistent display
                  refreshAllAvatars();
                }
              }}
            />
          );
        })()}
        {user.isOnline && <span className={`${styles.onlineStatusIndicator} ${styles.online}`}></span>}
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
