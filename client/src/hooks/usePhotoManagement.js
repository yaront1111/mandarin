/**
 * usePhotoManagement - A central hook for photo operations across the app
 * 
 * This hook centralizes all photo-related functionality including:
 * - Uploading photos
 * - Setting profile photos
 * - Managing photo privacy
 * - Deleting photos
 * - Handling photo loading errors
 * - Normalizing photo URLs
 */

import { useState, useCallback, useRef } from 'react';
import { useApi } from './useApi';
import { useUser } from '../context';
import { normalizePhotoUrl, markUrlAsFailed } from '../utils';
import { toast } from 'react-toastify';
import logger from '../utils/logger';

const log = logger.create("usePhotoManagement");

/**
 * Custom hook for managing user photos
 */
const usePhotoManagement = () => {
  const api = useApi();
  const { refreshUserData } = useUser();
  
  // State for tracking photo operations
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoLoadErrors, setPhotoLoadErrors] = useState({});
  
  // References to prevent race conditions
  const processingRef = useRef(false);

  /**
   * Generate a consistent temporary ID for a photo
   */
  const generateTempId = useCallback(() => {
    return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Handle photo upload with progress tracking
   * @param {File} file - The file to upload
   * @param {boolean} isPrivate - Whether the photo should be private
   * @param {Function} onProgress - Optional progress callback
   * @returns {Promise<Object>} The uploaded photo object
   */
  const uploadPhoto = useCallback(async (file, isPrivate = false, onProgress) => {
    if (!file) {
      throw new Error('No file provided');
    }

    const fileType = file.type.split('/')[0];
    if (fileType !== 'image') {
      throw new Error('File must be an image');
    }
    
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('File size exceeds 5MB limit');
    }

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('isPrivate', isPrivate);
      
      // Use api.upload method which is specifically designed for file uploads
      const response = await api.upload('/users/photos', formData, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percentCompleted);
        
        if (onProgress && typeof onProgress === 'function') {
          onProgress(percentCompleted);
        }
      });
      
      if (response && response.success && response.data) {
        return response.data;
      } else if (response && response.photo) {
        return response.photo;
      } else {
        throw new Error(response?.error || 'Failed to upload photo');
      }
    } catch (error) {
      log.error('Photo upload error:', error);
      throw error;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [api]);

  /**
   * Toggle the privacy status of a photo
   * @param {string} photoId - The ID of the photo
   * @param {string} userId - The user ID (for refreshing data after operation)
   * @returns {Promise<Object>} The updated photo
   */
  const togglePhotoPrivacy = useCallback(async (photoId, userId) => {
    if (!photoId) {
      throw new Error('No photo ID provided');
    }
    
    if (processingRef.current) return;
    
    // Check if this is a temporary photo
    if (typeof photoId === 'string' && photoId.startsWith('temp-')) {
      toast.warning('Please wait for the photo to finish uploading');
      return;
    }
    
    processingRef.current = true;
    setIsProcessingPhoto(true);
    
    try {
      // We need to know the current privacy status to toggle it
      const response = await api.get(`/users/photos/${photoId}`);
      
      if (!response.success) {
        throw new Error('Failed to get photo information');
      }
      
      const currentPrivacy = response.photo?.isPrivate || false;
      const newPrivacyValue = !currentPrivacy;
      
      // Toggle the privacy status
      const updateResponse = await api.put(`/users/photos/${photoId}/privacy`, {
        isPrivate: newPrivacyValue
      });
      
      if (!updateResponse.success) {
        throw new Error(updateResponse.error || 'Failed to update photo privacy');
      }
      
      // Refresh user data to update the UI
      if (userId) {
        await refreshUserData(userId);
      }
      
      return {
        ...updateResponse.photo,
        isPrivate: newPrivacyValue
      };
    } catch (error) {
      log.error('Photo privacy update error:', error);
      throw error;
    } finally {
      processingRef.current = false;
      setIsProcessingPhoto(false);
    }
  }, [api, refreshUserData]);

  /**
   * Set a photo as the profile photo
   * @param {string} photoId - The ID of the photo to set as profile
   * @param {string} userId - The user ID (for refreshing data after operation)
   * @returns {Promise<Object>} The updated photo
   */
  const setProfilePhoto = useCallback(async (photoId, userId) => {
    if (!photoId) {
      throw new Error('No photo ID provided');
    }
    
    if (processingRef.current) return;
    
    // Check if this is a temporary photo
    if (typeof photoId === 'string' && photoId.startsWith('temp-')) {
      toast.warning('Please wait for the photo to finish uploading');
      return;
    }
    
    processingRef.current = true;
    setIsProcessingPhoto(true);
    
    try {
      const response = await api.put(`/users/photos/${photoId}/profile`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to set profile photo');
      }
      
      // Refresh user data to update the UI
      if (userId) {
        await refreshUserData(userId);
      }
      
      return response.photo;
    } catch (error) {
      log.error('Set profile photo error:', error);
      throw error;
    } finally {
      processingRef.current = false;
      setIsProcessingPhoto(false);
    }
  }, [api, refreshUserData]);

  /**
   * Delete a photo
   * @param {string} photoId - The ID of the photo to delete
   * @param {string} userId - The user ID (for refreshing data after operation)
   * @returns {Promise<boolean>} Success status
   */
  const deletePhoto = useCallback(async (photoId, userId) => {
    if (!photoId) {
      throw new Error('No photo ID provided');
    }
    
    if (processingRef.current) return;
    
    // Check if this is a temporary photo
    if (typeof photoId === 'string' && photoId.startsWith('temp-')) {
      // For temporary photos, just return success
      return true;
    }
    
    processingRef.current = true;
    setIsProcessingPhoto(true);
    
    try {
      const response = await api.delete(`/users/photos/${photoId}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete photo');
      }
      
      // Refresh user data to update the UI
      if (userId) {
        await refreshUserData(userId);
      }
      
      return true;
    } catch (error) {
      log.error('Delete photo error:', error);
      throw error;
    } finally {
      processingRef.current = false;
      setIsProcessingPhoto(false);
    }
  }, [api, refreshUserData]);

  /**
   * Handle image loading errors and fallbacks
   * @param {string} photoId - The ID of the photo that failed to load
   * @param {string} url - The URL that failed to load
   */
  const handlePhotoLoadError = useCallback((photoId, url) => {
    log.debug(`Image with ID ${photoId} failed to load`);
    
    setPhotoLoadErrors(prev => ({
      ...prev,
      [photoId]: true,
    }));
    
    // Mark URL as failed to prevent retries
    if (url) {
      markUrlAsFailed(url);
    }
  }, []);

  /**
   * Ensure all photos have a valid ID, even if it's a temporary one
   * @param {Array} photos - Array of photo objects
   * @returns {Array} Array of photo objects with guaranteed IDs
   */
  const ensurePhotoIds = useCallback((photos) => {
    if (!photos || !Array.isArray(photos)) return [];
    
    return photos.map(photo => {
      if (!photo._id) {
        return {
          ...photo,
          _id: generateTempId(),
          url: photo.url || '/placeholder.svg',
          isPrivate: photo.isPrivate ?? false,
          isProfile: photo.isProfile ?? false,
        };
      }
      return photo;
    });
  }, [generateTempId]);

  /**
   * Process photos array to add missing properties and ensure IDs
   * @param {Array} photos - Array of photo objects
   * @returns {Array} Processed photo array
   */
  const processPhotos = useCallback((photos) => {
    const processedPhotos = ensurePhotoIds(photos);
    
    // Set the first photo as profile if none is marked
    if (processedPhotos.length > 0 && !processedPhotos.some(p => p.isProfile)) {
      processedPhotos[0].isProfile = true;
    }
    
    return processedPhotos;
  }, [ensurePhotoIds]);

  /**
   * Get the profile photo URL from a user or photos array
   * @param {Object|Array} userOrPhotos - User object or photos array
   * @returns {string} Normalized profile photo URL
   */
  const getProfilePhotoUrl = useCallback((userOrPhotos) => {
    if (!userOrPhotos) return normalizePhotoUrl('/default-avatar.png');
    
    // Handle user object
    if (userOrPhotos.photos) {
      const photos = userOrPhotos.photos;
      if (!photos || photos.length === 0) {
        return normalizePhotoUrl('/default-avatar.png');
      }
      
      // Find profile photo
      const profilePhoto = photos.find(photo => photo.isProfile);
      const url = profilePhoto ? profilePhoto.url : photos[0].url;
      
      return normalizePhotoUrl(url || '/default-avatar.png');
    }
    
    // Handle photos array
    if (Array.isArray(userOrPhotos)) {
      if (userOrPhotos.length === 0) {
        return normalizePhotoUrl('/default-avatar.png');
      }
      
      // Find profile photo
      const profilePhoto = userOrPhotos.find(photo => photo.isProfile);
      const url = profilePhoto ? profilePhoto.url : userOrPhotos[0].url;
      
      return normalizePhotoUrl(url || '/default-avatar.png');
    }
    
    // Handle string URL
    if (typeof userOrPhotos === 'string') {
      return normalizePhotoUrl(userOrPhotos);
    }
    
    return normalizePhotoUrl('/default-avatar.png');
  }, []);

  return {
    // State
    isUploading,
    uploadProgress,
    isProcessingPhoto,
    photoLoadErrors,
    
    // Photo operations
    uploadPhoto,
    togglePhotoPrivacy,
    setProfilePhoto,
    deletePhoto,
    
    // Utility functions
    handlePhotoLoadError,
    ensurePhotoIds,
    processPhotos,
    getProfilePhotoUrl,
    generateTempId,
    normalizePhotoUrl
  };
};

export default usePhotoManagement;