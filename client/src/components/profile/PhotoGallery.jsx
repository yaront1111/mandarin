// client/src/components/profile/PhotoGallery.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks';
import PhotoItem from './PhotoItem';
import styles from '../../styles/photo-management.module.css';
import logger from '../../utils/logger';

const log = logger.create('PhotoGallery');

/**
 * PhotoGallery component renders a grid of user photos with controls
 * Server is the single source of truth for photo state
 */
const PhotoGallery = ({
  photos,
  onSetProfilePhoto,
  onSetPrivacy,  // Changed from onTogglePrivacy
  onDeletePhoto,
  isProcessing = false,
  isUploading = false
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  
  // Add debugging but use our logger
  log.debug("Rendering gallery with photo count:", photos?.length);
  
  if (!photos || photos.length === 0) {
    log.debug("No photos to display in gallery");
    return null;
  }
  
  // Filter out deleted photos
  const availablePhotos = photos.filter(photo => 
    photo && 
    typeof photo === 'object' && 
    photo._id && 
    !photo.isDeleted
  );
  
  if (availablePhotos.length === 0) {
    log.debug("No available photos to display after filtering deleted photos");
    return null;
  }
  
  return (
    <div className={`${styles.photoGallery} ${isMobile ? styles.mobileGallery : ''}`}>
      <h3 className={styles.galleryTitle}>{t('profile.photos')}</h3>
      
      <div className={styles.galleryGrid}>
        {availablePhotos.map((photo) => (
          <PhotoItem
            key={photo._id}
            photo={photo}
            isProfilePhoto={photo.isProfile}
            onSetProfilePhoto={onSetProfilePhoto}
            onSetPrivacy={onSetPrivacy}  // Changed from onTogglePrivacy
            onDeletePhoto={onDeletePhoto}
            isProcessing={isProcessing}
            isUploading={isUploading}
          />
        ))}
      </div>
    </div>
  );
};

PhotoGallery.propTypes = {
  photos: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.string,
    url: PropTypes.string,
    privacy: PropTypes.string,
    isPrivate: PropTypes.bool, // For backward compatibility
    isProfile: PropTypes.bool,
    isDeleted: PropTypes.bool
  })).isRequired,
  onSetProfilePhoto: PropTypes.func.isRequired,
  onSetPrivacy: PropTypes.func.isRequired,  // Changed from onTogglePrivacy
  onDeletePhoto: PropTypes.func.isRequired,
  isProcessing: PropTypes.bool,
  isUploading: PropTypes.bool
};

export default React.memo(PhotoGallery);