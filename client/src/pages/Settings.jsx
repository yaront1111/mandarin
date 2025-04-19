import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { 
  FaBell, FaLock, FaPalette, FaSignOutAlt, FaTrash, FaUser, FaShieldAlt, 
  FaSave, FaTimes, FaExclamationTriangle, FaBan, FaUnlock, FaUserSlash,
  FaLanguage, FaGlobe
} from "react-icons/fa"
import { toast } from "react-toastify"
import { useTranslation } from 'react-i18next'
import { useAuth, useTheme, useUser, useLanguage } from "../context"
import { settingsService } from "../services"
import { ThemeToggle } from "../components/theme-toggle.tsx"
import { Navbar } from "../components/LayoutComponents"
import styles from "../styles/settings.module.css"

const Settings = () => {
  const navigate = useNavigate()
  const { user, logout, getCurrentUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const { currentUser, updateProfile, getUser, getBlockedUsers, unblockUser } = useUser()
  const { t } = useTranslation()
  const { language, changeLanguage, supportedLanguages, getLanguageDisplayName } = useLanguage()
  const previousUserRef = useRef(null);
  
  // State for blocked users
  const [blockedUsers, setBlockedUsers] = useState([])
  const [loadingBlockedUsers, setLoadingBlockedUsers] = useState(false)

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
  // Load blocked users
  const loadBlockedUsers = useCallback(async () => {
    if (!currentUser) return;
    
    setLoadingBlockedUsers(true);
    try {
      const blockedData = await getBlockedUsers();
      if (blockedData && Array.isArray(blockedData)) {
        setBlockedUsers(blockedData);
      } else {
        setBlockedUsers([]);
      }
    } catch (error) {
      console.error("Error loading blocked users:", error);
      setBlockedUsers([]);
    } finally {
      setLoadingBlockedUsers(false);
    }
  }, [getBlockedUsers, currentUser]);
  
  // Load blocked users when the privacy tab is selected
  useEffect(() => {
    if (activeTab === "privacy") {
      loadBlockedUsers();
    }
  }, [activeTab, loadBlockedUsers]);
  
  // Handle unblocking a user
  const handleUnblock = useCallback(async (userId, nickname) => {
    if (!userId) return;
    
    try {
      const success = await unblockUser(userId, nickname);
      if (success) {
        // Remove from local state for immediate UI update
        setBlockedUsers(prevUsers => prevUsers.filter(user => user._id !== userId));
      }
    } catch (error) {
      console.error("Error unblocking user:", error);
      toast.error("Failed to unblock user");
    }
  }, [unblockUser]);

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
          <div className={styles.settingsContent}>
            <div className={styles.settingsOption}>
              <div className={styles.optionContent}>
                <h3 className={styles.optionTitle}>Message Notifications</h3>
                <p className={styles.optionDescription}>Get notified when you receive new messages</p>
              </div>
              <label className={styles.toggleWrapper}>
                <input
                  type="checkbox"
                  checked={settings.notifications.messages}
                  onChange={() => handleToggleChange("notifications", "messages")}
                  className={styles.toggleInput}
                />
                <span className={styles.toggleSlider}></span>
              </label>
            </div>

            <div className={styles.settingsOption}>
              <div className={styles.optionContent}>
                <h3 className={styles.optionTitle}>Call Notifications</h3>
                <p className={styles.optionDescription}>Get notified for incoming calls</p>
              </div>
              <label className={styles.toggleWrapper}>
                <input
                  type="checkbox"
                  checked={settings.notifications.calls}
                  onChange={() => handleToggleChange("notifications", "calls")}
                  className={styles.toggleInput}
                />
                <span className={styles.toggleSlider}></span>
              </label>
            </div>

            <div className={styles.settingsOption}>
              <div className={styles.optionContent}>
                <h3 className={styles.optionTitle}>Story Notifications</h3>
                <p className={styles.optionDescription}>Get notified when friends post new stories</p>
              </div>
              <label className={styles.toggleWrapper}>
                <input
                  type="checkbox"
                  checked={settings.notifications.stories}
                  onChange={() => handleToggleChange("notifications", "stories")}
                  className={styles.toggleInput}
                />
                <span className={styles.toggleSlider}></span>
              </label>
            </div>

            <div className={styles.settingsOption}>
              <div className={styles.optionContent}>
                <h3 className={styles.optionTitle}>Like Notifications</h3>
                <p className={styles.optionDescription}>Get notified when someone likes your content</p>
              </div>
              <label className={styles.toggleWrapper}>
                <input
                  type="checkbox"
                  checked={settings.notifications.likes}
                  onChange={() => handleToggleChange("notifications", "likes")}
                  className={styles.toggleInput}
                />
                <span className={styles.toggleSlider}></span>
              </label>
            </div>

            <div className={styles.settingsOption}>
              <div className={styles.optionContent}>
                <h3 className={styles.optionTitle}>Comment Notifications</h3>
                <p className={styles.optionDescription}>Get notified when someone comments on your content</p>
              </div>
              <label className={styles.toggleWrapper}>
                <input
                  type="checkbox"
                  checked={settings.notifications.comments}
                  onChange={() => handleToggleChange("notifications", "comments")}
                  className={styles.toggleInput}
                />
                <span className={styles.toggleSlider}></span>
              </label>
            </div>
          </div>
        );

      case "privacy":
        return (
          <div className={styles.settingsContent}>
            <div className={styles.settingsOption}>
              <div className={styles.optionContent}>
                <h3 className={styles.optionTitle}>Online Status</h3>
                <p className={styles.optionDescription}>Show when you're active on the app</p>
              </div>
              <label className={styles.toggleWrapper}>
                <input
                  type="checkbox"
                  checked={settings.privacy.showOnlineStatus}
                  onChange={() => handleToggleChange("privacy", "showOnlineStatus")}
                  className={styles.toggleInput}
                />
                <span className={styles.toggleSlider}></span>
              </label>
            </div>

            <div className={styles.settingsOption}>
              <div className={styles.optionContent}>
                <h3 className={styles.optionTitle}>Read Receipts</h3>
                <p className={styles.optionDescription}>Let others know when you've read their messages</p>
              </div>
              <label className={styles.toggleWrapper}>
                <input
                  type="checkbox"
                  checked={settings.privacy.showReadReceipts}
                  onChange={() => handleToggleChange("privacy", "showReadReceipts")}
                  className={styles.toggleInput}
                />
                <span className={styles.toggleSlider}></span>
              </label>
            </div>

            <div className={styles.settingsOption}>
              <div className={styles.optionContent}>
                <h3 className={styles.optionTitle}>Last Seen</h3>
                <p className={styles.optionDescription}>Show when you were last active</p>
              </div>
              <label className={styles.toggleWrapper}>
                <input
                  type="checkbox"
                  checked={settings.privacy.showLastSeen}
                  onChange={() => handleToggleChange("privacy", "showLastSeen")}
                  className={styles.toggleInput}
                />
                <span className={styles.toggleSlider}></span>
              </label>
            </div>

            <div className={styles.settingsOption}>
              <div className={styles.optionContent}>
                <h3 className={styles.optionTitle}>Story Replies</h3>
                <p className={styles.optionDescription}>Control who can reply to your stories</p>
              </div>
              <div className={styles.radioGroup}>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="storyReplies"
                    value="everyone"
                    checked={settings.privacy.allowStoryReplies === "everyone"}
                    onChange={() => handleRadioChange("privacy", "allowStoryReplies", "everyone")}
                    className={styles.radioInput}
                  />
                  Everyone
                </label>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="storyReplies"
                    value="friends"
                    checked={settings.privacy.allowStoryReplies === "friends"}
                    onChange={() => handleRadioChange("privacy", "allowStoryReplies", "friends")}
                    className={styles.radioInput}
                  />
                  Friends only
                </label>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="storyReplies"
                    value="none"
                    checked={settings.privacy.allowStoryReplies === "none"}
                    onChange={() => handleRadioChange("privacy", "allowStoryReplies", "none")}
                    className={styles.radioInput}
                  />
                  No one
                </label>
              </div>
            </div>
            
            {/* Blocked Users Section */}
            <div className={styles.blockedUsersSection}>
              <div className={styles.sectionHeader}>
                <FaBan className={styles.sectionIcon} />
                <h3 className={styles.sectionTitle}>Blocked Users</h3>
              </div>
              <p className={styles.sectionDescription}>
                Users you've blocked cannot message you or view your profile
              </p>
              
              {loadingBlockedUsers ? (
                <div className={styles.loadingState}>
                  <div className={styles.spinner}></div>
                  <p>Loading blocked users...</p>
                </div>
              ) : blockedUsers.length === 0 ? (
                <div className={styles.emptyState}>
                  <FaUserSlash className={styles.emptyStateIcon} />
                  <p>You haven't blocked any users</p>
                </div>
              ) : (
                <div className={styles.blockedUsersList}>
                  {blockedUsers.map(user => (
                    <div key={user._id} className={styles.blockedUserItem}>
                      <div className={styles.blockedUserInfo}>
                        <img 
                          src={user.photos && user.photos[0] ? user.photos[0].url : "/default-avatar.png"} 
                          alt={user.nickname} 
                          className={styles.blockedUserAvatar}
                        />
                        <span className={styles.blockedUserName}>
                          {user.nickname || "User"}
                        </span>
                      </div>
                      <button 
                        className={styles.unblockButton}
                        onClick={() => handleUnblock(user._id, user.nickname)}
                      >
                        <FaUnlock /> Unblock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case "appearance":
        return (
          <div className={styles.settingsContent}>
            <div className={styles.settingsOption}>
              <div className={styles.optionContent}>
                <h3 className={styles.optionTitle}>{t('settings.themeMode')}</h3>
                <p className={styles.optionDescription}>{t('settings.themeMode')}</p>
              </div>
              <div className={styles.themeOptions}>
                <button
                  className={`${styles.themeOption} ${theme === "light" ? styles.active : ""}`}
                  onClick={() => handleThemeChange("light")}
                >
                  <div className={`${styles.themePreview} ${styles.light}`}></div>
                  <span className={styles.themeName}>{t('settings.light')}</span>
                </button>
                <button
                  className={`${styles.themeOption} ${theme === "dark" ? styles.active : ""}`}
                  onClick={() => handleThemeChange("dark")}
                >
                  <div className={`${styles.themePreview} ${styles.dark}`}></div>
                  <span className={styles.themeName}>{t('settings.dark')}</span>
                </button>
                <button
                  className={`${styles.themeOption} ${theme === "system" ? styles.active : ""}`}
                  onClick={() => handleThemeChange("system")}
                >
                  <div className={`${styles.themePreview} ${styles.system}`}></div>
                  <span className={styles.themeName}>{t('settings.system')}</span>
                </button>
              </div>
            </div>

            <div className={styles.settingsOption}>
              <div className={styles.optionContent}>
                <h3 className={styles.optionTitle}>Quick Theme Toggle</h3>
                <p className={styles.optionDescription}>Quickly switch between light and dark mode</p>
              </div>
              <ThemeToggle />
            </div>
            
            {/* Language Settings */}
            <div className={styles.settingsOption}>
              <div className={styles.optionContent}>
                <h3 className={styles.optionTitle}>
                  <FaLanguage className={styles.optionIcon} /> {t('settings.language')}
                </h3>
                <p className={styles.optionDescription}>
                  {t('settings.language')}
                </p>
              </div>
              
              {/* Import at the top: import LanguageSection from "../components/common/LanguageSection" */}
              <div className={styles.languageWrapper}>
                <div className={styles.languageOptions}>
                  <div 
                    className={`${styles.languageOption} ${language === 'en' ? styles.active : ''}`}
                    onClick={() => changeLanguage('en')}
                  >
                    <div className={styles.languageFlag}>🇺🇸</div>
                    <div className={styles.languageInfo}>
                      <div className={styles.languageName}>{t('settings.languages.english')}</div>
                      <div className={styles.languageNative}>English</div>
                    </div>
                    {language === 'en' && <div className={styles.languageActiveIndicator}>✓</div>}
                  </div>
                  
                  <div 
                    className={`${styles.languageOption} ${language === 'he' ? styles.active : ''}`}
                    onClick={() => changeLanguage('he')}
                  >
                    <div className={styles.languageFlag}>🇮🇱</div>
                    <div className={styles.languageInfo}>
                      <div className={styles.languageName}>{t('settings.languages.hebrew')}</div>
                      <div className={styles.languageNative}>עברית</div>
                    </div>
                    {language === 'he' && <div className={styles.languageActiveIndicator}>✓</div>}
                  </div>
                </div>
                
                <div className={styles.languageNotice}>
                  {language === 'en' ? 'Currently using English' : 'השפה הנוכחית היא עברית'}
                </div>
              </div>
            </div>
          </div>
        );

      case "account":
        return (
          <div className={styles.settingsContent}>
            <div className={styles.accountInfo}>
              <div className={styles.accountDetail}>
                <span className={styles.accountLabel}>Username:</span> {user?.username || "Not available"}
              </div>
              <div className={styles.accountDetail}>
                <span className={styles.accountLabel}>Email:</span> {user?.email || "Not available"}
              </div>
              <div className={styles.accountDetail}>
                <span className={styles.accountLabel}>Member since:</span>{" "}
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Not available"}
              </div>
              <div className={styles.accountDetail}>
                <span className={styles.accountLabel}>Subscription:</span> {user?.subscription?.plan || "Free"}
              </div>
            </div>

            <div className={styles.accountActions}>
              <button className={`${styles.actionButton} ${styles.editButton}`} onClick={() => navigate("/profile")}>
                <FaUser className={styles.actionIcon} />
                <span>Edit Profile</span>
              </button>

              <button className={`${styles.actionButton} ${styles.logoutButton}`} onClick={handleLogout}>
                <FaSignOutAlt className={styles.actionIcon} />
                <span>Log out</span>
              </button>

              <button className={`${styles.actionButton} ${styles.deleteButton}`} onClick={handleDeleteAccount}>
                <FaTrash className={styles.actionIcon} />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Add a loading state to ensure settings are only shown when we have user data
  // This conditional return MUST come after all hooks are defined
  if (!currentUser && loadingSettings && !fallbackSettings) {
    return (
      <div className={styles.settingsPage}>
        <Navbar />
        <div className={styles.settingsContent}>
          <div className={styles.settingsContainer}>
            <div className={styles.gradientBar}></div>
            <h1 className={styles.settingsTitle}>Settings</h1>
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p className={styles.loadingText}>Loading your settings...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.settingsPage}>
      <Navbar />
      <div className={styles.settingsContent}>
        <div className={styles.settingsContainer}>
          <div className={styles.gradientBar}></div>
          <h1 className={styles.settingsTitle}>Settings</h1>

          {/* Settings navigation */}
          <div className={styles.settingsNavigation}>
            <button
              className={`${styles.navItem} ${activeTab === "notifications" ? styles.active : ""}`}
              onClick={() => setActiveTab("notifications")}
            >
              <FaBell className={styles.navIcon} />
              <span>Notifications</span>
            </button>

            <button
              className={`${styles.navItem} ${activeTab === "privacy" ? styles.active : ""}`}
              onClick={() => setActiveTab("privacy")}
            >
              <FaLock className={styles.navIcon} />
              <span>Privacy</span>
            </button>

            <button
              className={`${styles.navItem} ${activeTab === "appearance" ? styles.active : ""}`}
              onClick={() => setActiveTab("appearance")}
            >
              <FaPalette className={styles.navIcon} />
              <span>Appearance</span>
            </button>

            <button
              className={`${styles.navItem} ${activeTab === "account" ? styles.active : ""}`}
              onClick={() => setActiveTab("account")}
            >
              <FaUser className={styles.navIcon} />
              <span>Account</span>
            </button>
          </div>

          {/* Settings content */}
          <div className={styles.settingsPanel}>
            <div className={styles.sectionHeader}>
              {activeTab === "notifications" && <FaBell className={styles.sectionIcon} />}
              {activeTab === "privacy" && <FaLock className={styles.sectionIcon} />}
              {activeTab === "appearance" && <FaPalette className={styles.sectionIcon} />}
              {activeTab === "account" && <FaUser className={styles.sectionIcon} />}

              <h2 className={styles.sectionTitle}>
                {activeTab === "notifications" && "Notification Settings"}
                {activeTab === "privacy" && "Privacy Settings"}
                {activeTab === "appearance" && "Appearance Settings"}
                {activeTab === "account" && "Account Settings"}
              </h2>
            </div>

            {renderTabContent()}

            {/* Save button - only show for tabs with settings that need saving */}
            {(activeTab === "notifications" || activeTab === "privacy") && (
              <div className={styles.saveSection}>
                <button
                  className={`${styles.saveButton} ${hasUnsavedChanges ? styles.hasChanges : ""}`}
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
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainer}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                <FaTrash /> Delete Account
              </h2>
              <button className={styles.closeButton} onClick={cancelDeleteAccount}>
                <FaTimes />
              </button>
            </div>

            <div className={styles.modalContent}>
              <div className={styles.warningBox}>
                <FaShieldAlt className={styles.warningIcon} />
                <p className={styles.warningText}>
                  This action <strong>cannot be undone</strong>. All your data will be permanently deleted, including:
                </p>
                <ul className={styles.warningList}>
                  <li className={styles.warningItem}>Your profile information</li>
                  <li className={styles.warningItem}>All messages and conversations</li>
                  <li className={styles.warningItem}>Photos and media you've shared</li>
                  <li className={styles.warningItem}>Stories and other content</li>
                </ul>
              </div>

              <div className={styles.passwordSection}>
                <label className={styles.passwordLabel} htmlFor="delete-password">Enter your password to confirm:</label>
                <input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your password"
                  className={`${styles.passwordInput} ${deleteError ? styles.error : ""}`}
                />
                {deleteError && (
                  <div className={styles.errorMessage}>
                    <FaExclamationTriangle /> {deleteError}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.buttonCancel} onClick={cancelDeleteAccount}>
                <FaTimes /> Cancel
              </button>
              <button className={styles.buttonDelete} onClick={confirmDeleteAccount} disabled={!deletePassword}>
                <FaTrash /> Delete My Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;