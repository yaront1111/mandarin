"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useUser } from "../../context";
import { FaImage, FaVideo, FaStarOfLife } from "react-icons/fa";
import styles from "../../styles/stories.module.css";
import Avatar from "../common/Avatar";

const StoryThumbnail = ({ story, onClick, hasUnviewedStories, user: propUser, mediaType }) => {
  const { user: contextUser } = useUser();
  const touchStartTimeRef = useRef(0);

  // Derive user object from story or props
  const storyUser = useMemo(() => {
    if (propUser) return propUser;
    if (!story) return {};
    if (typeof story.user === "object") return story.user;
    if (story.userData && typeof story.userData === "object") return story.userData;
    if (typeof story.user === "string") return { _id: story.user };
    return {};
  }, [story, propUser]);

  const userId = storyUser._id;
  const userName = storyUser.nickname || storyUser.username || storyUser.name || "User";

  // Check if this story is viewed by the current user
  const isViewed = useMemo(() => {
    if (typeof hasUnviewedStories !== "undefined") {
      return !hasUnviewedStories;
    }
    if (!contextUser || !contextUser._id || !story?.viewers) return false;
    if (!Array.isArray(story.viewers)) return false;
    return story.viewers.includes(contextUser._id);
  }, [hasUnviewedStories, contextUser, story]);

  // Determine if this is a "coming soon" story type
  const isComingSoon = useMemo(() => {
    return mediaType === "video" || mediaType === "image";
  }, [mediaType]);

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
          <Avatar 
            user={storyUser}
            alt={`${userName}'s avatar`}
            className={styles.thumbnailImage}
            size="medium"
            showFallback={true}
          />
          
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
