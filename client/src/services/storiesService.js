// client/src/services/storiesService.js
import apiService from "./apiService"

const BASE_URL = "/stories"

/**
 * Get all stories
 * @returns {Promise<Object>} Response with stories data
 */
export const getAllStories = async () => {
  try {
    const response = await apiService.get(BASE_URL)

    // Handle old API format (raw array) for backwards compatibility
    if (Array.isArray(response)) {
      return {
        success: true,
        data: response
      }
    }

    return response
  } catch (error) {
    console.error("Error fetching stories:", error)
    return {
      success: false,
      message: error.message || "Failed to fetch stories"
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
        data: response
      }
    }

    return response
  } catch (error) {
    console.error(`Error fetching stories for user ${userId}:`, error)
    return {
      success: false,
      message: error.message || "Failed to fetch user stories"
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
  try {
    // Add a timestamp to prevent caching issues
    if (formData instanceof FormData) {
      formData.append("timestamp", Date.now().toString())
    } else {
      formData.timestamp = Date.now()
    }

    const response = await apiService.upload(BASE_URL, formData, onProgress)

    // Validate the response
    if (!response.success && !response.data) {
      throw new Error(response.message || "Failed to create story")
    }

    // Handle new and old API response formats
    return {
      success: true,
      data: response.data || response,
      message: "Story created successfully"
    }
  } catch (error) {
    console.error("Error creating story:", error)
    return {
      success: false,
      message: error.message || "Failed to create story"
    }
  }
}

/**
 * Create a text-only story
 * @param {Object} storyData - Story data
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Response with created story
 */
export const createTextStory = async (storyData, onProgress) => {
  try {
    // Add a timestamp to prevent caching issues
    const dataWithTimestamp = {
      ...storyData,
      timestamp: Date.now(),
    }

    const response = await apiService.post(`${BASE_URL}/text`, dataWithTimestamp, {
      onUploadProgress: onProgress,
    })

    // Check for error responses in various formats
    if (response && typeof response === 'object') {
      if (response.error) {
        throw new Error(response.error);
      }

      if (response.success === false) {
        throw new Error(response.message || "Failed to create text story");
      }
    }

    // For backwards compatibility, handle different response formats
    if (response.success) {
      return {
        success: true,
        data: response.data || response.story,
        message: "Story created successfully"
      };
    }

    // Handle old API that might return the story directly
    if (response._id) {
      return {
        success: true,
        data: response,
        message: "Story created successfully"
      };
    }

    return response;
  } catch (error) {
    console.error("Error creating text story:", error)
    return {
      success: false,
      message: error.message || "Failed to create text story"
    }
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
    if (response && !response.success && response.msg) {
      return {
        success: true,
        message: response.msg
      }
    }

    return response
  } catch (error) {
    console.error(`Error deleting story ${storyId}:`, error)
    return {
      success: false,
      message: error.message || "Failed to delete story"
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
        message: response.msg
      }
    }

    return response
  } catch (error) {
    console.error(`Error marking story ${storyId} as viewed:`, error)
    return {
      success: false,
      message: error.message || "Failed to mark story as viewed"
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
    return response
  } catch (error) {
    console.error(`Error reacting to story ${storyId}:`, error)
    return {
      success: false,
      message: error.message || "Failed to react to story"
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
      message: error.message || "Failed to fetch story reactions"
    }
  }
}

/**
 * Comment on a story
 * @param {string} storyId - Story ID
 * @param {string} comment - Comment text
 * @returns {Promise<Object>} Response with result
 */
export const commentOnStory = async (storyId, comment) => {
  try {
    const response = await apiService.post(`${BASE_URL}/${storyId}/comment`, { comment })
    return response
  } catch (error) {
    console.error(`Error commenting on story ${storyId}:`, error)
    return {
      success: false,
      message: error.message || "Failed to comment on story"
    }
  }
}

/**
 * Get comments for a story
 * @param {string} storyId - Story ID
 * @returns {Promise<Object>} Response with comments data
 */
export const getStoryComments = async (storyId) => {
  try {
    const response = await apiService.get(`${BASE_URL}/${storyId}/comments`)
    return response
  } catch (error) {
    console.error(`Error fetching comments for story ${storyId}:`, error)
    return {
      success: false,
      message: error.message || "Failed to fetch story comments"
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
  getStoryReactions,
  commentOnStory,
  getStoryComments,
}

export default storiesService
