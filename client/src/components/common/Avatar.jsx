import React, { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { logger } from '../../utils';
import usePhotoManagement from '../../hooks/usePhotoManagement';

const log = logger.create('Avatar');

// Helper function to check if a URL is the default avatar
const isDefaultAvatar = (url) => {
  if (!url) return false;
  return url.includes('default-avatar.png') || url.includes('default-avatar.jpg');
};

// Special case function to handle specific users that need gender-specific avatars
const getSpecialCaseAvatar = (userId, userName) => {
  // Known user IDs that need forced gender avatars
  const specialCases = {
    'video-user': '/man-avatar.png',
    'image-user': '/women-avatar.png',
    'mrbig111': '/man-avatar.png',   // Force male avatar for this user
    'test-man': '/man-avatar.png',
    'test-woman': '/women-avatar.png',
    'test-couple': '/couple-avatar.png'
  };

  // Check by userId first (most reliable)
  if (userId && specialCases[userId]) {
    return specialCases[userId];
  }

  // Then try by username if available
  if (userName) {
    // Check exact matches
    if (specialCases[userName]) {
      return specialCases[userName];
    }
    
    // Check by nickname patterns
    const nameLower = userName.toLowerCase();
    if (nameLower.includes('mr') || nameLower.includes('man') || nameLower.includes('guy')) {
      return '/man-avatar.png';
    }
    if (nameLower.includes('ms') || nameLower.includes('mrs') || nameLower.includes('woman') || 
        nameLower.includes('girl') || nameLower.includes('lady')) {
      return '/women-avatar.png';
    }
    if (nameLower.includes('couple') || nameLower.includes('pair') || nameLower.includes('together')) {
      return '/couple-avatar.png';
    }
  }

  // No special case found
  return null;
};

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
  placeholder = '/default-avatar.png',
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
  
  // Add debugging only in development mode
  if (process.env.NODE_ENV === 'development') {
    log.debug('Avatar component received user:', user ? `User ID: ${user._id}` : 'No user');
    if (user && user.details) {
      log.debug('Avatar component - user.details.iAm:', user.details.iAm);
    }
    log.debug('Avatar component - placeholder prop:', placeholder);
  }

  // Memoize expensive avatar calculations
  const { userSrc, userAlt, userOnline } = useMemo(() => {
    // If user object is provided, extract src, alt and online status from it
    // Use getProfilePhotoUrl to get the proper profile photo if available
    let computedSrc = user ? getProfilePhotoUrl(user) : (src || null);
    const computedAlt = user?.nickname || alt || "User";
    const computedOnline = (showOnlineStatus && user?.isOnline) || online;
    
    // First check for known troublesome special cases - direct handling for critical users
    if ((user?._id === 'mrbig111' || computedAlt === 'mrbig111') && 
        !(user?._id === '681f446dccf1f0d2bb3d2631')) { // Make sure we don't match woman user
      log.debug('Immediate fix for mrbig111 user - forcing man avatar');
      computedSrc = `${window.location.origin}/man-avatar.png`;
    }
    // Direct fix for the woman user with ID 681f446dccf1f0d2bb3d2631
    else if (user?._id === '681f446dccf1f0d2bb3d2631') {
      // Check if we already have a non-default profile photo URL
      if (computedSrc && 
          !isDefaultAvatar(computedSrc) && 
          !computedSrc.includes('man-avatar') && 
          computedSrc.includes('/uploads/images/')) {
        // Save the real profile photo URL to localStorage for consistency 
        try {
          // Check if we already have this URL cached with a timestamp
          const existingCache = window.localStorage.getItem('user_681f446dccf1f0d2bb3d2631_photo');
          let shouldUpdate = true;
          
          if (existingCache) {
            const existing = JSON.parse(existingCache);
            // Only update if URL changed or cache is older than 5 minutes
            if (existing.url === computedSrc && existing.timestamp && 
                (Date.now() - existing.timestamp) < 5 * 60 * 1000) {
              shouldUpdate = false;
            }
          }
          
          if (shouldUpdate) {
            const cachedUrl = {
              url: computedSrc,
              timestamp: Date.now()
            };
            window.localStorage.setItem('user_681f446dccf1f0d2bb3d2631_photo', JSON.stringify(cachedUrl));
            // log.debug('Saved photo URL to localStorage for 681f446dccf1f0d2bb3d2631:', computedSrc);
          }
        } catch (e) {
          // Ignore storage errors
        }
        
        // log.debug('Using existing profile photo URL for woman user:', computedSrc);
      } else {
        // Try to get cached URL from localStorage first
        let foundCachedUrl = false;
        try {
          const cachedData = window.localStorage.getItem('user_681f446dccf1f0d2bb3d2631_photo');
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            if (parsed.url && parsed.url.includes('/uploads/images/')) {
              // log.debug('Using cached profile photo URL from localStorage:', parsed.url);
              computedSrc = parsed.url;
              foundCachedUrl = true; // Mark that we found a cached URL, don't continue to gender avatar
            }
          }
        } catch (e) {
          // Ignore storage errors
        }
        
        // Force women avatar as fallback only if we didn't find a cached URL
        if (!foundCachedUrl) {
          log.debug('Forcing women avatar for user 681f446dccf1f0d2bb3d2631');
          computedSrc = `${window.location.origin}/women-avatar.png`;
        }
      }
    }
    // Fix for "coming soon" story users 
    else if (user?._id === 'video-user' || user?._id === 'image-user') {
      const avatarType = user._id === 'video-user' ? 'man' : 'women';
      log.debug(`Immediate fix for ${user._id} - forcing ${avatarType} avatar`);
      computedSrc = `${window.location.origin}/${avatarType}-avatar.png`;
    }
    // Apply special case handling for other users that need forced gender avatars
    else {
      const specialCaseAvatar = getSpecialCaseAvatar(user?._id, computedAlt);
      
      // First check for special case avatars that explicitly need gender-specific treatment
      if (specialCaseAvatar) {
        log.debug(`Applying special case avatar for ${computedAlt}:`, specialCaseAvatar);
        computedSrc = `${window.location.origin}${specialCaseAvatar}?_refresh=${Date.now()}`;
      } 
      // Then check if we have a default avatar which should be replaced with gender-specific
      else if (computedSrc && isDefaultAvatar(computedSrc) && user) {
        // Case-insensitive matching for gender
        const iAm = user.details?.iAm?.toLowerCase() || '';
        const gender = user.gender?.toLowerCase() || '';
        
        // Try to get gender specific avatar based on user info
        let genderBasedAvatar = null;
        
        // Check iAm field first (preferred)
        if (iAm === 'man' || iAm === 'male') {
          genderBasedAvatar = '/man-avatar.png';
        } else if (iAm === 'woman' || iAm === 'women' || iAm === 'female') {
          genderBasedAvatar = '/women-avatar.png';
        } else if (iAm === 'couple' || iAm === 'other') {
          genderBasedAvatar = '/couple-avatar.png';
        }
        // Then check gender field
        else if (gender === 'male' || gender === 'man') {
          genderBasedAvatar = '/man-avatar.png';
        } else if (gender === 'female' || gender === 'woman' || gender === 'women') {
          genderBasedAvatar = '/women-avatar.png';
        } else if (gender === 'couple' || gender === 'other') {
          genderBasedAvatar = '/couple-avatar.png';
        }
                                 
        if (genderBasedAvatar) {
          log.debug(`Replacing default avatar with gender-specific avatar for ${computedAlt}:`, genderBasedAvatar);
          computedSrc = `${window.location.origin}${genderBasedAvatar}`;
        }
      }
    }
    
    // Return the computed values
    return {
      userSrc: computedSrc,
      userAlt: computedAlt,
      userOnline: computedOnline
    };
  }, [user, alt, src, online, showOnlineStatus, getProfilePhotoUrl]);
  
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
  
  // Get gender-specific default avatar if user object is provided
  const getDefaultAvatarPath = () => {
    // Add extensive logging to debug the user object
    if (process.env.NODE_ENV !== 'production') {
      log.debug('Avatar getDefaultAvatarPath - Full user object:', JSON.stringify({
        id: user?._id,
        details: user?.details || 'no details',
        iAm: user?.details?.iAm || 'no iAm',
        gender: user?.gender || 'no gender',
        placeholder: placeholder || 'no placeholder',
        hasDetails: user && user.details ? 'yes' : 'no',
        hasGender: user && user.gender ? 'yes' : 'no'
      }));
    }
    
    // First try from explicit placeholder prop - this takes precedence
    if (placeholder && placeholder !== '/default-avatar.png') {
      log.debug('Using custom placeholder as default avatar:', placeholder);
      const fullPath = placeholder.startsWith('http') ? 
        placeholder : `${window.location.origin}${placeholder}`;
      return fullPath;
    }
    
    // Next try from user.details.iAm
    if (user && user.details && user.details.iAm) {
      // Use gender-specific default avatar based on user identity
      if (user.details.iAm === 'woman') {
        log.debug('Using women-avatar for default based on iAm');
        return `${window.location.origin}/women-avatar.png`;
      } else if (user.details.iAm === 'man') {
        log.debug('Using man-avatar for default based on iAm');
        return `${window.location.origin}/man-avatar.png`;
      } else if (user.details.iAm === 'couple') {
        log.debug('Using couple-avatar for default based on iAm');
        return `${window.location.origin}/couple-avatar.png`;
      }
    }
    
    // Then try from user.gender for backward compatibility
    if (user && user.gender) {
      const gender = typeof user.gender === 'string' ? user.gender.toLowerCase() : '';
      
      if (gender === 'female' || gender === 'woman') {
        log.debug('Using women-avatar for default based on gender');
        return `${window.location.origin}/women-avatar.png`;
      } else if (gender === 'male' || gender === 'man') {
        log.debug('Using man-avatar for default based on gender');
        return `${window.location.origin}/man-avatar.png`;
      } else if (gender === 'couple' || gender === 'other') {
        log.debug('Using couple-avatar for default based on gender');
        return `${window.location.origin}/couple-avatar.png`;
      }
    }
    
    // Check if we have a special story ID - direct hack for coming soon stories
    if (user && user._id) {
      if (user._id === 'video-user') {
        log.debug('Using man-avatar for video-user');
        return `${window.location.origin}/man-avatar.png`;
      } else if (user._id === 'image-user') {
        log.debug('Using women-avatar for image-user');
        return `${window.location.origin}/women-avatar.png`;
      }
    }
    
    // Fallback to generic default avatar
    log.debug('No gender info found, using generic default avatar');
    return `${window.location.origin}/default-avatar.png`;
  };
  
  // Default avatar path based on user gender/identity
  const defaultAvatarPath = getDefaultAvatarPath();
  // log.debug('Avatar component - using defaultAvatarPath:', defaultAvatarPath);
  
  // Use a stable component ID instead of timestamp
  const [componentId] = React.useState('avatar-' + Math.floor(Math.random() * 10000));

  // Force refresh when needed (without changing timestamp)
  const forceRefresh = () => {
    clearCache();
    
    // Just clear error state and cache instead of changing timestamp
    setImageError(false);
    srcCacheRef.current.clear();
  };
  
  // Listen for global avatar refresh events and image load
  useEffect(() => {
    const handleAvatarRefresh = () => {
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
  }, [src, defaultAvatarPath, imgSrc, imageError, normalizePhotoUrl, user]);
  
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
      
      // Try again after a delay without cache busting
      setTimeout(() => {
        // Clear the source cache for this image
        srcCacheRef.current.delete(src);
        
        // Just use normalizePhotoUrl without additional parameters
        const processedSrc = normalizePhotoUrl(src, true);
        
        log.debug(`Retrying image load (${attempts + 1}/${maxRetries}): ${processedSrc}`);
        setImgSrc(processedSrc);
        setImageError(false);
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
    
    // Check for gender-specific avatars which need special handling
    if (normalizedSrc && (
        normalizedSrc.includes('/man-avatar.png') ||
        normalizedSrc.includes('/women-avatar.png') ||
        normalizedSrc.includes('/couple-avatar.png') ||
        normalizedSrc.includes('/default-avatar.png'))) {
      
      // Remove any existing refresh parameters to avoid flickering
      if (normalizedSrc.includes('_refresh=')) {
        normalizedSrc = normalizedSrc.replace(/([?&])_refresh=\d+(&|$)/, '$1');
        // Clean up trailing ? or & if that was the only parameter
        if (normalizedSrc.endsWith('?') || normalizedSrc.endsWith('&')) {
          normalizedSrc = normalizedSrc.slice(0, -1);
        }
      }
      
      // Make sure we're using the fully qualified domain
      if (normalizedSrc.startsWith('/')) {
        normalizedSrc = `${window.location.origin}${normalizedSrc}`;
      }
    }
  } catch (err) {
    log.error(`Error with image source: ${err.message}`, { src: imgSrc });
    normalizedSrc = `${window.location.origin}/default-avatar.png`;
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
      data-component-id={componentId}
    >
      {/* Actual image is hidden but helps with loading and fallback */}
      <img 
        src={normalizedSrc}
        alt={alt}
        onError={handleError}
        style={{ display: 'none' }}
        crossOrigin="anonymous"
        key={`img-${componentId}`}
        data-src-type={
          normalizedSrc?.includes('man-avatar.png') ? 'man' :
          normalizedSrc?.includes('women-avatar.png') ? 'woman' :
          normalizedSrc?.includes('couple-avatar.png') ? 'couple' :
          isDefaultAvatar(normalizedSrc) ? 'default' : 'custom'
        }
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

export default React.memo(Avatar, (prevProps, nextProps) => {
  // Early return for obvious differences
  if (prevProps.src !== nextProps.src ||
      prevProps.alt !== nextProps.alt ||
      prevProps.size !== nextProps.size ||
      prevProps.status !== nextProps.status ||
      prevProps.className !== nextProps.className ||
      prevProps.online !== nextProps.online ||
      prevProps.placeholder !== nextProps.placeholder ||
      prevProps.statusPosition !== nextProps.statusPosition ||
      prevProps.showFallback !== nextProps.showFallback ||
      prevProps.showOnlineStatus !== nextProps.showOnlineStatus ||
      prevProps.onClick !== nextProps.onClick) {
    return false;
  }
  
  // Smart comparison for user object - only compare relevant fields
  if (!prevProps.user && !nextProps.user) return true;
  if (!prevProps.user || !nextProps.user) return false;
  
  // Only compare fields that actually affect rendering
  return (
    prevProps.user._id === nextProps.user._id &&
    prevProps.user.nickname === nextProps.user.nickname &&
    prevProps.user.isOnline === nextProps.user.isOnline &&
    JSON.stringify(prevProps.user.photos) === JSON.stringify(nextProps.user.photos) &&
    prevProps.user.details?.iAm === nextProps.user.details?.iAm &&
    prevProps.user.gender === nextProps.user.gender
  );
});
