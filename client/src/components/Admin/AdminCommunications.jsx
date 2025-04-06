import React, { useState } from 'react';
import '../../styles/admin.css';
import AdminLayout from './AdminLayout';
import adminService from '../../services/AdminService';

const AdminCommunications = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  
  // Email campaign form
  const [emailForm, setEmailForm] = useState({
    subject: '',
    body: '',
    recipients: 'all', // all, active, premium, female, couple
    includeUnverified: false,
    scheduleDate: '',
    testEmail: ''
  });
  
  // Push notification form
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    recipients: 'all', // all, active, premium, female, couple
    action: 'none', // none, url, profile
    actionTarget: '',
    sendNow: true
  });
  
  const handleEmailChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEmailForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  const handleNotificationChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNotificationForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  const handleSendTestEmail = async () => {
    if (!emailForm.testEmail) {
      setError('Please enter a test email address');
      return;
    }
    
    setLoading(true);
    setSuccess(false);
    setError(null);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real implementation, we would call the API
      // const response = await adminService.sendEmail({
      //   ...emailForm,
      //   recipients: [emailForm.testEmail],
      //   isTest: true
      // });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Failed to send test email');
      console.error('Error sending test email:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSendEmail = async () => {
    if (!emailForm.subject || !emailForm.body) {
      setError('Please enter a subject and body for the email');
      return;
    }
    
    setLoading(true);
    setSuccess(false);
    setError(null);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real implementation, we would call the API
      // const response = await adminService.sendEmail(emailForm);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
      // Reset form
      setEmailForm({
        subject: '',
        body: '',
        recipients: 'all',
        includeUnverified: false,
        scheduleDate: '',
        testEmail: ''
      });
    } catch (err) {
      setError('Failed to send email campaign');
      console.error('Error sending email campaign:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSendNotification = async () => {
    if (!notificationForm.title || !notificationForm.message) {
      setError('Please enter a title and message for the notification');
      return;
    }
    
    // If action is url or profile, check that target is provided
    if (notificationForm.action !== 'none' && !notificationForm.actionTarget) {
      setError('Please enter a target for the notification action');
      return;
    }
    
    setLoading(true);
    setSuccess(false);
    setError(null);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real implementation, we would call the API
      // const response = await adminService.sendNotification(notificationForm);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
      // Reset form
      setNotificationForm({
        title: '',
        message: '',
        recipients: 'all',
        action: 'none',
        actionTarget: '',
        sendNow: true
      });
    } catch (err) {
      setError('Failed to send notification');
      console.error('Error sending notification:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Count for audience size based on recipient selection
  const getAudienceCount = (recipientType) => {
    const countMap = {
      all: 3245,
      active: 2158,
      premium: 432,
      female: 1243,
      couple: 187
    };
    
    return countMap[recipientType] || 0;
  };

  return (
    <AdminLayout title="Communications">
      {success && (
        <div className="admin-alert admin-alert-success">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Communication sent successfully!</span>
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
      
      <div className="admin-communications-container">
        {/* Email Campaigns */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Email Campaign</h3>
          </div>
          <div className="admin-card-body">
            <div className="admin-form-group">
              <label htmlFor="emailSubject">Subject</label>
              <input 
                type="text" 
                id="emailSubject" 
                name="subject" 
                className="admin-input" 
                placeholder="Enter email subject" 
                value={emailForm.subject} 
                onChange={handleEmailChange}
              />
            </div>
            
            <div className="admin-form-group">
              <label htmlFor="emailBody">Email Body</label>
              <textarea 
                id="emailBody" 
                name="body" 
                className="admin-textarea" 
                placeholder="Enter email body (supports HTML)"
                rows={8}
                value={emailForm.body} 
                onChange={handleEmailChange}
              ></textarea>
            </div>
            
            <div className="admin-form-group">
              <label htmlFor="emailRecipients">Recipients</label>
              <select 
                id="emailRecipients" 
                name="recipients" 
                className="admin-select" 
                value={emailForm.recipients} 
                onChange={handleEmailChange}
              >
                <option value="all">All Users</option>
                <option value="active">Active Users</option>
                <option value="premium">Premium Subscribers</option>
                <option value="female">Female Users</option>
                <option value="couple">Couple Accounts</option>
              </select>
              <div className="admin-form-helper-text">
                Audience size: approximately {getAudienceCount(emailForm.recipients)} users
              </div>
            </div>
            
            <div className="admin-form-group admin-form-checkbox">
              <label>
                <input 
                  type="checkbox" 
                  name="includeUnverified" 
                  checked={emailForm.includeUnverified} 
                  onChange={handleEmailChange}
                />
                Include unverified users
              </label>
            </div>
            
            <div className="admin-form-group">
              <label htmlFor="emailSchedule">Schedule Send (Optional)</label>
              <input 
                type="datetime-local" 
                id="emailSchedule" 
                name="scheduleDate" 
                className="admin-input" 
                value={emailForm.scheduleDate} 
                onChange={handleEmailChange}
              />
              <div className="admin-form-helper-text">
                Leave blank to send immediately
              </div>
            </div>
            
            <div className="admin-form-group">
              <label htmlFor="testEmail">Test Email Address</label>
              <div className="admin-input-with-button">
                <input 
                  type="email" 
                  id="testEmail" 
                  name="testEmail" 
                  className="admin-input" 
                  placeholder="Enter your email for testing" 
                  value={emailForm.testEmail} 
                  onChange={handleEmailChange}
                />
                <button 
                  className="admin-button admin-button-secondary" 
                  onClick={handleSendTestEmail}
                  disabled={loading}
                >
                  Send Test
                </button>
              </div>
            </div>
            
            <div className="admin-form-actions">
              <button 
                className="admin-button admin-button-primary" 
                onClick={handleSendEmail}
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Email Campaign'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Push Notifications */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Push Notification</h3>
          </div>
          <div className="admin-card-body">
            <div className="admin-form-group">
              <label htmlFor="notificationTitle">Notification Title</label>
              <input 
                type="text" 
                id="notificationTitle" 
                name="title" 
                className="admin-input" 
                placeholder="Enter notification title" 
                value={notificationForm.title} 
                onChange={handleNotificationChange}
              />
            </div>
            
            <div className="admin-form-group">
              <label htmlFor="notificationMessage">Notification Message</label>
              <textarea 
                id="notificationMessage" 
                name="message" 
                className="admin-textarea" 
                placeholder="Enter notification message"
                rows={4}
                value={notificationForm.message} 
                onChange={handleNotificationChange}
              ></textarea>
            </div>
            
            <div className="admin-form-group">
              <label htmlFor="notificationRecipients">Recipients</label>
              <select 
                id="notificationRecipients" 
                name="recipients" 
                className="admin-select" 
                value={notificationForm.recipients} 
                onChange={handleNotificationChange}
              >
                <option value="all">All Users</option>
                <option value="active">Active Users</option>
                <option value="premium">Premium Subscribers</option>
                <option value="female">Female Users</option>
                <option value="couple">Couple Accounts</option>
              </select>
              <div className="admin-form-helper-text">
                Audience size: approximately {getAudienceCount(notificationForm.recipients)} users
              </div>
            </div>
            
            <div className="admin-form-group">
              <label htmlFor="notificationAction">Action Type</label>
              <select 
                id="notificationAction" 
                name="action" 
                className="admin-select" 
                value={notificationForm.action} 
                onChange={handleNotificationChange}
              >
                <option value="none">No Action</option>
                <option value="url">Open URL</option>
                <option value="profile">Open User Profile</option>
              </select>
            </div>
            
            {notificationForm.action !== 'none' && (
              <div className="admin-form-group">
                <label htmlFor="notificationActionTarget">
                  {notificationForm.action === 'url' ? 'URL' : 'User ID'}
                </label>
                <input 
                  type="text" 
                  id="notificationActionTarget" 
                  name="actionTarget" 
                  className="admin-input" 
                  placeholder={notificationForm.action === 'url' ? 'https://example.com' : 'user123'} 
                  value={notificationForm.actionTarget} 
                  onChange={handleNotificationChange}
                />
              </div>
            )}
            
            <div className="admin-form-group admin-form-checkbox">
              <label>
                <input 
                  type="checkbox" 
                  name="sendNow" 
                  checked={notificationForm.sendNow} 
                  onChange={handleNotificationChange}
                />
                Send immediately
              </label>
            </div>
            
            <div className="admin-form-actions">
              <button 
                className="admin-button admin-button-primary" 
                onClick={handleSendNotification}
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Communication History */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Recent Communications</h3>
          </div>
          <div className="admin-card-body">
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Subject/Title</th>
                    <th>Recipients</th>
                    <th>Status</th>
                    <th>Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Apr 5, 2025</td>
                    <td>Email</td>
                    <td>New Features Announcement</td>
                    <td>All Users (3,241)</td>
                    <td><span className="admin-status-badge active">Sent</span></td>
                    <td>42% opened</td>
                  </tr>
                  <tr>
                    <td>Apr 3, 2025</td>
                    <td>Notification</td>
                    <td>Weekend Special Offer</td>
                    <td>Free Users (2,809)</td>
                    <td><span className="admin-status-badge active">Sent</span></td>
                    <td>38% clicked</td>
                  </tr>
                  <tr>
                    <td>Apr 2, 2025</td>
                    <td>Email</td>
                    <td>Your March Activity Summary</td>
                    <td>Active Users (2,156)</td>
                    <td><span className="admin-status-badge active">Sent</span></td>
                    <td>56% opened</td>
                  </tr>
                  <tr>
                    <td>Mar 28, 2025</td>
                    <td>Email</td>
                    <td>Profile Completion Reminder</td>
                    <td>New Users (187)</td>
                    <td><span className="admin-status-badge active">Sent</span></td>
                    <td>61% opened</td>
                  </tr>
                  <tr>
                    <td>Mar 25, 2025</td>
                    <td>Notification</td>
                    <td>New Message Waiting</td>
                    <td>Inactive Users (689)</td>
                    <td><span className="admin-status-badge active">Sent</span></td>
                    <td>27% clicked</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminCommunications;