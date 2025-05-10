// client/src/components/profile/ProfilePhoto.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { FaLock, FaUserCircle, FaUsers } from 'react-icons/fa';
import { normalizePhotoUrl } from '../../utils';
import styles from '../../styles/photo-management.module.css';
import logger from '../../utils/logger';

const log = logger.create('ProfilePhoto');

/**
 * ProfilePhoto component displays the main profile photo with loading state
 * Server is the single source of truth for photo state
 */
const ProfilePhoto = ({ 
  photo, 
  isLoading = false, 
  onImageLoad = () => {}, 
  onError = () => {} 
}) => {
  const { t } = useTranslation();
  
  log.debug("Rendering profile photo", { 
    hasPhoto: !!photo, 
    photoId: photo?._id, 
    isLoading 
  });
  
  // Show loading state
  if (isLoading) {
    log.debug("Showing loading state for profile photo");
    return (
      <div className={styles.profilePhotoContainer}>
        <div className={styles.profilePhotoWrapper}>
          <div className={styles.photoLoading}>
            <div className={styles.spinner}></div>
          </div>
          <div className={styles.profilePhotoLabel}>
            {t('profile.loading')}
          </div>
        </div>
      </div>
    );
  }

  // If there's no photo, render default avatar
  if (!photo) {
    log.debug("No photo provided, showing default avatar");
    return (
      <div className={styles.profilePhotoContainer}>
        <div className={styles.defaultProfilePhoto}>
          <FaUserCircle className={styles.defaultProfileIcon} />
        </div>
        <div className={styles.profilePhotoLabel}>
          {t('profile.profilePhoto')}
        </div>
      </div>
    );
  }
  
  // Verify the photo has a url property
  if (!photo.url) {
    log.warn("Photo object has no URL property:", photo);
    return (
      <div className={styles.profilePhotoContainer}>
        <div className={styles.defaultProfilePhoto}>
          <FaUserCircle className={styles.defaultProfileIcon} />
        </div>
        <div className={styles.profilePhotoLabel}>
          {t('profile.profilePhoto')}
        </div>
      </div>
    );
  }
  
  // Normal rendering with a valid photo
  log.debug("Rendering photo with URL:", photo.url);
  
  // Check if photo is private
  const isPrivatePhoto = photo.privacy === 'private' || (photo.isPrivate && !photo.privacy);
  
  return (
    <div className={styles.profilePhotoContainer}>
      <div className={styles.profilePhotoWrapper}>
        <img
          src={normalizePhotoUrl(photo.url) || "/placeholder.svg?height=100&width=100"}
          alt={t('profile.profilePhoto')}
          className={styles.profileImage}
          style={{
            opacity: isPrivatePhoto ? 0.7 : 1, // Add reduced opacity for private photos
          }}
          onLoad={() => {
            log.debug(`Successfully loaded profile photo: ${photo._id}`);
            onImageLoad();
          }}
          onError={(e) => {
            log.debug(`Failed to load profile photo: ${photo._id}`);
            e.target.src = "/placeholder.svg?height=200&width=200";
            onError();
          }}
        />
        
        {/* Privacy indicators */}
        {(photo.privacy === 'private' || (photo.isPrivate && !photo.privacy)) && (
          <div className={styles.privateIndicator}>
            <FaLock className={styles.lockIcon} />
          </div>
        )}
        {photo.privacy === 'friends_only' && (
          <div className={styles.friendsIndicator}>
            <FaUsers className={styles.usersIcon} />
          </div>
        )}
        
        {/* Profile photo label */}
        <div className={styles.profilePhotoLabel}>
          {t('profile.profilePhoto')}
        </div>
      </div>
    </div>
  );
};

ProfilePhoto.propTypes = {
  photo: PropTypes.shape({
    _id: PropTypes.string,
    url: PropTypes.string,
    privacy: PropTypes.string, // 'public', 'private', or 'friends_only'
    isPrivate: PropTypes.bool, // For backward compatibility
    isProfile: PropTypes.bool,
    isDeleted: PropTypes.bool
  }),
  isLoading: PropTypes.bool,
  onImageLoad: PropTypes.func,
  onError: PropTypes.func
};

export default React.memo(ProfilePhoto);