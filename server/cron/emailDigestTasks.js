// cron/emailDigestTasks.js - Email digest notifications scheduler
import cron from 'node-cron';
import logger from '../logger.js';
import { User, Notification } from '../models/index.js';
import emailService from '../utils/emailService.js';
import config from '../config.js';
import mongoose from 'mongoose';

/**
 * Send hourly email digest notifications
 * @returns {Promise<void>}
 */
const sendHourlyEmailDigests = async () => {
  try {
    logger.info("Running hourly email digest task");
    
    // Find users with hourly digest frequency who have email notifications enabled
    const users = await User.find({
      'settings.notifications.email': true,
      'settings.notifications.emailDigestFrequency': 'hourly',
      email: { $exists: true, $ne: '' }
    }).select('_id email nickname settings');
    
    logger.info(`Found ${users.length} users with hourly email digest settings`);
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let digestsSent = 0;
    
    // Process each user
    for (const user of users) {
      try {
        // Get unread notifications from the last hour for this user
        const notifications = await Notification.find({
          recipient: user._id,
          createdAt: { $gte: oneHourAgo },
          read: false
        }).populate('sender', 'nickname photos details').sort({ createdAt: -1 }).limit(50);
        
        if (notifications.length === 0) {
          continue; // Skip if no notifications to send
        }
        
        // Group notifications by type
        const groupedNotifications = {
          message: notifications.filter(n => n.type === 'message'),
          like: notifications.filter(n => n.type === 'like'),
          story: notifications.filter(n => n.type === 'story'),
          comment: notifications.filter(n => n.type === 'comment')
        };
        
        // Build notification summary
        const summary = {
          totalCount: notifications.length,
          messages: groupedNotifications.message.length,
          likes: groupedNotifications.like.length,
          stories: groupedNotifications.story.length,
          comments: groupedNotifications.comment.length,
          senders: [...new Set(notifications.map(n => n.sender?.nickname || 'Someone'))]
            .slice(0, 5) // Limit to 5 senders max
        };
        
        // Send digest email
        await sendDigestEmail(user, summary, 'hourly');
        digestsSent++;
        
      } catch (userError) {
        logger.error(`Error processing hourly digest for user ${user._id}: ${userError.message}`);
      }
    }
    
    logger.info(`Sent ${digestsSent} hourly email digests`);
  } catch (error) {
    logger.error(`Error sending hourly email digests: ${error.message}`, { stack: error.stack });
  }
};

/**
 * Send daily email digest notifications
 * @returns {Promise<void>}
 */
const sendDailyEmailDigests = async () => {
  try {
    logger.info("Running daily email digest task");
    
    // Find users with daily digest frequency who have email notifications enabled
    const users = await User.find({
      'settings.notifications.email': true,
      'settings.notifications.emailDigestFrequency': 'daily',
      email: { $exists: true, $ne: '' }
    }).select('_id email nickname settings');
    
    logger.info(`Found ${users.length} users with daily email digest settings`);
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let digestsSent = 0;
    
    // Process each user
    for (const user of users) {
      try {
        // Get unread notifications from the last 24 hours for this user
        const notifications = await Notification.find({
          recipient: user._id,
          createdAt: { $gte: oneDayAgo },
          read: false
        }).populate('sender', 'nickname photos details').sort({ createdAt: -1 }).limit(100);
        
        if (notifications.length === 0) {
          continue; // Skip if no notifications to send
        }
        
        // Group notifications by type
        const groupedNotifications = {
          message: notifications.filter(n => n.type === 'message'),
          like: notifications.filter(n => n.type === 'like'),
          story: notifications.filter(n => n.type === 'story'),
          comment: notifications.filter(n => n.type === 'comment')
        };
        
        // Build notification summary
        const summary = {
          totalCount: notifications.length,
          messages: groupedNotifications.message.length,
          likes: groupedNotifications.like.length,
          stories: groupedNotifications.story.length,
          comments: groupedNotifications.comment.length,
          senders: [...new Set(notifications.map(n => n.sender?.nickname || 'Someone'))]
            .slice(0, 10) // Limit to 10 senders max for daily digest
        };
        
        // Send digest email
        await sendDigestEmail(user, summary, 'daily');
        digestsSent++;
        
      } catch (userError) {
        logger.error(`Error processing daily digest for user ${user._id}: ${userError.message}`);
      }
    }
    
    logger.info(`Sent ${digestsSent} daily email digests`);
  } catch (error) {
    logger.error(`Error sending daily email digests: ${error.message}`, { stack: error.stack });
  }
};

/**
 * Send a digest email to a user
 * @param {Object} user - User object
 * @param {Object} summary - Notification summary object
 * @param {string} frequency - Digest frequency (hourly/daily)
 * @returns {Promise<void>}
 */
