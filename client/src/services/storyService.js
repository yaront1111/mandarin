// src/services/storyService.js
import api from './api';

/**
 * Create a new story
 * @param {Object} storyData - The story data
 * @param {string} storyData.type - Story type ('text' or 'photo')
 * @param {string} storyData.content - Story content (text or image url)
 * @param {string} storyData.backgroundColor - Background color (for text stories)
 * @returns {Promise} - The newly created story
 */
export const createStory = async ({ type, content, backgroundColor }) => {
  try {
    const response = await api.post('api/stories', {
      type,
      content,
      backgroundColor
    });
    return response.data.data;
  } catch (error) {
    console.error('Error creating story:', error);
    throw new Error(error.response?.data?.message || 'Failed to create story');
  }
};

/**
 * Get stories for the feed (from people the user follows/matches with)
 * @returns {Promise} - List of stories
 */
export const getFeedStories = async () => {
  try {
    const response = await api.get('api/stories/feed');
    return response.data.data;
  } catch (error) {
    console.error('Error fetching feed stories:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch feed stories');
  }
};

/**
 * Get stories for a specific user
 * @param {string} userId - The user's ID
 * @returns {Promise} - List of the user's stories
 */
export const getStoriesByUser = async (userId) => {
  try {
    const response = await api.get(`api/stories/user/${userId}`);
    return response.data.data;
  } catch (error) {
    console.error(`Error fetching stories for user ${userId}:`, error);
    // For development, return mock data if the API isn't ready
    return [
      {
        id: '1',
        type: 'text',
        content: 'Just having a great day! ☀️',
        backgroundColor: '#FF5588',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        user: {
          id: userId,
          firstName: 'User',
          avatar: '/images/default-avatar.png'
        }
      },
      {
        id: '2',
        type: 'photo',
        content: '/images/default-avatar.png', // This would be a real image URL
        backgroundColor: '#000000',
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        user: {
          id: userId,
          firstName: 'User',
          avatar: '/images/default-avatar.png'
        }
      }
    ];
  }
};

/**
 * Mark a story as viewed by the current user
 * @param {string} storyId - The story's ID
 * @returns {Promise} - The updated story
 */
export const viewStory = async (storyId) => {
  try {
    const response = await api.post(`api/stories/${storyId}/view`);
    return response.data.data;
  } catch (error) {
    console.error(`Error marking story ${storyId} as viewed:`, error);
    throw new Error(error.response?.data?.message || 'Failed to mark story as viewed');
  }
};

/**
 * Delete a story
 * @param {string} storyId - The story's ID
 * @returns {Promise} - Success message
 */
export const deleteStory = async (storyId) => {
  try {
    const response = await api.delete(`api/stories/${storyId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting story ${storyId}:`, error);
    throw new Error(error.response?.data?.message || 'Failed to delete story');
  }
};

/**
 * Upload a photo story
 * @param {File} file - The image file
 * @returns {Promise} - The created story
 */
export const uploadPhotoStory = async (file) => {
  try {
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('type', 'photo');

    const response = await api.post('api/stories/photo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    return response.data.data;
  } catch (error) {
    console.error('Error uploading photo story:', error);
    throw new Error(error.response?.data?.message || 'Failed to upload photo story');
  }
};

/**
 * Get users who have viewed a story
 * @param {string} storyId - The story's ID
 * @returns {Promise} - List of users who viewed the story
 */
export const getStoryViewers = async (storyId) => {
  try {
    const response = await api.get(`api/stories/${storyId}/viewers`);
    return response.data.data;
  } catch (error) {
    console.error(`Error fetching viewers for story ${storyId}:`, error);
    throw new Error(error.response?.data?.message || 'Failed to fetch story viewers');
  }
};

/**
 * Get users with active stories
 * @returns {Promise} - List of users with active stories
 */
export const getUsersWithStories = async () => {
  try {
    const response = await api.get('api/stories/users');
    return response.data.data;
  } catch (error) {
    console.error('Error fetching users with stories:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch users with stories');
  }
};
