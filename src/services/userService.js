// src/services/userService.js
import { api } from './api';
import { authService } from './authService';

export const userService = {
  /** Fetch a user's public profile */
  getProfile: async (userId) => {
    const token = authService.getToken();
    return api.get(`/users/${userId}`, { token });
  },

  /** Update a user profile (e.g., bio, relationship goals, etc.) */
  updateProfile: async (userId, profileData) => {
    const token = authService.getToken();
    return api.put(`/users/${userId}`, profileData, { token });
  },

  /** Search for users (e.g., with filters or query params) */
  searchUsers: async (queryParams) => {
    // Example: { distance: 10, compatibility: 70 }
    const token = authService.getToken();
    const queryString = new URLSearchParams(queryParams).toString();
    return api.get(`/users?${queryString}`, { token });
  },

  /** Request access to someone's private photos */
  requestPrivatePhotos: async (targetUserId) => {
    const token = authService.getToken();
    return api.post(`/users/${targetUserId}/private-photos/request`, null, { token });
  },

  /** Grant or deny private photo access to a specific user */
  respondToPrivatePhotoRequest: async (requestId, action) => {
    // action could be 'grant' or 'deny'
    const token = authService.getToken();
    return api.post(`/private-photos/${requestId}/${action}`, null, { token });
  },

  /** Get recommended or matched users (kink compatibility, etc.) */
  getRecommendedUsers: async (filters) => {
    const token = authService.getToken();
    const queryString = new URLSearchParams(filters).toString();
    return api.get(`/users/recommended?${queryString}`, { token });
  },
};
