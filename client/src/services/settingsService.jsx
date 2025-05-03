import apiService from './apiService.jsx';
import logger from '../utils/logger.js';

// Create a named logger for this service
const log = logger.create('SettingsService');

// Default settings for new users
const DEFAULT_SETTINGS = {
  notifications: {
    messages: true,
    calls: true,
    stories: true,
    likes: true,
    comments: true,
  },
  privacy: {
    showOnlineStatus: true,
    showReadReceipts: true,
    showLastSeen: true,
    allowStoryReplies: "everyone"
  }
};

const settingsService = {
  /**
   * Get user settings
   * @returns {Promise} Promise with user settings
   */
  getUserSettings: async () => {
    try {
      // Use /auth/me endpoint since it includes user settings
      log.debug('Fetching user settings from /auth/me endpoint');
      const response = await apiService.get('/auth/me');
      
      // Ensure response has the right format
      if (response.success && response.data) {
        // Extract settings from the user data
        const settings = response.data.settings || DEFAULT_SETTINGS;
        
        log.debug('Successfully fetched user settings');
        return {
          success: true,
          data: settings
        };
      } else {
        log.error('API returned unsuccessful response', response);
        return { 
          success: false, 
          error: response.error || 'Failed to fetch settings',
          data: null
        };
      }
    } catch (error) {
      log.error('Error fetching user settings', error);
      return { 
        success: false, 
        error: error.message || 'Failed to fetch settings',
        data: null
      };
    }
  },

  /**
   * Update user settings
   * @param {Object} settings - The settings object to update
   * @returns {Promise} Promise with updated settings
   */
  updateSettings: async (settings) => {
    try {
      log.debug('Updating settings via /users/profile endpoint');
      // apiService already handles token injection and validation
      const response = await apiService.put('/users/profile', { settings });
      
      if (response.success) {
        log.debug('Settings update successful');
        return {
          success: true,
          data: settings
        };
      } else {
        log.warn('Settings update failed', response);
        return { 
          success: false, 
          error: response.error || 'Failed to update settings',
          data: null
        };
      }
    } catch (error) {
      log.error('Error updating settings', error);
      return { 
        success: false, 
        error: error.message || 'Failed to update settings',
        data: null
      };
    }
  },

  /**
   * Update notification settings
   * @param {Object} notificationSettings - The notification settings to update
   * @returns {Promise} Promise with updated settings
   */
  updateNotificationSettings: async (notificationSettings) => {
    try {
      // Use the profile update endpoint with settings structure
      log.debug('Updating notification settings', { notificationSettings });
      const response = await apiService.put('/users/profile', {
        settings: {
          notifications: notificationSettings
        }
      });
      
      // Ensure response has the right format
      if (response.success) {
        log.debug('Notification settings update successful');
        return {
          success: true,
          data: { notifications: notificationSettings }
        };
      } else {
        log.warn('Notification settings update failed', response);
        return { 
          success: false, 
          error: response.error || 'Failed to update notification settings',
          data: null
        };
      }
    } catch (error) {
      log.error('Error updating notification settings', error);
      return { 
        success: false, 
        error: error.message || 'Failed to update notification settings',
        data: null
      };
    }
  },

  /**
   * Update privacy settings
   * @param {Object} privacySettings - The privacy settings to update
   * @returns {Promise} Promise with updated settings
   */
  updatePrivacySettings: async (privacySettings) => {
    try {
      // Use the profile update endpoint with settings structure
      log.debug('Updating privacy settings', { privacySettings });
      const response = await apiService.put('/users/profile', {
        settings: {
          privacy: privacySettings
        }
      });
      
      // Ensure response has the right format
      if (response.success) {
        log.debug('Privacy settings update successful');
        return {
          success: true,
          data: { privacy: privacySettings }
        };
      } else {
        log.warn('Privacy settings update failed', response);
        return { 
          success: false, 
          error: response.error || 'Failed to update privacy settings',
          data: null
        };
      }
    } catch (error) {
      log.error('Error updating privacy settings', error);
      return { 
        success: false, 
        error: error.message || 'Failed to update privacy settings',
        data: null
      };
    }
  },

  /**
   * Delete user account
   * @param {string} password - User's password for confirmation
   * @returns {Promise} Promise with deletion status
   */
  deleteAccount: async (password) => {
    try {
      log.info('Attempting account deletion');
      const response = await apiService.delete('/users/account', {
        data: { password }
      });
      
      log.info('Account deletion successful');
      return response.data;
    } catch (error) {
      log.error('Error deleting account', error);
      throw error;
    }
  }
};

export default settingsService;
