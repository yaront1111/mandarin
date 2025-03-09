// src/services/storyService.js
import api from './api';

const storyService = {
  async createStory({ type, content, backgroundColor }) {
    const response = await api.post('api/stories', { type, content, backgroundColor });
    // { success: true, data: { ...newStory } }
    return response.data.data;
  },

  async getFeedStories() {
    const response = await api.get('api/stories/feed');
    // { success: true, data: [ ...stories ] }
    return response.data.data;
  },

  async getUserStories(userId) {
    const response = await api.get(`api/stories/${userId}`);
    return response.data.data;
  },

  async viewStory(storyId) {
    const response = await api.post(`api/stories/view/${storyId}`);
    return response.data.data; // updated story with new viewer
  }
};

export default storyService;