const sendDigestEmail = async (user, summary, frequency) => {
  try {
    const appName = config.APP_NAME || "Mandarin Dating";
    const appUrl = config.APP_URL || "https://mandarindating.com";
    
    // Build title based on frequency
    const title = frequency === 'hourly'
      ? `Your ${appName} hourly update`
      : `Your ${appName} daily summary`;
    
    // Build subject line based on notification types
    let subject = `${title}: `;
    if (summary.messages > 0) {
      subject += `${summary.messages} new message${summary.messages > 1 ? 's' : ''}`;
    } else if (summary.likes > 0) {
      subject += `${summary.likes} new like${summary.likes > 1 ? 's' : ''}`;
    } else {
      subject += `${summary.totalCount} new notification${summary.totalCount > 1 ? 's' : ''}`;
    }
    
    // Create sender list text
    const senderText = summary.senders.length > 0
      ? summary.senders.join(', ') + (summary.totalCount > summary.senders.length ? ' and others' : '')
      : 'Several users';
    
    // Plain text version
    const text = `
      Hello ${user.nickname},

      Here's your ${frequency} update from ${appName}:

      ${summary.messages > 0 ? `• ${summary.messages} new message${summary.messages > 1 ? 's' : ''}\n` : ''}
      ${summary.likes > 0 ? `• ${summary.likes} new like${summary.likes > 1 ? 's' : ''}\n` : ''}
      ${summary.stories > 0 ? `• ${summary.stories} new story notification${summary.stories > 1 ? 's' : ''}\n` : ''}
      ${summary.comments > 0 ? `• ${summary.comments} new comment${summary.comments > 1 ? 's' : ''}\n` : ''}

      From: ${senderText}

      Click here to view your notifications:
      ${appUrl}/messages

      You're receiving this email because you've chosen the ${frequency} digest option.
      To change your preferences, visit your notification settings at ${appUrl}/settings/notifications.

      Best regards,
      The ${appName} Team
    `;
    
    // HTML version
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
          }
          .container {
            border: 1px solid #e1e1e1;
            border-radius: 8px;
            padding: 20px;
            background-color: #fff;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
          }
          .header {
            text-align: center;
            padding-bottom: 15px;
            border-bottom: 1px solid #e1e1e1;
            margin-bottom: 20px;
          }
          .button {
            display: inline-block;
            background-color: #ff4b7d;
            color: white !important;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 4px;
            margin: 20px 0;
            font-weight: bold;
            text-align: center;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #888;
            padding-top: 15px;
            border-top: 1px solid #e1e1e1;
          }
          .notification-summary {
            background-color: #f6f6f6;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
          }
          .summary-item {
            margin: 10px 0;
            padding-left: 15px;
            border-left: 3px solid #ff4b7d;
          }
          .count {
            font-weight: bold;
            color: #ff4b7d;
          }
          .sender-list {
            margin-top: 15px;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${appName}</h1>
            <h2>${title}</h2>
          </div>
          
          <p>Hello ${user.nickname},</p>
          
          <p>Here's your ${frequency} update:</p>
          
          <div class="notification-summary">
            ${summary.messages > 0 ? `
              <div class="summary-item">
                <span class="count">${summary.messages}</span> new message${summary.messages > 1 ? 's' : ''}
              </div>
            ` : ''}
            
            ${summary.likes > 0 ? `
              <div class="summary-item">
                <span class="count">${summary.likes}</span> new like${summary.likes > 1 ? 's' : ''}
              </div>
            ` : ''}
            
            ${summary.stories > 0 ? `
              <div class="summary-item">
                <span class="count">${summary.stories}</span> new story notification${summary.stories > 1 ? 's' : ''}
              </div>
            ` : ''}
            
            ${summary.comments > 0 ? `
              <div class="summary-item">
                <span class="count">${summary.comments}</span> new comment${summary.comments > 1 ? 's' : ''}
              </div>
            ` : ''}
            
            <div class="sender-list">
              From: ${senderText}
            </div>
          </div>
          
          <div style="text-align: center;">
            <a href="${appUrl}/messages" class="button">View Your Notifications</a>
          </div>
          
          <p>You're receiving this email because you've chosen the ${frequency} digest option.</p>
          
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
            <p>
              <small>To change your email preferences, 
              <a href="${appUrl}/settings/notifications">update your notification settings</a>.</small>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Send the email
    await emailService.sendEmailNotification({
      to: user.email,
      subject,
      text,
      html,
    });
    
    logger.debug(`Sent ${frequency} digest email to ${user.email}`);
  } catch (error) {
    logger.error(`Error sending digest email: ${error.message}`);
    throw error;
  }
};

/**
 * Initialize all email digest cron tasks
 */
const initEmailDigestTasks = () => {
  // Send hourly digests at the start of each hour
  cron.schedule("0 * * * *", sendHourlyEmailDigests);
  
  // Send daily digests at 9 AM (server time)
  cron.schedule("0 9 * * *", sendDailyEmailDigests);
  
  logger.info("Email digest tasks initialized");
};

// Export both the initialization function and the individual tasks
// This allows for easier unit testing of individual tasks
export { 
  initEmailDigestTasks,
  sendHourlyEmailDigests,
  sendDailyEmailDigests
};

export default initEmailDigestTasks;