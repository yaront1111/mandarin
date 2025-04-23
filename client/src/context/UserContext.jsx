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
          p.id === action.payload.id ? action.payload : p
        ),
      }
    case "SET_LIKED_USERS":
      return { ...state, likedUsers: action.payload, likesLoading: false }
    case "ADD_LIKED_USER":
      if (state.likedUsers.some(l => String(l.recipient?.id || l.recipient) === String(action.payload.recipient))) {
        return state
      }
      return { ...state, likedUsers: [...state.likedUsers, action.payload] }
    case "REMOVE_LIKED_USER":
      return {
        ...state,
        likedUsers: state.likedUsers.filter(
          l => String(l.recipient?.id || l.recipient) !== String(action.payload)
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

// Provider
export function UserProvider({ children }) {
  const [state, dispatch] = useReducer(userReducer, initialState)
  const { user, isAuthenticated } = useAuth()
  const likesLoadedRef = useRef(false)
  const debounceRef = useRef()

  // Fetch users with pagination
  const getUsers = useCallback(async (page = 1, limit = 20) => {
    dispatch({ type: "SET_LOADING", payload: page === 1 })
    try {
      const res = await apiService.get(`/users?page=${page}&limit=${limit}`)
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
        if (!user?.id || !isMongoId(user.id)) {
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
    if (isAuthenticated && user?.id) {
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
        if (!res.success) throw new Error(res.error)
        const updated = { ...state.currentUser, ...res.data, id: state.currentUser.id }
        dispatch({ type: "UPDATE_PROFILE", payload: updated })
        toast.success("Profile updated")
        return updated
      } catch (err) {
        dispatch({ type: "USER_ERROR", payload: err.message })
        return null
      }
    },
    [state.currentUser]
  )

  // Upload photo
  const uploadPhoto = useCallback(
    async (file, isPrivate) => {
      dispatch({ type: "UPLOADING_PHOTO" })
      try {
        const form = new FormData()
        form.append("photo", file)
        form.append("isPrivate", isPrivate)
        const res = await apiService.upload("/users/photos", form, pct =>
          log.debug(`Upload progress: ${pct}%`)
        )
        if (!res.success) throw new Error(res.error)
        dispatch({ type: "UPLOAD_PHOTO", payload: res.data })
        toast.success(`${isPrivate ? "Private" : "Public"} photo uploaded`)
        return res.data
      } catch (err) {
        dispatch({ type: "USER_ERROR", payload: err.message })
        return null
      }
    },
    []
  )

  // Photo permission
  const requestPhotoPermission = useCallback(async (photoId, ownerId) => {
    try {
      const res = await apiService.post(`/photos/${photoId}/request`, { userId: ownerId })
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
      const res = await apiService.put(`/photos/permissions/${permId}`, { status })
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
    id => state.likedUsers.some(l => String(l.recipient?.id || l.recipient) === String(id)),
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

  const getBlockedUsers = useCallback(async () => {
    try {
      const res = await apiService.get("/users/blocked")
      if (!res.success) throw new Error(res.error)
      return res.data || []
    } catch (err) {
      dispatch({ type: "USER_ERROR", payload: err.message })
      return []
    }
  }, [])

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
