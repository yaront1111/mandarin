// client/src/services/storiesService.js
import apiService from "./apiService"

const BASE_URL = "/stories"

const storiesService = {
  // Get all stories (for feed)
  getAllStories: async () => {
    try {
      const response = await apiService.get(BASE_URL)
      return response
    } catch (error) {
      console.error("Error fetching stories:", error)
      return { success: false, message: error.message || "Failed to fetch stories" }
    }
  },

  // Get stories for a specific user
  getUserStories: async (userId) => {
    try {
      const response = await apiService.get(`${BASE_URL}/user/${userId}`)
      return response
    } catch (error) {
      console.error(`Error fetching stories for user ${userId}:`, error)
      return { success: false, message: error.message || "Failed to fetch user stories" }
    }
  },

  // Create a new story
  createStory: async (formData, onProgress) => {
    try {
      const response = await apiService.post(BASE_URL, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: onProgress,
      })
      return response
    } catch (error) {
      console.error("Error creating story:", error)
      return { success: false, message: error.message || "Failed to create story" }
    }
  },

  // Delete a story
  deleteStory: async (storyId) => {
    try {
      const response = await apiService.delete(`${BASE_URL}/${storyId}`)
      return response
    } catch (error) {
      console.error(`Error deleting story ${storyId}:`, error)
      return { success: false, message: error.message || "Failed to delete story" }
    }
  },

  // Mark a story as viewed
  markStoryAsViewed: async (storyId) => {
    try {
      const response = await apiService.post(`${BASE_URL}/${storyId}/view`)
      return response
    } catch (error) {
      console.error(`Error marking story ${storyId} as viewed:`, error)
      return { success: false, message: error.message || "Failed to mark story as viewed" }
    }
  },

  // React to a story (like, etc.)
  reactToStory: async (storyId, reactionType) => {
    try {
      const response = await apiService.post(`${BASE_URL}/${storyId}/react`, { reactionType })
      return response
    } catch (error) {
      console.error(`Error reacting to story ${storyId}:`, error)
      return { success: false, message: error.message || "Failed to react to story" }
    }
  },

  // Get reactions for a story
  getStoryReactions: async (storyId) => {
    try {
      const response = await apiService.get(`${BASE_URL}/${storyId}/reactions`)
      return response
    } catch (error) {
      console.error(`Error fetching reactions for story ${storyId}:`, error)
      return { success: false, message: error.message || "Failed to fetch story reactions" }
    }
  },

  // Comment on a story
  commentOnStory: async (storyId, comment) => {
    try {
      const response = await apiService.post(`${BASE_URL}/${storyId}/comment`, { comment })
      return response
    } catch (error) {
      console.error(`Error commenting on story ${storyId}:`, error)
      return { success: false, message: error.message || "Failed to comment on story" }
    }
  },

  // Get comments for a story
  getStoryComments: async (storyId) => {
    try {
      const response = await apiService.get(`${BASE_URL}/${storyId}/comments`)
      return response
    } catch (error) {
      console.error(`Error fetching comments for story ${storyId}:`, error)
      return { success: false, message: error.message || "Failed to fetch story comments" }
    }
  },
}

export default storiesService
