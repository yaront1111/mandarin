import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { FaHeart, FaComment, FaUser, FaMapMarkerAlt, FaClock, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { Avatar, Card, Button } from "./common";
import { formatDate, normalizePhotoUrl, logger } from "../utils";
import { withMemo } from "./common";
import { useLanguage } from "../context";
import styles from "../styles/usercard.module.css";

// Constants
const TAG_TYPES = {
  LOOKING_FOR: "lookingFor",
  INTO: "into",
  INTEREST: "interest",
};

/**
 * Safely gets a translation string, handling cases where the translation might return an object
 * @param {Function} t - Translation function from useTranslation
 * @param {String} key - Translation key
 * @param {String} defaultValue - Default value if translation is missing or invalid
 * @returns {String} The translated string or default value
 */
const safeTranslate = (t, key, defaultValue = "") => {
  try {
    // For the problematic nested path keys, try flat format first
    const flatKey = key.replace(/\./g, '_');
    
    // Handle two-level and three-level nested keys
    const parts = key.split('.');
    
    // Try to use paths in different ways to ensure we get strings
    if (parts.length > 1) {
      // Try getting direct access from parent object
      try {
        // Get the parent object (e.g., 'profile' from 'profile.maritalStatus')
        const parentKey = parts[0];
        // Get the rest of the path as array
        const childPath = parts.slice(1);
        
        // Get the parent object from i18n
        const parent = t(parentKey, { returnObjects: true });
        
        // If parent is an object, try to access the child path directly
        if (typeof parent === 'object' && parent !== null) {
          // Navigate to the final value through the object structure
          let value = parent;
          for (const pathPart of childPath) {
            if (value && typeof value === 'object' && pathPart in value) {
              value = value[pathPart];
            } else {
              // Path doesn't exist, break out
              value = null;
              break;
            }
          }
          
          // If we found a string value, return it
          if (typeof value === 'string') {
            return value;
          }
        }
      } catch (e) {
        // Ignore errors in alternative lookup
      }
      
      // Try flat key format (e.g., 'profile_maritalStatus')
      try {
        const flatTranslation = t(flatKey);
        if (typeof flatTranslation === 'string' && flatTranslation !== flatKey) {
          return flatTranslation;
        }
      } catch (e) {
        // Ignore errors in alternative lookup
      }
      
      // For three-level nesting, also try two-level format
      if (parts.length > 2) {
        try {
          const twoLevelKey = `${parts[0]}_${parts[1]}_${parts[2]}`;
          const twoLevelTranslation = t(twoLevelKey);
          if (typeof twoLevelTranslation === 'string' && twoLevelTranslation !== twoLevelKey) {
            return twoLevelTranslation;
          }
        } catch (e) {
          // Ignore errors in alternative lookup
        }
      }
    }
    
    // Try direct translation
    const translated = t(key);
    
    // If it's a string and not just returning the key, use it
    if (typeof translated === 'string' && translated !== key) {
      return translated;
    }
    
    // If it's an object, likely a nested translation object - try to get a string representation or use default
    if (typeof translated === 'object' && translated !== null) {
      // Try to find a string representation
      if (translated.toString && typeof translated.toString === 'function' && 
          translated.toString() !== '[object Object]') {
        return translated.toString();
      }
      
      // If it's a valid translation object with string representation, use that
      return defaultValue;
    }
    
    // Return translated or default
    return translated || defaultValue;
  } catch (error) {
    logger.error(`Translation error for key '${key}':`, error);
    return defaultValue;
  }
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

  // Navigation and internationalization
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

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
  const handleCardClick = useCallback((e) => {
    // Don't navigate if the click was on a button inside the card
    if (e?.target?.closest('button')) {
      console.log('Skipping card click - clicked on a button');
      return;
    }

    console.log('UserCard clicked:', user?._id, user?.nickname);

    if (onClick) {
      console.log('Using provided onClick handler');
      onClick();
    } else {
      console.log('Navigating to user profile:', `/user/${user._id}`);
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
      // Ensure the event doesn't bubble up and trigger card click
      e.stopPropagation();
      e.preventDefault();

      if (onMessage) {
        onMessage(e, user);
      } else {
        // Create an embedded chat dialog with this user
        const chatEvent = new CustomEvent('openChat', {
          detail: { recipient: user }
        });
        window.dispatchEvent(chatEvent);

        // Log the event to help debug
        console.log('Dispatched openChat event with recipient:', user);
        console.log('User data in event:', JSON.stringify(user));
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
    if (!user?.photos?.length) return "/default-avatar.png";

    // Normalize the photo URL
    const url = user.photos[0]?.url;
    if (!url) return "/default-avatar.png";

    // Use the normalizePhotoUrl utility function
    return normalizePhotoUrl(url);
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
    if (user?.isOnline) return safeTranslate(t, 'common.activeNow', 'Active now');

    if (!user?.lastActive) return safeTranslate(t, 'common.neverActive', 'Never active');

    return formatDate(user.lastActive, { showRelative: true, showTime: false, showDate: false });
  }, [user?.lastActive, user?.isOnline, t]);

  // Helper to translate profile data (identity, lookingFor, etc.)
  const getTranslatedTag = useCallback((namespace, tag) => {
    if (!tag) return "";
    
    // Format the tag key according to the patterns we've been supporting
    // Method 1: Direct nested access
    const nestedKey = `${namespace}.${tag.toLowerCase().replace(/\s+/g, '_')}`;
    
    // Method 2: Special prefixed key format for common patterns
    let prefixKey = null;
    
    if (namespace === 'profile.intoTags') {
      prefixKey = `profile.intoTag_${tag.toLowerCase().replace(/\s+/g, '_')}`;
    } else if (namespace === 'profile.turnOns') {
      prefixKey = `profile.turnOn_${tag.toLowerCase().replace(/\s+/g, '_')}`;
    } else if (namespace === 'profile.interests') {
      prefixKey = `profile.interests${tag.charAt(0).toUpperCase() + tag.slice(1).replace(/\s+/g, '_')}`;
    }
    
    // Method 3: Flattened key
    const flatKey = nestedKey.replace(/\./g, '_');
    
    // Try each of the key formats in order
    // First try the special prefixed format
    if (prefixKey) {
      try {
        const prefixTranslation = t(prefixKey);
        if (typeof prefixTranslation === 'string' && prefixTranslation !== prefixKey) {
          return prefixTranslation;
        }
      } catch (e) {
        // Ignore errors in lookup
      }
    }
    
    // Then try the direct path access through safeTranslate
    const safeResult = safeTranslate(t, nestedKey, null);
    if (safeResult && safeResult !== nestedKey) {
      return safeResult;
    }
    
    // Then try the flat key
    try {
      const flatTranslation = t(flatKey);
      if (typeof flatTranslation === 'string' && flatTranslation !== flatKey) {
        return flatTranslation;
      }
    } catch (e) {
      // Ignore errors in lookup
    }
    
    // Fallback 1: Try to get the tag directly from translations
    try {
      const directTagTranslation = t(tag.toLowerCase().replace(/\s+/g, '_'));
      if (typeof directTagTranslation === 'string' && 
          directTagTranslation !== tag.toLowerCase().replace(/\s+/g, '_')) {
        return directTagTranslation;
      }
    } catch (e) {
      // Ignore errors in lookup
    }
    
    // Fallback 2: Just clean up and return the tag
    return tag.charAt(0).toUpperCase() + tag.slice(1).replace(/_/g, ' ');
  }, [t]);

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
        <FaHeart size={18} />
        {isLiked ? safeTranslate(t, 'common.liked', 'Liked') : safeTranslate(t, 'common.like', 'Like')}
      </button>
      <button
        onClick={handleMessageClick}
        aria-label={`Message ${user.nickname}`}
        className={`${styles.actionBtn} ${styles.messageBtn}`}
      >
        <FaComment size={18} />
        {safeTranslate(t, 'common.message', 'Message')}
      </button>
    </>
  );

  // Render the user card
  if (viewMode === "grid") {
    return (
      <Card
        className={styles.userCard}
        onClick={handleCardClick}
        hover={true}
        noPadding={true}
        headerClassName={styles.cardHeader}
        bodyClassName={styles.cardBody}
        data-userid={user._id}
      >
        {/* User Photo */}
        <div className={styles.cardPhoto}>
          <img
            src={profilePhotoUrl || "/default-avatar.png"}
            alt={user.nickname}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/default-avatar.png";
            }}
          />
          {user.isOnline && <span className="status-indicator online"></span>}
        </div>

        {/* User Info */}
        <div className={styles.userInfo}>
          <div className="d-flex justify-content-between align-items-center mb-1">
            <h3 className={styles.userName}>
              {user.nickname}
              {user.details?.age && <span className={styles.userAge}>, {user.details.age}</span>}
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
            {user.details?.location || safeTranslate(t, 'profile.unknownLocation', 'Unknown location')}
          </p>

          {/* Extended Details Section */}
          {showExtendedDetails && (
            <div className={styles.tagsContainer}>
              <div className={styles.detailsRow}>
                {extendedDetails.identity && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>{safeTranslate(t, 'profile.iAm', 'I am')}:</span>
                    <span
                      className={`${styles.tag} ${styles.identityTag} ${
                        extendedDetails.identity.toLowerCase().includes("woman")
                          ? styles.identityWoman
                          : extendedDetails.identity.toLowerCase().includes("man")
                            ? styles.identityMan
                            : extendedDetails.identity.toLowerCase().includes("couple")
                              ? styles.identityCouple
                              : ""
                      }`}
                    >
                      {getTranslatedTag('profile.identity', extendedDetails.identity)}
                    </span>
                  </div>
                )}

                {tags.lookingFor.length > 0 && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>{safeTranslate(t, 'profile.lookingFor', 'Looking for')}:</span>
                    <span className={`${styles.tag} ${
                      tags.lookingFor[0].toLowerCase().includes("women") || tags.lookingFor[0].toLowerCase().includes("woman")
                        ? styles.identityWoman
                        : tags.lookingFor[0].toLowerCase().includes("men") || tags.lookingFor[0].toLowerCase().includes("man")
                          ? styles.identityMan
                          : tags.lookingFor[0].toLowerCase().includes("couple")
                            ? styles.identityCouple
                            : styles.lookingForTag
                    }`}>
                      {getTranslatedTag('profile.lookingFor', tags.lookingFor[0])}
                    </span>
                    {tags.lookingFor.length > 1 && (
                      <span className={styles.moreCount}>+{tags.lookingFor.length - 1}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* User Tags */}
          {showExtendedDetails && (
            <div className={styles.tagsContainer}>
              {/* Show More/Less Toggle for all sections */}
              {(tags.lookingFor.length > 0 || tags.into.length > 0 || tags.interests.length > 0) && (
                <div className={styles.tagsToggle}>
                  <span className={styles.toggleBtn} onClick={toggleShowMoreSections}>
                    {showMoreSections ? (
                      <>{safeTranslate(t, 'common.viewLess', 'View less')} <FaChevronUp size={12} style={{ marginLeft: "4px" }} /></>
                    ) : (
                      <>{safeTranslate(t, 'common.viewMore', 'View more')} <FaChevronDown size={12} style={{ marginLeft: "4px" }} /></>
                    )}
                  </span>
                </div>
              )}

              {/* All sections now only visible when showMoreSections is true */}
              {showMoreSections && (
                <>
                  {/* Interests */}
                  {tags.interests.length > 0 && (
                    <div className={styles.tagCategory}>
                      <h4 className={styles.categoryTitle}>{safeTranslate(t, 'profile.interests', 'Interests')}</h4>
                      <div className={styles.interestTags}>
                        {(showAllTags ? tags.interests : tags.interests.slice(0, 3)).map((tag, idx) => (
                          <span key={`interest-${idx}`} className={`${styles.tag} ${
                            tag.toLowerCase().includes("women") || tag.toLowerCase().includes("woman")
                              ? styles.identityWoman
                              : tag.toLowerCase().includes("men") || tag.toLowerCase().includes("man")
                                ? styles.identityMan
                                : tag.toLowerCase().includes("couple")
                                  ? styles.identityCouple
                                  : ""
                          }`}>
                            {getTranslatedTag('profile.interests', tag)}
                          </span>
                        ))}
                        {tags.interests.length > 3 && !showAllTags && (
                          <span className={styles.moreCount} onClick={toggleShowAllTags}>
                            +{tags.interests.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Preferences section (formerly Into) */}
                  {tags.into.length > 0 && (
                    <div className={styles.tagCategory}>
                      <h4 className={styles.categoryTitle}>{safeTranslate(t, 'profile.preferences', 'Preferences')}</h4>
                      <div className={styles.interestTags}>
                        {(showAllTags ? tags.into : tags.into.slice(0, 3)).map((tag, idx) => (
                          <span key={`into-${idx}`} className={`${styles.tag} ${
                            tag.toLowerCase().includes("women") || tag.toLowerCase().includes("woman")
                              ? styles.identityWoman
                              : tag.toLowerCase().includes("men") || tag.toLowerCase().includes("man")
                                ? styles.identityMan
                                : tag.toLowerCase().includes("couple")
                                  ? styles.identityCouple
                                  : styles.intoTag
                          }`}>
                            {getTranslatedTag('profile.intoTags', tag)}
                          </span>
                        ))}
                        {tags.into.length > 3 && !showAllTags && (
                          <span className={styles.moreCount} onClick={toggleShowAllTags}>
                            +{tags.into.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Global More/Less Toggle for all tags */}
                  {(tags.lookingFor.length > 3 || tags.into.length > 3 || tags.interests.length > 3) && (
                    <div className={styles.tagsToggle}>
                      <span className={styles.toggleBtn} onClick={toggleShowAllTags}>
                        {showAllTags ? (
                          <>{safeTranslate(t, 'common.showLessTags', 'Show less tags')} <FaChevronUp size={12} style={{ marginLeft: "4px" }} /></>
                        ) : (
                          <>{safeTranslate(t, 'common.showAllTags', 'Show all tags')} <FaChevronDown size={12} style={{ marginLeft: "4px" }} /></>
                        )}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className={styles.actions}>{renderActionButtons()}</div>
        </div>
      </Card>
    );
  }

  // List View Rendering
  return (
    <div className={styles.listItem} onClick={handleCardClick} data-userid={user._id}>
      {/* User Photo - List View */}
      <div className={styles.listPhotoContainer}>
        <img
          src={profilePhotoUrl || "/default-avatar.png"}
          alt={user.nickname}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/default-avatar.png";
          }}
          className={styles.listPhoto}
        />
        {user.isOnline && <span className="status-indicator online-small"></span>}
      </div>

      {/* User Info - List View */}
      <div className={styles.listInfo}>
        <div className={styles.listHeader}>
          <h3 className={styles.listName}>
            {user.nickname}
            {user.details?.age && <span className={styles.userAge}>, {user.details.age}</span>}
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
          {user.details?.location || safeTranslate(t, 'profile.unknownLocation', 'Unknown location')}
        </p>

        {/* Extended Details - List View */}
        {showExtendedDetails && (
          <div className={styles.tagsContainer}>
            <div className={styles.detailsRow}>
              {extendedDetails.identity && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>{safeTranslate(t, 'profile.iAm', 'I am')}:</span>
                  <span
                    className={`${styles.tag} ${styles.identityTag} ${
                      extendedDetails.identity.toLowerCase().includes("woman")
                        ? styles.identityWoman
                        : extendedDetails.identity.toLowerCase().includes("man")
                          ? styles.identityMan
                          : extendedDetails.identity.toLowerCase().includes("couple")
                            ? styles.identityCouple
                            : ""
                    }`}
                  >
                    {getTranslatedTag('profile.identity', extendedDetails.identity)}
                  </span>
                </div>
              )}

              {tags.lookingFor.length > 0 && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>{safeTranslate(t, 'profile.into', 'Into')}:</span>
                  <span className={`${styles.tag} ${
                    tags.lookingFor[0].toLowerCase().includes("women") || tags.lookingFor[0].toLowerCase().includes("woman")
                      ? styles.identityWoman
                      : tags.lookingFor[0].toLowerCase().includes("men") || tags.lookingFor[0].toLowerCase().includes("man")
                        ? styles.identityMan
                        : tags.lookingFor[0].toLowerCase().includes("couple")
                          ? styles.identityCouple
                          : styles.lookingForTag
                  }`}>
                    {getTranslatedTag('profile.lookingFor', tags.lookingFor[0])}
                  </span>
                  {tags.lookingFor.length > 1 && (
                    <span className={styles.moreCount}>+{tags.lookingFor.length - 1}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* User Tags - List View */}
        {showExtendedDetails && (
          <div className={styles.tagsContainer}>
            {/* Show More/Less Toggle for all sections */}
            {(tags.lookingFor.length > 0 || tags.into.length > 0 || tags.interests.length > 0) && (
              <div className={styles.tagsToggle}>
                <span className={styles.toggleBtn} onClick={toggleShowMoreSections}>
                  {showMoreSections ? (
                    <>{safeTranslate(t, 'common.showLess', 'Show less')} <FaChevronUp size={12} style={{ marginLeft: "4px" }} /></>
                  ) : (
                    <>{safeTranslate(t, 'common.showMore', 'Show more')} <FaChevronDown size={12} style={{ marginLeft: "4px" }} /></>
                  )}
                </span>
              </div>
            )}

            {/* All sections now only visible when showMoreSections is true */}
            {showMoreSections && (
              <>
                {/* Interests */}
                {tags.interests.length > 0 && (
                  <div className={styles.tagCategory}>
                    <h4 className={styles.categoryTitle}>{safeTranslate(t, 'profile.interests', 'Interests')}</h4>
                    <div className={styles.interestTags}>
                      {(showAllTags ? tags.interests : tags.interests.slice(0, 2)).map((tag, idx) => (
                        <span key={`interest-${idx}`} className={`${styles.tag} ${
                          tag.toLowerCase().includes("women") || tag.toLowerCase().includes("woman")
                            ? styles.identityWoman
                            : tag.toLowerCase().includes("men") || tag.toLowerCase().includes("man")
                              ? styles.identityMan
                              : tag.toLowerCase().includes("couple")
                                ? styles.identityCouple
                                : ""
                        }`}>
                          {getTranslatedTag('profile.interests', tag)}
                        </span>
                      ))}
                      {tags.interests.length > 2 && !showAllTags && (
                        <span className={styles.moreCount} onClick={toggleShowAllTags}>
                          +{tags.interests.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Preferences section (formerly Into) */}
                {tags.into.length > 0 && (
                  <div className={styles.tagCategory}>
                    <h4 className={styles.categoryTitle}>{safeTranslate(t, 'profile.preferences', 'Preferences')}</h4>
                    <div className={styles.interestTags}>
                      {(showAllTags ? tags.into : tags.into.slice(0, 2)).map((tag, idx) => (
                        <span key={`into-${idx}`} className={`${styles.tag} ${
                          tag.toLowerCase().includes("women") || tag.toLowerCase().includes("woman")
                            ? styles.identityWoman
                            : tag.toLowerCase().includes("men") || tag.toLowerCase().includes("man")
                              ? styles.identityMan
                              : tag.toLowerCase().includes("couple")
                                ? styles.identityCouple
                                : styles.intoTag
                        }`}>
                          {getTranslatedTag('profile.intoTags', tag)}
                        </span>
                      ))}
                      {tags.into.length > 2 && !showAllTags && (
                        <span className={styles.moreCount} onClick={toggleShowAllTags}>
                          +{tags.into.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Global More/Less Toggle for all tags */}
                {(tags.lookingFor.length > 2 || tags.into.length > 2 || tags.interests.length > 2) && (
                  <div className={styles.tagsToggle}>
                    <span className={styles.toggleBtn} onClick={toggleShowAllTags}>
                      {showAllTags ? (
                        <>{safeTranslate(t, 'common.showLessTags', 'Show less tags')} <FaChevronUp size={12} style={{ marginLeft: "4px" }} /></>
                      ) : (
                        <>{safeTranslate(t, 'common.showAllTags', 'Show all tags')} <FaChevronDown size={12} style={{ marginLeft: "4px" }} /></>
                      )}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons - List View */}
      <div className={styles.listActions}>{renderActionButtons()}</div>
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
