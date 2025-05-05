/**
 * usePhotoManagement - A central hook for photo operations across the app
 * 
 * This hook centralizes all photo-related functionality, using the server as the
 * single source of truth for photo state. It supports the new three-level privacy model:
 * - 'public': Visible to all users
 * - 'private': Only visible to the owner and users with explicit permission
 * - 'friends_only': Only visible to connections/friends
 * 
 * Core functionality includes:
 * - Uploading photos with privacy settings
 * - Setting profile photos
 * - Managing photo privacy levels
 * - Soft deletion of photos (using isDeleted flag)
 * - Handling photo loading errors
 * - Normalizing photo URLs
 * 
 * The hook maintains backward compatibility with the old isPrivate boolean model
 * while encouraging the use of the new privacy enum.
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
   * Clear the URL normalization cache for a specific URL or all photo URLs
   * @param {string} specificUrl - Optional specific URL to clear from cache
   */
  const clearCache = useCallback((specificUrl) => {
    // Access the global caches from window object
    const globalUrlNormalizationCache = typeof window !== 'undefined' ? window.__url_normalization_cache : null;
    
    if (specificUrl) {
      // Only clear from global cache since we don't have local access
      if (globalUrlNormalizationCache) {
        globalUrlNormalizationCache.delete(specificUrl);
        globalUrlNormalizationCache.delete(`${specificUrl}:true`);
        log.debug(`Cleared cache for specific URL: ${specificUrl}`);
      }
    } else {
      // Clear all photo URLs from global cache
      if (globalUrlNormalizationCache) {
        globalUrlNormalizationCache.clear();
        log.debug('Cleared entire URL cache');
      }
    }
  }, []);

  /**
   * Generate a consistent temporary ID for a photo
   */
  const generateTempId = useCallback(() => {
    return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Handle photo upload with progress tracking
   * @param {File} file - The file to upload
   * @param {string} privacy - Privacy level ('public', 'private', 'friends_only')
   * @param {Function} onProgress - Optional progress callback
   * @param {boolean} shouldSetAsProfile - Whether to set this photo as profile photo
   * @returns {Promise<Object>} The uploaded photo object
   */
  const uploadPhoto = useCallback(async (file, privacy = 'private', onProgress, shouldSetAsProfile = false) => {
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
    
    // Validate privacy parameter
    if (privacy && !['public', 'private', 'friends_only'].includes(privacy)) {
      privacy = 'private'; // Default to private for safety
    }

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('privacy', privacy);
      
      // Add flag for profile photo if needed
      if (shouldSetAsProfile) {
        formData.append('isProfile', 'true');
      }
      
      // Use api.upload method which is specifically designed for file uploads
      const response = await api.upload('/users/photos', formData, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percentCompleted);
        
        if (onProgress && typeof onProgress === 'function') {
          onProgress(percentCompleted);
        }
      });
      
      // Clear cache to ensure all avatars are refreshed
      clearCache();
      
      // Dispatch a global avatar refresh event to notify all components
      if (typeof window !== 'undefined') {
        // Wait a short delay to dispatch event (helps with race conditions)
        setTimeout(() => {
          log.debug('Dispatching avatar refresh event after successful upload');
          const refreshEvent = new CustomEvent('avatar:refresh', {
            detail: { timestamp: Date.now() }
          });
          window.dispatchEvent(refreshEvent);
        }, 200);
      }
      
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
  }, [api, clearCache]);

  /**
   * Set the privacy level for a photo (public, private, friends_only)
   * @param {string} photoId - The ID of the photo
   * @param {string} privacy - The privacy level to set ('public', 'private', or 'friends_only')
   * @param {string} userId - The user ID (for refreshing data after operation)
   * @returns {Promise<Object>} The updated photo
   */
  const setPhotoPrivacy = useCallback(async (photoId, privacy, userId) => {
    if (!photoId) {
      throw new Error('No photo ID provided');
    }
    
    if (!['public', 'private', 'friends_only'].includes(privacy)) {
      throw new Error("Privacy must be 'public', 'private', or 'friends_only'");
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
      // Set the privacy directly with the new API
      const updateResponse = await api.put(`/users/photos/${photoId}/privacy`, {
        privacy: privacy
      });
      
      // API response is already processed by useApi hook
      // The response might be directly the data or could have success property
      // Handle both cases
      const responseData = updateResponse?.data || updateResponse;
      
      // Refresh user data to update the UI
      if (userId) {
        await refreshUserData(userId);
      }
      
      return responseData;
    } catch (error) {
      log.error('Photo privacy update error:', error);
      throw error;
    } finally {
      processingRef.current = false;
      setIsProcessingPhoto(false);
    }
  }, [api, refreshUserData]);
  
  /**
   * Legacy method - Toggle a photo between public and private
   * @deprecated Use setPhotoPrivacy instead with explicit 'public', 'private', or 'friends_only' values
   * 
   * Note: This method only toggles between 'public' and 'private' and doesn't support 'friends_only'.
   * It's maintained for backward compatibility with components that haven't been fully updated
   * to the new privacy model. New code should use setPhotoPrivacy directly.
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
      const user = await api.get(`/auth/me`);
      
      if (!user || !user.photos) {
        throw new Error('Failed to get user information');
      }
      
      const photo = user.photos.find(p => p._id === photoId);
      if (!photo) {
        throw new Error('Photo not found');
      }
      
      const currentPrivacy = photo.privacy || 'private';
      const newPrivacy = currentPrivacy === 'private' ? 'public' : 'private';
      
      // Use the new method to update
      return await setPhotoPrivacy(photoId, newPrivacy, userId);
    } catch (error) {
      log.error('Photo privacy toggle error:', error);
      throw error;
    } finally {
      processingRef.current = false;
      setIsProcessingPhoto(false);
    }
  }, [api, refreshUserData, setPhotoPrivacy]);

  /**
   * Set a photo as the profile photo
   * @param {string} photoId - The ID of the photo to set as profile
   * @param {string} userId - The user ID (for refreshing data after operation)
   * @returns {Promise<Object>} The updated photos array
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
      // The new API automatically handles the isProfile flag for all photos
      const response = await api.put(`/users/photos/${photoId}/profile`);
      
      // API response is already processed by useApi hook
      // The response might be directly the data or could have success property
      // Handle both cases
      const responseData = response?.data || response;
      
      // Clear URL cache for all images to ensure they're refreshed throughout the app
      clearCache();
      
      // Refresh user data to update the UI
      if (userId) {
        await refreshUserData(userId);
      }
      
      return responseData; // Returns the full photos array
    } catch (error) {
      log.error('Set profile photo error:', error);
      throw error;
    } finally {
      processingRef.current = false;
      setIsProcessingPhoto(false);
    }
  }, [api, refreshUserData, clearCache]);

  /**
   * Soft delete a photo (mark as deleted but keep in database)
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
      // Check if photo is the profile photo
      const user = await api.get(`/auth/me`);
      const photo = user?.photos?.find(p => p._id === photoId);
      
      if (photo?.isProfile) {
        throw new Error('Cannot delete profile photo. Set another photo as profile first.');
      }
      
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
          privacy: photo.privacy || 'private',
          isProfile: photo.isProfile ?? false,
          isDeleted: photo.isDeleted ?? false,
          uploadedAt: photo.uploadedAt || new Date(),
        };
      }
      
      // Convert legacy isPrivate property to privacy if needed
      if (photo.isPrivate !== undefined && !photo.privacy) {
        return {
          ...photo,
          privacy: photo.isPrivate ? 'private' : 'public',
          // Keep isPrivate for backward compatibility but don't rely on it
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
    if (!photos || !Array.isArray(photos)) return [];
    
    // First filter out deleted photos
    const nonDeletedPhotos = photos.filter(photo => !photo.isDeleted);
    
    // Ensure all photos have IDs
    const processedPhotos = ensurePhotoIds(nonDeletedPhotos);
    
    // Set the first photo as profile if none is marked
    if (processedPhotos.length > 0 && !processedPhotos.some(p => p.isProfile)) {
      processedPhotos[0].isProfile = true;
    }
    
    // Make sure all photos have proper privacy settings
    processedPhotos.forEach(photo => {
      if (!photo.privacy || !['public', 'private', 'friends_only'].includes(photo.privacy)) {
        photo.privacy = 'private'; // Default to private for safety
      }
    });
    
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
      
      // Find non-deleted photos first
      const availablePhotos = photos.filter(photo => !photo.isDeleted);
      if (availablePhotos.length === 0) {
        return normalizePhotoUrl('/default-avatar.png');
      }
      
      // Find profile photo among available photos
      const profilePhoto = availablePhotos.find(photo => photo.isProfile);
      const url = profilePhoto ? profilePhoto.url : availablePhotos[0].url;
      
      return normalizePhotoUrl(url || '/default-avatar.png');
    }
    
    // Handle photos array
    if (Array.isArray(userOrPhotos)) {
      if (userOrPhotos.length === 0) {
        return normalizePhotoUrl('/default-avatar.png');
      }
      
      // Find non-deleted photos first
      const availablePhotos = userOrPhotos.filter(photo => !photo.isDeleted);
      if (availablePhotos.length === 0) {
        return normalizePhotoUrl('/default-avatar.png');
      }
      
      // Find profile photo among available photos
      const profilePhoto = availablePhotos.find(photo => photo.isProfile);
      const url = profilePhoto ? profilePhoto.url : availablePhotos[0].url;
      
      return normalizePhotoUrl(url || '/default-avatar.png');
    }
    
    // Handle string URL
    if (typeof userOrPhotos === 'string') {
      return normalizePhotoUrl(userOrPhotos);
    }
    
    return normalizePhotoUrl('/default-avatar.png');
  }, []);

  /**
   * Force refresh all avatars application-wide
   * This is a utility function that can be called when you know a profile photo
   * has changed but you don't have access to specific avatar instances
   */
  const refreshAllAvatars = useCallback(() => {
    // Clear all photo caches
    clearCache();
    
    // Dispatch a custom event that avatar components can listen for
    if (typeof window !== 'undefined') {
      const refreshEvent = new CustomEvent('avatar:refresh', {
        detail: { timestamp: Date.now() }
      });
      window.dispatchEvent(refreshEvent);
      log.debug('Avatar refresh event dispatched');
    }
  }, [clearCache]);

  return {
    // State
    isUploading,
    uploadProgress,
    isProcessingPhoto,
    photoLoadErrors,
    
    // Photo operations
    uploadPhoto,
    setPhotoPrivacy,        // New method using privacy enum
    togglePhotoPrivacy,     // Legacy method preserved for compatibility
    setProfilePhoto,
    deletePhoto,
    
    // Utility functions
    handlePhotoLoadError,
    ensurePhotoIds,
    processPhotos,
    getProfilePhotoUrl,
    generateTempId,
    normalizePhotoUrl: normalizePhotoUrl, // Use the imported function
    clearCache,             // Clear URL cache
    refreshAllAvatars       // Force refresh all avatars app-wide
  };
};

export default usePhotoManagement;