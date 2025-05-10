import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks';
import { usePhotoManagement } from '../../hooks';
import { 
  FaCamera, 
  FaLock, 
  FaLockOpen, 
  FaStar, 
  FaTrash,
  FaSpinner,
  FaChevronLeft,
  FaChevronRight,
  FaUsers
} from 'react-icons/fa';
import { normalizePhotoUrl } from '../../utils';
import styles from '../../styles/photo-management.module.css';
import logger from '../../utils/logger';

const log = logger.create('PhotoGallery');

/**
 * Enhanced PhotoGallery component that combines features from both versions
 * Renders a grid of user photos with controls and optional gallery view
 * 
 * @param {Object} props Component props
 * @param {Array} props.photos Array of photo objects with _id, url, privacy/isPrivate, isProfile
 * @param {Function} props.onPhotoChange Callback when photos are added, removed, or changed
 * @param {Function} props.onSetProfilePhoto Function to set a photo as profile photo
 * @param {Function} props.onSetPrivacy Function to set photo privacy
 * @param {Function} props.onDeletePhoto Function to delete a photo
 * @param {boolean} props.canEdit Whether the user can edit photos
 * @param {boolean} props.canTogglePrivacy Whether the user can toggle photo privacy
 * @param {string} props.userId The ID of the user whose photos are being displayed
 * @param {boolean} props.isOwner Whether the current user is the owner of these photos
 * @param {boolean} props.canViewPrivate Whether the user can view private photos
 * @param {boolean} props.isProcessing Whether the component is currently processing a photo operation
 * @param {boolean} props.isUploading Whether a photo is currently being uploaded
 * @param {number} props.uploadProgress Upload progress percentage
 * @param {boolean} props.gridView Use grid view instead of gallery view
 */
