// src/services/storyService.js
import { api } from './api';
import { authService } from './authService';

export const storyService = {
  /** Fetch all active stories */
  fetchStories: async () => {
    const token = authService.getToken();
    return api.get('/stories', { token });
  },

  /** Fetch a single user's stories */
  fetchUserStories: async (userId) => {
    const token = authService.getToken();
    return api.get(`/stories/user/${userId}`, { token });
  },

  /** Upload a new story (photo/video). For real file uploads, consider a specialized approach or formData. */
  uploadStory: async (storyData) => {
    const token = authService.getToken();

    // If your server accepts JSON for story metadata but a separate endpoint for file upload:
    // Alternatively, use a specialized `api.upload()` or do a fetch with multipart/form-data
    return api.post('/stories', storyData, { token });
  },

  /** Delete a story by ID */
  deleteStory: async (storyId) => {
    const token = authService.getToken();
    return api.delete(`/stories/${storyId}`, { token });
  },
};
