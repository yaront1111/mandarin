// src/services/adminService.js
import { api } from './api';
import { authService } from './authService';

export const adminService = {
  async getDashboardStats() {
    const token = authService.getToken();
    return api.get('/admin/dashboard', { token });
  },
  async getAllUsers() {
    const token = authService.getToken();
    return api.get('/admin/users', { token });
  },
  async banUser(userId) {
    const token = authService.getToken();
    return api.post(`/admin/users/${userId}/ban`, null, { token });
  },
  async getAnalytics() {
    const token = authService.getToken();
    return api.get('/admin/analytics', { token });
  },
};
