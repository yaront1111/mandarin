// src/services/matchService.js
import api from './api';

const matchService = {
  async getMatches() {
    const response = await api.get('/matches');
    // { success: true, data: [ ...matches ] }
    return response.data.data;
  },

  async likeUser(targetId) {
    const response = await api.post('/matches/like', { targetId });
    // { success: true, data: { like, match } }
    return response.data.data;
  }
};

export default matchService;
