// client/src/components/Stories/StoryThumbnail.jsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useUser } from "../../context";
import "../../styles/stories.css";
// Removed: import UserAvatar from "../UserAvatar";

const StoryThumbnail = ({ story, onClick, hasUnviewedStories, user: propUser }) => {
  const { user: contextUser } = useUser();
  const [imageError, setImageError] = useState(false); // State for image loading error
  
  // Use a ref to track images we've already tried to load and failed
  const failedImagesRef = useRef(new Set());

  // Derive user object from story or props
  const storyUser = useMemo(() => {
    // ... (this logic remains the same)
    if (propUser) return propUser;
    if (!story) return {};
    if (typeof story.user === "object") return story.user;
    if (story.userData && typeof story.userData === "object") return story.userData;
    if (typeof story.user === "string") return { _id: story.user };
    return {};
  }, [story, propUser]);

  const userId = storyUser._id;
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
    // ... (this logic remains the same)
    if (typeof hasUnviewedStories !== "undefined") {
      return !hasUnviewedStories;
    }
    if (!contextUser || !contextUser._id || !story?.viewers) return false;
    if (!Array.isArray(story.viewers)) return false;
    return story.viewers.includes(contextUser._id);
  }, [hasUnviewedStories, contextUser, story]);

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
    const size = 64; // Match the desired avatar size

    return (
      <div
        // === Added new class for placeholder ===
        className="story-thumbnail-placeholder flex items-center justify-center rounded-full text-white font-bold"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: bgColor,
          fontSize: `${size / 2}px`,
        }}
      >
        {initial}
      </div>
    );
  };

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof onClick === "function") onClick();
  };

  if (!story && !propUser) return null;

  return (
    <div className="story-thumbnail" onClick={handleClick}>
      <div className={`story-avatar-border ${isViewed ? "viewed" : ""}`}>
        <div className="story-image-container rounded-full overflow-hidden"> {/* Optional container */}
          {!imageError ? (
            <img
              // === Added new class for image ===
              className="story-thumbnail-image" // New class for direct styling
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
            renderPlaceholder() // Render fallback
          )}
        </div>
      </div>
      <div className="story-username">{userName}</div>
    </div>
  );
};

export default StoryThumbnail;
