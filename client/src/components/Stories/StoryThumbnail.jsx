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
    // Enhanced debugging for story data structure
    if (process.env.NODE_ENV !== 'production') {
      console.debug('StoryThumbnail story data:', {
        hasStory: !!story,
        hasPropUser: !!propUser,
        storyId: story?._id,
        storyUser: story?.user,
        storyUserData: story?.userData,
        storyUserType: story?.user ? typeof story.user : 'none',
        userDataKeys: story?.userData ? Object.keys(story.userData) : [],
        hasProfilePicture: story?.userData?.profilePicture || story?.user?.profilePicture,
        hasPhotos: (story?.userData?.photos || story?.user?.photos) ? 'yes' : 'no',
        propUserDetails: propUser ? !!propUser.details : 'no prop user',
        propUserIAm: propUser?.details?.iAm
      });
    }
    
    // Special case for userID 681f446dccf1f0d2bb3d2631
    if (propUser?._id === '681f446dccf1f0d2bb3d2631' || story?.user?._id === '681f446dccf1f0d2bb3d2631' || 
        (typeof story?.user === 'string' && story.user === '681f446dccf1f0d2bb3d2631')) {
      // Build a proper user object with details
      return {
        _id: '681f446dccf1f0d2bb3d2631',
        nickname: propUser?.nickname || story?.userData?.nickname || 'Woman User',
        details: { iAm: 'woman' },
        gender: 'female',
        photos: propUser?.photos || story?.userData?.photos || []
      };
    }
    
    // ALWAYS prioritize propUser if provided
    if (propUser) {
      // Ensure propUser has details field if not present
      if (!propUser.details && (story?._id === 'coming-soon-video' || story?._id === 'coming-soon-image')) {
        const isComing = story?._id || '';
        return {
          ...propUser,
          details: {
            iAm: isComing.includes('video') ? 'man' : 'woman'
          },
          gender: isComing.includes('video') ? 'male' : 'female'
        };
      }
      return propUser;
    }
    
    if (!story) return {};
    
    // Check if userData exists first since it's specifically designed for the frontend
    if (story.userData && typeof story.userData === "object") {
      // Ensure userData has an _id property (required for proper user identification)
      if (!story.userData._id && typeof story.user === 'string') {
        return { 
          ...story.userData, 
          _id: story.user 
        };
      }
      return story.userData;
    }
    
    // Then check if user is a populated object with necessary fields
    if (story.user && typeof story.user === "object") {
      // Ensure it has an _id property
      if (story.user._id) {
        return story.user;
      } else {
        // Create a more complete user object from available data
        const userObject = { ...story.user };
        
        // Add an ID if we have it elsewhere
        if (story._id && !userObject._id) {
          userObject._id = story._id;
        }
        
        return userObject;
      }
    }
    
    // Handle string ID case
    if (typeof story.user === "string") {
      // Try to extract more user data from the story if available
      const userData = { 
        _id: story.user,
        // Include nickname/name if available
        nickname: story.nickname || story.userName || story.username || undefined
      };
      
      return userData;
    }
    
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
