// Admin service for interacting with the Admin API
import apiService from './apiService.jsx';

/**
 * AdminService - Service for admin-related API calls
 */
class AdminService {
  // Dashboard statistics
  async getOverviewStats() {
    const response = await apiService.get('/admin/stats/overview');
    return response;
  }

  async getUserStats() {
    const response = await apiService.get('/admin/stats/users');
    return response;
  }

  async getContentStats() {
    const response = await apiService.get('/admin/stats/content');
    return response;
  }

  async getMessagingStats() {
    const response = await apiService.get('/admin/stats/messaging');
    return response;
  }

  // User management
  async getUsers(params = {}) {
    const response = await apiService.get('/admin/users', params);
    return response;
  }

  async getUser(userId) {
    const response = await apiService.get(`/admin/users/${userId}`);
    return response;
  }

  async updateUser(userId, data) {
    const response = await apiService.put(`/admin/users/${userId}`, data);
    return response;
  }

  async toggleUserActive(userId, isActive) {
    const response = await apiService.put(`/admin/users/${userId}/status`, { isActive });
    return response;
  }

  async verifyUser(userId) {
    const response = await apiService.put(`/admin/users/${userId}/verify`, { verified: true });
    return response;
  }

  async deleteUser(userId) {
    const response = await apiService.delete(`/admin/users/${userId}`);
    return response;
  }

  // Content moderation
  async getPhotosForModeration(params = {}) {
    const response = await apiService.get('/admin/moderation/photos', params);
    return response;
  }

  async moderatePhoto(photoId, action, reason = '') {
    const response = await apiService.put(`/admin/moderation/photos/${photoId}`, { action, reason });
    return response;
  }

  async getReportedContent(params = {}) {
    const response = await apiService.get('/admin/moderation/reports', params);
    return response;
  }

  async handleReportedContent(reportId, action, notes = '') {
    const response = await apiService.put(`/admin/moderation/reports/${reportId}`, { action, notes });
    return response;
  }

  // Subscription management
  async getSubscriptions(params = {}) {
    return await apiService.get('/admin/subscriptions', params);
  }

  async updateSubscription(subscriptionId, data) {
    return await apiService.put(`/admin/subscriptions/${subscriptionId}`, data);
  }

  // System settings
  async getSettings() {
    return await apiService.get('/admin/settings');
  }

  async updateSettings(settings) {
    return await apiService.put('/admin/settings', settings);
  }

  // Communication tools
  async sendNotification(data) {
    return await apiService.post('/admin/communications/notification', data);
  }

  async sendEmail(data) {
    return await apiService.post('/admin/communications/email', data);
  }
  
  // Audit logs
  async getAuditLogs(params = {}) {
    return await apiService.get('/admin/logs/audit', params);
  }
}

const adminService = new AdminService();
export default adminService;