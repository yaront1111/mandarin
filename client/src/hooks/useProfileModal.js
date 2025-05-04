"use client"

import { useReducer, useCallback, useEffect, useRef } from "react"
import { toast } from "react-toastify"
import { useUser, useAuth, useModals } from "../context"
import apiService from "../services/apiService"
import { logger } from "../utils/logger"
import { 
  profileModalReducer, 
  initialState,
  ACTIONS 
} from "../reducers/profileModalReducer"

const log = logger.create("useProfileModal")

/**
 * Custom hook for profile modal state management
 * 
 * @param {string} userId - ID of the user to display
 * @returns {Object} Profile modal state and methods
 */
export function useProfileModal(userId) {
  // Get auth and user contexts
  const { user: currentUser } = useAuth()
  const { 
    isUserLiked, 
    likeUser, 
    unlikeUser, 
    blockUser, 
    unblockUser,
    requestPhotoPermission,
    getBlockedUsers
  } = useUser()
  
  // Get modals context for chat
  const { openChat } = useModals()
  
  // Set up the reducer
  const [state, dispatch] = useReducer(profileModalReducer, initialState)
  
  // References
  const isMounted = useRef(true)
  const isLoadingRef = useRef(false)
  
  // Check if this profile is for the current user
  const isOwnProfile = currentUser && currentUser._id === userId
  
  /**
   * Load user profile data
   */
  const loadUserProfile = useCallback(async () => {
    if (!userId || isLoadingRef.current) return null
    
    isLoadingRef.current = true
    dispatch({ type: ACTIONS.SET_LOADING, payload: true })
    
    try {
      // Load profile data
      const result = await apiService.get(`/users/${userId}`)
      
      if (!result.success) {
        throw new Error(result.error || "Failed to load user profile")
      }
      
      if (!isMounted.current) return null
      
      // Set profile data in state
      dispatch({ type: ACTIONS.SET_USER_PROFILE, payload: result.data })
      
      // Load photos
      if (result.data.photos) {
        dispatch({ type: ACTIONS.SET_PHOTO_GALLERY, payload: result.data.photos })
      }
      
      // Check if user is liked
      const liked = await isUserLiked(userId)
      dispatch({ type: ACTIONS.SET_LIKE_STATUS, payload: liked })
      
      // Check if user is blocked
      const blockedUsers = await getBlockedUsers()
      const isBlocked = blockedUsers.some(u => u._id === userId)
      dispatch({ type: ACTIONS.SET_BLOCK_STATUS, payload: isBlocked })
      
      return result.data
    } catch (error) {
      log.error("Error loading user profile:", error)
      
      if (isMounted.current) {
        dispatch({ type: ACTIONS.SET_ERROR, payload: error.message })
        toast.error(error.message || "Error loading profile")
      }
      
      return null
    } finally {
      isLoadingRef.current = false
      
      if (isMounted.current) {
        dispatch({ type: ACTIONS.SET_LOADING, payload: false })
      }
    }
  }, [userId, isUserLiked, getBlockedUsers])
  
  /**
   * Load photo gallery
   */
  const loadPhotoGallery = useCallback(async () => {
    if (!userId) return []
    
    dispatch({ type: ACTIONS.SET_PHOTO_LOADING, payload: true })
    
    try {
      const result = await apiService.get(`/users/${userId}/photos`)
      
      if (!result.success) {
        throw new Error(result.error || "Failed to load photos")
      }
      
      if (!isMounted.current) return []
      
      const photos = result.data || []
      dispatch({ type: ACTIONS.SET_PHOTO_GALLERY, payload: photos })
      
      return photos
    } catch (error) {
      log.error("Error loading photos:", error)
      
      if (isMounted.current) {
        toast.error(error.message || "Error loading photos")
      }
      
      return []
    } finally {
      if (isMounted.current) {
        dispatch({ type: ACTIONS.SET_PHOTO_LOADING, payload: false })
      }
    }
  }, [userId])
  
  /**
   * Handle like/unlike user
   */
  const handleLikeToggle = useCallback(async () => {
    if (!userId || state.likeLoading) return
    
    dispatch({ type: ACTIONS.SET_LIKE_LOADING, payload: true })
    
    try {
      if (state.isLiked) {
        // Unlike user
        const success = await unlikeUser(userId, state.userProfile?.nickname)
        
        if (success && isMounted.current) {
          dispatch({ type: ACTIONS.SET_LIKE_STATUS, payload: false })
        }
      } else {
        // Like user
        const success = await likeUser(userId, state.userProfile?.nickname)
        
        if (success && isMounted.current) {
          dispatch({ type: ACTIONS.SET_LIKE_STATUS, payload: true })
        }
      }
    } catch (error) {
      log.error("Error toggling like:", error)
      
      if (isMounted.current) {
        toast.error(error.message || "Error updating like status")
      }
    } finally {
      if (isMounted.current) {
        dispatch({ type: ACTIONS.SET_LIKE_LOADING, payload: false })
      }
    }
  }, [userId, state.likeLoading, state.isLiked, state.userProfile, likeUser, unlikeUser])
  
  /**
   * Handle block/unblock user
   */
  const handleBlockToggle = useCallback(async () => {
    if (!userId || state.blockLoading) return
    
    dispatch({ type: ACTIONS.SET_BLOCK_LOADING, payload: true })
    
    try {
      if (state.isBlocked) {
        // Unblock user
        const success = await unblockUser(userId, state.userProfile?.nickname)
        
        if (success && isMounted.current) {
          dispatch({ type: ACTIONS.SET_BLOCK_STATUS, payload: false })
        }
      } else {
        // Block user
        const success = await blockUser(userId, state.userProfile?.nickname)
        
        if (success && isMounted.current) {
          dispatch({ type: ACTIONS.SET_BLOCK_STATUS, payload: true })
        }
      }
    } catch (error) {
      log.error("Error toggling block:", error)
      
      if (isMounted.current) {
        toast.error(error.message || "Error updating block status")
      }
    } finally {
      if (isMounted.current) {
        dispatch({ type: ACTIONS.SET_BLOCK_LOADING, payload: false })
      }
    }
  }, [userId, state.blockLoading, state.isBlocked, state.userProfile, blockUser, unblockUser])
  
  /**
   * Start a chat with the user
   */
  const handleStartChat = useCallback(() => {
    if (!userId || !state.userProfile) return
    
    dispatch({ type: ACTIONS.TOGGLE_CHAT, payload: true })
    
    // Use the openChat method from ModalContext
    openChat(state.userProfile)
  }, [userId, state.userProfile, openChat])
  
  /**
   * Request permission for a private photo
   */
  const handleRequestPermission = useCallback(async (photoId) => {
    if (!photoId || state.permissionLoading) return
    
    dispatch({ type: ACTIONS.SET_PERMISSION_LOADING, payload: true })
    
    try {
      const result = await requestPhotoPermission(photoId, userId)
      
      if (result && isMounted.current) {
        dispatch({
          type: ACTIONS.SET_PERMISSION_STATUS,
          payload: {
            photoId,
            status: "pending"
          }
        })
        
        toast.success("Access request sent")
      }
      
      return result
    } catch (error) {
      log.error("Error requesting permission:", error)
      
      if (isMounted.current) {
        toast.error(error.message || "Error requesting access")
      }
      
      return null
    } finally {
      if (isMounted.current) {
        dispatch({ type: ACTIONS.SET_PERMISSION_LOADING, payload: false })
      }
    }
  }, [userId, state.permissionLoading, requestPhotoPermission])
  
  /**
   * Select a photo for viewing
   */
  const selectPhoto = useCallback((photo) => {
    dispatch({ type: ACTIONS.SET_SELECTED_PHOTO, payload: photo })
  }, [])
  
  /**
   * Navigate to next photo
   */
  const goToNextPhoto = useCallback(() => {
    dispatch({ type: ACTIONS.NEXT_PHOTO })
  }, [])
  
  /**
   * Navigate to previous photo
   */
  const goToPrevPhoto = useCallback(() => {
    dispatch({ type: ACTIONS.PREV_PHOTO })
  }, [])
  
  /**
   * Change active tab
   */
  const changeTab = useCallback((tab) => {
    dispatch({ type: ACTIONS.SET_ACTIVE_TAB, payload: tab })
  }, [])
  
  /**
   * Toggle action menu
   */
  const toggleActionMenu = useCallback((show) => {
    dispatch({ 
      type: ACTIONS.TOGGLE_ACTION_MENU, 
      payload: show !== undefined ? show : undefined
    })
  }, [])
  
  /**
   * Toggle stories viewer
   */
  const toggleStories = useCallback((show) => {
    dispatch({ 
      type: ACTIONS.TOGGLE_STORIES, 
      payload: show !== undefined ? show : undefined
    })
  }, [])
  
  // Load profile data when user ID changes
  useEffect(() => {
    if (userId) {
      loadUserProfile()
    }
  }, [userId, loadUserProfile])
  
  // Clean up on unmount
  useEffect(() => {
    isMounted.current = true
    
    return () => {
      isMounted.current = false
    }
  }, [])
  
  // Return state and methods
  return {
    // State from reducer
    userProfile: state.userProfile,
    photos: state.photos,
    selectedPhoto: state.selectedPhoto,
    activeTab: state.activeTab,
    showActionMenu: state.showActionMenu,
    showStories: state.showStories,
    isLiked: state.isLiked,
    isBlocked: state.isBlocked,
    loading: state.loading,
    photoLoading: state.photoLoading,
    likeLoading: state.likeLoading,
    blockLoading: state.blockLoading,
    permissionLoading: state.permissionLoading,
    error: state.error,
    
    // Additional derived state
    isOwnProfile,
    
    // Methods
    loadUserProfile,
    loadPhotoGallery,
    handleLikeToggle,
    handleBlockToggle,
    handleStartChat,
    handleRequestPermission,
    selectPhoto,
    goToNextPhoto,
    goToPrevPhoto,
    changeTab,
    toggleActionMenu,
    toggleStories,
    
    // Dispatcher for direct actions
    dispatch
  }
}

export default useProfileModal