const PhotoGallery = ({
  photos = [],
  onPhotoChange,
  onSetProfilePhoto,
  onSetPrivacy,
  onDeletePhoto,
  canEdit = false,
  canTogglePrivacy = false,
  userId,
  isOwner = true,
  canViewPrivate = false,
  isProcessing = false,
  isUploading = false,
  uploadProgress = 0,
  gridView = false,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const forceUpdateRef = useRef(0);
  const {
    isUploading: photoManagementUploading,
    uploadProgress: photoManagementProgress,
    isProcessingPhoto: photoManagementProcessing,
    uploadPhoto,
    togglePhotoPrivacy,
    setProfilePhoto,
    deletePhoto,
  } = usePhotoManagement();

  // Combine props with hook values
  const combinedIsUploading = isUploading || photoManagementUploading;
  const combinedUploadProgress = uploadProgress || photoManagementProgress;
  const combinedIsProcessing = isProcessing || photoManagementProcessing;

  // State for the gallery
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [imageKey, setImageKey] = useState(Date.now());
  
  // Refs
  const fileInputRef = useRef(null);

  // Listen for avatar refresh events
  useEffect(() => {
    const handleAvatarRefresh = () => {
      log.debug("Avatar refresh event received, updating PhotoGallery");
      forceUpdateRef.current = Date.now();
      setImageKey(Date.now());
      // Force a re-render
      setForceUpdate(Date.now());
    };
    
    window.addEventListener('avatar:refresh', handleAvatarRefresh);
    return () => window.removeEventListener('avatar:refresh', handleAvatarRefresh);
  }, []);
  
  // State to force re-render when refreshed
  const [forceUpdate, setForceUpdate] = useState(0);

  // Safety check for valid photos array and filter deleted photos
  const processedPhotos = Array.isArray(photos) ? photos.filter(photo => 
    photo && 
    typeof photo === 'object' && 
    photo._id && 
    !photo.isDeleted
  ) : [];
  
  // Get the active photo for gallery view
  const activePhoto = processedPhotos[activePhotoIndex] || null;

  // Handlers
  const handleFileSelection = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      // Default to private for new uploads
      const newPhoto = await uploadPhoto(file, 'private');
      
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
    if (combinedIsProcessing) return;
    
    try {
      // Get the current photo
      const photo = processedPhotos.find(p => p._id === photoId);
      if (!photo) return;
      
      // Determine current privacy
      const currentPrivacy = photo.privacy || (photo.isPrivate ? 'private' : 'public');
      
      // Cycle to next privacy level or use direct setting
      let newPrivacy;
      if (typeof onSetPrivacy === 'function') {
        // Simple toggle between public and private if onSetPrivacy is provided
        newPrivacy = currentPrivacy === 'private' ? 'public' : 'private';
        await onSetPrivacy(photoId, newPrivacy, e);
      } else {
        // Use the more complex privacy cycle otherwise
        switch(currentPrivacy) {
          case 'private':
            newPrivacy = 'public';
            break;
          case 'public':
            newPrivacy = 'friends_only';
            break;
          case 'friends_only':
          default:
            newPrivacy = 'private';
        }
        
        // Update via API
        await togglePhotoPrivacy(photoId, userId, newPrivacy);
        
        // Update local state optimistically
        if (onPhotoChange) {
          const updatedPhotos = processedPhotos.map(p => 
            p._id === photoId 
              ? { ...p, privacy: newPrivacy, isPrivate: newPrivacy === 'private' }
              : p
          );
          onPhotoChange(updatedPhotos);
        }
      }
    } catch (error) {
      log.error('Failed to update photo privacy:', error);
    }
  };
  
  const handleSetAsProfile = async (photoId, e) => {
    e?.stopPropagation();
    if (combinedIsProcessing) return;
    
    try {
      if (typeof onSetProfilePhoto === 'function') {
        await onSetProfilePhoto(photoId);
      } else {
        await setProfilePhoto(photoId, userId);
        
        // Update local state optimistically
        if (onPhotoChange) {
          const updatedPhotos = processedPhotos.map(photo => ({
            ...photo,
            isProfile: photo._id === photoId
          }));
          onPhotoChange(updatedPhotos);
        }
      }
      
      // Set the selected photo as active in gallery view
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
    if (combinedIsProcessing) return;
    
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
      if (typeof onDeletePhoto === 'function') {
        await onDeletePhoto(photoId, e);
      } else {
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

  // If no photos, show placeholder
  if (processedPhotos.length === 0) {
    return (
      <div className={styles.photoGallery}>
        <h3 className={styles.galleryTitle}>{t('profile.photos')}</h3>
        <div className={styles.noPhotosMessage}>
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
                  className={styles.uploadPhotoButton}
                  onClick={triggerFileInput}
                  disabled={combinedIsUploading}
                >
                  {combinedIsUploading ? (
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
      </div>
    );
  }

  // Render grid view (like the profile version)
  if (gridView) {
    return (
      <div className={`${styles.photoGallery} ${isMobile ? styles.mobileGallery : ''}`}>
        <h3 className={styles.galleryTitle}>{t('profile.photos')}</h3>
        
        <div className={styles.galleryGrid}>
          {processedPhotos.map((photo) => {
            // Handle both new privacy model and legacy isPrivate property
            const privacyLevel = photo.privacy || (photo.isPrivate ? 'private' : 'public');
            
            // Determine if this is a private photo
            const isPrivatePhoto = privacyLevel === 'private';
            
            // If it's a private photo and not the owner's photo, mask it
            const showPrivacyMask = isPrivatePhoto && !isOwner && !canViewPrivate;
            
            return (
              <div
                key={photo._id}
                className={`${styles.photoItem} 
                          ${photo.isProfile ? styles.profilePhotoItem : ''} 
                          ${isPrivatePhoto ? styles.hasPrivatePhoto : ''}`}
                onClick={(e) => handleSetAsProfile(photo._id, e)}
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
                {(canEdit || canTogglePrivacy) && (
                  <div className={styles.photoControls}>
                    {/* Privacy toggle button */}
                    {canTogglePrivacy && (
                      <button
                        onClick={(e) => handleTogglePrivacy(photo._id, e)}
                        className={styles.photoControlButton}
                        title={
                          privacyLevel === 'private' 
                            ? t('profile.makePublic') 
                            : t('profile.makePrivate')
                        }
                        disabled={combinedIsProcessing}
                        aria-label={
                          privacyLevel === 'private' 
                            ? t('profile.makePublic') 
                            : t('profile.makePrivate')
                        }
                      >
                        {privacyLevel === 'private' ? 
                          <FaLockOpen className={styles.controlIcon} /> : 
                          <FaLock className={styles.controlIcon} />}
                      </button>
                    )}
                    
                    {/* Set as profile button - only show if not already profile */}
                    {canEdit && !photo.isProfile && (
                      <button
                        onClick={(e) => handleSetAsProfile(photo._id, e)}
                        className={styles.photoControlButton}
                        title={t('profile.setAsProfilePhoto')}
                        disabled={combinedIsProcessing}
                        aria-label={t('profile.setAsProfilePhoto')}
                      >
                        <FaStar className={styles.controlIcon} />
                      </button>
                    )}
                    
                    {/* Delete button - don't show for profile photos */}
                    {canEdit && !photo.isProfile && (
                      <button
                        onClick={(e) => handleDeletePhoto(photo._id, e)}
                        className={styles.photoControlButton}
                        title={t('profile.deletePhoto')}
                        disabled={combinedIsProcessing}
                        aria-label={t('profile.deletePhoto')}
                      >
                        <FaTrash className={styles.controlIcon} />
                      </button>
                    )}
                  </div>
                )}
                
                {/* Privacy indicator overlay - only show for private photos */}
                {privacyLevel === 'private' && (
                  <div className={styles.privacyOverlay}>
                    <FaLock className={styles.overlayIcon} />
                  </div>
                )}
                
                {/* Profile photo indicator */}
                {photo.isProfile && (
                  <div className={styles.profileIndicator}>
                    <FaStar className={styles.profileStar} />
                  </div>
                )}
              </div>
            );
          })}
          
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
        
        {/* Upload progress */}
        {combinedIsUploading && (
          <div className={styles.uploadProgressContainer}>
            <div className={styles.uploadProgressBar}>
              <div 
                className={styles.uploadProgressFill}
                style={{ width: `${combinedUploadProgress}%` }}
              ></div>
            </div>
            <p className={styles.uploadProgressText}>
              {t('common.uploading', 'Uploading...')} {combinedUploadProgress}%
            </p>
          </div>
        )}
      </div>
    );
  }
  
  // Default: Render gallery view (like the common version)
  return (
    <div className={styles.photoGallery}>
      <h3 className={styles.galleryTitle}>{t('profile.photos')}</h3>
      
      {/* Main photo display */}
      <div className={styles.mainPhotoContainer}>
        {(() => {
          if (!activePhoto) return null;
          
          // Handle both new privacy model and legacy isPrivate property
          const privacyLevel = activePhoto.privacy || (activePhoto.isPrivate ? 'private' : 'public');
          
          // If it's a private photo and not the owner and can't view private, show placeholder
          const showPrivacyMask = 
            privacyLevel === 'private' && 
            !isOwner && 
            !canViewPrivate;
            
          return showPrivacyMask ? (
            <div className={styles.privatePhoto}>
              <FaLock className={styles.lockIcon} />
              <p>{t('common.privatePhoto', 'This photo is private')}</p>
            </div>
          ) : (
            <>
              <img
                key={`main-photo-${activePhoto._id}-${imageKey}`}
                src={normalizePhotoUrl(activePhoto.url, true)}
                alt={t('common.photo', 'Photo')}
                className={styles.mainPhoto}
                style={{
                  // Reduce opacity for own private photos
                  opacity: (privacyLevel === 'private' && isOwner) ? 0.7 : 1,
                  filter: (privacyLevel === 'private' && isOwner) ? 'grayscale(0.3)' : 'none'
                }}
                onError={(e) => {
                  log.debug(`Failed to load main photo: ${activePhoto._id}`);
                  e.target.src = `${window.location.origin}/placeholder.svg`;
                }}
              />
              
              {privacyLevel === 'private' && (
                <div className={styles.privateIndicator}>
                  <FaLock />
                  {t('common.private', 'Private')}
                </div>
              )}
              
              {privacyLevel === 'friends_only' && (
                <div className={styles.friendsIndicator}>
                  <FaUsers />
                  {t('common.friendsOnly', 'Friends Only')}
                </div>
              )}
              
              {activePhoto.isProfile && (
                <div className={styles.profileIndicator}>
                  <FaStar />
                  {t('common.profilePhoto', 'Profile')}
                </div>
              )}
            </>
          );
        })()}
        
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
          {processedPhotos.map((photo, index) => {
            // Handle both new privacy model and legacy isPrivate property
            const privacyLevel = photo.privacy || (photo.isPrivate ? 'private' : 'public');
            
            // If it's a private photo and not the owner and can't view private, mask thumbnail
            const showPrivacyMask = 
              privacyLevel === 'private' && 
              !isOwner && 
              !canViewPrivate;
              
            return (
              <div
                key={photo._id || `photo-${index}`}
                className={`${styles.thumbnail} ${index === activePhotoIndex ? styles.activeThumbnail : ''}`}
                onClick={() => setActivePhotoIndex(index)}
              >
                {showPrivacyMask ? (
                  <div className={styles.privateThumbnail}>
                    <img 
                      src={`${window.location.origin}/private-photo.png`}
                      alt={t('common.privatePhoto', 'Private photo')}
                      className={styles.thumbnailImage}
                    />
                    <FaLock className={styles.thumbnailLockIcon} />
                  </div>
                ) : (
                  <img
                    key={`thumbnail-${photo._id}-${imageKey}`}
                    src={normalizePhotoUrl(photo.url, true)}
                    alt={t('common.photoThumbnail', `Photo ${index + 1}`)}
                    className={styles.thumbnailImage}
                    style={{
                      // Reduce opacity for own private photos
                      opacity: (privacyLevel === 'private' && isOwner) ? 0.7 : 1,
                      filter: (privacyLevel === 'private' && isOwner) ? 'grayscale(0.3)' : 'none'
                    }}
                    onError={(e) => {
                      log.debug(`Failed to load thumbnail: ${photo._id}`);
                      e.target.src = `${window.location.origin}/placeholder.svg?height=60&width=60`;
                    }}
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
                        aria-label={
                          privacyLevel === 'private'
                            ? t('common.makePublic', 'Make public') 
                            : t('common.makePrivate', 'Make private')
                        }
                        title={
                          privacyLevel === 'private'
                            ? t('common.makePublic', 'Make public') 
                            : t('common.makePrivate', 'Make private')
                        }
                      >
                        {privacyLevel === 'private'
                          ? <FaLockOpen /> 
                          : <FaLock />}
                      </button>
                    )}
                    
                    {canEdit && !photo.isProfile && (
                      <button
                        onClick={(e) => handleSetAsProfile(photo._id, e)}
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
            );
          })}
          
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
      {combinedIsUploading && (
        <div className={styles.uploadProgress}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{ width: `${combinedUploadProgress}%` }}
            ></div>
          </div>
          <p className={styles.progressText}>
            {t('common.uploading', 'Uploading...')} {combinedUploadProgress}%
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
      privacy: PropTypes.string, // 'public', 'private', or 'friends_only'
      isPrivate: PropTypes.bool, // For backward compatibility
      isProfile: PropTypes.bool,
      isDeleted: PropTypes.bool,
    })
  ),
  onPhotoChange: PropTypes.func,
  onSetProfilePhoto: PropTypes.func,
  onSetPrivacy: PropTypes.func,
  onDeletePhoto: PropTypes.func,
  canEdit: PropTypes.bool,
  canTogglePrivacy: PropTypes.bool,
  userId: PropTypes.string,
  isOwner: PropTypes.bool,
  canViewPrivate: PropTypes.bool,
  isProcessing: PropTypes.bool,
  isUploading: PropTypes.bool,
  uploadProgress: PropTypes.number,
  gridView: PropTypes.bool,
};

export default React.memo(PhotoGallery);