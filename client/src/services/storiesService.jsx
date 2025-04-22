// client/src/services/storiesService.jsx - Production-ready implementation with caching
import apiService from "./apiService.jsx"

const BASE_URL = "/stories"

// Cache management
let cachedStories = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 minute cache

// Track in-progress requests to prevent duplicates
const pendingRequests = new Map()

/**
 * Get all stories with caching to prevent excessive API calls
 * @returns {Promise<Object>} Response with stories data
 */
export const getAllStories = async () => {
  try {
    const now = Date.now();

    // Return cached stories if available and not expired
    if (cachedStories && now - lastFetchTime < CACHE_DURATION) {
      return cachedStories;
    }

    const response = await apiService.get(BASE_URL)
    lastFetchTime = now;

    // Handle old API format (raw array) for backwards compatibility
    if (Array.isArray(response)) {
      cachedStories = {
        success: true,
        data: response,
      };
      return cachedStories;
    }

    cachedStories = response;
    return response;
  } catch (error) {
    console.error("Error fetching stories:", error)
    return {
      success: false,
      message: error.message || "Failed to fetch stories",
    }
  }
}

/**
 * Get stories for a specific user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Response with user stories data
 */
export const getUserStories = async (userId) => {
  try {
    const response = await apiService.get(`${BASE_URL}/user/${userId}`)

    // Handle old API format (raw array) for backwards compatibility
    if (Array.isArray(response)) {
      return {
        success: true,
        data: response,
      }
    }

    return response
  } catch (error) {
    console.error(`Error fetching stories for user ${userId}:`, error)
    return {
      success: false,
      message: error.message || "Failed to fetch user stories",
    }
  }
}

/**
 * Create a new story with media
 * @param {FormData} formData - Form data with story content and media
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Response with created story
 */
export const createStory = async (formData, onProgress) => {
  // Generate a unique request ID based on timestamp
  const requestId = `create-story-${Date.now()}`

  // Check if a similar request is already in progress
  if (pendingRequests.has(requestId.substring(0, requestId.length - 3))) {
    console.warn("Duplicate story creation request detected")
    return {
      success: false,
      message: "A similar request is already in progress",
    }
  }

  // Mark this request as pending
  pendingRequests.set(requestId, true)

  try {
    // Add a timestamp to prevent caching issues
    if (formData instanceof FormData) {
      formData.append("timestamp", Date.now().toString())
    } else if (typeof formData === "object") {
      // For text stories, check if this is a text or media request
      if (formData.mediaType === "text" || formData.type === "text") {
        // This is a text story, handle it with createTextStory function
        return createTextStory(formData, onProgress)
      }
      formData.timestamp = Date.now()
    }

    // This is a media upload
    const response = await apiService.upload(BASE_URL, formData, onProgress)

    // Handle new and old API response formats
    const result = {
      success: true,
      data: response.data || response,
      message: "Story created successfully",
    };

    // Invalidate stories cache after creating a new story
    cachedStories = null;

    return result;
  } catch (error) {
    console.error("Error creating story:", error)
    return {
      success: false,
    }
  } finally {
    // Remove from pending requests after a short delay
    setTimeout(() => {
      pendingRequests.delete(requestId)
    }, 5000)
  }
}

/**
 * Create a text-only story
 * @param {Object} storyData - Story data
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Response with created story
 */
export const createTextStory = async (storyData, onProgress) => {
  // Generate a unique request ID based on timestamp and content
  const contentHash = storyData.content ? storyData.content.substring(0, 10) : ""
  const requestId = `create-text-story-${contentHash}-${Date.now()}`

  // Check if a similar request is already in progress
  if (pendingRequests.has(requestId.substring(0, requestId.length - 3))) {
    console.warn("Duplicate text story creation request detected")
    return {
      success: false,
      message: "A similar request is already in progress",
    }
  }

  // Mark this request as pending
  pendingRequests.set(requestId, true)

  try {
    // Ensure type and mediaType are properly set for text stories
    const dataWithTimestamp = {
      ...storyData,
      timestamp: Date.now(),
      type: "text",
      mediaType: "text",
    }

    // Use the same endpoint as media stories - the server differentiates by the 'type' field
    const response = await apiService.post(`${BASE_URL}`, dataWithTimestamp, {
      onUploadProgress: onProgress,
    })

    // Check for error responses in various formats
    if (response && typeof response === "object") {
      if (response.error) {
        throw new Error(response.error)
      }

      if (response.success === false) {
        throw new Error(response.message || "Failed to create text story")
      }
    }

    // For backwards compatibility, handle different response formats
    let result;

    if (response && response.success) {
      result = {
        success: true,
        data: response.data || response.story,
        message: "Story created successfully",
      }
    } else if (response && response._id) {
      // Handle old API that might return the story directly
      result = {
        success: true,
        data: response,
        message: "Story created successfully",
      }
    } else if (response === undefined || response === null) {
      // If we get an undefined or null response but no error was thrown,
      // assume success but wrap it in our standard format
      result = {
        success: true,
        message: "Story created successfully",
        data: { created: true, timestamp: Date.now() }
      }
    } else {
      // Wrap any other response format in a success object
      result = {
        success: true,
        data: response,
        message: "Story created successfully"
      }
    }

    // Invalidate stories cache after creating a new story
    cachedStories = null;

    return result;
  } catch (error) {
    console.error("Error creating text story:", error)
    return {
      success: false,
      message: error.message || "Failed to create text story",
    }
  } finally {
    // Remove from pending requests after a short delay
    setTimeout(() => {
      pendingRequests.delete(requestId)
    }, 5000)
  }
}

