import { useState, useEffect, useCallback } from 'react';
import { useUser } from '../context';
import settingsService from '../services/settingsService';

// Default settings structure
const defaultSettings = {
  notifications: {
    messages: true,
    calls: true,
    stories: true,
    likes: true,
    comments: true,
    photoRequests: true,
  },
  privacy: {
    showOnlineStatus: true,
    showReadReceipts: true,
    showLastSeen: true,
    allowStoryReplies: 'everyone', // 'everyone', 'friends', 'none'
  },
  theme: {
    mode: 'light', // 'light', 'dark', 'system'
    color: 'default',
  },
};

/**
 * Custom hook for managing user settings
 * @returns {Object} Settings state and methods
 */
export const useSettings = () => {
  const { currentUser, updateProfile } = useUser();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // Load settings from server or user object
  useEffect(() => {
    if (!currentUser || initialLoadComplete) return;
    
    const loadSettings = async () => {
      setLoading(true);
      try {
        // Try to get settings from the server first
        const response = await settingsService.getUserSettings();
        
        if (response.success && response.data) {
          // Normalize settings to ensure consistent structure
          const normalizedSettings = normalizeSettings(response.data);
          setSettings(normalizedSettings);
          setInitialLoadComplete(true);
          return;
        }
      } catch (err) {
        console.error('Error fetching settings from server:', err);
      }
      
      // Fall back to currentUser settings if server fetch fails
      if (currentUser && currentUser.settings) {
        const normalizedSettings = normalizeSettings(currentUser.settings);
        setSettings(normalizedSettings);
      } else {
        // If all else fails, use defaults
        setSettings(defaultSettings);
      }
      
      setInitialLoadComplete(true);
      setLoading(false);
    };
    
    loadSettings();
  }, [currentUser, initialLoadComplete]);
  
  /**
   * Normalize settings to ensure consistent structure
   * @param {Object} userSettings - Settings to normalize
   * @returns {Object} Normalized settings
   */
  const normalizeSettings = useCallback((userSettings) => {
    const normalized = {
      notifications: {
        // Use explicit boolean conversion for notification settings
        messages: userSettings.notifications?.messages === false ? false : !!userSettings.notifications?.messages,
        calls: userSettings.notifications?.calls === false ? false : !!userSettings.notifications?.calls,
        stories: userSettings.notifications?.stories === false ? false : !!userSettings.notifications?.stories,
        likes: userSettings.notifications?.likes === false ? false : !!userSettings.notifications?.likes,
        comments: userSettings.notifications?.comments === false ? false : !!userSettings.notifications?.comments,
        photoRequests: userSettings.notifications?.photoRequests === false ? false : !!userSettings.notifications?.photoRequests,
      },
      privacy: {
        showOnlineStatus: userSettings.privacy?.showOnlineStatus ?? defaultSettings.privacy.showOnlineStatus,
        showReadReceipts: userSettings.privacy?.showReadReceipts ?? defaultSettings.privacy.showReadReceipts,
        showLastSeen: userSettings.privacy?.showLastSeen ?? defaultSettings.privacy.showLastSeen,
        allowStoryReplies: userSettings.privacy?.allowStoryReplies ?? defaultSettings.privacy.allowStoryReplies,
      },
      theme: {
        mode: userSettings.theme?.mode ?? defaultSettings.theme.mode,
        color: userSettings.theme?.color ?? defaultSettings.theme.color,
      },
    };
    
    return normalized;
  }, []);
  
  /**
   * Update a setting value
   * @param {string} section - Settings section (notifications, privacy, theme)
   * @param {string} setting - Setting name
   * @param {any} value - New value
   */
  const updateSetting = useCallback((section, setting, value) => {
    // Don't update if the settings aren't loaded yet
    if (!settings) return;
    
    // Get current value with explicit boolean conversion for settings
    const currentValue = section === 'notifications'
      ? settings[section][setting] === false ? false : !!settings[section][setting]
      : settings[section][setting];
    
    // Skip if the value isn't actually changing
    if (currentValue === value) return;
    
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [setting]: value,
      },
    }));
    
    setHasChanges(true);
  }, [settings]);
  
  /**
   * Toggle a boolean setting value
   * @param {string} section - Settings section
   * @param {string} setting - Setting name
   */
  const toggleSetting = useCallback((section, setting) => {
    if (!settings) return;
    
    // Get current value with explicit boolean conversion
    const currentValue = section === 'notifications'
      ? settings[section][setting] === false ? false : !!settings[section][setting]
      : !!settings[section][setting];
    
    updateSetting(section, setting, !currentValue);
  }, [settings, updateSetting]);
  
  /**
   * Save settings to the server
   * @returns {Promise<Object>} Save result
   */
  const saveSettings = useCallback(async () => {
    if (!settings) return { success: false, error: 'No settings to save' };
    
    setLoading(true);
    try {
      // Update settings via API
      const settingsResponse = await settingsService.updateSettings(settings);
      
      if (!settingsResponse.success) {
        throw new Error(settingsResponse.error || 'Failed to save settings');
      }
      
      // Update user profile with new settings
      if (currentUser) {
        await updateProfile({ settings });
      }
      
      // Update notification and socket services
      try {
        const [notificationModule, socketModule] = await Promise.all([
          import('../services/notificationService.jsx'),
          import('../services/socketService.jsx')
        ]);
        
        const notificationService = notificationModule.default;
        const socketService = socketModule.default;
        
        // Update notification settings
        notificationService.updateSettings(settings.notifications);
        
        // Update privacy settings
        socketService.updatePrivacySettings(settings.privacy);
      } catch (err) {
        console.error('Error updating services with settings:', err);
      }
      
      setHasChanges(false);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [settings, currentUser, updateProfile]);
  
  /**
   * Reset settings to defaults
   */
  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
    setHasChanges(true);
  }, []);
  
  /**
   * Reset changes to last saved settings
   */
  const cancelChanges = useCallback(async () => {
    // Re-fetch settings from server
    setLoading(true);
    try {
      const response = await settingsService.getUserSettings();
      
      if (response.success && response.data) {
        setSettings(normalizeSettings(response.data));
      } else if (currentUser && currentUser.settings) {
        setSettings(normalizeSettings(currentUser.settings));
      } else {
        setSettings(defaultSettings);
      }
      
      setHasChanges(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser, normalizeSettings]);
  
  return {
    settings,
    loading,
    error,
    hasChanges,
    updateSetting,
    toggleSetting,
    saveSettings,
    resetSettings,
    cancelChanges,
    defaultSettings
  };
};

export default useSettings;