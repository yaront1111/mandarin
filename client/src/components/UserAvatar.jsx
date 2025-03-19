

import React, { useState, useEffect } from "react";

/**
 * UserAvatar component for displaying user profile pictures
 * Uses static placeholder image for invalid IDs
 */
const UserAvatar = ({
  userId,
  name = "User",
  className = "",
  size = "md",
  src,
  showStatus = false,
  isOnline = false,
}) => {
  const [avatarSrc, setAvatarSrc] = useState("/placeholder.svg");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Safely determine avatar source
  useEffect(() => {
    // Option 1: Direct source provided
    if (src) {
      setAvatarSrc(src);
      setLoading(false);
      return;
    }

    // Option 2: No source or userId - use placeholder
    if (!userId) {
      setAvatarSrc("/placeholder.svg");
      setLoading(false);
      return;
    }

    setLoading(true);

    // Try to create URL based on user ID - first try direct file path
    // This approach is intended to work without API calls
    const placeholderImage = "/placeholder.svg";

    // Use a basic path that would work with most server setups
    const userAvatarPath = `/uploads/user-${userId}.jpg`;

    // Test if the image exists by preloading it
    const img = new Image();

    img.onload = () => {
      setAvatarSrc(userAvatarPath);
      setLoading(false);
    };

    img.onerror = () => {
      // If direct path fails, use placeholder
      console.warn(`Could not load avatar image for user ${userId}`);
      setAvatarSrc(placeholderImage);
      setLoading(false);
    };

    img.src = userAvatarPath;

    // Cleanup
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [userId, src]);

  // Handle size classes
  const getSizeClass = () => {
    switch(size) {
      case "xs": return "w-6 h-6";
      case "sm": return "w-8 h-8";
      case "md": return "w-10 h-10";
      case "lg": return "w-16 h-16";
      case "xl": return "w-24 h-24";
      default: return "w-10 h-10";
    }
  };

  return (
    <div className={`user-avatar-container ${className}`}>
      <div className={`user-avatar ${getSizeClass()} relative`}>
        {loading ? (
          <div className="placeholder-avatar"
               style={{ width: "100%", height: "100%", borderRadius: "50%", backgroundColor: "#e0e0e0" }}>
          </div>
        ) : (
          <img
            src={avatarSrc}
            alt={`${name}'s avatar`}
            className="rounded-full object-cover w-full h-full"
            onError={() => setAvatarSrc("/placeholder.svg")}
          />
        )}
        {showStatus && isOnline && (
          <div className="status-indicator"
               style={{
                 position: "absolute",
                 right: "0",
                 bottom: "0",
                 width: "30%",
                 height: "30%",
                 maxWidth: "12px",
                 maxHeight: "12px",
                 minWidth: "6px",
                 minHeight: "6px",
                 backgroundColor: "#4CAF50",
                 borderRadius: "50%",
                 border: "2px solid white"
               }}>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserAvatar;
