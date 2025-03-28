"use client"

// UserContext.jsx - with optimized like handling
import { createContext, useReducer, useContext, useEffect, useCallback, useRef } from "react"
import { toast } from "react-toastify"
import { FaHeart } from "react-icons/fa"
import apiService from "../services/apiService"
import { useAuth } from "./AuthContext"

// Create UserContext
const UserContext = createContext()

// User reducer to handle state updates
const userReducer = (state, action) => {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload }
    case "GET_USERS":
      return { ...state, users: action.payload, loading: false }
    case "APPEND_USERS":
      return { ...state, users: [...state.users, ...action.payload], loading: false }
    case "GET_USER":
      return {
        ...state,
        currentUser: action.payload.user,
        messages: action.payload.messages,
        loading: false,
      }
    case "USER_ONLINE":
      return {
        ...state,
        users: state.users.map((user) =>
          user._id === action.payload.userId ? { ...user, isOnline: true, lastActive: Date.now() } : user,
        ),
        currentUser:
          state.currentUser && state.currentUser._id === action.payload.userId
            ? { ...state.currentUser, isOnline: true, lastActive: Date.now() }
            : state.currentUser,
      }
    case "USER_OFFLINE":
      return {
        ...state,
        users: state.users.map((user) =>
          user._id === action.payload.userId ? { ...user, isOnline: false, lastActive: Date.now() } : user,
        ),
        currentUser:
          state.currentUser && state.currentUser._id === action.payload.userId
            ? { ...state.currentUser, isOnline: false, lastActive: Date.now() }
            : state.currentUser,
      }
    case "UPLOAD_PHOTO":
      return {
        ...state,
        currentUser: state.currentUser
          ? { ...state.currentUser, photos: [...(state.currentUser.photos || []), action.payload] }
          : state.currentUser,
        uploadingPhoto: false,
      }
    case "UPLOADING_PHOTO":
      return { ...state, uploadingPhoto: true }
    case "PHOTO_PERMISSION_REQUESTED":
      return {
        ...state,
        photoPermissions: [...state.photoPermissions, action.payload],
      }
    case "PHOTO_PERMISSION_UPDATED":
      return {
        ...state,
        photoPermissions: state.photoPermissions.map((permission) =>
          permission._id === action.payload._id ? action.payload : permission,
        ),
      }
    case "UPDATE_PROFILE":
      return {
        ...state,
        currentUser: { ...state.currentUser, ...action.payload },
        updatingProfile: false,
      }
    case "UPDATING_PROFILE":
      return { ...state, updatingProfile: true }
    case "SET_LIKED_USERS":
      return { ...state, likedUsers: action.payload }
    case "ADD_LIKED_USER":
      return {
        ...state,
        likedUsers: [...state.likedUsers, action.payload],
      }
    case "REMOVE_LIKED_USER":
      return {
        ...state,
        likedUsers: state.likedUsers.filter((like) => like.recipient !== action.payload),
      }
    case "SET_LIKES_LOADING":
      return { ...state, likesLoading: action.payload }
    case "USER_ERROR":
      toast.error(action.payload)
      return {
        ...state,
        error: action.payload,
        loading: false,
        uploadingPhoto: false,
        updatingProfile: false,
        likesLoading: false,
      }
    case "CLEAR_ERROR":
      return { ...state, error: null }
    default:
      return state
  }
}

// Initial state for the user context
const initialState = {
  users: [],
  currentUser: null,
  messages: [],
  photoPermissions: [],
  loading: false,
  uploadingPhoto: false,
  updatingProfile: false,
  likedUsers: [],
  likesLoading: true, // Start with true to show we're loading likes
  error: null,
}

