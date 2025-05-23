"use client"

// UserContext.jsx — Production-ready, optimized user context

import { createContext, useReducer, useContext, useEffect, useCallback, useRef } from "react"
import { toast } from "react-toastify"
import { FaHeart } from "react-icons/fa"
import isMongoId from "validator/lib/isMongoId"
import apiService from "../services/apiService"
import notificationService from "../services/notificationService"
import socketService from "../services/socketService"
import { useAuth } from "./AuthContext"
import logger from "../utils/logger"

const log = logger.create("UserContext")
const UserContext = createContext()

// Initial state
const initialState = {
  users: [],
  currentUser: null,
  messages: [],
  photoPermissions: [],
  likedUsers: [],
  loading: false,
  uploadingPhoto: false,
  updatingProfile: false,
  likesLoading: true,
  error: null,
}

// Reducer
function userReducer(state, action) {
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
    case "UPLOAD_PHOTO":
      return {
        ...state,
        currentUser: state.currentUser
          ? { ...state.currentUser, photos: [...(state.currentUser.photos || []), action.payload] }
          : null,
        uploadingPhoto: false,
      }
    case "PHOTO_PERMISSION_REQUESTED":
      return { ...state, photoPermissions: [...state.photoPermissions, action.payload] }
    case "PHOTO_PERMISSION_UPDATED":
      return {
        ...state,
        photoPermissions: state.photoPermissions.map(p =>
          p._id === action.payload._id ? action.payload : p
        ),
      }
    case "SET_LIKED_USERS":
      return { ...state, likedUsers: action.payload, likesLoading: false }
    case "ADD_LIKED_USER":
      if (state.likedUsers.some(l => String(l.recipient?._id || l.recipient) === String(action.payload.recipient))) {
        return state
      }
      return { ...state, likedUsers: [...state.likedUsers, action.payload] }
    case "REMOVE_LIKED_USER":
      return {
        ...state,
        likedUsers: state.likedUsers.filter(
          l => String(l.recipient?._id || l.recipient) !== String(action.payload)
        ),
      }
    case "SET_LIKES_LOADING":
      return { ...state, likesLoading: action.payload }
    case "UPLOADING_PHOTO":
      return { ...state, uploadingPhoto: true }
    case "UPDATING_PROFILE":
      return { ...state, updatingProfile: true }
    case "UPDATE_PROFILE":
      return { ...state, currentUser: action.payload, updatingProfile: false }
    case "USER_ERROR":
      // Remove toast from reducer to avoid React rendering issues
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

// Provider
export function UserProvider({ children }) {
  const [state, dispatch] = useReducer(userReducer, initialState)
  const { user, isAuthenticated } = useAuth()
  const likesLoadedRef = useRef(false)
  const debounceRef = useRef()
  const errorToastRef = useRef(null)

  // Fetch users with pagination and filters
  const getUsers = useCallback(async (page = 1, limit = 20, filters = {}) => {
    dispatch({ type: "SET_LOADING", payload: page === 1 })
    try {
      // Build query parameters with filters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })
      
      // Add filters to query params
      if (filters.online) params.append('online', 'true')
      if (filters.gender && filters.gender.length > 0) {
        // Handle multiple gender values by sending them as comma-separated
        filters.gender.forEach(g => params.append('gender', g))
      }
      if (filters.ageMin) params.append('minAge', filters.ageMin.toString())
      if (filters.ageMax) params.append('maxAge', filters.ageMax.toString())
      if (filters.location) params.append('location', filters.location)
      if (filters.interests && filters.interests.length > 0) {
        filters.interests.forEach(interest => params.append('interest', interest))
      }
      
      const res = await apiService.get(`/users?${params.toString()}`)
      if (!res.success) throw new Error(res.error || "Failed to fetch users")
      dispatch({
        type: page === 1 ? "GET_USERS" : "APPEND_USERS",
        payload: res.data,
      })
      return {
        users: res.data,
        hasMore: res.hasMore ?? res.pagination?.hasNext ?? res.data.length === limit,
        totalPages: res.pagination?.totalPages ?? Math.ceil(res.totalCount / limit) ?? 1,
      }
    } catch (err) {
      dispatch({ type: "USER_ERROR", payload: err.message })
      return { users: [], hasMore: false, totalPages: 1 }
    }
  }, [])

  // Debounced load
  const debouncedLoad = useCallback(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (isAuthenticated && user) getUsers()
    }, 500)
  }, [getUsers, isAuthenticated, user])

  // Effect: initial users
  useEffect(() => {
    if (isAuthenticated && user) debouncedLoad()
    return () => clearTimeout(debounceRef.current)
  }, [debouncedLoad, isAuthenticated, user])

  // Fetch liked users
  const getLikedUsers = useCallback(
    async (force = false) => {
      if (!likesLoadedRef.current || force) {
        dispatch({ type: "SET_LIKES_LOADING", payload: true })
        if (!user?._id || !isMongoId(user._id)) {
          dispatch({ type: "SET_LIKED_USERS", payload: [] })
          return
        }
        try {
          const res = await apiService.get("/users/likes", {}, {
            headers: force ? { "x-no-cache": "true" } : {},
            useCache: !force,
          })
          if (res.success) dispatch({ type: "SET_LIKED_USERS", payload: res.data })
          else dispatch({ type: "SET_LIKED_USERS", payload: [] })
          likesLoadedRef.current = true
        } catch {
          dispatch({ type: "SET_LIKED_USERS", payload: [] })
        }
      }
    },
    [user]
  )

  // Periodic refresh of likes
  useEffect(() => {
    if (isAuthenticated && user?._id) {
      getLikedUsers(true)
      const interval = setInterval(() => {
        if (document.visibilityState === "visible") getLikedUsers(true)
      }, 5 * 60_000)
      return () => clearInterval(interval)
    } else {
      dispatch({ type: "SET_LIKED_USERS", payload: [] })
      likesLoadedRef.current = false
    }
  }, [getLikedUsers, isAuthenticated, user])

  // Initialize services when settings change
  useEffect(() => {
    if (state.currentUser?.settings) {
      log.info("Initializing services with settings", state.currentUser.settings)
      notificationService.initialize(state.currentUser.settings.notifications)
      socketService.updatePrivacySettings(state.currentUser.settings.privacy)
    }
  }, [state.currentUser?.settings])

  // Get single user & messages
  const getUser = useCallback(
    async id => {
      if (!isMongoId(id)) {
        dispatch({ type: "USER_ERROR", payload: "Invalid user ID" })
        return null
      }
      dispatch({ type: "SET_LOADING", payload: true })
      try {
        const res = await apiService.get(`/users/${id}`)
        if (!res.success) throw new Error(res.error)
        dispatch({ type: "GET_USER", payload: res.data })
        return res.data
      } catch (err) {
        dispatch({ type: "USER_ERROR", payload: err.message })
        return null
      }
    },
    []
  )

  // Update profile
  const updateProfile = useCallback(
    async data => {
      dispatch({ type: "UPDATING_PROFILE" })
      try {
        const res = await apiService.put("/users/profile", data)
        log.debug("Profile update response:", res)
        
        if (!res.success) {
          throw new Error(res.error || "Profile update failed")
        }
        
        // Safely handle the possibility of null state.currentUser
        if (!state.currentUser) {
          // If we don't have the current user in state, just use the response data
          dispatch({ type: "UPDATE_PROFILE", payload: res.data })
          return res.data
        }
        
        // Normal case with existing user
        const updated = { 
          ...state.currentUser, 
          ...res.data, 
          _id: state.currentUser._id || (res.data && res.data._id) 
        }
        dispatch({ type: "UPDATE_PROFILE", payload: updated })
        return updated
      } catch (err) {
        log.error("Profile update error details:", err)
        dispatch({ type: "USER_ERROR", payload: err.message })
        return null
      }
    },
    [state.currentUser]
  )

  // Upload photo
  const uploadPhoto = useCallback(
    async (file, privacy = 'private') => {
      dispatch({ type: "UPLOADING_PHOTO" })
      try {
        const form = new FormData()
        form.append("photo", file)
        form.append("privacy", privacy)
        const res = await apiService.upload("/users/photos", form, pct =>
          log.debug(`Upload progress: ${pct}%`)
        )
        if (!res.success) throw new Error(res.error)
        dispatch({ type: "UPLOAD_PHOTO", payload: res.data })
        // Remove duplicate toast - let the calling component handle it
        // toast.success(`Photo uploaded (${privacy})`)
        return res.data
      } catch (err) {
        dispatch({ type: "USER_ERROR", payload: err.message })
        // Remove duplicate toast - let the calling component handle it
        // toast.error(err.message)
        throw err // Re-throw so the calling component can handle it
      }
    },
    []
  )

  // Photo permission
  const requestPhotoPermission = useCallback(async (photoId, ownerId) => {
    try {
      const res = await apiService.post(`/users/photos/${photoId}/request`, { userId: ownerId })
      if (!res.success) throw new Error(res.error)
      dispatch({ type: "PHOTO_PERMISSION_REQUESTED", payload: res.data })
      toast.success("Access request sent")
      return res.data
    } catch (err) {
      dispatch({ type: "USER_ERROR", payload: err.message })
      return null
    }
  }, [])

  const updatePhotoPermission = useCallback(async (permId, status) => {
    try {
      const res = await apiService.put(`/users/photos/permissions/${permId}`, { status })
      if (!res.success) throw new Error(res.error)
      dispatch({ type: "PHOTO_PERMISSION_UPDATED", payload: res.data })
      toast.success(`Photo ${status}`)
      return res.data
    } catch (err) {
      dispatch({ type: "USER_ERROR", payload: err.message })
      return null
    }
  }, [])

  // Likes
  const isUserLiked = useCallback(
    id => state.likedUsers.some(l => String(l.recipient?._id || l.recipient) === String(id)),
    [state.likedUsers]
  )

  const likeUser = useCallback(
    async (targetId, name) => {
      if (!isMongoId(targetId)) {
        toast.error("Invalid user ID")
        return false
      }
      if (isUserLiked(targetId)) return true
      dispatch({ type: "ADD_LIKED_USER", payload: { recipient: targetId, createdAt: new Date() } })
      try {
        const res = await apiService.post(`/users/${targetId}/like`, {}, { headers: { "x-no-cache": "true" } })
        if (!res.success && res.error !== "Already liked") throw new Error(res.error)
        getLikedUsers(true)
        toast.success(<><FaHeart className="pulse" /> Liked {name || ""}</>)
        if (res.likesRemaining !== undefined) toast.info(`${res.likesRemaining} likes left`)
        return true
      } catch (err) {
        dispatch({ type: "REMOVE_LIKED_USER", payload: targetId })
        toast.error(err.message)
        return false
      }
    },
    [getLikedUsers, isUserLiked]
  )

  const unlikeUser = useCallback(
    async (targetId, name) => {
      if (!isUserLiked(targetId)) return true
      dispatch({ type: "REMOVE_LIKED_USER", payload: targetId })
      try {
        const res = await apiService.delete(`/users/${targetId}/like`, {}, { headers: { "x-no-cache": "true" } })
        if (!res.success) throw new Error(res.error)
        getLikedUsers(true)
        toast.info(`Unliked ${name || ""}`)
        return true
      } catch (err) {
        dispatch({ type: "ADD_LIKED_USER", payload: { recipient: targetId, createdAt: new Date() } })
        toast.error(err.message)
        return false
      }
    },
    [getLikedUsers, isUserLiked]
  )

  // Other utilities: sendMessage, blockUser, unblockUser, reportUser
  const sendMessage = useCallback(async id => {
    try {
      const res = await apiService.post(`/messages/start`, { recipient: id })
      if (!res.success) throw new Error(res.error)
      return res.data
    } catch (err) {
      dispatch({ type: "USER_ERROR", payload: err.message })
      return null
    }
  }, [])

  // Standardized implementation to handle various response formats
  const getBlockedUsers = useCallback(async () => {
    try {
      // Final client-side fallback
      if (!user) {
        return [];
      }

      log.debug("Fetching blocked users list");

      try {
        const res = await apiService.get("/users/blocked");
        log.debug(`Blocked users response: ${res?.success ? 'success' : 'failed'}`);

        if (!res?.success) {
          return [];
        }

        // Normalize all user IDs to ensure consistent format
        const normalizedBlockList = (Array.isArray(res.data) ? res.data : []).map(id => {
          // Ensure each ID is a properly formatted MongoDB ObjectId
          if (typeof id === 'object' && id._id) {
            return id._id;
          } else if (typeof id === 'object' && id.id) {
            return id.id;
          } else {
            // Convert to string and ensure it's a valid MongoDB ObjectId format
            return String(id).replace(/^ObjectId\(['"](.+)['"]\)$/, '$1');
          }
        }).filter(id => /^[0-9a-fA-F]{24}$/.test(id));

        // Also update localStorage for future fallback
        localStorage.setItem('blockedUsers', JSON.stringify(normalizedBlockList));

        return normalizedBlockList;
      } catch (apiError) {
        log.warn('Failed to fetch blocked users from API, using localStorage fallback:', apiError);

        // Try fallback to localStorage
        try {
          const storedBlockedUsers = localStorage.getItem('blockedUsers');
          if (storedBlockedUsers) {
            const blockList = JSON.parse(storedBlockedUsers) || [];
            log.debug(`Loaded ${blockList.length} blocked users from localStorage`);
            return blockList;
          }
        } catch (storageError) {
          log.warn('Error parsing blocked users from localStorage:', storageError);
        }

        return [];
      }
    } catch (err) {
      log.error('Error in getBlockedUsers:', err);
      return [];
    }
  }, [user])

  const blockUser = useCallback(
    async (id, nick = "User") => {
      if (!isMongoId(id)) {
        toast.error("Invalid user ID")
        return false
      }
      try {
        const res = await apiService.post(`/users/${id}/block`)
        if (!res.success && !res.alreadyBlocked) throw new Error(res.error)
        toast.success(`Blocked ${nick}`)
        return true
      } catch (err) {
        dispatch({ type: "USER_ERROR", payload: err.message })
        return false
      }
    },
    []
  )

  const unblockUser = useCallback(
    async (id, nick = "User") => {
      if (!isMongoId(id)) {
        toast.error("Invalid user ID")
        return false
      }
      try {
        const res = await apiService.delete(`/users/${id}/block`)
        if (!res.success) throw new Error(res.error)
        toast.success(`Unblocked ${nick}`)
        return true
      } catch (err) {
        dispatch({ type: "USER_ERROR", payload: err.message })
        return false
      }
    },
    []
  )

  const reportUser = useCallback(async (id, reason = "") => {
    if (!isMongoId(id)) return false
    try {
      const res = await apiService.post(`/users/${id}/report`, { reason })
      if (!res.success) throw new Error(res.error)
      toast.success("User reported")
      return true
    } catch (err) {
      dispatch({ type: "USER_ERROR", payload: err.message })
      return false
    }
  }, [])

  const clearError = useCallback(() => dispatch({ type: "CLEAR_ERROR" }), [])
  
  // Refresh user data optimized for current user and photo updates
  const refreshUserData = useCallback(async (userId, forceImmediate = false) => {
    try {
      // If refreshing current user data
      if (!userId && user?._id) {
        log.info("Refreshing current user data" + (forceImmediate ? " (immediate)" : ""));
        // Use /auth/me endpoint for current user which returns full data including private photos
        // Force skip cache when forceImmediate is true
        const res = await apiService.get(
          `/auth/me`, 
          {}, 
          { 
            useCache: false, 
            headers: { 
              'x-no-cache': 'true',
              // Adding a unique timestamp to force a fresh request
              'Cache-Control': forceImmediate ? 'no-cache, no-store, must-revalidate' : undefined,
              'Pragma': forceImmediate ? 'no-cache' : undefined
            } 
          }
        );
        
        if (!res.success) {
          throw new Error(res.error || "Failed to refresh user data");
        }
        
        // Create a payload similar to what the GET_USER action expects
        const payload = {
          user: res,
          messages: state.messages || []
        };
        
        // Clear any cached data for this endpoint
        if (forceImmediate) {
          apiService.clearCache('/auth/me');
        }
        
        dispatch({ type: "GET_USER", payload });
        return res;
      } 
      // If refreshing specific user data
      else {
        const targetId = userId || state.currentUser?._id || user?._id;
        if (!targetId) {
          throw new Error("No user ID available for refresh");
        }
        
        log.info("Refreshing user data for ID:", targetId + (forceImmediate ? " (immediate)" : ""));
        // Force skip cache when forceImmediate is true
        const res = await apiService.get(
          `/users/${targetId}`, 
          {}, 
          { 
            useCache: false, 
            headers: { 
              'x-no-cache': 'true',
              // Adding a unique timestamp to force a fresh request
              'Cache-Control': forceImmediate ? 'no-cache, no-store, must-revalidate' : undefined,
              'Pragma': forceImmediate ? 'no-cache' : undefined
            } 
          }
        );
        
        if (!res.success) {
          throw new Error(res.error || "Failed to refresh user data");
        }
        
        // Clear any cached data for this endpoint
        if (forceImmediate) {
          apiService.clearCache(`/users/${targetId}`);
        }
        
        dispatch({ type: "GET_USER", payload: res.data });
        return res.data;
      }
    } catch (err) {
      log.error("Error refreshing user data:", err);
      dispatch({ type: "USER_ERROR", payload: err.message });
      return null;
    }
  }, [state.currentUser, state.messages, user]);
  
  // Handle error toasts outside of reducer
  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    }
  }, [state.error]);

  return (
    <UserContext.Provider
      value={{
        ...state,
        getUsers,
        getUser,
        updateProfile,
        uploadPhoto,
        requestPhotoPermission,
        updatePhotoPermission,
        getLikedUsers,
        isUserLiked,
        likeUser,
        unlikeUser,
        sendMessage,
        getBlockedUsers,
        blockUser,
        unblockUser,
        reportUser,
        clearError,
        refreshUserData,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

// Hook
export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error("useUser must be used within UserProvider")
  return ctx
}
