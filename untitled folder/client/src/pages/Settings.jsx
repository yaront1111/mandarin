import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { FaBell, FaLock, FaPalette, FaSignOutAlt, FaTrash, FaUser, FaShieldAlt, FaSave, FaTimes } from "react-icons/fa"
import { toast } from "react-toastify"
import { useAuth, useTheme, useUser } from "../context"
import { settingsService } from "../services"
import { ThemeToggle } from "../components/theme-toggle.tsx"

const Settings = () => {
  const navigate = useNavigate()
  const { user, logout, getCurrentUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const { currentUser, updateProfile, getUser } = useUser()
  const previousUserRef = useRef(null);

  // Define default settings
  const defaultSettings = {
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
      allowStoryReplies: "everyone", // 'everyone', 'friends', 'none'
    },
  };

  // Define states for settings and UI
  const [settings, setSettings] = useState(defaultSettings);
  const [activeTab, setActiveTab] = useState("notifications");
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [fallbackSettings, setFallbackSettings] = useState(null);

  // Load user settings when currentUser changes - only runs once per currentUser change
  useEffect(() => {
    // Skip if we've already loaded settings for this user
    if (initialLoadComplete && currentUser) {
      return;
    }

    console.log('useEffect for settings loading triggered');

    const loadSettings = async () => {
      // Always fetch fresh settings from the server first
      try {
        console.log('Fetching fresh settings from the server');
        const freshSettings = await settingsService.getUserSettings();

        if (freshSettings && freshSettings.success && freshSettings.data) {
          console.log('Successfully loaded settings from server:', freshSettings.data);
          console.log('Message notifications from server:',
            freshSettings.data.notifications?.messages,
            'typeof:', typeof freshSettings.data.notifications?.messages);

          // Create a normalized settings object with explicit boolean conversions
          const normalizedSettings = {
            notifications: {
              // Explicitly handle each setting to ensure correct boolean values
              messages: freshSettings.data.notifications?.messages === false ? false : !!freshSettings.data.notifications?.messages,
              calls: freshSettings.data.notifications?.calls === false ? false : !!freshSettings.data.notifications?.calls,
              stories: freshSettings.data.notifications?.stories === false ? false : !!freshSettings.data.notifications?.stories,
              likes: freshSettings.data.notifications?.likes === false ? false : !!freshSettings.data.notifications?.likes,
              comments: freshSettings.data.notifications?.comments === false ? false : !!freshSettings.data.notifications?.comments,
            },
            privacy: {
              showOnlineStatus: freshSettings.data.privacy?.showOnlineStatus ?? defaultSettings.privacy.showOnlineStatus,
              showReadReceipts: freshSettings.data.privacy?.showReadReceipts ?? defaultSettings.privacy.showReadReceipts,
              showLastSeen: freshSettings.data.privacy?.showLastSeen ?? defaultSettings.privacy.showLastSeen,
              allowStoryReplies: freshSettings.data.privacy?.allowStoryReplies ?? defaultSettings.privacy.allowStoryReplies,
            },
          };

          console.log('Normalized settings to apply:', normalizedSettings);
          console.log('Message notifications in normalized settings:',
            normalizedSettings.notifications.messages,
            'typeof:', typeof normalizedSettings.notifications.messages);

          // Apply the settings
          setSettings(normalizedSettings);
          setInitialLoadComplete(true);
          return;
        }
      } catch (error) {
        console.error('Error fetching settings from server:', error);
      }

      // Fall back to currentUser settings if server fetch fails
      if (currentUser && currentUser.settings) {
        console.log('Falling back to currentUser settings:', currentUser.settings);

        // Normalize the settings
        const userSettings = currentUser.settings || {};
        const normalizedSettings = {
          notifications: {
            messages: userSettings.notifications?.messages === false ? false : !!userSettings.notifications?.messages,
            calls: userSettings.notifications?.calls === false ? false : !!userSettings.notifications?.calls,
            stories: userSettings.notifications?.stories === false ? false : !!userSettings.notifications?.stories,
            likes: userSettings.notifications?.likes === false ? false : !!userSettings.notifications?.likes,
            comments: userSettings.notifications?.comments === false ? false : !!userSettings.notifications?.comments,
          },
          privacy: {
            showOnlineStatus: userSettings.privacy?.showOnlineStatus ?? defaultSettings.privacy.showOnlineStatus,
            showReadReceipts: userSettings.privacy?.showReadReceipts ?? defaultSettings.privacy.showReadReceipts,
            showLastSeen: userSettings.privacy?.showLastSeen ?? defaultSettings.privacy.showLastSeen,
            allowStoryReplies: userSettings.privacy?.allowStoryReplies ?? defaultSettings.privacy.allowStoryReplies,
          },
        };

        console.log('Normalized settings from user object:', normalizedSettings);
        console.log('Message notifications in normalized user settings:',
          normalizedSettings.notifications.messages,
          'typeof:', typeof normalizedSettings.notifications.messages);

        // Apply the settings
        setSettings(normalizedSettings);
        setInitialLoadComplete(true);
      } else {
        console.log('No settings available, using defaults');
        // If all else fails, use defaults - already set in the initial useState
        setInitialLoadComplete(true);
      }
    };

    // Only load settings if we have a currentUser
    if (currentUser) {
      loadSettings();
    } else {
      console.log('No currentUser available, skipping settings load');
    }
  }, [currentUser, defaultSettings, initialLoadComplete])

  // Handle toggle change for boolean settings
  const handleToggleChange = (section, setting) => {
    // Get current value with explicit conversion to boolean
    const currentValue = section === 'notifications' && setting === 'messages'
      ? Boolean(settings[section][setting])
      : !!settings[section][setting];

    // Log the toggle for debugging
    console.log(`Toggling ${section}.${setting}:`,
      `Current value: ${currentValue} (${typeof settings[section][setting]})`,
      `New value: ${!currentValue}`);

    setSettings((prev) => {
      const newSettings = {
        ...prev,
        [section]: {
          ...prev[section],
          [setting]: !currentValue,
        },
      };

      console.log(`New settings after toggle:`, newSettings);
      return newSettings;
    });

    setHasUnsavedChanges(true);
  }

  // Handle radio/select change for non-boolean settings
  const handleRadioChange = (section, setting, value) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [setting]: value,
      },
    }))
    setHasUnsavedChanges(true)
  }

  // Handle theme change
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
  }

  // Save settings to backend
  const handleSaveSettings = async () => {
    try {
      setSaving(true)
      console.log('Saving settings:', settings);

      // Ensure boolean values are correct before saving
      const normalizedSettings = {
        notifications: {
          messages: settings.notifications.messages === false ? false : !!settings.notifications.messages,
          calls: settings.notifications.calls === false ? false : !!settings.notifications.calls,
          stories: settings.notifications.stories === false ? false : !!settings.notifications.stories,
          likes: settings.notifications.likes === false ? false : !!settings.notifications.likes,
          comments: settings.notifications.comments === false ? false : !!settings.notifications.comments,
        },
        privacy: { ...settings.privacy }
      };

      console.log('Normalized settings before saving:', normalizedSettings);
      console.log('Messages notification specifically:', normalizedSettings.notifications.messages);

      // Update settings via API with normalized settings
      const settingsResponse = await settingsService.updateSettings(normalizedSettings);
      if (!settingsResponse.success) {
        throw new Error(settingsResponse.error || "Failed to save settings");
      }

      // Update user profile with new settings
      if (currentUser) {
        console.log('Updating user profile with normalized settings');
        const profileResponse = await updateProfile({ settings: normalizedSettings });
        if (!profileResponse) {
          console.warn("User profile update returned empty response");
        }
      }

      // Update notification service with new notification settings using dynamic import
      Promise.all([
        import('../services/notificationService.jsx'),
        import('../services/socketService.jsx')
      ]).then(([notificationModule, socketModule]) => {
        const notificationService = notificationModule.default;
        const socketService = socketModule.default;

        console.log('Updating notification service with normalized settings:', normalizedSettings.notifications);
        // Update notification settings
        notificationService.updateSettings(normalizedSettings.notifications);

        console.log('Updating socket service with settings:', normalizedSettings.privacy);
        // Update privacy settings
        socketService.updatePrivacySettings(normalizedSettings.privacy);

        console.log('Services updated with new settings');
      }).catch(err => {
        console.error('Error updating services with settings:', err);
      });

      toast.success("Settings saved successfully");
      setHasUnsavedChanges(false);

      // Reset the state to match the normalized settings for UI consistency
      console.log('Setting current UI state to match saved settings');
      setSettings(normalizedSettings);
      // and the profile update already triggers a state update in the UserContext
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error(error.message || "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Handle user logout
  const handleLogout = () => {
    if (hasUnsavedChanges) {
      if (window.confirm("You have unsaved changes. Are you sure you want to log out?")) {
        logout()
        navigate("/login")
      }
    } else {
      logout()
      navigate("/login")
    }
  }

  // Show delete account confirmation
  const handleDeleteAccount = () => {
    setShowDeleteConfirmation(true)
  }

  // Confirm account deletion
  const confirmDeleteAccount = async () => {
    try {
      setDeleteError("")

      if (!deletePassword) {
        setDeleteError("Please enter your password to confirm account deletion")
        return
      }

      const response = await settingsService.deleteAccount({ password: deletePassword })

      if (response.success) {
        toast.success("Account deleted successfully")
        logout()
        navigate("/login")
      } else {
        setDeleteError(response.error || "Failed to delete account")
      }
    } catch (error) {
      console.error("Error deleting account:", error)
      setDeleteError(error.error || "Failed to delete account. Please try again.")
    }
  }

  // Cancel account deletion
  const cancelDeleteAccount = () => {
    setShowDeleteConfirmation(false)
    setDeletePassword("")
    setDeleteError("")
  }

  // Combined user and settings loading effect
  useEffect(() => {
    // Skip if we already have initialLoadComplete, which means settings are loaded
    if (initialLoadComplete) {
      setLoadingSettings(false);
      return;
    }

    console.log('Combined loading effect running');
    console.log('User available:', !!user, 'currentUser available:', !!currentUser);

    const loadUserAndSettings = async () => {
      // Part 1: Try to load the user if needed
      if (user && !currentUser && user._id) {
        console.log('User exists but currentUser is not available yet - fetching user profile');

        try {
          // Method 1: Try to fetch from UserContext first
          if (typeof getUser === 'function') {
            console.log('Using getUser from UserContext to fetch profile');
            await getUser(user._id);
          }

          // Method 2: Try to fetch from AuthContext if still needed
          if (!currentUser && typeof getCurrentUser === 'function') {
            console.log('Using getCurrentUser from AuthContext to fetch profile');
            await getCurrentUser();
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }

      // Part 2: Only fetch settings directly if initialLoadComplete is false
      // The main settings loading useEffect will now handle this logic
      if (currentUser) {
        setLoadingSettings(false);
      }
    };

    loadUserAndSettings();
  }, [user, currentUser, getCurrentUser, getUser, initialLoadComplete]);

  // FIXED VERSION: Only update settings when currentUser changes in a meaningful way
  useEffect(() => {
    // Skip if settings aren't initialized yet or user hasn't loaded
    if (!initialLoadComplete || !currentUser || !currentUser.settings) {
      return;
    }

    // Only update if the user ID has changed or if this is the first update for this user
    const isNewUser = !previousUserRef.current ||
                      previousUserRef.current._id !== currentUser._id;

    // Use JSON.stringify for deep comparison of settings objects
    const previousSettings = previousUserRef.current?.settings;
    const currentSettings = currentUser.settings;

    // Skip update if it's the same user with the same settings
    if (!isNewUser &&
        previousSettings &&
        JSON.stringify(previousSettings) === JSON.stringify(currentSettings)) {
      return;
    }

    console.log('Detected meaningful change in currentUser settings, updating UI state');

    // Update the settings state with normalized values
    const normalized = {
      notifications: {
        messages: currentSettings.notifications?.messages === false ? false : !!currentSettings.notifications?.messages,
        calls: currentSettings.notifications?.calls === false ? false : !!currentSettings.notifications?.calls,
        stories: currentSettings.notifications?.stories === false ? false : !!currentSettings.notifications?.stories,
        likes: currentSettings.notifications?.likes === false ? false : !!currentSettings.notifications?.likes,
        comments: currentSettings.notifications?.comments === false ? false : !!currentSettings.notifications?.comments,
      },
      privacy: {
        showOnlineStatus: currentSettings.privacy?.showOnlineStatus ?? defaultSettings.privacy.showOnlineStatus,
        showReadReceipts: currentSettings.privacy?.showReadReceipts ?? defaultSettings.privacy.showReadReceipts,
        showLastSeen: currentSettings.privacy?.showLastSeen ?? defaultSettings.privacy.showLastSeen,
        allowStoryReplies: currentSettings.privacy?.allowStoryReplies ?? defaultSettings.privacy.allowStoryReplies,
      },
    };

    // Update the ref to the current user to prevent unnecessary updates
    previousUserRef.current = currentUser;

    // Only update state if necessary
    setSettings(normalized);
  }, [currentUser, defaultSettings, initialLoadComplete]);

  // Render tab content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case "notifications":
        return (
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
                  onChange={() => handleToggleChange("notifications", "messages")}
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
                  onChange={() => handleToggleChange("notifications", "calls")}
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
                  onChange={() => handleToggleChange("notifications", "stories")}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="settings-option">
              <div className="option-text">
                <h3>Like Notifications</h3>
                <p>Get notified when someone likes your content</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.notifications.likes}
                  onChange={() => handleToggleChange("notifications", "likes")}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="settings-option">
              <div className="option-text">
                <h3>Comment Notifications</h3>
                <p>Get notified when someone comments on your content</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.notifications.comments}
                  onChange={() => handleToggleChange("notifications", "comments")}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        )

      case "privacy":
        return (
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
                  onChange={() => handleToggleChange("privacy", "showOnlineStatus")}
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
                  onChange={() => handleToggleChange("privacy", "showReadReceipts")}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="settings-option">
              <div className="option-text">
                <h3>Last Seen</h3>
                <p>Show when you were last active</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.privacy.showLastSeen}
                  onChange={() => handleToggleChange("privacy", "showLastSeen")}
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
                    checked={settings.privacy.allowStoryReplies === "everyone"}
                    onChange={() => handleRadioChange("privacy", "allowStoryReplies", "everyone")}
                  />
                  Everyone
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="storyReplies"
                    value="friends"
                    checked={settings.privacy.allowStoryReplies === "friends"}
                    onChange={() => handleRadioChange("privacy", "allowStoryReplies", "friends")}
                  />
                  Friends only
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="storyReplies"
                    value="none"
                    checked={settings.privacy.allowStoryReplies === "none"}
                    onChange={() => handleRadioChange("privacy", "allowStoryReplies", "none")}
                  />
                  No one
                </label>
              </div>
            </div>
          </div>
        )

      case "appearance":
        return (
          <div className="settings-content">
            <div className="settings-option">
              <div className="option-text">
                <h3>Theme</h3>
                <p>Choose your preferred app theme</p>
              </div>
              <div className="theme-options">
                <button
                  className={`theme-option ${theme === "light" ? "active" : ""}`}
                  onClick={() => handleThemeChange("light")}
                >
                  <div className="theme-preview light"></div>
                  <span>Light</span>
                </button>
                <button
                  className={`theme-option ${theme === "dark" ? "active" : ""}`}
                  onClick={() => handleThemeChange("dark")}
                >
                  <div className="theme-preview dark"></div>
                  <span>Dark</span>
                </button>
                <button
                  className={`theme-option ${theme === "system" ? "active" : ""}`}
                  onClick={() => handleThemeChange("system")}
                >
                  <div className="theme-preview system"></div>
                  <span>System</span>
                </button>
              </div>
            </div>

            <div className="settings-option">
              <div className="option-text">
                <h3>Quick Theme Toggle</h3>
                <p>Quickly switch between light and dark mode</p>
              </div>
              <ThemeToggle />
            </div>
          </div>
        )

      case "account":
        return (
          <div className="settings-content">
            <div className="account-info">
              <div className="account-detail">
                <strong>Username:</strong> {user?.username || "Not available"}
              </div>
              <div className="account-detail">
                <strong>Email:</strong> {user?.email || "Not available"}
              </div>
              <div className="account-detail">
                <strong>Member since:</strong>{" "}
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Not available"}
              </div>
              <div className="account-detail">
                <strong>Subscription:</strong> {user?.subscription?.plan || "Free"}
              </div>
            </div>

            <div className="account-actions">
              <button className="settings-action-button edit" onClick={() => navigate("/profile")}>
                <FaUser />
                <span>Edit Profile</span>
              </button>

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
        )

      default:
        return null
    }
  }

  // Add a loading state to ensure settings are only shown when we have user data
  // This conditional return MUST come after all hooks are defined
  if (!currentUser && loadingSettings && !fallbackSettings) {
    return (
      <div className="settings-page">
        <div className="settings-container">
          <h1 className="settings-title">Settings</h1>
          <div className="loading-message">
            <p>Loading your settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-container">
        <h1 className="settings-title">Settings</h1>

        {/* Settings navigation */}
        <div className="settings-navigation">
          <button
            className={`settings-nav-item ${activeTab === "notifications" ? "active" : ""}`}
            onClick={() => setActiveTab("notifications")}
          >
            <FaBell className="settings-icon" />
            <span>Notifications</span>
          </button>

          <button
            className={`settings-nav-item ${activeTab === "privacy" ? "active" : ""}`}
            onClick={() => setActiveTab("privacy")}
          >
            <FaLock className="settings-icon" />
            <span>Privacy</span>
          </button>

          <button
            className={`settings-nav-item ${activeTab === "appearance" ? "active" : ""}`}
            onClick={() => setActiveTab("appearance")}
          >
            <FaPalette className="settings-icon" />
            <span>Appearance</span>
          </button>

          <button
            className={`settings-nav-item ${activeTab === "account" ? "active" : ""}`}
            onClick={() => setActiveTab("account")}
          >
            <FaUser className="settings-icon" />
            <span>Account</span>
          </button>
        </div>

        {/* Settings content */}
        <div className="settings-panel">
          <div className="settings-header">
            {activeTab === "notifications" && <FaBell className="settings-header-icon" />}
            {activeTab === "privacy" && <FaLock className="settings-header-icon" />}
            {activeTab === "appearance" && <FaPalette className="settings-header-icon" />}
            {activeTab === "account" && <FaUser className="settings-header-icon" />}

            <h2 className="settings-section-title">
              {activeTab === "notifications" && "Notification Settings"}
              {activeTab === "privacy" && "Privacy Settings"}
              {activeTab === "appearance" && "Appearance Settings"}
              {activeTab === "account" && "Account Settings"}
            </h2>
          </div>

          {renderTabContent()}

          {/* Save button - only show for tabs with settings that need saving */}
          {(activeTab === "notifications" || activeTab === "privacy") && (
            <div className="settings-save">
              <button
                className={`btn btn-primary save-button ${hasUnsavedChanges ? "has-changes" : ""}`}
                onClick={handleSaveSettings}
                disabled={saving || !hasUnsavedChanges}
              >
                <FaSave />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="modal-overlay">
          <div className="confirmation-modal">
            <div className="modal-header">
              <h2>
                <FaTrash /> Delete Account
              </h2>
              <button className="close-button" onClick={cancelDeleteAccount}>
                <FaTimes />
              </button>
            </div>

            <div className="modal-content">
              <div className="warning-message">
                <FaShieldAlt className="warning-icon" />
                <p>
                  This action <strong>cannot be undone</strong>. All your data will be permanently deleted, including:
                </p>
                <ul>
                  <li>Your profile information</li>
                  <li>All messages and conversations</li>
                  <li>Photos and media you've shared</li>
                  <li>Stories and other content</li>
                </ul>
              </div>

              <div className="password-confirmation">
                <label htmlFor="delete-password">Enter your password to confirm:</label>
                <input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your password"
                  className={deleteError ? "error" : ""}
                />
                {deleteError && <div className="error-message">{deleteError}</div>}
              </div>
            </div>

            <div className="confirmation-actions">
              <button className="btn btn-secondary" onClick={cancelDeleteAccount}>
                <FaTimes /> Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDeleteAccount} disabled={!deletePassword}>
                <FaTrash /> Delete My Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings
