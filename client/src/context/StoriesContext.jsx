"use client"

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react"
import debounce from "lodash.debounce"
import storiesService from "@services/storiesService.jsx"
import { useAuth } from "./AuthContext"
import { toast } from "react-toastify"
import logger from "../utils/logger"

const log = logger.create("StoriesContext")
const StoriesContext = createContext()

const initialState = {
  stories: [],
  loading: false,
  error: null,
  viewedStories: {},      // { [storyId]: timestamp }
  isCreating: false,
}

function reducer(state, action) {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true, error: null }
    case "LOAD_SUCCESS":
      return { ...state, loading: false, stories: action.payload, error: null }
    case "LOAD_ERROR":
      return { ...state, loading: false, error: action.payload }
    case "ADD_STORY":
      return {
        ...state,
        stories: state.stories.some(s => s._id === action.payload._id)
          ? state.stories
          : [action.payload, ...state.stories],
      }
    case "REMOVE_STORY":
      return {
        ...state,
        stories: state.stories.filter(s => s._id !== action.payload),
      }
    case "CREATE_START":
      return { ...state, isCreating: true }
    case "CREATE_END":
      return { ...state, isCreating: false }
    case "VIEW_STORY":
      return {
        ...state,
        viewedStories: {
          ...state.viewedStories,
          [action.payload]: Date.now(),
        },
      }
    default:
      return state
  }
}

export function StoriesProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const [state, dispatch] = useReducer(reducer, initialState)
  const lastFetchRef = useRef(0)
  const opsRef = useRef(new Map())
  const refreshIntervalRef = useRef(null)

  // Load all stories with caching & dedupe
  const loadStories = useCallback(
    async (force = false) => {
      const now = Date.now()
      if (!force && state.stories.length > 0 && now - lastFetchRef.current < 60_000) {
        return state.stories
      }
      const key = "loadStories"
      if (opsRef.current.has(key)) {
        return opsRef.current.get(key)
      }
      const promise = (async () => {
        dispatch({ type: "LOAD_START" })
        try {
          const res = await storiesService.getAllStories()
          if (!res.success) throw new Error(res.message || "Failed to load stories")
          
          // Process stories to ensure proper userData for frontend
          const processedStories = res.data.map(story => {
            // Add debug information for story data structure
            if (process.env.NODE_ENV !== 'production') {
              log.debug(`Processing story ${story._id}:`, {
                hasPopulatedUser: story.user && typeof story.user === 'object',
                hasUserData: !!story.userData,
                userType: typeof story.user,
                userKeys: story.user && typeof story.user === 'object' ? Object.keys(story.user) : []
              });
            }
            
            // If the story has a populated user object but no userData,
            // we should create userData from the user object
            if (story.user && typeof story.user === 'object') {
              // If userData doesn't exist, create it
              if (!story.userData) {
                return {
                  ...story,
                  userData: { 
                    ...story.user,
                    // Ensure _id is present 
                    _id: story.user._id || story._id
                  }
                };
              } 
              // If userData exists but doesn't have _id, add it
              else if (typeof story.userData === 'object' && !story.userData._id) {
                return {
                  ...story,
                  userData: { 
                    ...story.userData,
                    _id: story.user._id || story._id
                  }
                };
              }
            }
            
            // If story has a string user ID but no userData, create minimal userData
            if (typeof story.user === 'string' && !story.userData) {
              return {
                ...story,
                userData: { 
                  _id: story.user,
                  // If we have nickname in the story, add it to userData
                  ...(story.nickname && { nickname: story.nickname })
                }
              };
            }
            
            // If userData exists but doesn't have _id and user is a string, add it
            if (story.userData && typeof story.userData === 'object' && 
                !story.userData._id && typeof story.user === 'string') {
              return {
                ...story,
                userData: {
                  ...story.userData,
                  _id: story.user
                }
              };
            }
            
            return story;
          });
          
          // dedupe by _id
          const unique = Array.from(
            new Map(processedStories.map(s => [s._id, s])).values()
          )
          
          lastFetchRef.current = Date.now()
          dispatch({ type: "LOAD_SUCCESS", payload: unique })
          return unique
        } catch (err) {
          dispatch({ type: "LOAD_ERROR", payload: err.message })
          return []
        } finally {
          opsRef.current.delete(key)
        }
      })()
      opsRef.current.set(key, promise)
      return promise
    },
    [state.stories]
  )

  // Debounced loader
  const debouncedLoadStories = useMemo(
    () => debounce(loadStories, 300),
    [loadStories]
  )

  // Load stories for specific user
  const loadUserStories = useCallback(userId => {
    if (!userId) return Promise.resolve([])
    const key = `loadUserStories:${userId}`
    if (opsRef.current.has(key)) {
      return opsRef.current.get(key)
    }
    const promise = (async () => {
      dispatch({ type: "LOAD_START" })
      try {
        const res = await storiesService.getUserStories(userId)
        if (!res.success) throw new Error(res.message || "Failed to load user stories")
        
        // Process stories to ensure proper userData - using same enhanced logic as getAllStories
        const processedStories = Array.isArray(res.data) ? res.data.map(story => {
          // Add debug information for story data structure
          if (process.env.NODE_ENV !== 'production') {
            log.debug(`Processing user story ${story._id}:`, {
              hasPopulatedUser: story.user && typeof story.user === 'object',
              hasUserData: !!story.userData,
              userType: typeof story.user,
              userKeys: story.user && typeof story.user === 'object' ? Object.keys(story.user) : []
            });
          }
          
          // If the story has a populated user object with _id
          if (story.user && typeof story.user === 'object') {
            // If userData doesn't exist, create it
            if (!story.userData) {
              return {
                ...story,
                userData: { 
                  ...story.user,
                  // Ensure _id is present 
                  _id: story.user._id || story._id || userId // Use userId as fallback
                }
              };
            } 
            // If userData exists but doesn't have _id, add it
            else if (typeof story.userData === 'object' && !story.userData._id) {
              return {
                ...story,
                userData: { 
                  ...story.userData,
                  _id: story.user._id || story._id || userId
                }
              };
            }
          }
          
          // If story has a string user ID but no userData, create minimal userData
          if (typeof story.user === 'string' && !story.userData) {
            return {
              ...story,
              userData: { 
                _id: story.user,
                // If we have nickname in the story, add it to userData
                ...(story.nickname && { nickname: story.nickname })
              }
            };
          }
          
          // If userData exists but doesn't have _id and user is a string, add it
          if (story.userData && typeof story.userData === 'object' && 
              !story.userData._id && typeof story.user === 'string') {
            return {
              ...story,
              userData: {
                ...story.userData,
                _id: story.user
              }
            };
          }
          
          // For user stories specifically, if all else fails, ensure userData exists with at least the userID
          if (!story.userData) {
            return {
              ...story,
              userData: { _id: userId }
            };
          }
          
          return story;
        }) : [];
        
        return processedStories
      } catch (err) {
        log.error(`loadUserStories(${userId})`, err)
        return []
      } finally {
        dispatch({ type: "LOAD_SUCCESS", payload: state.stories })
        opsRef.current.delete(key)
      }
    })()
    opsRef.current.set(key, promise)
    return promise
  }, [state.stories])

  // Create a new story
  const createStory = useCallback(
    async (storyData, onProgress) => {
      log.debug("createStory");
      if (!isAuthenticated) {
        toast.error("Login required to create stories");
        return { success: false };
      }
      if (state.isCreating) return;
      dispatch({ type: "CREATE_START" });
      try {
        const normalize = { ...storyData };
        if (normalize.mediaType === "text" && !normalize.content) {
          throw new Error("Text stories require content");
        }
        const res =
          normalize.mediaType === "text"
            ? await storiesService.createTextStory(normalize, onProgress)
            : await storiesService.createStory(normalize, onProgress);
            
        if (!res) {
          throw new Error("No response from server");
        }
        
        // If the message indicates a rate limit, handle it specially
        if (res.message && res.message.includes("wait") && !res.success) {
          toast.info(res.message);
          return res;
        }
        
        if (!res.success) throw new Error(res.message || "Failed to create story");
        
        const newStory = res.data || res.story;
        if (!newStory) throw new Error("No story returned from API");
        
        dispatch({ type: "ADD_STORY", payload: newStory });
        return res;
      } catch (err) {
        // Handle rate limiting error specially
        if (err.status === 429 || (err && err.data && err.data.status === 429)) {
          // Use server message if available, otherwise show a default message
          const serverMsg = err.data?.message || err.data?.error;
          const cooldownMessage = serverMsg || "Please wait before posting another story";
          toast.error(cooldownMessage);
          log.error("createStory rate limited", err);
          return { success: false, message: cooldownMessage };
        } else {
          toast.error(err.message);
          log.error("createStory", err);
          return { success: false, message: err.message };
        }
      } finally {
        dispatch({ type: "CREATE_END" });
      }
    },
    [isAuthenticated, state.isCreating]
  )

  // Delete a story
  const deleteStory = useCallback(
    async storyId => {
      if (!isAuthenticated) {
        toast.error("Login required to delete stories")
        return { success: false }
      }
      if (!storyId) {
        toast.error("Invalid story ID")
        return { success: false }
      }
      const key = `deleteStory:${storyId}`
      if (opsRef.current.has(key)) return opsRef.current.get(key)
      const promise = (async () => {
        dispatch({ type: "LOAD_START" })
        try {
          const res = await storiesService.deleteStory(storyId)
          if (!res.success) throw new Error(res.message || "Failed to delete story")
          dispatch({ type: "REMOVE_STORY", payload: storyId })
          toast.success("Story deleted")
          return res
        } catch (err) {
          toast.error(err.message)
          log.error("deleteStory", err)
          return { success: false, message: err.message }
        } finally {
          opsRef.current.delete(key)
          dispatch({ type: "LOAD_SUCCESS", payload: state.stories })
        }
      })()
      opsRef.current.set(key, promise)
      return promise
    },
    [isAuthenticated, state.stories]
  )

  // Mark story viewed
  const viewStory = useCallback(
    storyId => {
      if (!isAuthenticated || !storyId) return Promise.resolve(false)
      const key = `viewStory:${storyId}`
      if (opsRef.current.has(key)) return opsRef.current.get(key)
      const promise = (async () => {
        try {
          const res = await storiesService.markStoryAsViewed(storyId)
          if (!res.success) throw new Error(res.message || "Failed to mark viewed")
          dispatch({ type: "VIEW_STORY", payload: storyId })
          return true
        } catch (err) {
          log.error("viewStory", err)
          return false
        } finally {
          opsRef.current.delete(key)
        }
      })()
      opsRef.current.set(key, promise)
      return promise
    },
    [isAuthenticated]
  )

  // React to story
  const reactToStory = useCallback(
    (storyId, reactionType) => {
      if (!isAuthenticated || !storyId || !reactionType) {
        toast.error("Invalid reaction")
        return Promise.resolve({ success: false })
      }
      const key = `reactToStory:${storyId}:${reactionType}`
      if (opsRef.current.has(key)) return opsRef.current.get(key)
      const promise = (async () => {
        try {
          const res = await storiesService.reactToStory(storyId, reactionType)
          if (!res.success) throw new Error(res.message || "Failed to react")
          toast.success("Reaction recorded")
          return res
        } catch (err) {
          toast.error(err.message)
          log.error("reactToStory", err)
          return { success: false }
        } finally {
          opsRef.current.delete(key)
        }
      })()
      opsRef.current.set(key, promise)
      return promise
    },
    [isAuthenticated]
  )

  // Check unviewed
  const hasUnviewedStories = useCallback(
    userId => {
      if (!userId) return false
      return state.stories.some(
        s =>
          String(s.user?._id || s.user) === String(userId) &&
          !state.viewedStories[s._id]
      )
    },
    [state.stories, state.viewedStories]
  )

  const clearError = useCallback(() => {
    dispatch({ type: "LOAD_ERROR", payload: null })
  }, [])

  // Load & save viewedStories from localStorage
  useEffect(() => {
    if (!user?._id) return
    try {
      const key = `viewedStories:${user._id}`
      const stored = JSON.parse(localStorage.getItem(key) || "{}")
      dispatch({ type: "VIEW_STORY", payload: null }) // no-op to ensure state exists
      if (stored && typeof stored === "object") {
        for (const [id, ts] of Object.entries(stored)) {
          dispatch({ type: "VIEW_STORY", payload: id })
        }
      }
    } catch (err) {
      log.error("load viewedStories", err)
    }
  }, [user])

  useEffect(() => {
    if (!user?._id) return
    const save = () => {
      try {
        localStorage.setItem(
          `viewedStories:${user._id}`,
          JSON.stringify(state.viewedStories)
        )
      } catch (err) {
        log.error("save viewedStories", err)
      }
    }
    const debouncedSave = debounce(save, 1000)
    debouncedSave()
    return () => debouncedSave.flush()
  }, [state.viewedStories, user])

  // Periodic refresh
  useEffect(() => {
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    if (!isAuthenticated) return
    const initTimeout = setTimeout(() => debouncedLoadStories(false), 500)
    refreshIntervalRef.current = setInterval(
      () => {
        if (document.visibilityState === "visible") {
          debouncedLoadStories(true)
        }
      },
      5 * 60_000
    )
    return () => {
      clearTimeout(initTimeout)
      clearInterval(refreshIntervalRef.current)
    }
  }, [isAuthenticated, debouncedLoadStories])

  const value = useMemo(
    () => ({
      stories: state.stories,
      loading: state.loading,
      error: state.error,
      viewedStories: state.viewedStories,
      isCreating: state.isCreating,
      clearError,
      loadStories,
      loadUserStories,
      createStory,
      deleteStory,
      viewStory,
      reactToStory,
      hasUnviewedStories,
    }),
    [
      state,
      clearError,
      loadStories,
      loadUserStories,
      createStory,
      deleteStory,
      viewStory,
      reactToStory,
      hasUnviewedStories,
    ]
  )

  return (
    <StoriesContext.Provider value={value}>
      {children}
    </StoriesContext.Provider>
  )
}

export function useStories() {
  const ctx = useContext(StoriesContext)
  if (!ctx) throw new Error("useStories must be used within StoriesProvider")
  return ctx
}

export default StoriesContext
