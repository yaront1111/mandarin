// client/src/reducers/profileModalReducer.js
import { logger } from "../utils/logger";

const log = logger.create("profileModalReducer");

// Define action types as constants to avoid typos
export const ACTIONS = {
  // Profile data
  SET_USER_PROFILE: "SET_USER_PROFILE",
  SET_PHOTO_GALLERY: "SET_PHOTO_GALLERY",
  SET_SELECTED_PHOTO: "SET_SELECTED_PHOTO",
  
  // Loading states
  SET_LOADING: "SET_LOADING",
  SET_PHOTO_LOADING: "SET_PHOTO_LOADING",
  SET_ERROR: "SET_ERROR",
  CLEAR_ERROR: "CLEAR_ERROR",
  
  // UI state
  SET_ACTIVE_TAB: "SET_ACTIVE_TAB",
  TOGGLE_ACTION_MENU: "TOGGLE_ACTION_MENU",
  TOGGLE_CHAT: "TOGGLE_CHAT",
  TOGGLE_STORIES: "TOGGLE_STORIES",
  
  // User interactions
  SET_LIKE_STATUS: "SET_LIKE_STATUS",
  SET_LIKE_LOADING: "SET_LIKE_LOADING",
  SET_BLOCK_STATUS: "SET_BLOCK_STATUS",
  SET_BLOCK_LOADING: "SET_BLOCK_LOADING",
  
  // Photo gallery
  NEXT_PHOTO: "NEXT_PHOTO",
  PREV_PHOTO: "PREV_PHOTO",
  REQUEST_PHOTO_PERMISSION: "REQUEST_PHOTO_PERMISSION",
  SET_PERMISSION_LOADING: "SET_PERMISSION_LOADING",
  SET_PERMISSION_STATUS: "SET_PERMISSION_STATUS"
};

// Initial state
export const initialState = {
  // User data
  userProfile: null,
  photos: [],
  selectedPhoto: null,
  selectedPhotoIndex: -1,
  isLiked: false,
  isBlocked: false,
  
  // UI state
  activeTab: "profile", // profile, photos, about
  showActionMenu: false,
  showStories: false,
  isChatOpen: false,
  
  // Loading states
  loading: true,
  photoLoading: false,
  likeLoading: false,
  blockLoading: false,
  permissionLoading: false,
  error: null
};

/**
 * Reducer for user profile modal
 * @param {Object} state - Current state
 * @param {Object} action - Action to perform
 * @returns {Object} New state
 */
