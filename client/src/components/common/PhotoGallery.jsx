import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  FaCamera, 
  FaLock, 
  FaLockOpen, 
  FaStar, 
  FaTrash,
  FaSpinner,
  FaChevronLeft,
  FaChevronRight
} from 'react-icons/fa';
import { usePhotoManagement } from '../../hooks';
import PropTypes from 'prop-types';
import logger from '../../utils/logger';

// Import CSS module - we'll create this file later
import styles from '../../styles/photo-gallery.module.css';

const log = logger.create("PhotoGallery");

/**
 * A reusable component for displaying and managing photos
 * 
 * @param {Object} props Component props
 * @param {Array} props.photos Array of photo objects with _id, url, isPrivate, isProfile
 * @param {Function} props.onPhotoChange Callback when photos are added, removed, or changed
 * @param {boolean} props.canEdit Whether the user can edit photos (add, remove, make profile)
 * @param {boolean} props.canTogglePrivacy Whether the user can toggle photo privacy
 * @param {string} props.userId The ID of the user whose photos are being displayed (for refreshing data)
 * @param {boolean} props.isOwner Whether the current user is the owner of these photos
 * @param {boolean} props.canViewPrivate Whether the user can view private photos
 * @param {Function} props.onRequestAccess Callback to request access to private photos
 */
