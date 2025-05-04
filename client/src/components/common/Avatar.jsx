import React from 'react';
import PropTypes from 'prop-types';
import { normalizePhotoUrl, markUrlAsFailed, logger } from '../../utils';

const log = logger.create('Avatar');

/**
 * Reusable avatar component for user photos
 */
const Avatar = ({
  src,
  alt,
  size = 'medium',
  status = null,
  className = '',
  onClick,
  online = false,
  placeholder = '/default-avatar1.png',
  statusPosition = 'bottom-right',
  showFallback = true,
  user = null,
  showOnlineStatus = false
}) => {
  // If user object is provided, extract src, alt and online status from it
  const userSrc = user?.photos?.[0]?.url || user?._id || src;
  const userAlt = user?.nickname || alt || "User";
  const userOnline = (showOnlineStatus && user?.isOnline) || online;
  
  // Use extracted values for the rest of the component
  src = userSrc;
  alt = userAlt;
  online = userOnline;
  // Handle fallback image if src is invalid
  const [imgSrc, setImgSrc] = React.useState(src);
  const [imageError, setImageError] = React.useState(false);
  const [debugInfo, setDebugInfo] = React.useState('');
  
  // Cache for src values - prevent duplicate requests
  const srcCacheRef = React.useRef(new Map());
  
  // Fix for default avatar path
  const defaultAvatarPath = `${window.location.origin}/default-avatar1.png`;
  
  React.useEffect(() => {
    // Only reset if src actually changes to avoid infinite loop
    if (src !== imgSrc || (!src && !imageError)) {
      // Check if we've previously processed this src and had an error
      if (src && srcCacheRef.current.has(src)) {
        const cachedResult = srcCacheRef.current.get(src);
        if (cachedResult.error) {
          setImgSrc(cachedResult.fallback);
          setImageError(true);
          return;
        }
      }
      
      // Skip unsplash URLs entirely since they are consistently failing
      if (src && typeof src === 'string' && src.includes('unsplash.com')) {
        setImgSrc(defaultAvatarPath);
        setImageError(true);
        return;
      }
      
      setImgSrc(src || defaultAvatarPath);
      setImageError(false);
      
      // For debugging
      if (src && typeof src === 'string' && /^[0-9a-f]{24}$/i.test(src)) {
        log.debug(`Avatar for user ID: ${src}`);
      }
    }
  }, [src, defaultAvatarPath, imgSrc, imageError]);
  
  const handleError = (e) => {
    // Collect error information for debugging
    const failedSrc = e.target.src;
    setDebugInfo(`Failed to load image: ${failedSrc}`);
    
    // Don't log Unsplash errors, they're expected due to rate limiting
    if (!failedSrc.includes('unsplash.com')) {
      log.error(`Image failed to load: ${failedSrc}`, { originalSrc: src });
    }
    
    // Only update if we haven't already fallen back
    if (!imageError && showFallback) {
      // Use local default avatar instead of external service
      const fallbackImg = defaultAvatarPath;
      
      // Cache the result to prevent future requests to this URL
      if (src) {
        // Local component cache
        srcCacheRef.current.set(src, { 
          error: true, 
          fallback: fallbackImg 
        });
        
        // Global URL cache to help other components
        if (failedSrc) {
          markUrlAsFailed(failedSrc);
        }
      }
      
      setImgSrc(fallbackImg);
      setImageError(true);
    }
  };
  
  // Normalize URL with better error handling
  let normalizedSrc;
  try {
    // For MongoDB ObjectId patterns, directly use the avatar API
    if (imgSrc && typeof imgSrc === 'string' && /^[0-9a-f]{24}$/i.test(imgSrc)) {
      normalizedSrc = `${window.location.origin}/api/avatars/${imgSrc}`;
      log.debug(`Using direct avatar API path: ${normalizedSrc}`);
    } else {
      normalizedSrc = normalizePhotoUrl(imgSrc);
    }
  } catch (err) {
    log.error(`Error normalizing URL: ${err.message}`, { src: imgSrc });
    normalizedSrc = defaultAvatarPath;
  }
  
  // Size classes
  const sizeClasses = {
    tiny: 'avatar-xs',
    small: 'avatar-sm',
    medium: 'avatar-md',
    large: 'avatar-lg',
    xlarge: 'avatar-xl'
  };
  
  const avatarStyles = {
    backgroundImage: `url(${normalizedSrc})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  };
  
  return (
    <div 
      className={`avatar ${sizeClasses[size] || ''} ${online ? 'avatar-online' : ''} ${className}`}
      onClick={onClick}
      style={avatarStyles}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-debug={debugInfo}
    >
      {/* Actual image is hidden but helps with loading and fallback */}
      <img 
        src={normalizedSrc}
        alt={alt}
        onError={handleError}
        style={{ display: 'none' }}
        crossOrigin="anonymous"
      />
      
      {status && (
        <span className={`avatar-status status-${status} status-${statusPosition}`}></span>
      )}
    </div>
  );
};

Avatar.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string,
  size: PropTypes.oneOf(['tiny', 'small', 'medium', 'large', 'xlarge']),
  status: PropTypes.oneOf([null, 'online', 'offline', 'busy', 'away']),
  className: PropTypes.string,
  onClick: PropTypes.func,
  online: PropTypes.bool,
  placeholder: PropTypes.string,
  statusPosition: PropTypes.oneOf(['top-right', 'top-left', 'bottom-right', 'bottom-left']),
  showFallback: PropTypes.bool,
  user: PropTypes.object, // User object with nickname, photos, isOnline, etc.
  showOnlineStatus: PropTypes.bool // Whether to show online status from user object
};

export default Avatar;
