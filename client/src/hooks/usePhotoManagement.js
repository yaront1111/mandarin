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
 * - Image compression before upload
 * - Offline support with local storage
 * - Robust retry mechanism for failed uploads
 * - Race condition handling for token processing
 * 
 * The hook maintains backward compatibility with the old isPrivate boolean model
 * while encouraging the use of the new privacy enum.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useApi } from './useApi';
import { useUser } from '../context';
import { normalizePhotoUrl, markUrlAsFailed } from '../utils';
import { toast } from 'react-toastify';
import logger from '../utils/logger';
import imageCompression from 'browser-image-compression';

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
  const [pendingUploads, setPendingUploads] = useState([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // References to prevent race conditions
  const processingRef = useRef(false);
  const tokenWaitTimeRef = useRef(500); // Initial wait time for token processing
  const maxRetries = 3; // Maximum number of retry attempts
  const uploadQueueKey = 'mandarin_pending_uploads';
  
  // Load any pending uploads from localStorage on hook initialization
  useEffect(() => {
    try {
      const savedUploads = localStorage.getItem(uploadQueueKey);
      if (savedUploads) {
        const uploads = JSON.parse(savedUploads);
        // Check if there are any valid pending uploads
        if (Array.isArray(uploads) && uploads.length > 0) {
          setPendingUploads(uploads);
          log.debug(`Loaded ${uploads.length} pending uploads from localStorage`);
        }
      }
    } catch (err) {
      log.error('Error loading pending uploads from localStorage:', err);
    }
  }, []);
  
  // Save uploads queue to localStorage
  const saveUploadsToLocalStorage = (uploads) => {
    try {
      if (uploads.length > 0) {
        localStorage.setItem(uploadQueueKey, JSON.stringify(uploads));
      } else {
        localStorage.removeItem(uploadQueueKey);
      }
    } catch (err) {
      log.error('Error saving pending uploads to localStorage:', err);
    }
  };
  
  // Add an upload to the pending queue
  const addToPendingUploads = useCallback((uploadData) => {
    setPendingUploads(prev => {
      const newQueue = [...prev, uploadData];
      saveUploadsToLocalStorage(newQueue);
      return newQueue;
    });
  }, []);

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
   * Force refresh all avatars application-wide with an option for extreme refresh
   * This is a utility function that can be called when you know a profile photo
   * has changed but you don't have access to specific avatar instances
   */
  const refreshAllAvatars = useCallback((forcePageRefresh = false) => {
    // Clear all photo caches
    clearCache();
    
    // Most aggressive solution - actual page refresh if requested
    if (forcePageRefresh && typeof window !== 'undefined') {
      log.debug('Forcing complete page refresh by reloading the window');
      window.location.reload();
      return; // Stop here since we're reloading
    }
    
    // Dispatch a custom event that components can listen for
    if (typeof window !== 'undefined') {
      // Add a more aggressive cache busting using a single random value for the entire page
      window.__photo_refresh_timestamp = Date.now();
      
      // Create and dispatch refresh event
      const refreshEvent = new CustomEvent('avatar:refresh', {
        detail: { timestamp: window.__photo_refresh_timestamp }
      });
      window.dispatchEvent(refreshEvent);
      
      // Force a CSS class change on body to trigger repaints
      document.body.classList.add('photo-refreshed');
      setTimeout(() => {
        document.body.classList.remove('photo-refreshed');
      }, 100);
      
      // Force repaint on browser by triggering a layout recalculation
      const scrollPosition = window.scrollY;
      document.body.style.zoom = '99.99%';
      setTimeout(() => {
        document.body.style.zoom = '100%';
        window.scrollTo(0, scrollPosition);
      }, 50);
      
      log.debug('Avatar refresh event dispatched with timestamp:', window.__photo_refresh_timestamp);
    }
  }, [clearCache]);
  
  // Process any pending uploads when online and authenticated
  useEffect(() => {
    const processQueue = async () => {
      // Only process if online and not already uploading
      if (!navigator.onLine || isUploading || isRetrying || pendingUploads.length === 0) {
        return;
      }
      
      log.debug(`Processing ${pendingUploads.length} pending uploads`);
      setIsRetrying(true);
      
      // Take the first pending upload
      const [nextUpload, ...remainingUploads] = pendingUploads;
      
      try {
        // Try to upload the file
        await processUpload(nextUpload);
        
        // Update the queue
        setPendingUploads(remainingUploads);
        saveUploadsToLocalStorage(remainingUploads);
        
        // Reset retry count on success
        setRetryCount(0);
      } catch (err) {
        log.error('Failed to process pending upload:', err);
        
        // Increment retry count
        const newRetryCount = retryCount + 1;
        setRetryCount(newRetryCount);
        
        // Get specific error message
        const errorMessage = err.message || 'Unknown error';
        
        if (newRetryCount >= maxRetries) {
          // If we've reached max retries, remove this upload from the queue
          setPendingUploads(remainingUploads);
          saveUploadsToLocalStorage(remainingUploads);
          
          // Check if we should not retry this type of error
          if (err.shouldRetry === false) {
            toast.error(errorMessage);
          } else {
            toast.error(`Failed to upload photo after ${maxRetries} attempts: ${errorMessage}`); 
          }
          setRetryCount(0);
        } else {
          // Otherwise keep in queue for next retry
          toast.info(`Retrying photo upload (${newRetryCount}/${maxRetries}) - ${errorMessage}`);
        }
      } finally {
        setIsRetrying(false);
      }
    };
    
    // Process queue when online
    if (navigator.onLine) {
      processQueue();
    }
    
    // Listen for online/offline events
    const handleOnline = () => {
      toast.info('Back online. Resuming photo uploads...');
      processQueue();
    };
    
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [pendingUploads, isUploading, isRetrying, retryCount]);
  
  // Compress an image before upload
  const compressImage = async (file, options = {}) => {
    const defaultOptions = {
      maxSizeMB: 1,          // Default max size 1MB
      maxWidthOrHeight: 1920,  // Reasonable size for profile photos
      useWebWorker: true,    // Use web worker for better performance
      fileType: file.type,   // Preserve file type
    };
    
    try {
      log.debug(`Compressing image: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      const compressedFile = await imageCompression(file, { ...defaultOptions, ...options });
      log.debug(`Compression complete: ${compressedFile.name} (${(compressedFile.size / 1024 / 1024).toFixed(2)}MB)`);
      return compressedFile;
    } catch (err) {
      log.error('Image compression error:', err);
      // Return original file if compression fails
      return file;
    }
  };
  
  // Process a pending upload
  const processUpload = async (uploadData) => {
    if (!uploadData || !uploadData.file) {
      throw new Error('Invalid upload data');
    }
    
    const { file, privacy, shouldSetAsProfile } = uploadData;
    
    log.debug('Processing upload:', {
      fileName: file.name,
      fileSize: file.size,
      privacy,
      shouldSetAsProfile,
      isNewRegistration: uploadData.isNewRegistration,
      retry: uploadData.retry,
      previousError: uploadData.error
    });
    
    // Create FormData
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('privacy', privacy || 'private');
    
    // Add flag for profile photo if needed
    if (shouldSetAsProfile) {
      formData.append('isProfile', 'true');
    }
    
    // Handle token race condition by waiting
    if (uploadData.isNewRegistration) {
      log.debug(`Waiting ${tokenWaitTimeRef.current}ms for token processing`);
      await new Promise(resolve => setTimeout(resolve, tokenWaitTimeRef.current));
      // Increase wait time for each retry, up to 3 seconds
      tokenWaitTimeRef.current = Math.min(3000, tokenWaitTimeRef.current * 1.5);
    }
    
    // Make the API request
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      log.debug('Starting upload to /users/photos');
      
      // Use api.upload method
      const response = await api.upload('/users/photos', formData, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percentCompleted);
        
        if (uploadData.onProgress && typeof uploadData.onProgress === 'function') {
          uploadData.onProgress(percentCompleted);
        }
      });
      
      log.debug('Upload response:', response);
      
      // Clear cache and trigger refresh
      refreshAllAvatars();
      
      // Wait before refreshing user data
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (response && (response.success || response.photo)) {
        const resultData = response.data || response.photo;
        log.debug('Upload successful:', resultData);
        return resultData;
      } else {
        const error = new Error(response?.error || 'Failed to upload photo');
        log.error('Upload failed with response:', response);
        throw error;
      }
    } catch (error) {
      log.error('Upload error in processUpload:', {
        message: error.message,
        response: error.response,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  /**
   * Generate a consistent temporary ID for a photo
   */
  const generateTempId = useCallback(() => {
    return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Handle photo upload with progress tracking, compression, offline support, and retry mechanism
   * @param {File} file - The file to upload
   * @param {string} privacy - Privacy level ('public', 'private', 'friends_only')
   * @param {Function} onProgress - Optional progress callback
   * @param {boolean} shouldSetAsProfile - Whether to set this photo as profile photo
   * @param {Object} options - Additional options
   * @param {boolean} options.isNewRegistration - Whether this upload is part of a new user registration
   * @param {boolean} options.compressImage - Whether to compress the image before upload (defaults to true)
   * @param {boolean} options.addToQueueOnFailure - Whether to add failed uploads to queue (defaults to true)
   * @param {Object} options.compressionOptions - Options for image compression
   * @returns {Promise<Object>} The uploaded photo object
   */
  const uploadPhoto = useCallback(async (file, privacy = 'private', onProgress, shouldSetAsProfile = false, options = {}) => {
    if (!file) {
      throw new Error('No file provided');
    }

    // Validate file type - must match server restrictions
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      log.error(`Invalid file type: ${file.type}. Allowed types: ${allowedTypes.join(', ')}`);
      throw new Error(`Invalid file type. Only JPEG, PNG, and GIF images are allowed. You uploaded: ${file.type}`);
    }
    
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      log.error(`File too large: ${file.size} bytes (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      throw new Error(`File size exceeds 5MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    }
    
    // Validate privacy parameter
    if (privacy && !['public', 'private', 'friends_only'].includes(privacy)) {
      privacy = 'private'; // Default to private for safety
    }
    
    // Extract options with defaults
    const {
      isNewRegistration = false,
      compressImage: shouldCompress = true,
      addToQueueOnFailure = true,
      compressionOptions = {}
    } = options;
    
    try {
      // Compress image if enabled (and not already processing a failed upload)
      let processedFile = file;
      if (shouldCompress && file.size > 500 * 1024) { // Only compress if > 500KB
        processedFile = await compressImage(file, compressionOptions);
      }
      
      // Check if offline
      if (!navigator.onLine) {
        log.debug('Device is offline. Adding upload to queue.');
        toast.info('You appear to be offline. The photo will upload when connection is restored.');
        
        // Add to pending uploads queue
        const uploadData = {
          file: processedFile,
          privacy,
          shouldSetAsProfile,
          onProgress,
          isNewRegistration,
          timestamp: Date.now()
        };
        
        addToPendingUploads(uploadData);
        return { queued: true, message: 'Upload queued until online' };
      }
      
      setIsUploading(true);
      setUploadProgress(0);
      
      // Handle token race condition by waiting if this is a new registration
      if (isNewRegistration) {
        log.debug(`Waiting ${tokenWaitTimeRef.current}ms for token processing`);
        await new Promise(resolve => setTimeout(resolve, tokenWaitTimeRef.current));
      }
      
      // Create FormData
      const formData = new FormData();
      formData.append('photo', processedFile);
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
      
      // Clear cache and trigger a global refresh
      // This will force immediate refresh across all components
      refreshAllAvatars();
      
      // Wait a short delay before refreshing user data
      // This helps with race conditions
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Reset token wait time on successful upload
      tokenWaitTimeRef.current = 500;
      
      if (response && response.success && response.data) {
        return response.data;
      } else if (response && response.photo) {
        return response.photo;
      } else {
        throw new Error(response?.error || 'Failed to upload photo');
      }
    } catch (error) {
      log.error('Photo upload error:', error);
      
      // Extract specific error information
      let errorMessage = error.message || 'Failed to upload photo';
      let shouldRetry = true;
      
      // Check for specific error types
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 400) {
          // Handle specific 400 errors from our server
          if (data?.error) {
            errorMessage = data.error;
            // Don't retry certain validation errors
            if (errorMessage.includes('Max 10 photos') || 
                errorMessage.includes('Only jpg/png/gif images allowed') ||
                errorMessage.includes('No file uploaded')) {
              shouldRetry = false;
            }
          } else {
            errorMessage = 'Bad request: Request failed with status code 400';
          }
        } else if (status === 401) {
          errorMessage = 'Authentication expired. Please log in again.';
          shouldRetry = false; // Don't retry auth errors
        } else if (status === 413) {
          errorMessage = 'File too large. Maximum size is 5MB.';
          shouldRetry = false;
        } else if (status === 429) {
          errorMessage = 'Too many requests. Please wait a moment.';
        } else if (status >= 500) {
          errorMessage = 'Server error. Will retry automatically.';
        } else if (data?.error) {
          errorMessage = data.error;
        }
      } else if (!navigator.onLine) {
        errorMessage = 'No internet connection. Will retry when online.';
      }
      
      // If we should add to queue on failure and we're online (meaning it's an API error, not a network error)
      if (addToQueueOnFailure && shouldRetry && navigator.onLine) {
        log.debug('Adding failed upload to retry queue');
        
        // Add to pending uploads with retry information
        const uploadData = {
          file,
          privacy,
          shouldSetAsProfile,
          onProgress,
          isNewRegistration,
          timestamp: Date.now(),
          retry: true,
          error: errorMessage
        };
        
        addToPendingUploads(uploadData);
        toast.info('Upload failed. Will retry automatically.');
      } else if (!shouldRetry) {
        // Don't retry certain errors
        toast.error(errorMessage);
      }
      
      // Include the specific error message when throwing
      const enhancedError = new Error(errorMessage);
      enhancedError.originalError = error;
      enhancedError.shouldRetry = shouldRetry;
      throw enhancedError;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [api, refreshAllAvatars, addToPendingUploads, compressImage]);

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
      
      // Force global refresh by dispatching refresh event
      refreshAllAvatars();
      
      // Refresh user data to update the UI
      if (userId) {
        await refreshUserData(userId, true); // Force immediate refresh
      }
      
      return responseData;
    } catch (error) {
      log.error('Photo privacy update error:', error);
      throw error;
    } finally {
      processingRef.current = false;
      setIsProcessingPhoto(false);
    }
  }, [api, refreshUserData, refreshAllAvatars]);
  
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
  }, [api, setPhotoPrivacy]);

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
      // First check if the photo is private and make it public if needed
      const user = await api.get(`/auth/me`);
      const photo = user?.photos?.find(p => p._id === photoId);

      if (photo && (photo.privacy === 'private' || photo.privacy === 'friends_only' || photo.isPrivate)) {
        log.debug(`Setting photo ${photoId} to public because it's being set as profile photo`);
        // Make sure the photo is public before setting as profile
        await api.put(`/users/photos/${photoId}/privacy`, {
          privacy: 'public'
        });
      }

      // The API automatically handles the isProfile flag for all photos
      const response = await api.put(`/users/photos/${photoId}/profile`);

      // API response is already processed by useApi hook
      // The response might be directly the data or could have success property
      // Handle both cases
      const responseData = response?.data || response;

      // Clear URL cache for all images to ensure they're refreshed throughout the app
      clearCache();

      // Force global refresh by dispatching refresh event
      refreshAllAvatars();

      // Refresh user data to update the UI
      if (userId) {
        await refreshUserData(userId, true); // Force immediate refresh
      }

      return responseData; // Returns the full photos array
    } catch (error) {
      log.error('Set profile photo error:', error);
      throw error;
    } finally {
      processingRef.current = false;
      setIsProcessingPhoto(false);
    }
  }, [api, refreshUserData, clearCache, refreshAllAvatars]);

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
      
      // Force global refresh by dispatching refresh event
      refreshAllAvatars();
      
      // Refresh user data to update the UI
      if (userId) {
        await refreshUserData(userId, true); // Force immediate refresh
      }
      
      return true;
    } catch (error) {
      log.error('Delete photo error:', error);
      throw error;
    } finally {
      processingRef.current = false;
      setIsProcessingPhoto(false);
    }
  }, [api, refreshUserData, refreshAllAvatars]);

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
    // Get gender-specific default avatar based on user's gender/identity
    const getDefaultAvatar = (user) => {
      // Debug logging - check if user exists
      log.debug('getDefaultAvatar called with user:', user ? 'User object present' : 'No user object');
      
      if (!user) {
        log.debug('No user provided, returning default avatar');
        return '/default-avatar.png';
      }
      
      // Debug logging - check if details.iAm exists
      log.debug('User contains details.iAm:', user.details && user.details.iAm ? 'YES' : 'NO');
      if (user.details) {
        log.debug('User details object:', JSON.stringify(user.details));
      }
      
      // Check user's identity from details.iAm - case-insensitive matching
      if (user.details && user.details.iAm) {
        const iAm = typeof user.details.iAm === 'string' ? user.details.iAm.toLowerCase() : '';
        log.debug('details.iAm value (normalized):', iAm);
        
        if (iAm === 'woman' || iAm === 'women' || iAm === 'female') {
          log.debug('Returning women avatar based on details.iAm');
          return '/women-avatar.png';
        } else if (iAm === 'man' || iAm === 'male') {
          log.debug('Returning man avatar based on details.iAm');
          return '/man-avatar.png';
        } else if (iAm === 'couple' || iAm === 'other') {
          log.debug('Returning couple avatar based on details.iAm');
          return '/couple-avatar.png';
        }
      }
      
      // Debug logging - check gender field
      log.debug('User gender field:', user.gender || 'Not defined');
      
      // Fallback to gender field if iAm is not available (for backward compatibility)
      if (user.gender) {
        // Case-insensitive gender matching
        const gender = typeof user.gender === 'string' ? user.gender.toLowerCase() : '';
        
        if (gender === 'female' || gender === 'woman' || gender === 'women') {
          log.debug('Returning women avatar based on gender field');
          return '/women-avatar.png';
        } else if (gender === 'male' || gender === 'man') {
          log.debug('Returning man avatar based on gender field');
          return '/man-avatar.png';
        } else if (gender === 'couple' || gender === 'other') {
          log.debug('Returning couple avatar based on gender field');
          return '/couple-avatar.png';
        }
      }
      
      // If no specific gender/identity or it's not one of the recognized values
      log.debug('No matching gender/identity found, returning default avatar');
      return '/default-avatar.png';
    };
    
    if (!userOrPhotos) return normalizePhotoUrl(getDefaultAvatar());
    
    // Handle user object
    if (userOrPhotos.photos) {
      const photos = userOrPhotos.photos;
      
      // Debug logging for photos array
      log.debug(`User has photos array with ${photos ? photos.length : 0} photos`);
      if (photos && photos.length > 0) {
        log.debug(`First photo URL: ${photos[0].url || 'undefined'}`);
      }
      
      // No photos or empty array
      if (!photos || photos.length === 0) {
        log.debug('No photos found, returning gender-specific avatar');
        return normalizePhotoUrl(getDefaultAvatar(userOrPhotos), true); // Always bust cache for avatars
      }
      
      // Find non-deleted photos first
      const availablePhotos = photos.filter(photo => !photo.isDeleted && photo.url);
      
      log.debug(`User has ${availablePhotos.length} non-deleted photos with URLs`);
      
      // No available photos after filtering
      if (availablePhotos.length === 0) {
        log.debug('No available photos after filtering, returning gender-specific avatar');
        return normalizePhotoUrl(getDefaultAvatar(userOrPhotos), true); // Always bust cache for avatars
      }
      
      // Find profile photo among available photos
      const profilePhoto = availablePhotos.find(photo => photo.isProfile === true);
      
      if (profilePhoto && profilePhoto.url) {
        log.debug('Found profile photo with URL:', profilePhoto.url);
        return normalizePhotoUrl(profilePhoto.url, true); // Bust cache for profile photos
      } else {
        // Use first available photo if no profile photo is set
        log.debug('No profile photo found, using first available photo:', availablePhotos[0].url);
        return normalizePhotoUrl(availablePhotos[0].url, true);
      }
    }
    
    // Handle photos array
    if (Array.isArray(userOrPhotos)) {
      log.debug(`Received photos array with ${userOrPhotos.length} items`);
      
      if (userOrPhotos.length === 0) {
        // This is trickier as we don't have the user object here
        // Just use generic default avatar in this case
        log.debug('Empty photos array, returning default avatar');
        return normalizePhotoUrl('/default-avatar.png', true);
      }
      
      // Find non-deleted photos first with valid URLs
      const availablePhotos = userOrPhotos.filter(photo => !photo.isDeleted && photo.url);
      log.debug(`Found ${availablePhotos.length} available photos after filtering`);
      
      if (availablePhotos.length === 0) {
        log.debug('No available photos after filtering, returning default avatar');
        return normalizePhotoUrl('/default-avatar.png', true);
      }
      
      // Find profile photo among available photos
      const profilePhoto = availablePhotos.find(photo => photo.isProfile === true);
      
      if (profilePhoto && profilePhoto.url) {
        log.debug('Found profile photo with URL:', profilePhoto.url);
        return normalizePhotoUrl(profilePhoto.url, true); // Always bust cache for profile photos
      } else {
        // Use first available photo if no profile photo is set
        log.debug('No profile photo found, using first available photo:', availablePhotos[0].url);
        return normalizePhotoUrl(availablePhotos[0].url, true);
      }
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
    pendingUploads,
    isRetrying,
    retryCount,
    
    // Photo operations
    uploadPhoto,
    setPhotoPrivacy,        // New method using privacy enum
    togglePhotoPrivacy,     // Legacy method preserved for compatibility
    setProfilePhoto,
    deletePhoto,
    
    // Enhanced features
    compressImage,          // Compress images before upload
    processUpload,          // Process a pending upload
    addToPendingUploads,    // Add an upload to the pending queue
    
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