"use client"

import { useState, useEffect } from 'react';

/**
 * UserAvatar component with automatic fallback
 *
 * @param {Object} props
 * @param {string} props.userId - User ID
 * @param {string} props.name - User display name for fallback
 * @param {string} props.src - Optional direct image source
 * @param {string} props.className - CSS class for the image
 * @param {Function} props.onError - Optional error callback
 */
const UserAvatar = ({ userId, name, src, className, onError, ...rest }) => {
  const [imgSrc, setImgSrc] = useState(src || (userId ? `/api/avatar/${userId}` : null));
  const [hasError, setHasError] = useState(false);

  // Generate initials for fallback
  const getInitials = () => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Get random pastel color based on user ID or name
  const getColorFromString = (str) => {
    if (!str) return '#cccccc';

    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Generate pastel colors
    const h = hash % 360;
    return `hsl(${h}, 70%, 80%)`;
  };

  // Handle image load errors
  const handleError = () => {
    if (onError) onError();
    setHasError(true);
    setImgSrc(null);
  };

  useEffect(() => {
    // Reset if src or userId changes
    setImgSrc(src || (userId ? `/api/avatar/${userId}` : null));
    setHasError(false);
  }, [src, userId]);

  if (hasError || !imgSrc) {
    // Render fallback avatar with initials
    const backgroundColor = getColorFromString(userId || name);
    const textColor = '#ffffff';

    return (
      <div
        className={`user-avatar-fallback ${className || ''}`}
        style={{
          backgroundColor,
          color: textColor,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          fontWeight: 'bold',
          ...rest.style
        }}
        {...rest}
      >
        {getInitials()}
      </div>
    );
  }

  // Render actual image
  return (
    <img
      src={imgSrc}
      alt={name || "User"}
      className={className}
      onError={handleError}
      {...rest}
    />
  );
};

export default UserAvatar;
