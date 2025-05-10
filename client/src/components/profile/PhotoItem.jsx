// client/src/components/profile/PhotoItem.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { FaLock, FaLockOpen, FaUsers, FaStar, FaTrash } from 'react-icons/fa';
import { normalizePhotoUrl } from '../../utils';
import styles from '../../styles/photo-management.module.css';
import logger from '../../utils/logger';

const log = logger.create('PhotoItem');

/**
 * PhotoItem component represents a single photo in the gallery with controls
 * Server is the single source of truth for photo state
 */
const PhotoItem = ({
  photo,
  isProfilePhoto,
  onSetProfilePhoto,
  onSetPrivacy,  // Changed from onTogglePrivacy
  onDeletePhoto,
  isProcessing = false,
  isUploading = false
}) => {
  const { t } = useTranslation();
  const [imageKey, setImageKey] = React.useState(Date.now());
  
  // Listen for avatar refresh events to force reload of images
  React.useEffect(() => {
    const handleAvatarRefresh = () => {
      log.debug(`Refreshing PhotoItem ${photo._id}`);
      setImageKey(Date.now());
    };
    
    window.addEventListener('avatar:refresh', handleAvatarRefresh);
    return () => window.removeEventListener('avatar:refresh', handleAvatarRefresh);
  }, [photo._id]);
  
  
  // Ensure photo object exists
  if (!photo) return null;
  
  // Handle both new privacy model and legacy isPrivate property
  const privacyLevel = photo.privacy || (photo.isPrivate ? 'private' : 'public');
  
  // Determine if this is a private photo
  const isPrivatePhoto = privacyLevel === 'private';
  // Import useAuth from context - should be added at the top of the file
  // For the user's own profile, they always have permission to view their photos
  // For other users' profiles, check if this is a private photo that should be masked
  
  // In Profile.jsx, it's always the user's own photos, but we'll leave this logic in place
  // for future cases where this component might be used to display other users' photos
  const isOwnPhoto = true; // In the profile view, it's always the user's own photos
  
  // If it's a private photo and not the owner's photo, mask it
  // Currently always false in Profile view because isOwnPhoto is true
  const showPrivacyMask = isPrivatePhoto && !isOwnPhoto;
  
  // Get icon and title based on privacy level
  const getPrivacyIcon = () => {
    switch(privacyLevel) {
      case 'private':
        return <FaLock className={styles.controlIcon} />;
      case 'public':
      default:
        return <FaLockOpen className={styles.controlIcon} />;
    }
  };
  
  const getPrivacyTitle = () => {
    switch(privacyLevel) {
      case 'private':
        return t('profile.currentlyPrivate');
      case 'public':
      default:
        return t('profile.currentlyPublic');
    }
  };
  
  // Handle privacy click - toggle between public and private
  const handlePrivacyClick = (e) => {
    e.stopPropagation();
    
    // Simply toggle between public and private without confirmation
    const newPrivacy = privacyLevel === 'private' ? 'public' : 'private';
    
    onSetPrivacy(photo._id, newPrivacy, e);
  };
  
  return (
    <div
      className={`${styles.photoItem} 
                 ${isProfilePhoto ? styles.profilePhotoItem : ''} 
                 ${isPrivatePhoto ? styles.hasPrivatePhoto : ''}`}
      onClick={() => onSetProfilePhoto(photo._id)}
    >
      {/* Photo image with key for forced re-render */}
      {showPrivacyMask ? (
        // Show private photo placeholder with lock overlay
        <div className={styles.privatePhoto}>
          <img
            key={`private-photo-${photo._id}`}
            src={`${window.location.origin}/private-photo.png`}
            alt={t('profile.privatePhoto')}
            className={styles.photoImage}
          />
        </div>
      ) : (
        // Show actual photo
        <img
          key={`photo-${photo._id}-${imageKey}`}
          src={`${normalizePhotoUrl(photo.url, true)}${window.__photo_refresh_timestamp ? `&_t=${window.__photo_refresh_timestamp}` : ''}&_k=${imageKey}`}
          alt={t('profile.photo')}
          className={styles.photoImage}
          style={{
            opacity: isPrivatePhoto ? 0.7 : 1, // Add reduced opacity for private photos
            filter: isPrivatePhoto ? 'grayscale(0.3)' : 'none' // Add subtle grayscale for private photos
          }}
          onError={(e) => {
            log.debug(`Failed to load photo: ${photo._id}`);
            e.target.src = `${window.location.origin}/placeholder.svg?height=100&width=100`;
          }}
        />
      )}
      
      {/* Photo controls */}
      <div className={styles.photoControls}>
        {/* Privacy toggle button */}
        <button
          onClick={handlePrivacyClick}
          className={styles.photoControlButton}
          title={getPrivacyTitle()}
          disabled={isProcessing}
          aria-label={getPrivacyTitle()}
        >
          {getPrivacyIcon()}
        </button>
        
        {/* Set as profile button - only show if not already profile */}
        {!isProfilePhoto && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSetProfilePhoto(photo._id);
            }}
            className={styles.photoControlButton}
            title={t('profile.setAsProfilePhoto')}
            disabled={isProcessing}
            aria-label={t('profile.setAsProfilePhoto')}
          >
            <FaStar className={styles.controlIcon} />
          </button>
        )}
        
        {/* Delete button - don't show for profile photos */}
        {!isProfilePhoto && (
          <button
            onClick={(e) => onDeletePhoto(photo._id, e)}
            className={styles.photoControlButton}
            title={t('profile.deletePhoto')}
            disabled={isProcessing}
            aria-label={t('profile.deletePhoto')}
          >
            <FaTrash className={styles.controlIcon} />
          </button>
        )}
      </div>
      
      {/* Privacy indicator overlay - only show for private photos */}
      {privacyLevel === 'private' && (
        <div className={styles.privacyOverlay}>
          <FaLock className={styles.overlayIcon} />
        </div>
      )}
      
      {/* Profile photo indicator */}
      {isProfilePhoto && (
        <div className={styles.profileIndicator}>
          <FaStar className={styles.profileStar} />
        </div>
      )}
    </div>
  );
};

PhotoItem.propTypes = {
  photo: PropTypes.shape({
    _id: PropTypes.string,
    url: PropTypes.string,
    privacy: PropTypes.string,
    isPrivate: PropTypes.bool, // For backward compatibility
    isProfile: PropTypes.bool,
    isDeleted: PropTypes.bool
  }).isRequired,
  isProfilePhoto: PropTypes.bool.isRequired,
  onSetProfilePhoto: PropTypes.func.isRequired,
  onSetPrivacy: PropTypes.func.isRequired, // Changed from onTogglePrivacy
  onDeletePhoto: PropTypes.func.isRequired,
  isProcessing: PropTypes.bool,
  isUploading: PropTypes.bool
};

export default React.memo(PhotoItem);