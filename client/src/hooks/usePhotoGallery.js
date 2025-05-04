"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { toast } from "react-toastify"
import { useUser, useAuth } from "../context"
import apiService from "../services/apiService"
import { logger } from "../utils/logger"

const log = logger.create("usePhotoGallery")

/**
 * Custom hook for managing photo gallery
 * 
 * @param {string} userId - User ID whose photos to display
 * @param {Array} initialPhotos - Initial photos array (optional)
 * @param {Object} options - Hook options
 * @returns {Object} Photo gallery state and methods
 */
export function usePhotoGallery(userId, initialPhotos = [], options = {}) {
  const {
    pageSize = 20,
    includePrivate = true
  } = options
  
  // State
  const [photos, setPhotos] = useState(initialPhotos)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [permissionRequests, setPermissionRequests] = useState([])

  // Get user context
  const { user: currentUser } = useAuth()
  const { 
    uploadPhoto: uploadUserPhoto,
    requestPhotoPermission,
    refreshUserData
  } = useUser()
  
  // Check if the current user owns the gallery
  const isOwner = currentUser?._id === userId

  // Refs
  const mountedRef = useRef(true)
  const loadingRef = useRef(false)

  /**
   * Load photos from the server
   * @param {number} pageNum - Page number to load
   * @param {boolean} replace - Whether to replace existing photos
   */
  const loadPhotos = useCallback(async (pageNum = 1, replace = true) => {
    if (loadingRef.current || !userId) return []
    
    loadingRef.current = true
    setLoading(true)
    setError(null)
    
    try {
      const queryParams = {
        page: pageNum,
        limit: pageSize,
        includePrivate: isOwner || includePrivate
      }
      
      const result = await apiService.get(`/users/${userId}/photos`, queryParams)
      
      if (!result.success) {
        throw new Error(result.error || "Failed to load photos")
      }
      
      const newPhotos = result.data || []
      
      if (!mountedRef.current) return []
      
      if (replace) {
        setPhotos(newPhotos)
      } else {
        setPhotos(prev => [...prev, ...newPhotos])
      }
      
      setHasMore(newPhotos.length === pageSize)
      setPage(pageNum)
      
      return newPhotos
    } catch (err) {
      log.error("Error loading photos:", err)
      if (mountedRef.current) {
        setError(err.message || "Error loading photos")
      }
      return []
    } finally {
      loadingRef.current = false
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [userId, pageSize, isOwner, includePrivate])

  /**
   * Load more photos (pagination)
   */
  const loadMorePhotos = useCallback(() => {
    if (loading || !hasMore) return
    loadPhotos(page + 1, false)
  }, [loading, hasMore, loadPhotos, page])

  /**
   * Load permission requests
   */
  const loadPermissionRequests = useCallback(async () => {
    if (!isOwner) return []
    
    try {
      const result = await apiService.get("/photos/permissions")
      
      if (!result.success) {
        throw new Error(result.error || "Failed to load permission requests")
      }
      
      if (mountedRef.current) {
        setPermissionRequests(result.data || [])
      }
      
      return result.data || []
    } catch (err) {
      log.error("Error loading permission requests:", err)
      return []
    }
  }, [isOwner])

  /**
   * Upload a new photo
   * @param {File} file - Photo file to upload
   * @param {boolean} isPrivate - Whether the photo is private
   */
  const uploadPhoto = useCallback(async (file, isPrivate = false) => {
    if (!isOwner || !file) return null
    
    setUploading(true)
    setUploadProgress(0)
    setError(null)
    
    try {
      // Custom progress tracking
      const onProgress = (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100)
          setUploadProgress(percent)
        }
      }
      
      // Use user context uploadPhoto method
      const result = await uploadUserPhoto(file, isPrivate, onProgress)
      
      if (!result) {
        throw new Error("Upload failed")
      }
      
      if (mountedRef.current) {
        // Add the new photo to the beginning of the gallery
        setPhotos(prev => [result, ...prev])
        toast.success(`${isPrivate ? "Private" : "Public"} photo uploaded`)
      }
      
      return result
    } catch (err) {
      log.error("Error uploading photo:", err)
      if (mountedRef.current) {
        setError(err.message || "Error uploading photo")
        toast.error(err.message || "Error uploading photo")
      }
      return null
    } finally {
      if (mountedRef.current) {
        setUploading(false)
        setUploadProgress(0)
      }
    }
  }, [isOwner, uploadUserPhoto])

  /**
   * Delete a photo
   * @param {string} photoId - ID of photo to delete
   */
  const deletePhoto = useCallback(async (photoId) => {
    if (!isOwner || !photoId) return false
    
    try {
      const result = await apiService.delete(`/users/photos/${photoId}`)
      
      if (!result.success) {
        throw new Error(result.error || "Failed to delete photo")
      }
      
      if (mountedRef.current) {
        // Remove the photo from the gallery
        setPhotos(prev => prev.filter(p => p._id !== photoId))
        
        // Clear selection if this was the selected photo
        if (selectedPhoto && selectedPhoto._id === photoId) {
          setSelectedPhoto(null)
          setSelectedIndex(-1)
        }
        
        toast.success("Photo deleted")
      }
      
      return true
    } catch (err) {
      log.error("Error deleting photo:", err)
      if (mountedRef.current) {
        setError(err.message || "Error deleting photo")
        toast.error(err.message || "Error deleting photo")
      }
      return false
    }
  }, [isOwner, selectedPhoto])

  /**
   * Update a photo's properties
   * @param {string} photoId - ID of photo to update
   * @param {Object} updates - Properties to update
   */
  const updatePhoto = useCallback(async (photoId, updates) => {
    if (!isOwner || !photoId) return false
    
    try {
      const result = await apiService.put(`/users/photos/${photoId}`, updates)
      
      if (!result.success) {
        throw new Error(result.error || "Failed to update photo")
      }
      
      if (mountedRef.current) {
        // Update the photo in the gallery
        setPhotos(prev => prev.map(p => 
          p._id === photoId ? { ...p, ...result.data } : p
        ))
        
        // Update selected photo if this was it
        if (selectedPhoto && selectedPhoto._id === photoId) {
          setSelectedPhoto(prev => ({ ...prev, ...result.data }))
        }
        
        toast.success("Photo updated")
      }
      
      return result.data
    } catch (err) {
      log.error("Error updating photo:", err)
      if (mountedRef.current) {
        setError(err.message || "Error updating photo")
        toast.error(err.message || "Error updating photo")
      }
      return false
    }
  }, [isOwner, selectedPhoto])

  /**
   * Request permission for a private photo
   * @param {string} photoId - ID of photo to request access
   */
  const requestPermission = useCallback(async (photoId) => {
    if (!photoId || isOwner) return null
    
    try {
      const result = await requestPhotoPermission(photoId, userId)
      
      if (!result) {
        throw new Error("Failed to request permission")
      }
      
      toast.success("Access request sent")
      return result
    } catch (err) {
      log.error("Error requesting permission:", err)
      setError(err.message || "Error requesting permission")
      toast.error(err.message || "Error requesting permission")
      return null
    }
  }, [isOwner, userId, requestPhotoPermission])

  /**
   * Respond to a permission request
   * @param {string} requestId - ID of permission request
   * @param {string} status - New status (approved, denied)
   */
  const respondToPermissionRequest = useCallback(async (requestId, status) => {
    if (!isOwner || !requestId) return null
    
    try {
      const result = await apiService.put(`/photos/permissions/${requestId}`, { status })
      
      if (!result.success) {
        throw new Error(result.error || "Failed to update permission")
      }
      
      // Update request in state
      setPermissionRequests(prev => prev.map(req => 
        req._id === requestId ? { ...req, status } : req
      ))
      
      toast.success(`Request ${status}`)
      
      // Refresh permission requests
      loadPermissionRequests()
      
      return result.data
    } catch (err) {
      log.error("Error responding to permission request:", err)
      setError(err.message || "Error responding to permission request")
      toast.error(err.message || "Error responding to permission request")
      return null
    }
  }, [isOwner, loadPermissionRequests])

  /**
   * Select a photo
   * @param {Object|string} photo - Photo object or ID to select
   */
  const selectPhoto = useCallback((photo) => {
    if (!photo) {
      setSelectedPhoto(null)
      setSelectedIndex(-1)
      return
    }
    
    // If photo is an ID, find the photo object
    if (typeof photo === "string") {
      const photoObj = photos.find(p => p._id === photo)
      if (photoObj) {
        setSelectedPhoto(photoObj)
        setSelectedIndex(photos.indexOf(photoObj))
      }
    } else {
      setSelectedPhoto(photo)
      setSelectedIndex(photos.indexOf(photo))
    }
  }, [photos])

  /**
   * Navigate to next photo
   */
  const nextPhoto = useCallback(() => {
    if (photos.length === 0 || selectedIndex === -1) return
    
    const newIndex = (selectedIndex + 1) % photos.length
    setSelectedPhoto(photos[newIndex])
    setSelectedIndex(newIndex)
  }, [photos, selectedIndex])

  /**
   * Navigate to previous photo
   */
  const prevPhoto = useCallback(() => {
    if (photos.length === 0 || selectedIndex === -1) return
    
    const newIndex = (selectedIndex - 1 + photos.length) % photos.length
    setSelectedPhoto(photos[newIndex])
    setSelectedIndex(newIndex)
  }, [photos, selectedIndex])

  /**
   * Clear the selected photo
   */
  const clearSelection = useCallback(() => {
    setSelectedPhoto(null)
    setSelectedIndex(-1)
  }, [])

  /**
   * Clear any errors
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Initial load of photos
  useEffect(() => {
    if (userId) {
      loadPhotos(1, true)
    }
    
    return () => {
      mountedRef.current = false
    }
  }, [userId, loadPhotos])

  // Load permission requests for owners
  useEffect(() => {
    if (isOwner) {
      loadPermissionRequests()
    }
  }, [isOwner, loadPermissionRequests])

  // Return the state and methods
  return {
    // State
    photos,
    selectedPhoto,
    selectedIndex,
    loading,
    uploading,
    uploadProgress,
    error,
    hasMore,
    isOwner,
    permissionRequests,
    
    // Methods
    loadPhotos,
    loadMorePhotos,
    uploadPhoto,
    deletePhoto,
    updatePhoto,
    requestPermission,
    respondToPermissionRequest,
    selectPhoto,
    nextPhoto,
    prevPhoto,
    clearSelection,
    clearError
  }
}

export default usePhotoGallery