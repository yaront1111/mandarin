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
  // For the user's own profile, they always have permission to view their photos
  // For other users' profiles, check if this is a private photo that should be masked
  const showPrivacyMask = false; // We now handle private photos at the API level
  
  // Get icon and title based on privacy level
  const getPrivacyIcon = () => {
    switch(privacyLevel) {
      case 'private':
        return <FaLock className={styles.controlIcon} />;
      case 'friends_only':
        return <FaUsers className={styles.controlIcon} />;
      case 'public':
      default:
        return <FaLockOpen className={styles.controlIcon} />;
    }
  };
  
  const getPrivacyTitle = () => {
    switch(privacyLevel) {
      case 'private':
        return t('profile.currentlyPrivate');
      case 'friends_only':
        return t('profile.currentlyFriendsOnly');
      case 'public':
      default:
        return t('profile.currentlyPublic');
    }
  };
  
  // Handle privacy click - cycle through privacy levels
  const handlePrivacyClick = (e) => {
    e.stopPropagation();
    
    let newPrivacy;
    switch(privacyLevel) {
      case 'private':
        newPrivacy = 'public';
        break;
      case 'public':
        newPrivacy = 'friends_only';
        break;
      case 'friends_only':
      default:
        newPrivacy = 'private';
        break;
    }
    
    // Add confirmation for setting photo to private
    if (newPrivacy === 'private' && privacyLevel !== 'private') {
      const confirm = window.confirm(t('profile.confirmPrivate'));
      if (!confirm) return;
    }
    
    onSetPrivacy(photo._id, newPrivacy, e);
  };
  
  return (
    <div
      className={`${styles.photoItem} ${isProfilePhoto ? styles.profilePhotoItem : ''}`}
      onClick={() => onSetProfilePhoto(photo._id)}
    >
      {/* Photo image with key for forced re-render */}
      {showPrivacyMask ? (
        // Show private photo placeholder with lock overlay
        <img
          key={`private-photo-${photo._id}`}
          src="/private-photo.png"
          alt={t('profile.privatePhoto')}
          className={styles.photoImage}
        />
      ) : (
        // Show actual photo
        <img
          key={`photo-${photo._id}-${imageKey}`}
          src={`${normalizePhotoUrl(photo.url, true)}${window.__photo_refresh_timestamp ? `&_t=${window.__photo_refresh_timestamp}` : ''}&_k=${imageKey}`}
          alt={t('profile.photo')}
          className={styles.photoImage}
          onError={(e) => {
            log.debug(`Failed to load photo: ${photo._id}`);
            e.target.src = "/placeholder.svg?height=100&width=100";
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
      
      {/* Privacy indicator overlay */}
      {privacyLevel !== 'public' && (
        <div className={styles.privacyOverlay}>
          {privacyLevel === 'private' ? (
            <FaLock className={styles.overlayIcon} />
          ) : (
            <FaUsers className={styles.overlayIcon} />
          )}
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