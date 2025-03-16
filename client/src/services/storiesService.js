// client/src/services/storiesService.js
import apiService from "./apiService"

const BASE_URL = "/stories"

// Option 1: Using named exports (recommended)
export const getAllStories = async () => {
  try {
    const response = await apiService.get(BASE_URL)
    return response
  } catch (error) {
    console.error("Error fetching stories:", error)
    return { success: false, message: error.message || "Failed to fetch stories" }
  }
}

export const getUserStories = async (userId) => {
  try {
    const response = await apiService.get(`${BASE_URL}/user/${userId}`)
    return response
  } catch (error) {
    console.error(`Error fetching stories for user ${userId}:`, error)
    return { success: false, message: error.message || "Failed to fetch user stories" }
  }
}

export const createStory = async (formData, onProgress) => {
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
}

export const createTextStory = async (storyData, onProgress) => {
  try {
    const response = await apiService.post(`${BASE_URL}/text`, storyData, {
      onUploadProgress: onProgress,
    })
    return response
  } catch (error) {
    console.error("Error creating text story:", error)
    return { success: false, message: error.message || "Failed to create text story" }
  }
}

export const deleteStory = async (storyId) => {
  try {
    const response = await apiService.delete(`${BASE_URL}/${storyId}`)
    return response
  } catch (error) {
    console.error(`Error deleting story ${storyId}:`, error)
    return { success: false, message: error.message || "Failed to delete story" }
  }
}

export const markStoryAsViewed = async (storyId) => {
  try {
    const response = await apiService.post(`${BASE_URL}/${storyId}/view`)
    return response
  } catch (error) {
    console.error(`Error marking story ${storyId} as viewed:`, error)
    return { success: false, message: error.message || "Failed to mark story as viewed" }
  }
}

export const reactToStory = async (storyId, reactionType) => {
  try {
    const response = await apiService.post(`${BASE_URL}/${storyId}/react`, { reactionType })
    return response
  } catch (error) {
    console.error(`Error reacting to story ${storyId}:`, error)
    return { success: false, message: error.message || "Failed to react to story" }
  }
}

export const getStoryReactions = async (storyId) => {
  try {
    const response = await apiService.get(`${BASE_URL}/${storyId}/reactions`)
    return response
  } catch (error) {
    console.error(`Error fetching reactions for story ${storyId}:`, error)
    return { success: false, message: error.message || "Failed to fetch story reactions" }
  }
}

export const commentOnStory = async (storyId, comment) => {
  try {
    const response = await apiService.post(`${BASE_URL}/${storyId}/comment`, { comment })
    return response
  } catch (error) {
    console.error(`Error commenting on story ${storyId}:`, error)
    return { success: false, message: error.message || "Failed to comment on story" }
  }
}

export const getStoryComments = async (storyId) => {
  try {
    const response = await apiService.get(`${BASE_URL}/${storyId}/comments`)
    return response
  } catch (error) {
    console.error(`Error fetching comments for story ${storyId}:`, error)
    return { success: false, message: error.message || "Failed to fetch story comments" }
  }
}

// You can also keep this for backward compatibility
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
  getStoryComments
}

export default storiesService