export const UserProvider = ({ children }) => {
  const [state, dispatch] = useReducer(userReducer, initialState)
  const { user, isAuthenticated } = useAuth()

  // Use a ref to store the debounce timeout ID
  const debounceTimeoutRef = useRef(null)

  // Track if we've loaded likes to prevent multiple fetches
  const likesLoadedRef = useRef(false)

  // getUsers function: fetches users with pagination support
  const getUsers = useCallback(async (page = 1, limit = 20) => {
    dispatch({ type: "SET_LOADING", payload: page === 1 })
    try {
      const data = await apiService.get(`/users?page=${page}&limit=${limit}`)
      if (data.success) {
        // If it's the first page, replace users array, otherwise append
        dispatch({
          type: page === 1 ? "GET_USERS" : "APPEND_USERS",
          payload: data.data,
        })
        return {
          users: data.data,
          hasMore: data.hasMore || data.pagination?.hasNext || data.data.length === limit,
          totalPages: data.pagination?.totalPages || Math.ceil(data.totalCount / limit) || 1,
        }
      } else {
        throw new Error(data.error || "Failed to fetch users")
      }
    } catch (err) {
      const errorMsg = err.error || err.message || "Failed to fetch users"
      dispatch({ type: "USER_ERROR", payload: errorMsg })
      return { users: [], hasMore: false, totalPages: 1 }
    }
  }, [])

  // Get all users liked by current user - OPTIMIZED VERSION
  const getLikedUsers = useCallback(
    async (forceRefresh = false) => {
      // Remove the early return based on likesLoadedRef to allow refreshing
      if (!user || !user._id) return

      // Only set loading if we're not already loading
      if (!state.likesLoading) {
        dispatch({ type: "SET_LIKES_LOADING", payload: true })
      }

      try {
        // Make sure we have a valid user before making the request
        if (!user._id || typeof user._id !== "string") {
          console.warn("Current user ID is missing or invalid", user)
          dispatch({ type: "SET_LIKED_USERS", payload: [] })
          return
        }

        // Validate if user._id is a valid MongoDB ObjectId
        const isValidId = /^[0-9a-fA-F]{24}$/.test(user._id)
        if (!isValidId) {
          console.warn(`Invalid user ID format: ${user._id}`)
          dispatch({ type: "SET_LIKED_USERS", payload: [] })
          return
        }

        const response = await apiService.get(
          "/users/likes",
          {},
          {
            headers: forceRefresh ? { "x-no-cache": "true" } : {}, // Add cache-busting header when forcing refresh
          },
        )

        if (response.success) {
          dispatch({ type: "SET_LIKED_USERS", payload: response.data || [] })
          // Mark likes as loaded
          likesLoadedRef.current = true
        } else {
          console.error("Error in getLikedUsers:", response.error)
          // Set empty array on error to prevent undefined errors
          dispatch({ type: "SET_LIKED_USERS", payload: [] })
        }
      } catch (err) {
        console.error("Error fetching liked users:", err)
        // Set empty array on error to prevent undefined errors
        dispatch({ type: "SET_LIKED_USERS", payload: [] })
      } finally {
        dispatch({ type: "SET_LIKES_LOADING", payload: false })
      }
    },
    [user, state.likesLoading],
  )

  // Load likes when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user && user._id) {
      // Always fetch likes when the component mounts or user changes
      getLikedUsers(true) // Force refresh on mount/user change

      // Set up periodic refresh of likes data
      const refreshInterval = setInterval(
        () => {
          if (document.visibilityState === "visible") {
            getLikedUsers(true)
          }
        },
        5 * 60 * 1000,
      ) // Refresh every 5 minutes when tab is visible

      return () => clearInterval(refreshInterval)
    } else {
      // Reset likes if user logs out
      dispatch({ type: "SET_LIKED_USERS", payload: [] })
      likesLoadedRef.current = false
    }
  }, [isAuthenticated, user, getLikedUsers])

  // Debounced getUsers: cancels previous timeout and calls getUsers after 500ms delay.
  const debouncedGetUsers = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    debounceTimeoutRef.current = setTimeout(() => {
      if (isAuthenticated && user) {
        getUsers()
      }
    }, 500)
  }, [isAuthenticated, user, getUsers])

  // Initial data loading: call debouncedGetUsers when authenticated user is available.
  useEffect(() => {
    if (isAuthenticated && user) {
      debouncedGetUsers()
    }
    // Cleanup the debounce timeout on unmount.
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current)
    }
  }, [isAuthenticated, user, debouncedGetUsers])

  /**
   * Get a specific user profile and message history.
   * @param {string} id - User ID.
   */
  const getUser = useCallback(async (id) => {
    if (!id) return null

    // Validate if id is a valid MongoDB ObjectId
    const isValidId = /^[0-9a-fA-F]{24}$/.test(id)
    if (!isValidId) {
      const errorMsg = "Invalid user ID format"
      dispatch({ type: "USER_ERROR", payload: errorMsg })
      return null
    }

    dispatch({ type: "SET_LOADING", payload: true })
    try {
      const data = await apiService.get(`/users/${id}`)
      if (data.success) {
        dispatch({ type: "GET_USER", payload: data.data })
        return data.data
      } else {
        throw new Error(data.error || "Failed to fetch user")
      }
    } catch (err) {
      const errorMsg = err.error || err.message || "Failed to fetch user"
      dispatch({ type: "USER_ERROR", payload: errorMsg })
      return null
    }
  }, [])

  /**
   * Update the current user's profile.
   * @param {Object} profileData - Data to update.
   */
  const updateProfile = useCallback(async (profileData) => {
    dispatch({ type: "UPDATING_PROFILE", payload: true })
    try {
      const data = await apiService.put("/users/profile", profileData)
      if (data.success) {
        dispatch({ type: "UPDATE_PROFILE", payload: data.data })
        toast.success("Profile updated successfully")
        return data.data
      } else {
        throw new Error(data.error || "Failed to update profile")
      }
    } catch (err) {
      const errorMsg = err.error || err.message || "Failed to update profile"
      dispatch({ type: "USER_ERROR", payload: errorMsg })
      return null
    }
  }, [])

  /**
   * Upload a photo.
   * @param {File} file - Photo file.
   * @param {boolean} isPrivate - Whether photo is private.
   */
  const uploadPhoto = useCallback(async (file, isPrivate) => {
    dispatch({ type: "UPLOADING_PHOTO", payload: true })
    try {
      const formData = new FormData()
      formData.append("photo", file)
      formData.append("isPrivate", isPrivate)

      // Use apiService.upload which supports progress tracking.
      const data = await apiService.upload("/users/photos", formData, (progress) => {
        // Optional: update UI progress state here
        console.log(`Upload progress: ${progress}%`)
      })

      if (data.success) {
        dispatch({ type: "UPLOAD_PHOTO", payload: data.data })
        toast.success(`${isPrivate ? "Private" : "Public"} photo uploaded successfully`)
        return data.data
      } else {
        throw new Error(data.error || "Failed to upload photo")
      }
    } catch (err) {
      const errorMsg = err.error || err.message || "Failed to upload photo"
      dispatch({ type: "USER_ERROR", payload: errorMsg })
      return null
    }
  }, [])

  /**
   * Request permission to view a private photo.
   * @param {string} photoId - ID of the photo.
   * @param {string} userId - ID of the photo owner.
   */
  const requestPhotoPermission = useCallback(async (photoId, userId) => {
    try {
      const data = await apiService.post(`/photos/${photoId}/request`, { userId })
      if (data.success) {
        dispatch({ type: "PHOTO_PERMISSION_REQUESTED", payload: data.data })
        toast.success("Photo access request sent")
        return data.data
      } else {
        throw new Error(data.error || "Failed to request photo access")
      }
    } catch (err) {
      const errorMsg = err.error || err.message || "Failed to request photo access"
      dispatch({ type: "USER_ERROR", payload: errorMsg })
      return null
    }
  }, [])

  /**
   * Update a photo permission request (approve or reject).
   * @param {string} permissionId - Permission request ID.
   * @param {string} status - New status ('approved' or 'rejected').
   */
  const updatePhotoPermission = useCallback(async (permissionId, status) => {
    try {
      const data = await apiService.put(`/photos/permissions/${permissionId}`, { status })
      if (data.success) {
        dispatch({ type: "PHOTO_PERMISSION_UPDATED", payload: data.data })
        toast.success(`Photo access ${status}`)
        return data.data
      } else {
        throw new Error(data.error || `Failed to ${status} photo access`)
      }
    } catch (err) {
      const errorMsg = err.error || err.message || `Failed to ${status} photo access`
      dispatch({ type: "USER_ERROR", payload: errorMsg })
      return null
    }
  }, [])

  /**
   * Refresh user data: refetch current user data and user list.
   * @param {string|null} userId - Optional user ID to refresh.
   */
  const refreshUserData = useCallback(
    async (userId = null) => {
      if (userId) {
        await getUser(userId)
      } else if (state.currentUser) {
        await getUser(state.currentUser._id)
      }
      await getUsers()
    },
    [state.currentUser, getUser, getUsers],
  )

  /**
   * Clear error state.
   */
  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" })
  }, [])

  // Check if a user is liked
  const isUserLiked = useCallback(
    (userId) => {
      if (!state.likedUsers || !Array.isArray(state.likedUsers)) return false
      return state.likedUsers.some((like) => like && like.recipient === userId)
    },
    [state.likedUsers],
  )

  // Like a user - OPTIMIZED VERSION
  const likeUser = useCallback(
    async (userId, userName) => {
      if (!user || !user._id) return false

      try {
        // Validate userId
        if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
          toast.error("Invalid user ID format")
          return false
        }

        // Optimistic update - add to liked users immediately for better UX
        if (!isUserLiked(userId)) {
          dispatch({
            type: "ADD_LIKED_USER",
            payload: {
              recipient: userId,
              createdAt: new Date().toISOString(),
            },
          })
        }

        const response = await apiService.post(`/users/${userId}/like`)
        if (response.success) {
          // Show success notification with heart icon
          toast.success(
            <div className="like-toast">
              <FaHeart className="like-icon pulse" />
              <span>You liked {userName || "this user"}</span>
            </div>,
          )

          // If free user, update remaining likes count
          if (response.likesRemaining !== undefined) {
            toast.info(`You have ${response.likesRemaining} likes remaining today`)
          }

          // Refresh likes to ensure consistency with server
          setTimeout(() => getLikedUsers(true), 500)

          return true
        } else {
          // Revert optimistic update on error
          dispatch({ type: "REMOVE_LIKED_USER", payload: userId })

          // Handle case where response is {success: false} with no error message
          const errorMsg = response.error || "You've already liked this user"
          toast.error(errorMsg)
          return false
        }
      } catch (err) {
        // Revert optimistic update on error
        dispatch({ type: "REMOVE_LIKED_USER", payload: userId })

        const errorMsg = err.error || err.message || "Failed to like user"
        toast.error(errorMsg)
        return false
      }
    },
    [user, isUserLiked, getLikedUsers],
  )

  // Unlike a user - OPTIMIZED VERSION
  const unlikeUser = useCallback(
    async (userId, userName) => {
      if (!user || !user._id) return false

      try {
        // Validate userId
        if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
          toast.error("Invalid user ID format")
          return false
        }

        // Optimistic update - remove from liked users immediately
        dispatch({ type: "REMOVE_LIKED_USER", payload: userId })

        const response = await apiService.delete(`/users/${userId}/like`)
        if (response.success) {
          toast.info(`You unliked ${userName || "this user"}`)

          // Refresh likes to ensure consistency with server
          setTimeout(() => getLikedUsers(true), 500)

          return true
        } else {
          // Revert optimistic update if failed
          if (isUserLiked(userId)) {
            dispatch({
              type: "ADD_LIKED_USER",
              payload: {
                recipient: userId,
                createdAt: new Date().toISOString(),
              },
            })
          }

          throw new Error(response.error || "Failed to unlike user")
        }
      } catch (err) {
        // Revert optimistic update
        getLikedUsers(true)

        const errorMsg = err.error || err.message || "Failed to unlike user"
        toast.error(errorMsg)
        return false
      }
    },
    [user, getLikedUsers, isUserLiked],
  )

  return (
    <UserContext.Provider
      value={{
        users: state.users,
        currentUser: state.currentUser,
        messages: state.messages,
        photoPermissions: state.photoPermissions,
        loading: state.loading,
        uploadingPhoto: state.uploadingPhoto,
        updatingProfile: state.updatingProfile,
        error: state.error,
        likedUsers: state.likedUsers,
        likesLoading: state.likesLoading,
        getUsers,
        getUser,
        updateProfile,
        uploadPhoto,
        requestPhotoPermission,
        updatePhotoPermission,
        refreshUserData,
        clearError,
        isUserLiked,
        likeUser,
        unlikeUser,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

/**
 * Custom hook to access the user context.
 */
export const useUser = () => {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}