const PhotoGallery = ({
  photos = [],
  onPhotoChange,
  canEdit = false,
  canTogglePrivacy = false,
  userId,
  isOwner = false,
  canViewPrivate = false,
  onRequestAccess,
}) => {
  const { t } = useTranslation();
  const {
    isUploading,
    uploadProgress,
    isProcessingPhoto,
    uploadPhoto,
    togglePhotoPrivacy,
    setProfilePhoto,
    deletePhoto,
    normalizePhotoUrl
  } = usePhotoManagement();

  // State for the gallery
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  
  // Refs
  const fileInputRef = useRef(null);

  // Safety check for valid photos array
  const processedPhotos = Array.isArray(photos) ? photos : [];
  
  // Get the active photo
  const activePhoto = processedPhotos[activePhotoIndex] || null;
  
  // Whether the current photo is private and can't be viewed
  const isPrivateAndHidden = activePhoto?.isPrivate && !canViewPrivate;

  // Handlers
  const handleFileSelection = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const newPhoto = await uploadPhoto(file, false);
      
      if (newPhoto && onPhotoChange) {
        onPhotoChange([...processedPhotos.filter(p => !p._id.startsWith('temp-')), newPhoto]);
      }
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      log.error('Failed to upload photo:', error);
    }
  };
  
  const handleTogglePrivacy = async (photoId, e) => {
    e?.stopPropagation();
    if (isProcessingPhoto) return;
    
    try {
      await togglePhotoPrivacy(photoId, userId);
      
      // Update local state optimistically
      if (onPhotoChange) {
        const updatedPhotos = processedPhotos.map(photo => 
          photo._id === photoId 
            ? { ...photo, isPrivate: !photo.isPrivate }
            : photo
        );
        onPhotoChange(updatedPhotos);
      }
    } catch (error) {
      log.error('Failed to toggle photo privacy:', error);
    }
  };
  
  const handleSetAsProfile = async (photoId) => {
    if (isProcessingPhoto) return;
    
    try {
      await setProfilePhoto(photoId, userId);
      
      // Update local state optimistically
      if (onPhotoChange) {
        const updatedPhotos = processedPhotos.map(photo => ({
          ...photo,
          isProfile: photo._id === photoId
        }));
        onPhotoChange(updatedPhotos);
      }
      
      // Set the selected photo as active
      const newIndex = processedPhotos.findIndex(p => p._id === photoId);
      if (newIndex !== -1) {
        setActivePhotoIndex(newIndex);
      }
    } catch (error) {
      log.error('Failed to set profile photo:', error);
    }
  };
  
  const handleDeletePhoto = async (photoId, e) => {
    e?.stopPropagation();
    if (isProcessingPhoto) return;
    
    // For temporary photos, just remove them from state
    if (typeof photoId === 'string' && photoId.startsWith('temp-')) {
      if (onPhotoChange) {
        onPhotoChange(processedPhotos.filter(p => p._id !== photoId));
      }
      return;
    }
    
    // Confirm deletion
    if (!window.confirm(t('common.confirmDeletePhoto', 'Are you sure you want to delete this photo?'))) {
      return;
    }
    
    // Check if it's a profile photo
    const photoIndex = processedPhotos.findIndex(p => p._id === photoId);
    if (photoIndex !== -1 && processedPhotos[photoIndex].isProfile) {
      alert(t('common.cannotDeleteProfilePhoto', 'You cannot delete your profile photo. Please set another photo as your profile photo first.'));
      return;
    }
    
    try {
      await deletePhoto(photoId, userId);
      
      // Update local state
      if (onPhotoChange) {
        const updatedPhotos = processedPhotos.filter(p => p._id !== photoId);
        onPhotoChange(updatedPhotos);
        
        // Adjust active index if needed
        if (photoIndex <= activePhotoIndex && activePhotoIndex > 0) {
          setActivePhotoIndex(activePhotoIndex - 1);
        } else if (updatedPhotos.length === 0) {
          setActivePhotoIndex(0);
        }
      }
    } catch (error) {
      log.error('Failed to delete photo:', error);
    }
  };
  
  const triggerFileInput = () => {
    if (fileInputRef.current && canEdit) {
      fileInputRef.current.click();
    }
  };
  
  const nextPhoto = () => {
    if (activePhotoIndex < processedPhotos.length - 1) {
      setActivePhotoIndex(activePhotoIndex + 1);
    }
  };
  
  const prevPhoto = () => {
    if (activePhotoIndex > 0) {
      setActivePhotoIndex(activePhotoIndex - 1);
    }
  };
  
  const handleRequestAccess = () => {
    if (onRequestAccess && typeof onRequestAccess === 'function') {
      onRequestAccess();
    }
  };
  
  // If no photos, show placeholder
  if (processedPhotos.length === 0) {
    return (
      <div className={styles.emptyGallery}>
        <div className={styles.placeholder}>
          <div className={styles.placeholderIcon}>
            <FaCamera size={48} />
          </div>
          <p className={styles.placeholderText}>
            {t('common.noPhotos', 'No photos available')}
          </p>
          {canEdit && (
            <>
              <button 
                className={styles.uploadButton}
                onClick={triggerFileInput}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <FaSpinner className={styles.spinner} />
                    {t('common.uploading', 'Uploading...')}
                  </>
                ) : (
                  <>
                    <FaCamera />
                    {t('common.addPhoto', 'Add Photo')}
                  </>
                )}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelection}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className={styles.photoGallery}>
      {/* Main photo display */}
      <div className={styles.mainPhotoContainer}>
        {isPrivateAndHidden ? (
          <div className={styles.privatePhoto}>
            <FaLock className={styles.lockIcon} />
            <p>{t('common.privatePhoto', 'This photo is private')}</p>
            {!isOwner && (
              <button 
                className={styles.requestAccessButton}
                onClick={handleRequestAccess}
              >
                {t('common.requestAccess', 'Request Access')}
              </button>
            )}
          </div>
        ) : (
          <>
            <img
              src={activePhoto ? normalizePhotoUrl(activePhoto.url) : '/default-avatar.png'}
              alt={t('common.photo', 'Photo')}
              className={styles.mainPhoto}
            />
            {activePhoto?.isPrivate && (
              <div className={styles.privateIndicator}>
                <FaLock />
                {t('common.private', 'Private')}
              </div>
            )}
            {activePhoto?.isProfile && (
              <div className={styles.profileIndicator}>
                <FaStar />
                {t('common.profilePhoto', 'Profile')}
              </div>
            )}
          </>
        )}
        
        {/* Navigation arrows */}
        {processedPhotos.length > 1 && (
          <>
            <button
              className={`${styles.navButton} ${styles.prevButton}`}
              onClick={prevPhoto}
              disabled={activePhotoIndex === 0}
              aria-label={t('common.previousPhoto', 'Previous photo')}
            >
              <FaChevronLeft />
            </button>
            <button
              className={`${styles.navButton} ${styles.nextButton}`}
              onClick={nextPhoto}
              disabled={activePhotoIndex === processedPhotos.length - 1}
              aria-label={t('common.nextPhoto', 'Next photo')}
            >
              <FaChevronRight />
            </button>
          </>
        )}
      </div>
      
      {/* Thumbnails */}
      <div className={styles.thumbnailsContainer}>
        <div className={styles.thumbnails}>
          {processedPhotos.map((photo, index) => (
            <div
              key={photo._id || `photo-${index}`}
              className={`${styles.thumbnail} ${index === activePhotoIndex ? styles.activeThumbnail : ''}`}
              onClick={() => setActivePhotoIndex(index)}
            >
              {photo.isPrivate && !canViewPrivate ? (
                <div className={styles.privateThumbnail}>
                  <FaLock />
                </div>
              ) : (
                <img
                  src={normalizePhotoUrl(photo.url)}
                  alt={t('common.photoThumbnail', `Photo ${index + 1}`)}
                  className={styles.thumbnailImage}
                />
              )}
              {photo.isProfile && (
                <div className={styles.profileBadge}>
                  <FaStar />
                </div>
              )}
              
              {/* Photo controls */}
              {(canEdit || canTogglePrivacy) && (
                <div className={styles.thumbnailControls}>
                  {canTogglePrivacy && (
                    <button
                      onClick={(e) => handleTogglePrivacy(photo._id, e)}
                      className={styles.controlButton}
                      aria-label={photo.isPrivate ? t('common.makePublic', 'Make public') : t('common.makePrivate', 'Make private')}
                      title={photo.isPrivate ? t('common.makePublic', 'Make public') : t('common.makePrivate', 'Make private')}
                    >
                      {photo.isPrivate ? <FaLockOpen /> : <FaLock />}
                    </button>
                  )}
                  
                  {canEdit && !photo.isProfile && (
                    <button
                      onClick={() => handleSetAsProfile(photo._id)}
                      className={styles.controlButton}
                      aria-label={t('common.setAsProfile', 'Set as profile photo')}
                      title={t('common.setAsProfile', 'Set as profile photo')}
                    >
                      <FaStar />
                    </button>
                  )}
                  
                  {canEdit && !photo.isProfile && (
                    <button
                      onClick={(e) => handleDeletePhoto(photo._id, e)}
                      className={styles.controlButton}
                      aria-label={t('common.deletePhoto', 'Delete photo')}
                      title={t('common.deletePhoto', 'Delete photo')}
                    >
                      <FaTrash />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          
          {/* Add photo button */}
          {canEdit && (
            <div 
              className={styles.addPhotoThumbnail}
              onClick={triggerFileInput}
            >
              <FaCamera />
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelection}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Upload progress */}
      {isUploading && (
        <div className={styles.uploadProgress}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <p className={styles.progressText}>
            {t('common.uploading', 'Uploading...')} {uploadProgress}%
          </p>
        </div>
      )}
    </div>
  );
};

PhotoGallery.propTypes = {
  photos: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
      url: PropTypes.string.isRequired,
      isPrivate: PropTypes.bool,
      isProfile: PropTypes.bool,
    })
  ),
  onPhotoChange: PropTypes.func,
  canEdit: PropTypes.bool,
  canTogglePrivacy: PropTypes.bool,
  userId: PropTypes.string,
  isOwner: PropTypes.bool,
  canViewPrivate: PropTypes.bool,
  onRequestAccess: PropTypes.func,
};

export default PhotoGallery;