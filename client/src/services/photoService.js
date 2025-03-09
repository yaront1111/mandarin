// src/services/photoService.js
import api from './api';

const photoService = {
  /**
   * Upload a new photo
   * @param {File} file - The photo file to upload
   * @param {Boolean} isPrivate - Whether the photo is private
   * @param {Object} metadata - Additional photo metadata
   * @returns {Promise} - Promise resolving to the uploaded photo data
   */
  async uploadPhoto(file, isPrivate = false, metadata = {}) {
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('isPrivate', isPrivate);

      // Add optional metadata
      if (metadata.caption) formData.append('caption', metadata.caption);
      if (metadata.order) formData.append('order', metadata.order);
      if (metadata.tags) formData.append('tags', JSON.stringify(metadata.tags));

      const response = await api.post('/photos', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return response.data.data;
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw new Error(error.response?.data?.message || 'Failed to upload photo');
    }
  },

  /**
   * Get user's photos (public and private)
   * @param {String} userId - User ID (optional, defaults to current user)
   * @returns {Promise} - Promise resolving to user's photos
   */
  async getUserPhotos(userId = 'me') {
    try {
      const endpoint = userId === 'me' ? '/photos' : `/photos/${userId}`;
      const response = await api.get(endpoint);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching user photos:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch user photos');
    }
  },

  /**
   * Delete a photo
   * @param {String} photoId - Photo ID to delete
   * @returns {Promise}
   */
  async deletePhoto(photoId) {
    try {
      const response = await api.delete(`/photos/${photoId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw new Error(error.response?.data?.message || 'Failed to delete photo');
    }
  },

  /**
   * Update photo details
   * @param {String} photoId - Photo ID
   * @param {Object} updates - Updates to apply (caption, isPrivate, order, etc.)
   * @returns {Promise} - Promise resolving to updated photo
   */
  async updatePhoto(photoId, updates) {
    try {
      const response = await api.put(`/photos/${photoId}`, updates);
      return response.data.data;
    } catch (error) {
      console.error('Error updating photo:', error);
      throw new Error(error.response?.data?.message || 'Failed to update photo');
    }
  },

  /**
   * Update the order of photos
   * @param {Array} photoOrder - Array of photo IDs in the desired order
   * @returns {Promise}
   */
  async updatePhotoOrder(photoOrder) {
    try {
      const response = await api.put('/photos/order', { photoOrder });
      return response.data;
    } catch (error) {
      console.error('Error updating photo order:', error);
      throw new Error(error.response?.data?.message || 'Failed to update photo order');
    }
  },

  /**
   * Request access to a user's private photos
   * @param {String} userId - User ID to request photos from
   * @param {String} message - Optional message with the request
   * @returns {Promise}
   */
  async requestPhotoAccess(userId, message = '') {
    try {
      const response = await api.post('/photos/request-access', {
        userId,
        message
      });
      return response.data;
    } catch (error) {
      console.error('Error requesting photo access:', error);
      throw new Error(error.response?.data?.message || 'Failed to request photo access');
    }
  },

  /**
   * Grant access to private photos
   * @param {String} userId - User ID to grant access to
   * @param {Array} photoIds - Optional specific photo IDs to grant access to
   * @returns {Promise}
   */
  async grantPhotoAccess(userId, photoIds = []) {
    try {
      const response = await api.post('/photos/grant-access', {
        userId,
        photoIds
      });
      return response.data;
    } catch (error) {
      console.error('Error granting photo access:', error);
      throw new Error(error.response?.data?.message || 'Failed to grant photo access');
    }
  },

  /**
   * Revoke access to private photos
   * @param {String} userId - User ID to revoke access from
   * @param {Array} photoIds - Optional specific photo IDs to revoke access to
   * @returns {Promise}
   */
  async revokePhotoAccess(userId, photoIds = []) {
    try {
      const response = await api.post('/photos/revoke-access', {
        userId,
        photoIds
      });
      return response.data;
    } catch (error) {
      console.error('Error revoking photo access:', error);
      throw new Error(error.response?.data?.message || 'Failed to revoke photo access');
    }
  },

  /**
   * Get pending photo access requests
   * @returns {Promise} - Promise resolving to list of pending requests
   */
  async getPhotoAccessRequests() {
    try {
      const response = await api.get('/photos/access-requests');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching photo access requests:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch photo access requests');
    }
  },

  /**
   * Get photo access permissions (who has access to your private photos)
   * @returns {Promise} - Promise resolving to list of access permissions
   */
  async getPhotoAccessPermissions() {
    try {
      const response = await api.get('/photos/access-permissions');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching photo access permissions:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch photo access permissions');
    }
  }
};

export default photoService;
