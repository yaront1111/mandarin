import { useState } from 'react';
import { FaCog, FaBell, FaLock, FaPalette, FaSignOutAlt, FaTrash } from 'react-icons/fa';
import { useAuth, useTheme } from '../context';
import { toast } from 'react-toastify';

const Settings = () => {
  const { user, logout, updateUserSettings } = useAuth();
  const { theme, setTheme } = useTheme();

  const [settings, setSettings] = useState({
    notifications: {
      messages: user?.settings?.notifications?.messages ?? true,
      calls: user?.settings?.notifications?.calls ?? true,
      stories: user?.settings?.notifications?.stories ?? true
    },
    privacy: {
      showOnlineStatus: user?.settings?.privacy?.showOnlineStatus ?? true,
      showReadReceipts: user?.settings?.privacy?.showReadReceipts ?? true,
      allowStoryReplies: user?.settings?.privacy?.allowStoryReplies ?? 'everyone' // 'everyone', 'friends', 'none'
    }
  });

  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleToggleChange = (section, setting) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [setting]: !prev[section][setting]
      }
    }));
  };

  const handleRadioChange = (section, setting, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [setting]: value
      }
    }));
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await updateUserSettings(settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleDeleteAccount = () => {
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteAccount = async () => {
    try {
      // API call to delete account would go here
      toast.success('Account deleted successfully');
      logout();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
    }
  };

  return (
    <div className="container settings-container">
      <h1>Settings</h1>

      {/* Notifications Section */}
      <div className="settings-section">
        <div className="settings-header">
          <FaBell className="settings-icon" />
          <h2>Notifications</h2>
        </div>
        <div className="settings-content">
          <div className="settings-option">
            <div className="option-text">
              <h3>Message Notifications</h3>
              <p>Get notified when you receive new messages</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.notifications.messages}
                onChange={() => handleToggleChange('notifications', 'messages')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="settings-option">
            <div className="option-text">
              <h3>Call Notifications</h3>
              <p>Get notified for incoming calls</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.notifications.calls}
                onChange={() => handleToggleChange('notifications', 'calls')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="settings-option">
            <div className="option-text">
              <h3>Story Notifications</h3>
              <p>Get notified when friends post new stories</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.notifications.stories}
                onChange={() => handleToggleChange('notifications', 'stories')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      {/* Privacy Section */}
      <div className="settings-section">
        <div className="settings-header">
          <FaLock className="settings-icon" />
          <h2>Privacy</h2>
        </div>
        <div className="settings-content">
          <div className="settings-option">
            <div className="option-text">
              <h3>Online Status</h3>
              <p>Show when you're active on the app</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.privacy.showOnlineStatus}
                onChange={() => handleToggleChange('privacy', 'showOnlineStatus')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="settings-option">
            <div className="option-text">
              <h3>Read Receipts</h3>
              <p>Let others know when you've read their messages</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.privacy.showReadReceipts}
                onChange={() => handleToggleChange('privacy', 'showReadReceipts')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="settings-option">
            <div className="option-text">
              <h3>Story Replies</h3>
              <p>Control who can reply to your stories</p>
            </div>
            <div className="radio-options">
              <label className="radio-option">
                <input
                  type="radio"
                  name="storyReplies"
                  value="everyone"
                  checked={settings.privacy.allowStoryReplies === 'everyone'}
                  onChange={() => handleRadioChange('privacy', 'allowStoryReplies', 'everyone')}
                />
                Everyone
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="storyReplies"
                  value="friends"
                  checked={settings.privacy.allowStoryReplies === 'friends'}
                  onChange={() => handleRadioChange('privacy', 'allowStoryReplies', 'friends')}
                />
                Friends only
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="storyReplies"
                  value="none"
                  checked={settings.privacy.allowStoryReplies === 'none'}
                  onChange={() => handleRadioChange('privacy', 'allowStoryReplies', 'none')}
                />
                No one
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Theme Section */}
      <div className="settings-section">
        <div className="settings-header">
          <FaPalette className="settings-icon" />
          <h2>Appearance</h2>
        </div>
        <div className="settings-content">
          <div className="settings-option">
            <div className="option-text">
              <h3>Theme</h3>
              <p>Choose your preferred app theme</p>
            </div>
            <div className="theme-options">
              <button
                className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                onClick={() => handleThemeChange('light')}
              >
                <div className="theme-preview light"></div>
                <span>Light</span>
              </button>
              <button
                className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => handleThemeChange('dark')}
              >
                <div className="theme-preview dark"></div>
                <span>Dark</span>
              </button>
              <button
                className={`theme-option ${theme === 'system' ? 'active' : ''}`}
                onClick={() => handleThemeChange('system')}
              >
                <div className="theme-preview system"></div>
                <span>System</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Account Actions */}
      <div className="settings-section">
        <div className="settings-header">
          <FaCog className="settings-icon" />
          <h2>Account</h2>
        </div>
        <div className="settings-content">
          <button className="settings-action-button logout" onClick={handleLogout}>
            <FaSignOutAlt />
            <span>Log out</span>
          </button>
          <button className="settings-action-button delete" onClick={handleDeleteAccount}>
            <FaTrash />
            <span>Delete Account</span>
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="settings-save">
        <button
          className="btn btn-primary"
          onClick={handleSaveSettings}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="modal-overlay">
          <div className="confirmation-modal">
            <h2>Delete Account</h2>
            <p>Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently lost.</p>
            <div className="confirmation-actions">
              <button
                className="btn"
                onClick={() => setShowDeleteConfirmation(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={confirmDeleteAccount}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
