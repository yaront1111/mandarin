// client/src/reducers/dashboardReducer.js
import { logger } from "../utils/logger";

const log = logger.create("dashboardReducer");

// Define action types as constants to avoid typos
export const ACTIONS = {
  // User data actions
  SET_USERS: "SET_USERS",
  APPEND_USERS: "APPEND_USERS", 
  SET_SELECTED_USER: "SET_SELECTED_USER",
  
  // Loading state actions
  SET_LOADING: "SET_LOADING",
  SET_ERROR: "SET_ERROR",
  CLEAR_ERROR: "CLEAR_ERROR", 
  SET_LOADING_MORE: "SET_LOADING_MORE",
  
  // Pagination actions 
  SET_PAGE: "SET_PAGE",
  SET_HAS_MORE: "SET_HAS_MORE",
  
  // View mode actions
  SET_VIEW_MODE: "SET_VIEW_MODE",
  TOGGLE_FILTER_PANEL: "TOGGLE_FILTER_PANEL",
  
  // Filter actions
  SET_FILTER: "SET_FILTER",
  RESET_FILTERS: "RESET_FILTERS",
  
  // Modal actions
  TOGGLE_PROFILE_MODAL: "TOGGLE_PROFILE_MODAL",
  TOGGLE_STORY_CREATOR: "TOGGLE_STORY_CREATOR",
  TOGGLE_STORY_VIEWER: "TOGGLE_STORY_VIEWER"
};

// Default filter values
const defaultFilters = {
  gender: "all",
  minAge: 18,
  maxAge: 99, 
  distance: 100,
  onlineOnly: false,
  withPhotosOnly: false,
  withStoriesOnly: false,
  keyword: ""
};

// Initial state
export const initialState = {
  // User data
  users: [],
  selectedUser: null,
  
  // Pagination
  page: 1,
  hasMore: true,
  
  // Loading states
  loading: true,
  loadingMore: false,
  error: null,
  
  // UI state
  viewMode: "grid", // grid or list
  showFilterPanel: false,
  
  // Filters
  filters: { ...defaultFilters },
  
  // Modals
  showProfileModal: false,
  showStoryCreator: false,
  showStoryViewer: false,
  activeStoryId: null
};

/**
 * Reducer for dashboard state
 * @param {Object} state - Current state
 * @param {Object} action - Action to perform
 * @returns {Object} New state
 */
export function dashboardReducer(state, action) {
  const { type, payload } = action;
  
  try {
    switch (type) {
      // User data actions
      case ACTIONS.SET_USERS:
        return {
          ...state,
          users: payload,
          loading: false
        };
        
      case ACTIONS.APPEND_USERS:
        return {
          ...state,
          users: [...state.users, ...payload],
          loadingMore: false
        };
        
      case ACTIONS.SET_SELECTED_USER:
        return {
          ...state,
          selectedUser: payload
        };
        
      // Loading state actions
      case ACTIONS.SET_LOADING:
        return {
          ...state,
          loading: payload
        };
        
      case ACTIONS.SET_ERROR:
        return {
          ...state,
          error: payload,
          loading: false,
          loadingMore: false
        };
        
      case ACTIONS.CLEAR_ERROR:
        return {
          ...state,
          error: null
        };
        
      case ACTIONS.SET_LOADING_MORE:
        return {
          ...state,
          loadingMore: payload
        };
        
      // Pagination actions
      case ACTIONS.SET_PAGE:
        return {
          ...state,
          page: payload
        };
        
      case ACTIONS.SET_HAS_MORE:
        return {
          ...state,
          hasMore: payload
        };
        
      // View mode actions
      case ACTIONS.SET_VIEW_MODE:
        return {
          ...state,
          viewMode: payload
        };
        
      case ACTIONS.TOGGLE_FILTER_PANEL:
        return {
          ...state,
          showFilterPanel: payload !== undefined ? payload : !state.showFilterPanel
        };
        
      // Filter actions
      case ACTIONS.SET_FILTER:
        return {
          ...state,
          filters: {
            ...state.filters,
            ...payload
          }
        };
        
      case ACTIONS.RESET_FILTERS:
        return {
          ...state,
          filters: { ...defaultFilters }
        };
        
      // Modal actions
      case ACTIONS.TOGGLE_PROFILE_MODAL:
        return {
          ...state,
          showProfileModal: payload !== undefined ? payload : !state.showProfileModal,
          // If closing, also clear selected user
          selectedUser: payload === false ? null : state.selectedUser
        };
        
      case ACTIONS.TOGGLE_STORY_CREATOR:
        return {
          ...state,
          showStoryCreator: payload !== undefined ? payload : !state.showStoryCreator
        };
        
      case ACTIONS.TOGGLE_STORY_VIEWER:
        const showViewer = payload?.show !== undefined ? payload.show : !state.showStoryViewer;
        return {
          ...state,
          showStoryViewer: showViewer,
          activeStoryId: payload?.storyId || (showViewer ? state.activeStoryId : null)
        };
        
      default:
        log.warn(`Unknown action type: ${type}`);
        return state;
    }
  } catch (error) {
    log.error(`Error in dashboardReducer:`, error);
    return {
      ...state,
      error: error.message || "An error occurred in the reducer"
    };
  }
}

// Action creators
export const setUsers = (users) => ({
  type: ACTIONS.SET_USERS,
  payload: users
});

export const appendUsers = (users) => ({
  type: ACTIONS.APPEND_USERS,
  payload: users
});

export const setSelectedUser = (user) => ({
  type: ACTIONS.SET_SELECTED_USER,
  payload: user
});

export const setLoading = (isLoading) => ({
  type: ACTIONS.SET_LOADING,
  payload: isLoading
});

export const setLoadingMore = (isLoading) => ({
  type: ACTIONS.SET_LOADING_MORE,
  payload: isLoading
});

export const setError = (error) => ({
  type: ACTIONS.SET_ERROR,
  payload: error
});

export const clearError = () => ({
  type: ACTIONS.CLEAR_ERROR
});

export const setPage = (page) => ({
  type: ACTIONS.SET_PAGE,
  payload: page
});

export const setHasMore = (hasMore) => ({
  type: ACTIONS.SET_HAS_MORE,
  payload: hasMore
});

export const setFilter = (filter) => ({
  type: ACTIONS.SET_FILTER,
  payload: filter
});

export const resetFilters = () => ({
  type: ACTIONS.RESET_FILTERS
});

export const setViewMode = (mode) => ({
  type: ACTIONS.SET_VIEW_MODE,
  payload: mode
});

export const toggleFilterPanel = (show) => ({
  type: ACTIONS.TOGGLE_FILTER_PANEL,
  payload: show
});

export const toggleProfileModal = (show) => ({
  type: ACTIONS.TOGGLE_PROFILE_MODAL,
  payload: show
});

export const toggleStoryCreator = (show) => ({
  type: ACTIONS.TOGGLE_STORY_CREATOR,
  payload: show
});

export const toggleStoryViewer = (show, storyId) => ({
  type: ACTIONS.TOGGLE_STORY_VIEWER,
  payload: { show, storyId }
});