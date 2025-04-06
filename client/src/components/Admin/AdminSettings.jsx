import React, { useState, useEffect } from 'react';
import '../../styles/admin.css';
import AdminLayout from './AdminLayout';
import adminService from '../../services/AdminService';

const AdminSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  
  // Group settings by category
  const [generalSettings, setGeneralSettings] = useState({
    siteName: 'Mandarin Dating',
    siteDescription: 'Connect with singles in your area',
    supportEmail: 'support@mandarin-dating.com',
    maxUploadSize: 10,
    defaultLanguage: 'en',
    enableRegistration: true,
    maintenanceMode: false
  });
  
  const [userSettings, setUserSettings] = useState({
    defaultUserRole: 'user',
    requireEmailVerification: true,
    verificationExpiry: 24,
    allowProfileVisibility: true,
    minimumAge: 18,
    maximumAge: 99,
    maximumPhotos: 10,
    allowMultipleGenders: true,
    allowCoupleAccounts: true
  });
  
  const [messageSettings, setMessageSettings] = useState({
    allowDirectMessages: true,
    allowFileSharing: true,
    maximumMessageLength: 2000,
    messageRateLimit: 50,
    messageRetentionDays: 90,
    filterProfanity: true,
    blockExternalLinks: false
  });
  
  const [notificationSettings, setNotificationSettings] = useState({
    enableEmailNotifications: true,
    enablePushNotifications: true,
    emailDigestFrequency: 'daily',
    newMessageNotification: true,
    newMatchNotification: true,
    profileViewNotification: true,
    systemAnnouncementNotification: true
  });
  
  const [securitySettings, setSecuritySettings] = useState({
    passwordMinLength: 8,
    requireStrongPasswords: true,
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    lockoutDuration: 15,
    enableTwoFactorAuth: false,
    ipLogging: true,
    dataRetentionPolicy: 'gdpr-compliant'
  });
  
  // Mock loading settings from API
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // In a real implementation, we would fetch settings from the API
        // const response = await adminService.getSettings();
        // if (response.success) {
        //   const { general, user, message, notification, security } = response.data;
        //   setGeneralSettings(general);
        //   setUserSettings(user);
        //   setMessageSettings(message);
        //   setNotificationSettings(notification);
        //   setSecuritySettings(security);
        // }
        
        // For now, we'll just use the default mock values
      } catch (err) {
        setError('Failed to load settings');
        console.error('Error loading settings:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, []);
  
  const saveSettings = async () => {
    setSaveInProgress(true);
    setSuccess(false);
    setError(null);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real implementation, we would save settings via the API
      // const response = await adminService.updateSettings({
      //   general: generalSettings,
      //   user: userSettings,
      //   message: messageSettings,
      //   notification: notificationSettings,
      //   security: securitySettings
      // });
      // if (response.success) {
      //   setSuccess(true);
      // } else {
      //   setError(response.error || 'Failed to save settings');
      // }
      
      // For now, just simulate success
      setSuccess(true);
    } catch (err) {
      setError('Failed to save settings');
      console.error('Error saving settings:', err);
    } finally {
      setSaveInProgress(false);
      
      // Auto-hide success message after 3 seconds
      if (success) {
        setTimeout(() => setSuccess(false), 3000);
      }
    }
  };
  
  const handleGeneralChange = (e) => {
    const { name, value, type, checked } = e.target;
    setGeneralSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  const handleUserChange = (e) => {
    const { name, value, type, checked } = e.target;
    setUserSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value, 10) : value
    }));
  };
  
  const handleMessageChange = (e) => {
    const { name, value, type, checked } = e.target;
    setMessageSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value, 10) : value
    }));
  };
  
  const handleNotificationChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNotificationSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  const handleSecurityChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSecuritySettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value, 10) : value
    }));
  };

  return (
    <AdminLayout title="System Settings">
      {loading ? (
        <div className="admin-loading">
          <div className="spinner"></div>
          <p>Loading system settings...</p>
        </div>
      ) : (
        <>
          {success && (
            <div className="admin-alert admin-alert-success">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Settings saved successfully!</span>
            </div>
          )}
          
          {error && (
            <div className="admin-alert admin-alert-error">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 9L9 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 9L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>{error}</span>
            </div>
          )}
          
          <div className="admin-settings-container">
            {/* General Settings */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h3>General Settings</h3>
              </div>
              <div className="admin-card-body">
                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label htmlFor="siteName">Site Name</label>
                    <input 
                      type="text" 
                      id="siteName" 
                      name="siteName" 
                      className="admin-input" 
                      value={generalSettings.siteName} 
                      onChange={handleGeneralChange}
                    />
                  </div>
                  
                  <div className="admin-form-group">
                    <label htmlFor="siteDescription">Site Description</label>
                    <input 
                      type="text" 
                      id="siteDescription" 
                      name="siteDescription" 
                      className="admin-input" 
                      value={generalSettings.siteDescription} 
                      onChange={handleGeneralChange}
                    />
                  </div>
                  
                  <div className="admin-form-group">
                    <label htmlFor="supportEmail">Support Email</label>
                    <input 
                      type="email" 
                      id="supportEmail" 
                      name="supportEmail" 
                      className="admin-input" 
                      value={generalSettings.supportEmail} 
                      onChange={handleGeneralChange}
                    />
                  </div>
                  
                  <div className="admin-form-group">
                    <label htmlFor="maxUploadSize">Max Upload Size (MB)</label>
                    <input 
                      type="number" 
                      id="maxUploadSize" 
                      name="maxUploadSize" 
                      className="admin-input" 
                      value={generalSettings.maxUploadSize} 
                      onChange={handleGeneralChange}
                    />
                  </div>
                  
                  <div className="admin-form-group">
                    <label htmlFor="defaultLanguage">Default Language</label>
                    <select 
                      id="defaultLanguage" 
                      name="defaultLanguage" 
                      className="admin-select" 
                      value={generalSettings.defaultLanguage} 
                      onChange={handleGeneralChange}
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="zh">Chinese</option>
                    </select>
                  </div>
                  
                  <div className="admin-form-group admin-form-checkbox">
                    <label>
                      <input 
                        type="checkbox" 
                        name="enableRegistration" 
                        checked={generalSettings.enableRegistration} 
                        onChange={handleGeneralChange}
                      />
                      Enable Registration
                    </label>
                  </div>
                  
                  <div className="admin-form-group admin-form-checkbox">
                    <label>
                      <input 
                        type="checkbox" 
                        name="maintenanceMode" 
                        checked={generalSettings.maintenanceMode} 
                        onChange={handleGeneralChange}
                      />
                      Maintenance Mode
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            {/* User Settings */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h3>User Settings</h3>
              </div>
              <div className="admin-card-body">
                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label htmlFor="defaultUserRole">Default User Role</label>
                    <select 
                      id="defaultUserRole" 
                      name="defaultUserRole" 
                      className="admin-select" 
                      value={userSettings.defaultUserRole} 
                      onChange={handleUserChange}
                    >
                      <option value="user">User</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
                  
                  <div className="admin-form-group admin-form-checkbox">
                    <label>
                      <input 
                        type="checkbox" 
                        name="requireEmailVerification" 
                        checked={userSettings.requireEmailVerification} 
                        onChange={handleUserChange}
                      />
                      Require Email Verification
                    </label>
                  </div>
                  
                  <div className="admin-form-group">
                    <label htmlFor="verificationExpiry">Verification Link Expiry (hours)</label>
                    <input 
                      type="number" 
                      id="verificationExpiry" 
                      name="verificationExpiry" 
                      className="admin-input" 
                      value={userSettings.verificationExpiry} 
                      onChange={handleUserChange}
                    />
                  </div>
                  
                  <div className="admin-form-group admin-form-checkbox">
                    <label>
                      <input 
                        type="checkbox" 
                        name="allowProfileVisibility" 
                        checked={userSettings.allowProfileVisibility} 
                        onChange={handleUserChange}
                      />
                      Allow Profile Visibility Control
                    </label>
                  </div>
                  
                  <div className="admin-form-group">
                    <label htmlFor="minimumAge">Minimum Age</label>
                    <input 
                      type="number" 
                      id="minimumAge" 
                      name="minimumAge" 
                      className="admin-input" 
                      value={userSettings.minimumAge} 
                      onChange={handleUserChange}
                    />
                  </div>
                  
                  <div className="admin-form-group">
                    <label htmlFor="maximumPhotos">Maximum Photos</label>
                    <input 
                      type="number" 
                      id="maximumPhotos" 
                      name="maximumPhotos" 
                      className="admin-input" 
                      value={userSettings.maximumPhotos} 
                      onChange={handleUserChange}
                    />
                  </div>
                  
                  <div className="admin-form-group admin-form-checkbox">
                    <label>
                      <input 
                        type="checkbox" 
                        name="allowMultipleGenders" 
                        checked={userSettings.allowMultipleGenders} 
                        onChange={handleUserChange}
                      />
                      Allow Multiple Genders
                    </label>
                  </div>
                  
                  <div className="admin-form-group admin-form-checkbox">
                    <label>
                      <input 
                        type="checkbox" 
                        name="allowCoupleAccounts" 
                        checked={userSettings.allowCoupleAccounts} 
                        onChange={handleUserChange}
                      />
                      Allow Couple Accounts
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Message Settings */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h3>Messaging Settings</h3>
              </div>
              <div className="admin-card-body">
                <div className="admin-form-grid">
                  <div className="admin-form-group admin-form-checkbox">
                    <label>
                      <input 
                        type="checkbox" 
                        name="allowDirectMessages" 
                        checked={messageSettings.allowDirectMessages} 
                        onChange={handleMessageChange}
                      />
                      Allow Direct Messages
                    </label>
                  </div>
                  
                  <div className="admin-form-group admin-form-checkbox">
                    <label>
                      <input 
                        type="checkbox" 
                        name="allowFileSharing" 
                        checked={messageSettings.allowFileSharing} 
                        onChange={handleMessageChange}
                      />
                      Allow File Sharing
                    </label>
                  </div>
                  
                  <div className="admin-form-group">
                    <label htmlFor="maximumMessageLength">Maximum Message Length</label>
                    <input 
                      type="number" 
                      id="maximumMessageLength" 
                      name="maximumMessageLength" 
                      className="admin-input" 
                      value={messageSettings.maximumMessageLength} 
                      onChange={handleMessageChange}
                    />
                  </div>
                  
                  <div className="admin-form-group">
                    <label htmlFor="messageRateLimit">Message Rate Limit (per hour)</label>
                    <input 
                      type="number" 
                      id="messageRateLimit" 
                      name="messageRateLimit" 
                      className="admin-input" 
                      value={messageSettings.messageRateLimit} 
                      onChange={handleMessageChange}
                    />
                  </div>
                  
                  <div className="admin-form-group">
                    <label htmlFor="messageRetentionDays">Message Retention (days)</label>
                    <input 
                      type="number" 
                      id="messageRetentionDays" 
                      name="messageRetentionDays" 
                      className="admin-input" 
                      value={messageSettings.messageRetentionDays} 
                      onChange={handleMessageChange}
                    />
                  </div>
                  
                  <div className="admin-form-group admin-form-checkbox">
                    <label>
                      <input 
                        type="checkbox" 
                        name="filterProfanity" 
                        checked={messageSettings.filterProfanity} 
                        onChange={handleMessageChange}
                      />
                      Filter Profanity
                    </label>
                  </div>
                  
                  <div className="admin-form-group admin-form-checkbox">
                    <label>
                      <input 
                        type="checkbox" 
                        name="blockExternalLinks" 
                        checked={messageSettings.blockExternalLinks} 
                        onChange={handleMessageChange}
                      />
                      Block External Links
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Notification Settings */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h3>Notification Settings</h3>
              </div>
              <div className="admin-card-body">
                <div className="admin-form-grid">
                  <div className="admin-form-group admin-form-checkbox">
                    <label>
                      <input 
                        type="checkbox" 
                        name="enableEmailNotifications" 
                        checked={notificationSettings.enableEmailNotifications} 
                        onChange={handleNotificationChange}
                      />
                      Enable Email Notifications
                    </label>
                  </div>
                  
                  <div className="admin-form-group admin-form-checkbox">
                    <label>
                      <input 
                        type="checkbox" 
                        name="enablePushNotifications" 
                        checked={notificationSettings.enablePushNotifications} 
                        onChange={handleNotificationChange}
                      />
                      Enable Push Notifications
                    </label>
                  </div>
                  
                  <div className="admin-form-group">
                    <label htmlFor="emailDigestFrequency">Email Digest Frequency</label>
                    <select 
                      id="emailDigestFrequency" 
                      name="emailDigestFrequency" 
                      className="admin-select" 
                      value={notificationSettings.emailDigestFrequency} 
                      onChange={handleNotificationChange}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="never">Never</option>
                    </select>
                  </div>
                  
                  <div className="admin-form-group admin-form-checkbox">
                    <label>
                      <input 
                        type="checkbox" 
                        name="newMessageNotification" 
                        checked={notificationSettings.newMessageNotification} 
                        onChange={handleNotificationChange}
                      />
                      New Message Notifications
                    </label>
                  </div>
                  
                  <div className="admin-form-group admin-form-checkbox">
                    <label>
                      <input 
                        type="checkbox" 
                        name="newMatchNotification" 
                        checked={notificationSettings.newMatchNotification} 
                        onChange={handleNotificationChange}
                      />
                      New Match Notifications
                    </label>
                  </div>
                  
                  <div className="admin-form-group admin-form-checkbox">
                    <label>
                      <input 
                        type="checkbox" 
                        name="profileViewNotification" 
                        checked={notificationSettings.profileViewNotification} 
                        onChange={handleNotificationChange}
                      />
                      Profile View Notifications
                    </label>
                  </div>
                  
                  <div className="admin-form-group admin-form-checkbox">
                    <label>
                      <input 
                        type="checkbox" 
                        name="systemAnnouncementNotification" 
                        checked={notificationSettings.systemAnnouncementNotification} 
                        onChange={handleNotificationChange}
                      />
                      System Announcement Notifications
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Security Settings */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h3>Security Settings</h3>
              </div>
              <div className="admin-card-body">
                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label htmlFor="passwordMinLength">Minimum Password Length</label>
                    <input 
                      type="number" 
                      id="passwordMinLength" 
                      name="passwordMinLength" 
                      className="admin-input" 
                      value={securitySettings.passwordMinLength} 
                      onChange={handleSecurityChange}
                    />
                  </div>
                  
                  <div className="admin-form-group admin-form-checkbox">
                    <label>
                      <input 
                        type="checkbox" 
                        name="requireStrongPasswords" 
                        checked={securitySettings.requireStrongPasswords} 
                        onChange={handleSecurityChange}
                      />
                      Require Strong Passwords
                    </label>
                  </div>
                  
                  <div className="admin-form-group">
                    <label htmlFor="sessionTimeout">Session Timeout (minutes)</label>
                    <input 
                      type="number" 
                      id="sessionTimeout" 
                      name="sessionTimeout" 
                      className="admin-input" 
                      value={securitySettings.sessionTimeout} 
                      onChange={handleSecurityChange}
                    />
                  </div>
                  
                  <div className="admin-form-group">
                    <label htmlFor="maxLoginAttempts">Max Login Attempts</label>
                    <input 
                      type="number" 
                      id="maxLoginAttempts" 
                      name="maxLoginAttempts" 
                      className="admin-input" 
                      value={securitySettings.maxLoginAttempts} 
                      onChange={handleSecurityChange}
                    />
                  </div>
                  
                  <div className="admin-form-group">
                    <label htmlFor="lockoutDuration">Lockout Duration (minutes)</label>
                    <input 
                      type="number" 
                      id="lockoutDuration" 
                      name="lockoutDuration" 
                      className="admin-input" 
                      value={securitySettings.lockoutDuration} 
                      onChange={handleSecurityChange}
                    />
                  </div>
                  
                  <div className="admin-form-group admin-form-checkbox">
                    <label>
                      <input 
                        type="checkbox" 
                        name="enableTwoFactorAuth" 
                        checked={securitySettings.enableTwoFactorAuth} 
                        onChange={handleSecurityChange}
                      />
                      Enable Two-Factor Authentication
                    </label>
                  </div>
                  
                  <div className="admin-form-group admin-form-checkbox">
                    <label>
                      <input 
                        type="checkbox" 
                        name="ipLogging" 
                        checked={securitySettings.ipLogging} 
                        onChange={handleSecurityChange}
                      />
                      IP Logging
                    </label>
                  </div>
                  
                  <div className="admin-form-group">
                    <label htmlFor="dataRetentionPolicy">Data Retention Policy</label>
                    <select 
                      id="dataRetentionPolicy" 
                      name="dataRetentionPolicy" 
                      className="admin-select" 
                      value={securitySettings.dataRetentionPolicy} 
                      onChange={handleSecurityChange}
                    >
                      <option value="gdpr-compliant">GDPR Compliant</option>
                      <option value="ccpa-compliant">CCPA Compliant</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="admin-form-actions">
              <button 
                className="admin-button admin-button-primary" 
                onClick={saveSettings} 
                disabled={saveInProgress}
              >
                {saveInProgress ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
};

export default AdminSettings;