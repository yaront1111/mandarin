import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { logger } from '../../utils';
import usePhotoManagement from '../../hooks/usePhotoManagement';

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
  // Use the shared photo management hook
  const { 
    normalizePhotoUrl, 
    getProfilePhotoUrl, 
    handlePhotoLoadError, 
    clearCache 
  } = usePhotoManagement();

  // If user object is provided, extract src, alt and online status from it
  // Use getProfilePhotoUrl to get the proper profile photo if available
  const userSrc = user ? getProfilePhotoUrl(user) : (src || null);
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
  
  // Add timestamp state to force re-renders when photo is updated
  const [renderTimestamp, setRenderTimestamp] = React.useState(Date.now());

  // Force refresh when needed
  const forceRefresh = () => {
    clearCache();
    setRenderTimestamp(Date.now());
  };
  
  // Listen for global avatar refresh events and image load
  useEffect(() => {
    const handleAvatarRefresh = (event) => {
      // Update the timestamp to trigger a re-render
      setRenderTimestamp(event.detail.timestamp || Date.now());
      
      // Clear local image cache on refresh events
      srcCacheRef.current.clear();
      
      // Clear image error state to attempt reload
      setImageError(false);
    };
    
    // Add event listener for avatar refresh
    window.addEventListener('avatar:refresh', handleAvatarRefresh);
    
    // Define a listener for the "loadeddata" document event 
    // to refresh avatars when navigating between pages
    const handleDocumentLoad = () => {
      // Only force refresh if there was a previous error
      if (imageError) {
        forceRefresh();
      }
    };
    
    // Listen for page fully loaded event
    window.addEventListener('load', handleDocumentLoad);
    
    // Clean up
    return () => {
      window.removeEventListener('avatar:refresh', handleAvatarRefresh);
      window.removeEventListener('load', handleDocumentLoad);
    };
  }, [imageError]);

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
      
      // Cache busting strategy:
      // 1. Only add cache busting on first load of the component
      // 2. Only for user profile photos
      // 3. Store the processed URL in the srcCacheRef to prevent multiple cache busting on re-renders
      const isUserPhoto = user && user.photos?.length > 0;
      const isCached = srcCacheRef.current.has(src);
      
      // Apply cache busting only on first load of user profile photos
      let processedSrc;
      if (isUserPhoto && !isCached) {
        // Use cache busting only for the initial load
        processedSrc = normalizePhotoUrl(src, true);
        // Store in cache to prevent applying cache busting again on re-renders
        srcCacheRef.current.set(src, { processed: processedSrc, error: false });
      } else if (isCached && !srcCacheRef.current.get(src).error) {
        // Use the cached version if it exists and doesn't have an error
        processedSrc = srcCacheRef.current.get(src).processed;
      } else {
        // Otherwise, just normalize without cache busting
        processedSrc = normalizePhotoUrl(src, false);
      }
      
      setImgSrc(processedSrc);
      setImageError(false);
      
      // For debugging
      if (src && typeof src === 'string' && /^[0-9a-f]{24}$/i.test(src)) {
        log.debug(`Avatar for user ID: ${src}`);
      }
    }
  }, [src, defaultAvatarPath, imgSrc, imageError, normalizePhotoUrl, user, renderTimestamp]);
  
  // Track retry attempts for each image
  const retryAttemptsRef = React.useRef(new Map());
  
  const handleError = (e) => {
    // Collect error information for debugging
    const failedSrc = e.target.src;
    setDebugInfo(`Failed to load image: ${failedSrc}`);
    
    // Check if this is a newly uploaded image by checking the timestamp pattern
    const isNewlyUploaded = typeof src === 'string' && /\d+-\d+\.(jpg|jpeg|png|gif|webp)$/i.test(src);
    
    // Initialize retry counter if needed
    if (!retryAttemptsRef.current.has(src)) {
      retryAttemptsRef.current.set(src, 0);
    }
    
    // Get current retry attempts
    const attempts = retryAttemptsRef.current.get(src);
    
    // Allow more retries for newly uploaded images (they might be still processing)
    const maxRetries = isNewlyUploaded ? 3 : 1;
    
    // Don't log Unsplash errors, they're expected due to rate limiting
    if (!failedSrc.includes('unsplash.com')) {
      log.error(`Image failed to load: ${failedSrc}`, { originalSrc: src, attempt: attempts + 1, maxRetries });
    }
    
    // If we haven't reached max retries for this image, try again with cache busting
    if (attempts < maxRetries) {
      retryAttemptsRef.current.set(src, attempts + 1);
      
      // For newly uploaded images, add a longer delay between retries
      const retryDelay = isNewlyUploaded ? 1500 : 500;
      
      // Try again with forced cache busting for newly uploaded images
      setTimeout(() => {
        // Clear the source cache for this image
        srcCacheRef.current.delete(src);
        
        // Generate a new timestamp for cache busting
        const timestamp = Date.now();
        const bustingSrc = normalizePhotoUrl(src, true) + `&retry=${timestamp}`;
        
        log.debug(`Retrying image load (${attempts + 1}/${maxRetries}): ${bustingSrc}`);
        setImgSrc(bustingSrc);
        setRenderTimestamp(timestamp);
      }, retryDelay);
      
      return;
    }
    
    // Only update if we've exhausted retries and need to fall back
    if (showFallback) {
      // Use local default avatar instead of external service
      const fallbackImg = defaultAvatarPath;
      
      // Cache the result to prevent future requests to this URL
      if (src) {
        // Local component cache
        srcCacheRef.current.set(src, { 
          error: true, 
          fallback: fallbackImg 
        });
        
        // Global URL cache to help other components using handlePhotoLoadError
        if (failedSrc) {
          handlePhotoLoadError(src, failedSrc);
        }
      }
      
      setImgSrc(fallbackImg);
      setImageError(true);
    }
  };
  
  // Normalize URL with better error handling
  let normalizedSrc;
  try {
    // Use the image source that's already been processed correctly
    normalizedSrc = imgSrc;
  } catch (err) {
    log.error(`Error with image source: ${err.message}`, { src: imgSrc });
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
  
  // Add a double-click handler to force refresh if needed
  const handleDoubleClick = (e) => {
    // Only respond to double-click if we're not also handling clicks
    if (!onClick) {
      forceRefresh();
      e.stopPropagation();
    }
  };

  return (
    <div 
      className={`avatar ${sizeClasses[size] || ''} ${online ? 'avatar-online' : ''} ${className}`}
      onClick={onClick}
      onDoubleClick={handleDoubleClick}
      style={avatarStyles}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-debug={debugInfo}
      data-timestamp={renderTimestamp}
    >
      {/* Actual image is hidden but helps with loading and fallback */}
      <img 
        src={normalizedSrc}
        alt={alt}
        onError={handleError}
        style={{ display: 'none' }}
        crossOrigin="anonymous"
        key={`img-${renderTimestamp}`}
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