export function profileModalReducer(state, action) {
  const { type, payload } = action;
  
  try {
    switch (type) {
      // Profile data
      case ACTIONS.SET_USER_PROFILE:
        return {
          ...state,
          userProfile: payload,
          loading: false
        };
        
      case ACTIONS.SET_PHOTO_GALLERY:
        return {
          ...state,
          photos: payload,
          photoLoading: false
        };
        
      case ACTIONS.SET_SELECTED_PHOTO: {
        if (!payload) {
          return {
            ...state,
            selectedPhoto: null,
            selectedPhotoIndex: -1
          };
        }
        
        // If payload is a photo object
        if (payload._id) {
          const index = state.photos.findIndex(p => p._id === payload._id);
          return {
            ...state,
            selectedPhoto: payload,
            selectedPhotoIndex: index !== -1 ? index : state.selectedPhotoIndex
          };
        }
        
        // If payload is an index
        if (typeof payload === 'number') {
          if (payload >= 0 && payload < state.photos.length) {
            return {
              ...state,
              selectedPhoto: state.photos[payload],
              selectedPhotoIndex: payload
            };
          }
          return state;
        }
        
        return state;
      }
        
      // Loading states
      case ACTIONS.SET_LOADING:
        return {
          ...state,
          loading: payload
        };
        
      case ACTIONS.SET_PHOTO_LOADING:
        return {
          ...state,
          photoLoading: payload
        };
        
      case ACTIONS.SET_ERROR:
        return {
          ...state,
          error: payload,
          loading: false
        };
        
      case ACTIONS.CLEAR_ERROR:
        return {
          ...state,
          error: null
        };
        
      // UI state
      case ACTIONS.SET_ACTIVE_TAB:
        return {
          ...state,
          activeTab: payload
        };
        
      case ACTIONS.TOGGLE_ACTION_MENU:
        return {
          ...state,
          showActionMenu: payload !== undefined ? payload : !state.showActionMenu
        };
        
      case ACTIONS.TOGGLE_CHAT:
        return {
          ...state,
          isChatOpen: payload !== undefined ? payload : !state.isChatOpen
        };
        
      case ACTIONS.TOGGLE_STORIES:
        return {
          ...state,
          showStories: payload !== undefined ? payload : !state.showStories
        };
        
      // User interactions
      case ACTIONS.SET_LIKE_STATUS:
        return {
          ...state,
          isLiked: payload,
          likeLoading: false
        };
        
      case ACTIONS.SET_LIKE_LOADING:
        return {
          ...state,
          likeLoading: payload
        };
        
      case ACTIONS.SET_BLOCK_STATUS:
        return {
          ...state,
          isBlocked: payload,
          blockLoading: false
        };
        
      case ACTIONS.SET_BLOCK_LOADING:
        return {
          ...state,
          blockLoading: payload
        };
        
      // Photo gallery navigation
      case ACTIONS.NEXT_PHOTO: {
        if (state.photos.length === 0 || state.selectedPhotoIndex === -1) {
          return state;
        }
        
        const newIndex = (state.selectedPhotoIndex + 1) % state.photos.length;
        return {
          ...state,
          selectedPhoto: state.photos[newIndex],
          selectedPhotoIndex: newIndex
        };
      }
        
      case ACTIONS.PREV_PHOTO: {
        if (state.photos.length === 0 || state.selectedPhotoIndex === -1) {
          return state;
        }
        
        const newIndex = (state.selectedPhotoIndex - 1 + state.photos.length) % state.photos.length;
        return {
          ...state,
          selectedPhoto: state.photos[newIndex],
          selectedPhotoIndex: newIndex
        };
      }
        
      case ACTIONS.REQUEST_PHOTO_PERMISSION: {
        return {
          ...state,
          permissionLoading: true
        };
      }
        
      case ACTIONS.SET_PERMISSION_LOADING: {
        return {
          ...state,
          permissionLoading: payload
        };
      }
        
      case ACTIONS.SET_PERMISSION_STATUS: {
        // Update the permission status for a specific photo
        const { photoId, status } = payload;
        
        // Update the photo in the gallery
        const updatedPhotos = state.photos.map(photo => 
          photo._id === photoId 
            ? { ...photo, permissionStatus: status } 
            : photo
        );
        
        // Update the selected photo if it's the one we just updated
        const updatedSelectedPhoto = state.selectedPhoto && state.selectedPhoto._id === photoId
          ? { ...state.selectedPhoto, permissionStatus: status }
          : state.selectedPhoto;
        
        return {
          ...state,
          photos: updatedPhotos,
          selectedPhoto: updatedSelectedPhoto,
          permissionLoading: false
        };
      }
        
      default:
        log.warn(`Unknown action type: ${type}`);
        return state;
    }
  } catch (error) {
    log.error(`Error in profileModalReducer:`, error);
    return {
      ...state,
      error: error.message || "An error occurred in the reducer"
    };
  }
}

// Action creators
export const setUserProfile = (profile) => ({
  type: ACTIONS.SET_USER_PROFILE,
  payload: profile
});

export const setPhotoGallery = (photos) => ({
  type: ACTIONS.SET_PHOTO_GALLERY,
  payload: photos
});

export const setSelectedPhoto = (photo) => ({
  type: ACTIONS.SET_SELECTED_PHOTO,
  payload: photo
});

export const setLoading = (isLoading) => ({
  type: ACTIONS.SET_LOADING,
  payload: isLoading
});

export const setError = (error) => ({
  type: ACTIONS.SET_ERROR,
  payload: error
});

export const setActiveTab = (tab) => ({
  type: ACTIONS.SET_ACTIVE_TAB,
  payload: tab
});

export const toggleActionMenu = (show) => ({
  type: ACTIONS.TOGGLE_ACTION_MENU,
  payload: show
});

export const toggleChat = (show) => ({
  type: ACTIONS.TOGGLE_CHAT,
  payload: show
});

export const toggleStories = (show) => ({
  type: ACTIONS.TOGGLE_STORIES,
  payload: show
});

export const setLikeStatus = (isLiked) => ({
  type: ACTIONS.SET_LIKE_STATUS,
  payload: isLiked
});

export const nextPhoto = () => ({
  type: ACTIONS.NEXT_PHOTO
});

export const prevPhoto = () => ({
  type: ACTIONS.PREV_PHOTO
});