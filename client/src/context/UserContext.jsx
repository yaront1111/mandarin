"use client"

// UserContext.jsx - with optimized like handling
import { createContext, useReducer, useContext, useEffect, useCallback, useRef } from "react"
import { toast } from "react-toastify"
import { FaHeart } from "react-icons/fa"
import apiService from "../services/apiService"
import { useAuth } from "./AuthContext"
import logger from "../utils/logger"

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
      // Properly merge nested settings objects
      const updatedUser = { ...state.currentUser };
      
      // Merge top-level fields
      Object.keys(action.payload).forEach(key => {
        if (key !== 'settings') {
          updatedUser[key] = action.payload[key];
        }
      });
      
      // Special handling for settings to ensure proper merging
      if (action.payload.settings) {
        // Initialize settings if they don't exist yet
        if (!updatedUser.settings) {
          updatedUser.settings = {};
        }
        
        // Handle notifications settings
        if (action.payload.settings.notifications) {
          // Create a normalized version of notification settings with explicit boolean conversion
          const normalizedNotifications = {};
          const notificationSettings = action.payload.settings.notifications;
          
          // Explicitly handle each notification setting
          if ('messages' in notificationSettings) {
            normalizedNotifications.messages = notificationSettings.messages === false ? false : !!notificationSettings.messages;
          }
          if ('calls' in notificationSettings) {
            normalizedNotifications.calls = notificationSettings.calls === false ? false : !!notificationSettings.calls;
          }
          if ('stories' in notificationSettings) {
            normalizedNotifications.stories = notificationSettings.stories === false ? false : !!notificationSettings.stories;
          }
          if ('likes' in notificationSettings) {
            normalizedNotifications.likes = notificationSettings.likes === false ? false : !!notificationSettings.likes;
          }
          if ('comments' in notificationSettings) {
            normalizedNotifications.comments = notificationSettings.comments === false ? false : !!notificationSettings.comments;
          }
          if ('photoRequests' in notificationSettings) {
            normalizedNotifications.photoRequests = notificationSettings.photoRequests === false ? false : !!notificationSettings.photoRequests;
          }
          
          console.log('Normalized notification settings for user update:', normalizedNotifications);
          
          updatedUser.settings.notifications = {
            ...(updatedUser.settings.notifications || {}),
            ...normalizedNotifications
          };
        }
        
        // Handle privacy settings
        if (action.payload.settings.privacy) {
          updatedUser.settings.privacy = {
            ...(updatedUser.settings.privacy || {}),
            ...action.payload.settings.privacy
          };
        }
        
        // Log merged settings for debugging
        console.log('Merged settings in user reducer:', updatedUser.settings);
      }
      
      return {
        ...state,
        currentUser: updatedUser,
        updatingProfile: false,
      }
    case "UPDATING_PROFILE":
      return { ...state, updatingProfile: true }
    case "SET_LIKED_USERS":
      return { ...state, likedUsers: action.payload }
    case "ADD_LIKED_USER":
      // Only add if not already present to avoid duplicates
      if (state.likedUsers.some(like =>
          (like.recipient && like.recipient._id && like.recipient._id === action.payload.recipient) ||
          like.recipient === action.payload.recipient)) {
        return state;
      }
      return {
        ...state,
        likedUsers: [...state.likedUsers, action.payload],
      }
    case "REMOVE_LIKED_USER":
      return {
        ...state,
        likedUsers: state.likedUsers.filter((like) => {
          if (typeof like.recipient === 'object' && like.recipient !== null) {
            return like.recipient._id !== action.payload;
          }
          return like.recipient !== action.payload
        }),
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

  // Get all users liked by current user - OPTIMIZED & FIXED VERSION
  const getLikedUsers = useCallback(
    async (forceRefresh = false) => {
      // Only set loading if we're not already loading and this is a forced refresh
      if (!state.likesLoading && forceRefresh) {
        dispatch({ type: "SET_LIKES_LOADING", payload: true })
      }

      try {
        // Make sure we have a valid user before making the request
        if (!user || !user._id || typeof user._id !== "string") {
          console.warn("Current user ID is missing or invalid", user)
          dispatch({ type: "SET_LIKES_LOADING", payload: false })
          return
        }

        // Validate if user._id is a valid MongoDB ObjectId
        const isValidId = /^[0-9a-fA-F]{24}$/.test(user._id)
        if (!isValidId) {
          console.warn(`Invalid user ID format: ${user._id}`)
          dispatch({ type: "SET_LIKES_LOADING", payload: false })
          return
        }

        console.log("Fetching liked users from server with forceRefresh:", forceRefresh)
        const response = await apiService.get(
          "/users/likes",
          {},
          {
            headers: forceRefresh ? { "x-no-cache": "true" } : {}, // Add cache-busting header when forcing refresh
            useCache: !forceRefresh, // Explicitly bypass cache when forcing refresh
          },
        )

        if (response.success) {
          console.log("Liked users response:", response.data)
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
    [user],
  )

  // Ensure likes are loaded when user is authenticated
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
        
        // Initialize services with user settings if this is the current user
        if (user && id === user._id && data.data.user && data.data.user.settings) {
          try {
            // Initialize notification service with settings using dynamic imports
            Promise.all([
              import('../services/notificationService.jsx'),
              import('../services/socketService.jsx')
            ]).then(([notificationModule, socketModule]) => {
              const notificationService = notificationModule.default;
              const socketService = socketModule.default;
              
              console.log('Initializing services with user settings:', data.data.user.settings);
              
              // Initialize notification service
              notificationService.initialize(data.data.user.settings);
              
              // Update socket service privacy settings
              if (data.data.user.settings.privacy) {
                socketService.updatePrivacySettings(data.data.user.settings.privacy);
              }
              
              console.log('Services initialized with user settings');
            }).catch(err => {
              console.error('Error initializing services with settings:', err);
            });
          } catch (serviceError) {
            console.error('Error in dynamic import for services:', serviceError);
          }
        }
        
        return data.data
      } else {
        throw new Error(data.error || "Failed to fetch user")
      }
    } catch (err) {
      const errorMsg = err.error || err.message || "Failed to fetch user"
      dispatch({ type: "USER_ERROR", payload: errorMsg })
      return null
    }
  }, [user])

  /**
   * Update the current user's profile.
   * @param {Object} profileData - Data to update.
   */
  const updateProfile = useCallback(async (profileData) => {
    dispatch({ type: "UPDATING_PROFILE", payload: true })
    try {
      console.log('Updating profile with data:', profileData);
      
      const data = await apiService.put("/users/profile", profileData)
      
      if (data.success) {
        // If settings are being updated, make sure the data has the settings
        if (profileData.settings) {
          // Make sure data.data has settings field
          if (!data.data.settings) {
            data.data.settings = {};
          }
          
          // Handle partial settings updates - merge with existing
          if (profileData.settings.notifications && !data.data.settings.notifications) {
            data.data.settings.notifications = profileData.settings.notifications;
          }
          
          if (profileData.settings.privacy && !data.data.settings.privacy) {
            data.data.settings.privacy = profileData.settings.privacy;
          }
          
          // Log what we're using
          console.log('Using settings in UPDATE_PROFILE:', data.data.settings);
        }
        
        // Make sure we have the user ID properly set in the response data
        if (!data.data._id && state.currentUser && state.currentUser._id) {
          console.log('Adding missing _id to profile data:', state.currentUser._id);
          data.data._id = state.currentUser._id;
        }
        
        // Dispatch the update to User reducer
        dispatch({ type: "UPDATE_PROFILE", payload: data.data })
        
        // Update the current user in state 
        if (state.currentUser) {
          // Create a merged object with both the old and new data
          const mergedData = {
            ...state.currentUser,
            ...data.data,
            details: {
              ...state.currentUser.details,
              ...data.data.details,
            }
          };
          
          // Ensure all profile fields are included
          if (profileData.details) {
            if (profileData.details.iAm !== undefined) {
              mergedData.details.iAm = profileData.details.iAm;
            }
            if (profileData.details.maritalStatus !== undefined) {
              mergedData.details.maritalStatus = profileData.details.maritalStatus;
            }
          }
          
          // Re-dispatch with the merged data to ensure all fields are properly updated
          dispatch({ type: "UPDATE_PROFILE", payload: mergedData });
        }
        
        // If we're updating settings, reinitialize services with the updated settings
        if (profileData.settings) {
          try {
            Promise.all([
              import('../services/notificationService.jsx'),
              import('../services/socketService.jsx')
            ]).then(([notificationModule, socketModule]) => {
              const notificationService = notificationModule.default;
              const socketService = socketModule.default;
              
              // Ensure notification service has the right settings
              if (profileData.settings.notifications) {
                console.log('Updating notification service after profile update:', profileData.settings.notifications);
                notificationService.updateSettings(profileData.settings.notifications);
              }
              
              // Ensure socket service has the right settings
              if (profileData.settings.privacy) {
                console.log('Updating socket service after profile update:', profileData.settings.privacy);
                socketService.updatePrivacySettings(profileData.settings.privacy);
              }
              
              console.log('Services updated after profile update with new settings');
            }).catch(err => {
              console.error('Error updating services after profile update:', err);
            });
          } catch (error) {
            console.error('Error importing services for settings update:', error);
          }
        }
        
        toast.success("Profile updated successfully")
        
        // Return the properly merged data with ID
        const returnData = state.currentUser ? 
          { ...data.data, _id: state.currentUser._id } : 
          data.data;
          
        return returnData;
      } else {
        throw new Error(data.error || "Failed to update profile")
      }
    } catch (err) {
      const errorMsg = err.error || err.message || "Failed to update profile"
      dispatch({ type: "USER_ERROR", payload: errorMsg })
      return null
    }
  }, [state.currentUser])

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
      try {
        // First try to refresh from auth endpoint (doesn't require user ID)
        try {
          console.log("Refreshing user data from auth endpoint");
          const authResponse = await apiService.get("/auth/me");
          if (authResponse.success && authResponse.data) {
            // Update our internal user state with the latest data
            dispatch({ 
              type: "UPDATE_PROFILE", 
              payload: authResponse.data 
            });
            console.log("User data refreshed from auth endpoint");
            
            // Also refresh the users list in the background
            getUsers().catch(err => console.error("Error refreshing users list:", err));
            return true;
          }
        } catch (authError) {
          console.warn("Could not refresh from auth endpoint", authError);
        }
        
        // If auth endpoint fails and we have a userId, try user API
        const idToUse = userId || (state.currentUser && state.currentUser._id);
        if (idToUse) {
          console.log(`Falling back to user API with ID: ${idToUse}`);
          const userData = await getUser(idToUse);
          if (userData) {
            console.log("User data refreshed from user API");
            // Also refresh the users list in the background
            getUsers().catch(err => console.error("Error refreshing users list:", err));
            return true;
          } else {
            console.error(`Failed to refresh user data for ID: ${idToUse}`);
          }
        } else {
          console.warn("No user ID available for refresh, using token-based refresh");
          
          // Last resort: try to get token from storage and extract user ID
          try {
            const token = sessionStorage.getItem("token") || localStorage.getItem("token");
            if (token) {
              const base64Url = token.split(".")[1];
              const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
              const payload = JSON.parse(atob(base64));
              
              const tokenId = payload.id || (payload.user && (payload.user._id || payload.user.id));
              if (tokenId) {
                console.log(`Using ID from token: ${tokenId}`);
                const userData = await getUser(tokenId);
                if (userData) {
                  console.log("User data refreshed from user API using token ID");
                  // Also refresh the users list in the background
                  getUsers().catch(err => console.error("Error refreshing users list:", err));
                  return true;
                }
              }
            }
          } catch (tokenErr) {
            console.error("Failed to extract ID from token", tokenErr);
          }
        }
        
        // Also refresh the users list in the background anyway
        getUsers().catch(err => console.error("Error refreshing users list:", err));
        
        return false;
      } catch (error) {
        console.error("Error in refreshUserData:", error);
        return false;
      }
    },
    [state.currentUser, getUser, getUsers, dispatch],
  )

  /**
   * Clear error state.
   */
  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" })
  }, [])

  /**
   * Check if a user is liked - FIXED VERSION
   * @param {string} userId - User ID to check.
   * @returns {boolean} True if user is liked, false otherwise.
   */
  const isUserLiked = useCallback(
    (userId) => {
      if (!state.likedUsers || !Array.isArray(state.likedUsers) || !userId) return false;

      // Normalize userId to string for consistent comparison
      const userIdStr = typeof userId === "object" && userId !== null
        ? userId.toString()
        : userId;

      // Robust checking for various formats
      return state.likedUsers.some((like) => {
        if (!like) return false;

        // Handle recipient as object (MongoDB document)
        if (typeof like.recipient === 'object' && like.recipient !== null) {
          if (like.recipient._id) {
            return like.recipient._id.toString() === userIdStr;
          }
          return like.recipient.toString() === userIdStr;
        }

        // Handle recipient as string
        return like.recipient === userIdStr;
      });
    },
    [state.likedUsers]
  );

  /**
   * Like a user - FIXED VERSION
   * @param {string} userId - User ID to like.
   * @param {string} userName - User name for toast message.
   * @returns {Promise<boolean>} Success status.
   */
  const likeUser = useCallback(
    async (userId, userName) => {
      if (!user || !user._id) return false;

      try {
        // Validate userId format
        if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
          toast.error("Invalid user ID format");
          return false;
        }

        // Skip if already liked to prevent duplicate API calls
        if (isUserLiked(userId)) {
          console.log(`User ${userId} is already liked, skipping API call`);
          return true;
        }

        // Optimistic update for better UX
        dispatch({
          type: "ADD_LIKED_USER",
          payload: {
            recipient: userId,
            createdAt: new Date().toISOString(),
          },
        });

        console.log(`Sending like request for user ${userId}`);
        const response = await apiService.post(
          `/users/${userId}/like`,
          {},
          { headers: { "x-no-cache": "true" } } // Force no caching
        );

        if (response.success) {
          // Force refresh likes to ensure consistent state
          getLikedUsers(true);

          // Show success notification with heart icon
          toast.success(
            <div className="like-toast">
              <FaHeart className="like-icon pulse" />
              <span>You liked {userName || "this user"}</span>
            </div>
          );

          // If free user, update remaining likes count
          if (response.likesRemaining !== undefined) {
            toast.info(`You have ${response.likesRemaining} likes remaining today`);
          }

          return true;
        } else {
          // Handle "Already liked" case specially
          if (response.error === "Already liked") {
            console.log("User already liked according to server");
            return true;
          }

          // Revert optimistic update on error
          dispatch({ type: "REMOVE_LIKED_USER", payload: userId });
          toast.error(response.error || "Failed to like user");
          return false;
        }
      } catch (err) {
        // Revert optimistic update on error
        dispatch({ type: "REMOVE_LIKED_USER", payload: userId });
        const errorMsg = err.error || err.message || "Failed to like user";
        toast.error(errorMsg);
        console.error("Like error:", err);
        return false;
      }
    },
    [user, isUserLiked, getLikedUsers, dispatch]
  );

  /**
   * Unlike a user - FIXED VERSION
   * @param {string} userId - User ID to unlike.
   * @param {string} userName - User name for toast message.
   * @returns {Promise<boolean>} Success status.
   */
  const unlikeUser = useCallback(
    async (userId, userName) => {
      if (!user || !user._id) return false;

      try {
        // Validate userId format
        if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
          toast.error("Invalid user ID format");
          return false;
        }

        // Skip if not liked to prevent unnecessary API calls
        if (!isUserLiked(userId)) {
          console.log(`User ${userId} is not liked, skipping API call`);
          return true;
        }

        // Optimistic update - remove from liked users immediately
        dispatch({ type: "REMOVE_LIKED_USER", payload: userId });

        console.log(`Sending unlike request for user ${userId}`);
        const response = await apiService.delete(
          `/users/${userId}/like`,
          {},
          { headers: { "x-no-cache": "true" } } // Force no caching
        );

        if (response.success) {
          // Force refresh likes to ensure consistent state
          getLikedUsers(true);
          toast.info(`You unliked ${userName || "this user"}`);
          return true;
        } else {
          // Revert optimistic update if failed
          dispatch({
            type: "ADD_LIKED_USER",
            payload: {
              recipient: userId,
              createdAt: new Date().toISOString(),
            },
          });

          throw new Error(response.error || "Failed to unlike user");
        }
      } catch (err) {
        // Force refresh likes to ensure consistent state
        getLikedUsers(true);
        const errorMsg = err.error || err.message || "Failed to unlike user";
        toast.error(errorMsg);
        console.error("Unlike error:", err);
        return false;
      }
    },
    [user, getLikedUsers, isUserLiked, dispatch]
  );

  /**
   * Send a message to a user.
   * @param {string} userId - User ID to message.
   * @returns {Promise<boolean>} Success status.
   */
  const sendMessage = useCallback(async (userId) => {
    // This function is a placeholder since it wasn't implemented in the original
    // but it's referenced in other components
    try {
      const response = await apiService.post(`/messages/start`, { recipient: userId });
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || "Failed to send message");
    } catch (err) {
      const errorMsg = err.error || err.message || "Failed to send message";
      dispatch({ type: "USER_ERROR", payload: errorMsg });
      return null;
    }
  }, []);

  /**
   * Block a user.
   * @param {string} userId - User ID to block.
   * @returns {Promise<boolean>} Success status.
   */
  const blockUser = useCallback(async (userId) => {
    // This function is a placeholder since it wasn't implemented in the original
    // but it's referenced in other components
    try {
      const response = await apiService.post(`/users/${userId}/block`);
      if (response.success) {
        toast.success("User blocked successfully");
        return true;
      }
      throw new Error(response.error || "Failed to block user");
    } catch (err) {
      const errorMsg = err.error || err.message || "Failed to block user";
      dispatch({ type: "USER_ERROR", payload: errorMsg });
      return false;
    }
  }, []);

  /**
   * Report a user.
   * @param {string} userId - User ID to report.
   * @returns {Promise<boolean>} Success status.
   */
  const reportUser = useCallback(async (userId) => {
    // This function is a placeholder since it wasn't implemented in the original
    // but it's referenced in other components
    try {
      const response = await apiService.post(`/users/${userId}/report`);
      if (response.success) {
        toast.success("User reported successfully");
        return true;
      }
      throw new Error(response.error || "Failed to report user");
    } catch (err) {
      const errorMsg = err.error || err.message || "Failed to report user";
      dispatch({ type: "USER_ERROR", payload: errorMsg });
      return false;
    }
  }, []);

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
        getLikedUsers,
        sendMessage,
        blockUser,
        reportUser
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
