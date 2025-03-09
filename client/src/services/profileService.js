// src/services/profileService.js
import api from './api';

const profileService = {
  async getMyProfile() {
    const response = await api.get('api/users/me');
    // { success: true, data: { user, kinkCompatibility? } }
    return response.data.data;
  },

  async getUserProfile(userId) {
    const response = await api.get(`api/users/${userId}`);
    // { success: true, data: { user, kinkCompatibility? } }
    return response.data.data;
  },

  async updateProfile(payload) {
    // e.g. { firstName, lastName, bio, etc. }
    const response = await api.put('api/users/me', payload);
    // { success: true, data: {... updated user } }
    return response.data.data;
  },

  async deleteAccount() {
    const response = await api.delete('api/users/me');
    // { success: true, message: 'Account deleted' }
    return response.data;
  }
};

export default profileService;
