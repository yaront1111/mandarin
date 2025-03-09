// src/services/kinkService.js
import api from './api';

const kinkService = {
  async getAllKinks() {
    const response = await api.get('api/kinks');
    // { success: true, data: [ ...kinkList ] }
    return response.data.data;
  },

  async getUserKinks(userId) {
    const response = await api.get(`api/kinks/preferences/${userId}`);
    // or /users/:userId/kinks
    return response.data.data;
  },

  async updateUserKinks(preferences) {
    // preferences might be array of { kinkId, interestLevel, role, isPublic }
    const response = await api.post('api/kinks/preferences', { preferences });
    return response.data.data;
  }
};

export default kinkService;
