// client/src/context/UserContext.js
import React, { createContext, useReducer, useContext, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import apiService from '../services/apiService';
import { useAuth } from './AuthContext';

// Create user context
const UserContext = createContext();

/**
 * User reducer to handle user state changes
 */
const userReducer = (state, action) => {
  switch (action.type) {
    case 'GET_USERS':
      return { ...state, users: action.payload, loading: false };
    case 'GET_USER':
      return {
        ...state,
        currentUser: action.payload.user,
        messages: action.payload.messages,
        loading: false
      };
    case 'USER_ONLINE':
      return {
        ...state,
        users: state.users.map(user =>
          user._id === action.payload.userId ? {
            ...user,
            isOnline: true,
            lastActive: Date.now()
          } : user
        ),
        // Also update currentUser if it matches
        currentUser: state.currentUser && state.currentUser._id === action.payload.userId
          ? { ...state.currentUser, isOnline: true, lastActive: Date.now() }
          : state.currentUser
      };
    case 'USER_OFFLINE':
      return {
        ...state,
        users: state.users.map(user =>
          user._id === action.payload.userId ? {
            ...user,
            isOnline: false,
            lastActive: Date.now()
          } : user
        ),
        // Also update currentUser if it matches
        currentUser: state.currentUser && state.currentUser._id === action.payload.userId
          ? { ...state.currentUser, isOnline: false, lastActive: Date.now() }
          : state.currentUser
      };
    case 'UPLOAD_PHOTO':
      return {
        ...state,
        currentUser: state.currentUser ? {
          ...state.currentUser,
          photos: [...(state.currentUser.photos || []), action.payload]
        } : state.currentUser,
        uploadingPhoto: false
      };
    case 'UPLOADING_PHOTO':
      return { ...state, uploadingPhoto: true };
    case 'PHOTO_PERMISSION_REQUESTED':
      return {
        ...state,
        photoPermissions: [...state.photoPermissions, action.payload]
      };
    case 'PHOTO_PERMISSION_UPDATED':
      return {
        ...state,
        photoPermissions: state.photoPermissions.map(permission =>
          permission._id === action.payload._id ? action.payload : permission
        )
      };
    case 'UPDATE_PROFILE':
      return {
        ...state,
        currentUser: { ...state.currentUser, ...action.payload },
        updatingProfile: false
      };
    case 'UPDATING_PROFILE':
      return { ...state, updatingProfile: true };
    case 'USER_ERROR':
      toast.error(action.payload);
      return {
        ...state,
        error: action.payload,
        loading: false,
        uploadingPhoto: false,
        updatingProfile: false
      };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
};

/**
 * User provider component
 */
export const UserProvider = ({ children }) => {
  const initialState = {
    users: [],
    currentUser: null,
    messages: [],
    photoPermissions: [],
    loading: false,
    uploadingPhoto: false,
    updatingProfile: false,
    error: null,
  };

  const [state, dispatch] = useReducer(userReducer, initialState);
  const { user, isAuthenticated } = useAuth();

  // Debounced getUsers function to prevent excessive API calls
  const debouncedGetUsers = useCallback(
    (() => {
      let timeout;
      return () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          if (isAuthenticated && user) {
            getUsers();
          }
        }, 500);
      };
    })(),
    [isAuthenticated, user]
  );

  // Initial data loading if user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      debouncedGetUsers();
    }
  }, [isAuthenticated, user, debouncedGetUsers]);

  /**
   * Get all online users
   * @returns {Promise<void>}
   */
  const getUsers = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const data = await apiService.get('/users');

      if (data.success) {
        dispatch({ type: 'GET_USERS', payload: data.data });
      } else {
        throw new Error(data.error || 'Failed to fetch users');
      }
    } catch (err) {
      const errorMsg = err.error || err.message || 'Failed to fetch users';
      dispatch({ type: 'USER_ERROR', payload: errorMsg });
    }
  };

  /**
   * Get a specific user and message history
   * @param {string} id - User ID
   * @returns {Promise<void>}
   */
  const getUser = async (id) => {
    if (!id) return;

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const data = await apiService.get(`/users/${id}`);

      if (data.success) {
        dispatch({ type: 'GET_USER', payload: data.data });
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to fetch user');
      }
    } catch (err) {
      const errorMsg = err.error || err.message || 'Failed to fetch user';
      dispatch({ type: 'USER_ERROR', payload: errorMsg });
      return null;
    }
  };

  /**
   * Update user profile
   * @param {Object} profileData - Profile data to update
   * @returns {Promise<Object|null>} - Updated profile or null if failed
   */
  const updateProfile = async (profileData) => {
    dispatch({ type: 'UPDATING_PROFILE', payload: true });

    try {
      const data = await apiService.put('/users/profile', profileData);

      if (data.success) {
        dispatch({ type: 'UPDATE_PROFILE', payload: data.data });
        toast.success('Profile updated successfully');
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to update profile');
      }
    } catch (err) {
      const errorMsg = err.error || err.message || 'Failed to update profile';
      dispatch({ type: 'USER_ERROR', payload: errorMsg });
      return null;
    }
  };

  /**
   * Upload a photo
   * @param {File} file - Photo file
   * @param {boolean} isPrivate - Whether the photo is private
   * @returns {Promise<Object|null>} - Uploaded photo or null if failed
   */
  const uploadPhoto = async (file, isPrivate) => {
    dispatch({ type: 'UPLOADING_PHOTO', payload: true });

    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('isPrivate', isPrivate);

      // Using upload method from apiService for progress tracking
      const data = await apiService.upload('/users/photos', formData, (progress) => {
        // Optional: show upload progress
        console.log(`Upload progress: ${progress}%`);
      });

      if (data.success) {
        dispatch({ type: 'UPLOAD_PHOTO', payload: data.data });
        toast.success(`${isPrivate ? 'Private' : 'Public'} photo uploaded successfully`);
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to upload photo');
      }
    } catch (err) {
      const errorMsg = err.error || err.message || 'Failed to upload photo';
      dispatch({ type: 'USER_ERROR', payload: errorMsg });
      return null;
    }
  };

  /**
   * Request permission to view a private photo
   * @param {string} photoId - Photo ID
   * @param {string} userId - User ID who owns the photo
   * @returns {Promise<Object|null>} - Permission request or null if failed
   */
  const requestPhotoPermission = async (photoId, userId) => {
    try {
      const data = await apiService.post(`/photos/${photoId}/request`, { userId });

      if (data.success) {
        dispatch({ type: 'PHOTO_PERMISSION_REQUESTED', payload: data.data });
        toast.success('Photo access request sent');
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to request photo access');
      }
    } catch (err) {
      const errorMsg = err.error || err.message || 'Failed to request photo access';
      dispatch({ type: 'USER_ERROR', payload: errorMsg });
      return null;
    }
  };

  /**
   * Update a photo permission request (approve/reject)
   * @param {string} permissionId - Permission ID
   * @param {string} status - Status (approved/rejected)
   * @returns {Promise<Object|null>} - Updated permission or null if failed
   */
  const updatePhotoPermission = async (permissionId, status) => {
    try {
      const data = await apiService.put(`/photos/permissions/${permissionId}`, { status });

      if (data.success) {
        dispatch({ type: 'PHOTO_PERMISSION_UPDATED', payload: data.data });
        toast.success(`Photo access ${status}`);
        return data.data;
      } else {
        throw new Error(data.error || `Failed to ${status} photo access`);
      }
    } catch (err) {
      const errorMsg = err.error || err.message || `Failed to ${status} photo access`;
      dispatch({ type: 'USER_ERROR', payload: errorMsg });
      return null;
    }
  };

  /**
   * Refresh user data
   * @param {string} userId - User ID (optional, defaults to currentUser)
   */
  const refreshUserData = useCallback(async (userId = null) => {
    if (userId) {
      await getUser(userId);
    } else if (state.currentUser) {
      await getUser(state.currentUser._id);
    }

    // Also refresh the users list
    await getUsers();
  }, [state.currentUser]);

  /**
   * Clear error state
   */
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

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
        getUsers,
        getUser,
        updateProfile,
        uploadPhoto,
        requestPhotoPermission,
        updatePhotoPermission,
        refreshUserData,
        clearError,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

/**
 * Custom hook to use user context
 * @returns {Object} - User context
 */
export const useUser = () => {
  const context = useContext(UserContext);

  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }

  return context;
};
