import apiService from './apiService.jsx';

const settingsService = {
  /**
   * Get user settings
   * @returns {Promise} Promise with user settings
   */
  getUserSettings: async () => {
    try {
      // Use /auth/me endpoint instead since it includes user settings
      console.log('Fetching user settings from /auth/me endpoint');
      const response = await apiService.get('/auth/me');
      
      // Ensure response has the right format
      if (response.success && response.data) {
        // Extract settings from the user data
        const settings = response.data.settings || {
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
        
        console.log('Successfully fetched user settings from /auth/me:', settings);
        return {
          success: true,
          data: settings
        };
      } else {
        console.error('API returned unsuccessful response:', response);
        return { 
          success: false, 
          error: response.error || 'Failed to fetch settings',
          data: null
        };
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
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
  // In updateSettings, add a check for valid token
  updateSettings: async (settings) => {
    try {
      // Check if token exists before making request
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        return {
          success: false,
          error: 'Authentication required. Please log in again.',
          data: null
        };
      }

      console.log('Updating settings via /users/profile endpoint', settings);
      const response = await apiService.put('/users/profile', { settings });

      // Rest of your function...
    } catch (error) {
      // Error handling...
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
      console.log('Updating notification settings via /users/profile endpoint', notificationSettings);
      const response = await apiService.put('/users/profile', {
        settings: {
          notifications: notificationSettings
        }
      });
      
      // Log the response for debugging
      console.log('Notification settings update API response:', response);
      
      // Ensure response has the right format
      if (response.success) {
        return {
          success: true,
          data: { notifications: notificationSettings }
        };
      } else {
        console.error('API returned unsuccessful notification settings update response:', response);
        return { 
          success: false, 
          error: response.error || 'Failed to update notification settings',
          data: null
        };
      }
    } catch (error) {
      console.error('Error updating notification settings:', error);
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
      console.log('Updating privacy settings via /users/profile endpoint', privacySettings);
      const response = await apiService.put('/users/profile', {
        settings: {
          privacy: privacySettings
        }
      });
      
      // Log the response for debugging
      console.log('Privacy settings update API response:', response);
      
      // Ensure response has the right format
      if (response.success) {
        return {
          success: true,
          data: { privacy: privacySettings }
        };
      } else {
        console.error('API returned unsuccessful privacy settings update response:', response);
        return { 
          success: false, 
          error: response.error || 'Failed to update privacy settings',
          data: null
        };
      }
    } catch (error) {
      console.error('Error updating privacy settings:', error);
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
      // Make sure your endpoint here is also correct (remove extra "/api" if needed)
      const response = await apiService.delete('/users/account', {
        data: { password }
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }
};

export default settingsService;
