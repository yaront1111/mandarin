"use client"

import { useReducer, useCallback, useEffect, useRef } from "react"
import { toast } from "react-toastify"
import { useUser, useAuth, useModals } from "../context"
import { logger } from "../utils/logger"
import { 
  dashboardReducer, 
  initialState,
  ACTIONS 
} from "../reducers/dashboardReducer"

const log = logger.create("useDashboard")

/**
 * Custom hook for dashboard state management
 * 
 * @param {Object} options - Hook options
 * @returns {Object} Dashboard state and methods
 */
export function useDashboard(options = {}) {
  const {
    pageSize = 20
  } = options
  
  // Initialize state with reducer
  const [state, dispatch] = useReducer(dashboardReducer, initialState)
  
  // Get user context
  const { user: currentUser } = useAuth()
  const { 
    getUsers, 
    likeUser, 
    unlikeUser, 
    isUserLiked,
    loading: usersLoading
  } = useUser()
  
  // Get modal context
  const { openProfileModal } = useModals()
  
  // References
  const isMounted = useRef(true)
  const loadingRef = useRef(false)
  
  /**
   * Load users from the API
   * @param {boolean} refresh - Whether to refresh the list
   */
  const loadUsers = useCallback(async (refresh = false) => {
    // Prevent multiple simultaneous loads
    if (loadingRef.current) return
    
    // Set loading state
    loadingRef.current = true
    
    const newPage = refresh ? 1 : state.page
    
    if (refresh) {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true })
    } else if (newPage > 1) {
      dispatch({ type: ACTIONS.SET_LOADING_MORE, payload: true })
    }
    
    try {
      // Apply filters to API call
      const queryParams = {
        page: newPage,
        limit: pageSize,
        ...state.filters
      }
      
      // Special handling for age range
      if (state.filters.minAge !== defaultFilters.minAge || 
          state.filters.maxAge !== defaultFilters.maxAge) {
        queryParams.ageRange = `${state.filters.minAge}-${state.filters.maxAge}`
        delete queryParams.minAge
        delete queryParams.maxAge
      }
      
      // Call the user context method
      const result = await getUsers(newPage, pageSize, queryParams)
      
      if (!isMounted.current) return
      
      // Update state based on response
      if (refresh || newPage === 1) {
        dispatch({ type: ACTIONS.SET_USERS, payload: result.users || [] })
      } else {
        dispatch({ type: ACTIONS.APPEND_USERS, payload: result.users || [] })
      }
      
      dispatch({ type: ACTIONS.SET_HAS_MORE, payload: result.hasMore })
      dispatch({ type: ACTIONS.SET_PAGE, payload: newPage })
      
      return result.users
    } catch (error) {
      log.error("Error loading users:", error)
      
      if (isMounted.current) {
        dispatch({ type: ACTIONS.SET_ERROR, payload: error.message })
        toast.error(error.message || "Error loading users")
      }
      
      return []
    } finally {
      loadingRef.current = false
      
      if (isMounted.current) {
        dispatch({ type: ACTIONS.SET_LOADING, payload: false })
        dispatch({ type: ACTIONS.SET_LOADING_MORE, payload: false })
      }
    }
  }, [state.page, state.filters, pageSize, getUsers])
  
  /**
   * Load the next page of users
   */
  const loadMoreUsers = useCallback(() => {
    if (state.loading || state.loadingMore || !state.hasMore) return
    
    dispatch({ type: ACTIONS.SET_PAGE, payload: state.page + 1 })
    
    // The effect will trigger loading the next page
  }, [state.loading, state.loadingMore, state.hasMore, state.page])
  
  /**
   * Apply new filters
   * @param {Object} newFilters - Filter values to apply
   */
  const applyFilters = useCallback((newFilters) => {
    dispatch({ type: ACTIONS.SET_FILTER, payload: newFilters })
    // Reset to first page when filters change
    dispatch({ type: ACTIONS.SET_PAGE, payload: 1 })
  }, [])
  
  /**
   * Reset filters to defaults
   */
  const resetFilters = useCallback(() => {
    dispatch({ type: ACTIONS.RESET_FILTERS })
    // Reset to first page when filters change
    dispatch({ type: ACTIONS.SET_PAGE, payload: 1 })
  }, [])
  
  /**
   * Toggle view mode (grid/list)
   */
  const toggleViewMode = useCallback(() => {
    dispatch({ 
      type: ACTIONS.SET_VIEW_MODE, 
      payload: state.viewMode === 'grid' ? 'list' : 'grid'
    })
  }, [state.viewMode])
  
  /**
   * Toggle filter panel visibility
   */
  const toggleFilterPanel = useCallback((show) => {
    dispatch({ 
      type: ACTIONS.TOGGLE_FILTER_PANEL, 
      payload: show !== undefined ? show : undefined 
    })
  }, [])
  
  /**
   * Handle user profile click
   * @param {Object} user - User to show
   */
  const handleUserClick = useCallback((user) => {
    if (!user || !user._id) return
    
    dispatch({ type: ACTIONS.SET_SELECTED_USER, payload: user })
    
    // Use ModalContext to open profile modal
    openProfileModal(user._id)
  }, [openProfileModal])
  
  /**
   * Toggle story creator visibility
   */
  const toggleStoryCreator = useCallback((show) => {
    dispatch({ 
      type: ACTIONS.TOGGLE_STORY_CREATOR, 
      payload: show !== undefined ? show : undefined 
    })
  }, [])
  
  /**
   * Toggle story viewer visibility
   * @param {boolean} show - Whether to show the viewer
   * @param {string} storyId - ID of story to view
   */
  const toggleStoryViewer = useCallback((show, storyId) => {
    dispatch({ 
      type: ACTIONS.TOGGLE_STORY_VIEWER, 
      payload: { show, storyId } 
    })
  }, [])
  
  /**
   * Handle like/unlike user
   * @param {Object} user - User to like/unlike
   * @param {Event} e - Click event
   */
  const handleLikeToggle = useCallback(async (user, e) => {
    if (e) {
      e.stopPropagation()
    }
    
    if (!user || !user._id) return
    
    try {
      const isLiked = await isUserLiked(user._id)
      
      if (isLiked) {
        await unlikeUser(user._id, user.nickname)
      } else {
        await likeUser(user._id, user.nickname)
      }
    } catch (error) {
      log.error("Error toggling like:", error)
      toast.error(error.message || "Error updating like status")
    }
  }, [likeUser, unlikeUser, isUserLiked])
  
  // Load users when page or filters change
  useEffect(() => {
    if (currentUser) {
      loadUsers(state.page === 1)
    }
  }, [currentUser, state.page, loadUsers])
  
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
    users: state.users,
    selectedUser: state.selectedUser,
    page: state.page,
    hasMore: state.hasMore,
    loading: state.loading || usersLoading,
    loadingMore: state.loadingMore,
    error: state.error,
    viewMode: state.viewMode,
    showFilterPanel: state.showFilterPanel,
    filters: state.filters,
    showStoryCreator: state.showStoryCreator,
    showStoryViewer: state.showStoryViewer,
    activeStoryId: state.activeStoryId,
    
    // Methods
    loadUsers,
    loadMoreUsers,
    applyFilters,
    resetFilters,
    toggleViewMode,
    toggleFilterPanel,
    handleUserClick,
    toggleStoryCreator,
    toggleStoryViewer,
    handleLikeToggle,
    
    // Dispatcher for direct actions
    dispatch
  }
}

export default useDashboard