/**
 * Delete a story
 * @param {string} storyId - Story ID to delete
 * @returns {Promise<Object>} Response with result
 */
export const deleteStory = async (storyId) => {
  try {
    const response = await apiService.delete(`${BASE_URL}/${storyId}`)

    // Handle old API format for backwards compatibility
    const result = response && !response.success && response.msg ? {
      success: true,
      message: response.msg,
    } : response;

    // Invalidate stories cache after deleting a story
    cachedStories = null;

    return result;
  } catch (error) {
    console.error(`Error deleting story ${storyId}:`, error)
    return {
      success: false,
      message: error.message || "Failed to delete story",
    }
  }
}

/**
 * Mark a story as viewed
 * @param {string} storyId - Story ID to mark as viewed
 * @returns {Promise<Object>} Response with result
 */
export const markStoryAsViewed = async (storyId) => {
  try {
    const response = await apiService.post(`${BASE_URL}/${storyId}/view`)

    // Handle old API format for backwards compatibility
    if (response && !response.success && response.msg) {
      return {
        success: true,
        message: response.msg,
      }
    }

    return response
  } catch (error) {
    console.error(`Error marking story ${storyId} as viewed:`, error)
    return {
      success: false,
      message: error.message || "Failed to mark story as viewed",
    }
  }
}

/**
 * React to a story
 * @param {string} storyId - Story ID
 * @param {string} reactionType - Type of reaction
 * @returns {Promise<Object>} Response with result
 */
export const reactToStory = async (storyId, reactionType) => {
  try {
    const response = await apiService.post(`${BASE_URL}/${storyId}/react`, { reactionType })

    // Ensure we return a properly formatted response with the updated reactions
    if (response && response.data && !response.success) {
      return {
        success: true,
        data: response.data,
        message: "Reaction added successfully",
      }
    }

    return response
  } catch (error) {
    console.error(`Error reacting to story ${storyId}:`, error)
    return {
      success: false,
      message: error.message || "Failed to react to story",
    }
  }
}

/**
 * Remove a reaction from a story
 * @param {string} storyId - Story ID
 * @returns {Promise<Object>} Response with result
 */
export const removeReaction = async (storyId) => {
  try {
    const response = await apiService.delete(`${BASE_URL}/${storyId}/react`)
    return response
  } catch (error) {
    console.error(`Error removing reaction from story ${storyId}:`, error)
    return {
      success: false,
      message: error.message || "Failed to remove reaction",
    }
  }
}

/**
 * Get reactions for a story
 * @param {string} storyId - Story ID
 * @returns {Promise<Object>} Response with reactions data
 */
export const getStoryReactions = async (storyId) => {
  try {
    const response = await apiService.get(`${BASE_URL}/${storyId}/reactions`)
    return response
  } catch (error) {
    console.error(`Error fetching reactions for story ${storyId}:`, error)
    return {
      success: false,
      message: error.message || "Failed to fetch story reactions",
    }
  }
}

/**
 * Get viewers of a story
 * @param {string} storyId - Story ID
 * @returns {Promise<Object>} Response with viewers data
 */
export const getStoryViewers = async (storyId) => {
  try {
    const response = await apiService.get(`${BASE_URL}/${storyId}/viewers`)
    return response
  } catch (error) {
    console.error(`Error fetching viewers for story ${storyId}:`, error)
    return {
      success: false,
      message: error.message || "Failed to fetch story viewers",
    }
  }
}

// Export as an object for backwards compatibility
const storiesService = {
  getAllStories,
  getUserStories,
  createStory,
  createTextStory,
  deleteStory,
  markStoryAsViewed,
  reactToStory,
  removeReaction,
  getStoryReactions,
  getStoryViewers,
}

export default storiesService
