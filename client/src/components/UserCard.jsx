import React, { useState, useCallback, useMemo } from "react";
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
import { useLanguage } from "../context";
import { formatDate, normalizePhotoUrl, logger } from "../utils";
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
 */
const safeTranslate = (t, key, defaultValue = "") => {
  try {
    // For nested path keys, try flat format first
    const flatKey = key.replace(/\./g, '_');
    const parts = key.split('.');

    // Try various formats
    if (parts.length > 1) {
      // Try direct access from parent object
      try {
        const parentKey = parts[0];
        const childPath = parts.slice(1);
        const parent = t(parentKey, { returnObjects: true });

        if (typeof parent === 'object' && parent !== null) {
          let value = parent;
          for (const pathPart of childPath) {
            if (value && typeof value === 'object' && pathPart in value) {
              value = value[pathPart];
            } else {
              value = null;
              break;
            }
          }

          if (typeof value === 'string') {
            return value;
          }
        }
      } catch (e) { /* Continue with other methods */ }

      // Try flat key format
      try {
        const flatTranslation = t(flatKey);
        if (typeof flatTranslation === 'string' && flatTranslation !== flatKey) {
          return flatTranslation;
        }
      } catch (e) { /* Continue with other methods */ }

      // For three-level nesting, try two-level format
      if (parts.length > 2) {
        try {
          const twoLevelKey = `${parts[0]}_${parts[1]}_${parts[2]}`;
          const twoLevelTranslation = t(twoLevelKey);
          if (typeof twoLevelTranslation === 'string' && twoLevelTranslation !== twoLevelKey) {
            return twoLevelTranslation;
          }
        } catch (e) { /* Continue with other methods */ }
      }
    }

    // Try direct translation
    const translated = t(key);

    // If it's a string and not just returning the key, use it
    if (typeof translated === 'string' && translated !== key) {
      return translated;
    }

    // For objects, try to get a string representation
    if (typeof translated === 'object' && translated !== null) {
      if (translated.toString && typeof translated.toString === 'function' &&
          translated.toString() !== '[object Object]') {
        return translated.toString();
      }
      return defaultValue;
    }

    return translated || defaultValue;
  } catch (error) {
    log.error(`Translation error for key '${key}':`, error);
    return defaultValue;
  }
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

    // Format key for translation patterns
    const nestedKey = `${namespace}.${tag.toLowerCase().replace(/\s+/g, '_')}`;
    const prefixKey = namespace === 'profile.intoTags'
      ? `profile.intoTag_${tag.toLowerCase().replace(/\s+/g, '_')}`
      : namespace === 'profile.turnOns'
      ? `profile.turnOn_${tag.toLowerCase().replace(/\s+/g, '_')}`
      : namespace === 'profile.interests'
      ? `profile.interests${tag.charAt(0).toUpperCase() + tag.slice(1).replace(/\s+/g, '_')}`
      : null;

    const flatKey = nestedKey.replace(/\./g, '_');

    // Try each translation pattern
    if (prefixKey) {
      try {
        const prefixTranslation = t(prefixKey);
        if (typeof prefixTranslation === 'string' && prefixTranslation !== prefixKey) {
          return prefixTranslation;
        }
      } catch (e) { /* Continue with other methods */ }
    }

    const safeResult = safeTranslate(t, nestedKey, null);
    if (safeResult && safeResult !== nestedKey) {
      return safeResult;
    }

    try {
      const flatTranslation = t(flatKey);
      if (typeof flatTranslation === 'string' && flatTranslation !== flatKey) {
        return flatTranslation;
      }
    } catch (e) { /* Continue with other methods */ }

    try {
      const directTagTranslation = t(tag.toLowerCase().replace(/\s+/g, '_'));
      if (typeof directTagTranslation === 'string' &&
          directTagTranslation !== tag.toLowerCase().replace(/\s+/g, '_')) {
        return directTagTranslation;
      }
    } catch (e) { /* Continue with other methods */ }

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

  // Event Handlers
  const handleCardClick = useCallback((e) => {
    // Don't navigate if the click was on a button
    if (e?.target?.closest('button')) {
      return;
    }

    if (onClick) {
      onClick();
    } else if (user?.id) {
      navigate(`/user/${user.id}`);
    }
  }, [onClick, navigate, user?.id]);

  const handleLikeClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();

    if (onLike && user?.id) {
      log.debug(`Like button clicked for user ${user.id}, current isLiked: ${isLiked}`);
      onLike(user.id, user.nickname);
    }
  }, [onLike, user?.id, user?.nickname, isLiked]);

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

  // Memoized data
  const profilePhotoUrl = useMemo(() => {
    if (!user?.photos?.length) return "/default-avatar.png";

    const url = user.photos[0]?.url;
    if (!url) return "/default-avatar.png";

    return normalizePhotoUrl(url);
  }, [user?.photos]);

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
      location: location || safeTranslate(t, 'profile.unknownLocation', 'Unknown location'),
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
    if (user?.isOnline) return safeTranslate(t, 'common.activeNow', 'Active now');

    if (!user?.lastActive) return safeTranslate(t, 'common.neverActive', 'Never active');

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
          ? safeTranslate(t, 'common.liked', 'Liked')
          : safeTranslate(t, 'common.like', 'Like')}
      </button>
      <button
        onClick={handleMessageClick}
        aria-label={`Message ${user.nickname}`}
        className={`${styles.actionBtn} ${styles.messageBtn}`}
      >
        <FaComment />
        {safeTranslate(t, 'common.message', 'Message')}
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
              {safeTranslate(t, 'profile.iAm', 'I am')}:
            </span>
            <span className={getTagClassName(TAG_TYPES.IDENTITY, userDetails.identity)}>
              {safeTranslate(t, `profile.identity.${userDetails.identity.toLowerCase().replace(/\s+/g, '_')}`, userDetails.identity)}
            </span>
          </div>
        )}

        {userDetails.tags.lookingFor.length > 0 && (
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>
              {safeTranslate(t, 'profile.lookingFor', 'Looking for')}:
            </span>
            <span className={getTagClassName(TAG_TYPES.LOOKING_FOR, userDetails.tags.lookingFor[0])}>
              {safeTranslate(t, `profile.lookingFor.${userDetails.tags.lookingFor[0].toLowerCase().replace(/\s+/g, '_')}`, userDetails.tags.lookingFor[0])}
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
          showMoreText: safeTranslate(t, 'common.viewMore', 'View more'),
          showLessText: safeTranslate(t, 'common.viewLess', 'View less')
        })
      )}

      {showMoreSections && (
        <>
          <TagGroup
            title={safeTranslate(t, 'profile.interests', 'Interests')}
            tags={userDetails.tags.interests}
            tagType={TAG_TYPES.INTEREST}
            translationNamespace="profile.interests"
            t={t}
            showAll={showAllTags}
            toggleShowAll={toggleShowAllTags}
            maxVisible={viewMode === "grid" ? 3 : 2}
          />

          <TagGroup
            title={safeTranslate(t, 'profile.preferences', 'Preferences')}
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
              showMoreText: safeTranslate(t, 'common.showAllTags', 'Show all tags'),
              showLessText: safeTranslate(t, 'common.showLessTags', 'Show less tags')
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
        data-userid={user.id}
      >
        {/* User Photo */}
        <div className={styles.cardPhoto}>
          <img
            src={profilePhotoUrl}
            alt={user.nickname}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/default-avatar.png";
            }}
          />
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
    <div className={styles.listItem} onClick={handleCardClick} data-userid={user.id}>
      {/* User Photo - List View */}
      <div className={styles.listPhotoContainer}>
        <img
          src={profilePhotoUrl}
          alt={user.nickname}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/default-avatar.png";
          }}
          className={styles.listPhoto}
        />
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
    id: PropTypes.string.isRequired,
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
    prevProps.user.id === nextProps.user.id &&
    prevProps.isLiked === nextProps.isLiked &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.hasUnreadMessages === nextProps.hasUnreadMessages &&
    prevProps.unreadMessageCount === nextProps.unreadMessageCount &&
    prevProps.user.isOnline === nextProps.user.isOnline
  );
}, { debug: process.env.NODE_ENV !== 'production' });
