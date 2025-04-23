"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useUser } from "../../context";
import { FaImage, FaVideo, FaStarOfLife } from "react-icons/fa";
import styles from "../../styles/stories.module.css";

const StoryThumbnail = ({ story, onClick, hasUnviewedStories, user: propUser, mediaType }) => {
  const { user: contextUser } = useUser();
  const [imageError, setImageError] = useState(false);

  // Use a ref to track images we've already tried to load and failed
  const failedImagesRef = useRef(new Set());
  const touchStartTimeRef = useRef(0);

  // Derive user object from story or props
  const storyUser = useMemo(() => {
    if (propUser) return propUser;
    if (!story) return {};
    if (typeof story.user === "object") return story.user;
    if (story.userData && typeof story.userData === "object") return story.userData;
    if (typeof story.user === "string") return { id: story.user };
    return {};
  }, [story, propUser]);

  const userId = storyUser.id;
  const userName = storyUser.nickname || storyUser.username || storyUser.name || "User";
  const explicitAvatarSrc = storyUser.profilePicture || storyUser.avatar || null;

  // Determine the final avatar URL - use the proper URL pattern
  const avatarUrl = useMemo(() => {
    const baseUrl = window.location.origin;
    const url = explicitAvatarSrc ||
                (userId ? `${baseUrl}/api/avatars/${userId}` : `${baseUrl}/placeholder.svg`);

    // If we've already tried this URL and it failed, go straight to placeholder
    if (failedImagesRef.current.has(url)) {
      return `${baseUrl}/placeholder.svg`;
    }

    return url;
  }, [explicitAvatarSrc, userId]);

  // Reset error state when avatarUrl changes, but only if it's not a known failed URL
  useEffect(() => {
    if (!failedImagesRef.current.has(avatarUrl)) {
      setImageError(false);
    }
  }, [avatarUrl]);

  // Check if this story is viewed by the current user
  const isViewed = useMemo(() => {
    if (typeof hasUnviewedStories !== "undefined") {
      return !hasUnviewedStories;
    }
    if (!contextUser || !contextUser.id || !story?.viewers) return false;
    if (!Array.isArray(story.viewers)) return false;
    return story.viewers.includes(contextUser.id);
  }, [hasUnviewedStories, contextUser, story]);

  // Determine if this is a "coming soon" story type
  const isComingSoon = useMemo(() => {
    return mediaType === "video" || mediaType === "image";
  }, [mediaType]);

  // Generate placeholder similar to UserAvatar
  const renderPlaceholder = () => {
    const colors = [
      "#1abc9c", "#2ecc71", "#3498db", "#9b59b6", "#34495e",
      "#16a085", "#27ae60", "#2980b9", "#8e44ad", "#2c3e50",
      "#f1c40f", "#e67e22", "#e74c3c", "#ecf0f1", "#95a5a6",
    ];
    const colorIndex = userId
      ? userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
      : 0;
    const bgColor = colors[colorIndex];
    const initial = userName ? userName.charAt(0).toUpperCase() : "?";

    return (
      <div
        className={styles.thumbnailPlaceholder}
        style={{ backgroundColor: bgColor }}
      >
        {initial}
      </div>
    );
  };

  const handleClick = (e) => {
    if (isComingSoon) {
      e.preventDefault();
      e.stopPropagation();
      // Don't trigger onClick for coming soon stories
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (typeof onClick === "function") onClick();
  };

  // Handle touch events for better mobile experience
  const handleTouchStart = (e) => {
    touchStartTimeRef.current = Date.now();
  };

  const handleTouchEnd = (e) => {
    const touchDuration = Date.now() - touchStartTimeRef.current;

    // Only handle as a click if it was a quick tap (not a long press or drag)
    if (touchDuration < 300) {
      handleClick(e);
    }
  };

  if (!story && !propUser) return null;

  return (
    <div
      className={styles.storyThumbnail}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label={`${userName}'s story ${isViewed ? 'viewed' : 'not viewed'}`}
      role="button"
    >
      <div className={`${styles.avatarBorder} ${isViewed ? styles.avatarBorderViewed : ""}`}>
        <div className={styles.imageContainer}>
          {!imageError ? (
            <img
              className={styles.thumbnailImage}
              src={avatarUrl}
              alt={`${userName}'s avatar`}
              onError={(e) => {
                // Add to failed images set
                failedImagesRef.current.add(avatarUrl);
                setImageError(true);
              }}
              crossOrigin="anonymous"
              loading="lazy"
            />
          ) : (
            renderPlaceholder()
          )}
          
          {/* Media type icon */}
          {mediaType === "video" && (
            <div className={styles.mediaTypeIcon}>
              <FaVideo />
            </div>
          )}
          
          {mediaType === "image" && (
            <div className={styles.mediaTypeIcon}>
              <FaImage />
            </div>
          )}
        </div>
      </div>
      
      {/* Coming soon badge */}
      {isComingSoon && (
        <div className={styles.comingSoonBadge}>
          <FaStarOfLife size={8} style={{ marginRight: "2px" }} /> Coming Soon
        </div>
      )}
      
      <div className={styles.username}>{userName}</div>
    </div>
  );
};

export default StoryThumbnail;
