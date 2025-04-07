// server/utils/emailService.js

// Import the Resend SDK
import { Resend } from 'resend';
// Keep config for APP_NAME, APP_URL, etc.
import config from '../config.js';
// Keep your logger
import logger from '../logger.js';
// Load environment variables (ensure dotenv is configured in your app entry point)
// require('dotenv').config(); // Or however you load .env

// --- Resend Configuration ---
// Initialize Resend with your API key from environment variables
// Ensure RESEND_API_KEY is set in your .env file
const resend = new Resend(config.RESEND_API_KEY || process.env.RESEND_API_KEY);

// Default sender address - MUST be from your verified domain in Resend (flirtss.com)
const DEFAULT_FROM_ADDRESS = `"${config.APP_NAME || 'Flirtss'}" <${config.EMAIL_FROM || 'noreply@flirtss.com'}>`;

// --- Core Sending Function (Rewritten for Resend) ---

/**
 * Sends an email notification using Resend.
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address.
 * @param {string} options.subject - Email subject.
 * @param {string} options.text - Plain text content for the email body.
 * @param {string} options.html - HTML content for the email body.
 * @param {string} [options.from=DEFAULT_FROM_ADDRESS] - Sender email address.
 * @returns {Promise<object|null>} Resend API response data { id: '...' } or null on error.
 */
export const sendEmailNotification = async ({ to, subject, text, html, from = DEFAULT_FROM_ADDRESS }) => {
  // Check if Resend API key is configured
  if (!resend.apiKey) { // Note: Accessing apiKey directly might change in future SDK versions
    logger.error('Resend API Key is not configured. Check RESEND_API_KEY environment variable.');
    // Optionally throw an error or return a specific error object
    return null;
  }

  // Basic validation
  if (!to || !subject || (!text && !html)) {
    logger.error('Missing required parameters for sendEmailNotification (to, subject, text/html).');
    return null;
  }

  try {
    logger.info(`Attempting to send email via Resend to: ${to}, Subject: ${subject}`);

    // Use the Resend SDK to send the email
    const { data, error } = await resend.emails.send({
      from: from,
      to: [to], // Resend expects 'to' to be an array
      subject: subject,
      text: text, // Include plain text version if available
      html: html, // HTML version
      // Add tags for categorization if desired
      // tags: [{ name: 'category', value: 'notification' }],
    });

    // Handle potential errors returned by the Resend API
    if (error) {
      logger.error('Resend API Error:', {
        message: error.message,
        name: error.name,
        // Avoid logging potentially sensitive details in production
        // details: error,
      });
      return null; // Indicate failure
    }

    // Log success and return the response data (contains message ID)
    logger.info(`Email sent successfully via Resend to ${to}. Message ID: ${data?.id}`);
    return data; // e.g., { id: '...' }

  } catch (err) {
    // Catch unexpected errors during the API call or processing
    logger.error(`Unexpected error sending email via Resend: ${err.message}`, { stack: err.stack });
    // Optionally re-throw or return null/error object
    return null;
  }
};


// --- Specific Email Generation Functions (Unchanged Logic, Uses New Sender) ---

/**
 * Generates and sends a verification email
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.nickname - User's nickname
 * @param {string} options.token - Verification token
 * @returns {Promise<object|null>} - Resend response data or null
 */
export const sendVerificationEmail = async ({ email, nickname, token }) => {
  const appName = config.APP_NAME || "Flirtss";
  const appUrl = config.APP_URL || "https://flirtss.com";
  // Ensure the base URL doesn't have a trailing slash if adding path directly
  const verificationUrl = `${appUrl.replace(/\/$/, '')}/verify-email?token=${token}`;

  const subject = `Verify your email for ${appName}`;

  // Plain text version (keep as is)
  const text = `
    Hello ${nickname},

    Thank you for registering with ${appName}!

    Please verify your email address by clicking the link below:
    ${verificationUrl}

    This link will expire in 24 hours.

    If you did not create an account, please ignore this email.

    Best regards,
    The ${appName} Team
  `;

  // HTML version (keep as is - ensure image paths are absolute URLs or embedded)
  // Make sure image URLs like ${appUrl}/logo.png are correct and publicly accessible
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f9f9f9;
        }
        .container {
          border: 1px solid #e1e1e1;
          border-radius: 12px;
          padding: 25px;
          background-color: #fff;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .header {
          text-align: center;
          padding-bottom: 20px;
          margin-bottom: 25px;
        }
        .logo {
          max-width: 180px; /* Ensure logo size is appropriate */
          height: auto;
          margin-bottom: 15px;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #ff6b6b 0%, #ff2d73 100%);
          color: white !important; /* Ensure high contrast */
          text-decoration: none;
          padding: 14px 28px;
          border-radius: 50px; /* Fully rounded */
          margin: 25px 0;
          font-weight: bold;
          font-size: 16px;
          box-shadow: 0 4px 10px rgba(255, 45, 115, 0.2);
          transition: all 0.2s ease;
        }
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 15px rgba(255, 45, 115, 0.3);
        }
        .footer {
          margin-top: 35px;
          text-align: center;
          font-size: 13px;
          color: #888;
          border-top: 1px solid #f0f0f0;
          padding-top: 20px;
        }
        .verification-banner {
          background: linear-gradient(135deg, rgba(255,107,107,0.1) 0%, rgba(255,45,115,0.1) 100%);
          border-left: 4px solid #ff2d73;
          padding: 15px;
          margin: 20px 0;
          border-radius: 6px;
        }
        .social-icons {
          margin-top: 15px;
        }
        .social-icon {
          display: inline-block;
          margin: 0 8px;
          width: 32px; /* Adjust size as needed */
          height: 32px;
        }
        h1 {
          color: #ff2d73;
          font-weight: 600;
        }
        p {
          color: #555;
        }
        a { /* Ensure links are visible */
            color: #ff2d73;
            text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${config.APP_URL || 'https://flirtss.com'}/logo.png" alt="${appName} Logo" class="logo">
          <h1>${appName}</h1>
        </div>

        <p>Hello ${nickname},</p>

        <div class="verification-banner">
          <p><strong>Please verify your email to unlock all features</strong></p>
          <p>Thank you for registering with ${appName}! We're excited to have you join our community.</p>
        </div>

        <p>Please verify your email address by clicking the button below:</p>

        <div style="text-align: center;">
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
        </div>

        <p style="font-size: 14px; color: #777;">Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; font-size: 14px; background-color: #f8f8f8; padding: 10px; border-radius: 4px;"><a href="${verificationUrl}">${verificationUrl}</a></p>

        <p><strong>Why verify?</strong> Verified members have full access to messaging, profile features, and more!</p>

        <p>This verification link will expire in 24 hours.</p>

        <p>If you did not create an account, please ignore this email.</p>

        <p>Best regards,<br>The ${appName} Team</p>

        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
          <p>This is an automated message, please do not reply.</p>
          <div class="social-icons">
            <a href="#"><img src="${config.APP_URL || 'https://flirtss.com'}/images/social/facebook.png" alt="Facebook" class="social-icon"></a>
            <a href="#"><img src="${config.APP_URL || 'https://flirtss.com'}/images/social/instagram.png" alt="Instagram" class="social-icon"></a>
            <a href="#"><img src="${config.APP_URL || 'https://flirtss.com'}/images/social/twitter.png" alt="Twitter" class="social-icon"></a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  // Call the core sending function
  return sendEmailNotification({
    to: email,
    subject,
    text,
    html,
  });
};

/**
 * Generates and sends a new message notification email with user card
 * @param {Object} options - Email options
 * @param {string} options.recipientEmail - Recipient email
 * @param {string} options.recipientName - Recipient's nickname
 * @param {Object} options.sender - Sender user object
 * @param {string} options.messagePreview - Preview of the message content
 * @param {string} options.messageType - Type of message (text, image, etc.)
 * @param {string} options.conversationUrl - URL to the conversation
 * @returns {Promise<object|null>} - Resend response data or null
 */
export const sendNewMessageEmail = async ({
  recipientEmail,
  recipientName,
  sender,
  messagePreview,
  messageType,
  conversationUrl,
}) => {
  const appName = config.APP_NAME || "Flirtss";
  const appUrl = config.APP_URL || "https://flirtss.com";

  // Default values if sender info is incomplete
  const senderName = sender?.nickname || "Someone";
  const senderAge = sender?.details?.age ? `, ${sender.details.age}` : "";
  const senderLocation = sender?.details?.location || "Unknown location";
  // Ensure senderPhoto is an absolute URL
  const senderPhoto = sender?.photos?.length > 0 ? sender.photos[0].url : `${appUrl.replace(/\/$/, '')}/default-avatar.png`;
  const senderIdentity = sender?.details?.iAm || "";
  const senderLookingFor = sender?.details?.lookingFor?.length > 0 ? sender.details.lookingFor[0] : "";

  const subject = `${senderName} sent you a message on ${appName}`;

  // Plain text version (Keep as is)
  const text = `
    Hello ${recipientName},

    You have received a new message from ${senderName}${senderAge} on ${appName}.

    Message preview: "${messagePreview}"

    To view and reply to this message, click here:
    ${conversationUrl}

    Best regards,
    The ${appName} Team
  `;

  // HTML version (Keep as is - ensure image URLs are absolute)
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Message</title>
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
        .logo { /* Added for consistency if needed */
          max-width: 150px;
          height: auto;
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
        .user-card {
          border: 1px solid #e1e1e1;
          border-radius: 8px;
          overflow: hidden;
          margin: 20px 0;
          background-color: #fff;
        }
        .user-photo {
          width: 100%;
          height: 200px; /* Adjust as needed */
          object-fit: cover;
          display: block;
          background-color: #eee; /* Placeholder color */
        }
        .user-info {
          padding: 15px;
        }
        .user-name {
          font-size: 18px;
          font-weight: bold;
          margin: 0 0 5px 0;
        }
        .user-subtitle { /* Not used in template, but keep style */
          color: #666;
          margin: 0 0 10px 0;
          font-size: 14px;
        }
        .user-location {
          display: flex;
          align-items: center;
          color: #666;
          font-size: 14px;
          margin: 10px 0;
        }
        .tag-container {
          margin: 15px 0;
        }
        .tag {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 20px;
          font-size: 12px;
          margin-right: 5px;
          margin-bottom: 5px;
        }
        .identity-tag {
          background-color: #e3f2fd;
          color: #1976d2;
        }
        .looking-for-tag {
          background-color: #fff8e1;
          color: #ff8f00;
        }
        .message-preview {
          background-color: #f5f5f5;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
          font-style: italic;
          border-left: 4px solid #ff4b7d;
        }
        a { /* Ensure links are visible */
            color: #ff4b7d;
            text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${appName}</h1>
        </div>

        <p>Hello ${recipientName},</p>

        <p>You have received a new message from:</p>

        <div class="user-card">
          <img src="${senderPhoto}" alt="${senderName}" class="user-photo" />
          <div class="user-info">
            <h3 class="user-name">${senderName}${senderAge}</h3>
            <p class="user-location">📍 ${senderLocation}</p>

            <div class="tag-container">
              ${senderIdentity ? `<span class="tag identity-tag">I am: ${senderIdentity}</span>` : ""}
              ${senderLookingFor ? `<span class="tag looking-for-tag">Into: ${senderLookingFor}</span>` : ""}
            </div>
          </div>
        </div>

        <div class="message-preview">
          ${
            messageType === "text"
              ? `"${messagePreview}"`
              : messageType === "image"
                ? "Sent you an image"
                : messageType === "file"
                  ? "Sent you a file"
                  : messageType === "wink"
                    ? "Sent you a wink 😉"
                    : "Sent you a message"
          }
        </div>

        <div style="text-align: center;">
          <a href="${conversationUrl}" class="button">View & Reply</a>
        </div>

        <p>To view your messages and reply, you can also log in to your account.</p>

        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
          <p>
            <small>If you no longer wish to receive these emails, you can
            <a href="${appUrl}/settings/notifications">update your notification preferences</a>.</small>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Call the core sending function
  return sendEmailNotification({
    to: recipientEmail,
    subject,
    text,
    html,
  });
};

/**
 * Sends a test notification email to verify user's notification settings
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.nickname - User's nickname
 * @param {Object} options.settings - User's notification settings
 * @returns {Promise<object|null>} - Resend response data or null
 */
export const sendTestNotificationEmail = async ({ email, nickname, settings }) => {
  const appName = config.APP_NAME || "Flirtss";
  const appUrl = config.APP_URL || "https://flirtss.com";

  const subject = `Test Notification from ${appName}`;

  // Get settings summary
  const emailEnabled = settings?.notifications?.email !== false;
  const frequency = settings?.notifications?.emailDigestFrequency || 'instant';
  const offlineOnly = settings?.notifications?.emailOfflineOnly !== false;

  // Plain text version (Keep as is)
  const text = `
    Hello ${nickname},

    This is a test notification email from ${appName}.

    Your current email notification settings:

    - Email notifications: ${emailEnabled ? 'Enabled' : 'Disabled'}
    - Frequency: ${frequency}
    - Offline only: ${offlineOnly ? 'Yes' : 'No'}

    If you received this email, your email notification settings are working correctly.

    You can update your notification preferences at any time in your settings:
    ${appUrl}/settings

    Best regards,
    The ${appName} Team
  `;

  // HTML version (Keep as is - ensure image URLs are absolute)
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Test Notification</title>
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
          .logo {
            max-width: 150px;
            height: auto;
            margin-bottom: 10px;
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
          .settings-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .settings-table th, .settings-table td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #e1e1e1;
          }
          .settings-table th {
            background-color: #f5f5f5;
          }
          .enabled {
            color: #28a745;
            font-weight: bold;
          }
          .disabled {
            color: #dc3545;
          }
          .test-badge {
            display: inline-block;
            background-color: #6c757d;
            color: white;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 12px;
            margin-left: 10px;
          }
          a { /* Ensure links are visible */
            color: #ff4b7d;
            text-decoration: underline;
          }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${appUrl.replace(/\/$/, '')}/logo.png" alt="${appName} Logo" class="logo">
          <h1>${appName} <span class="test-badge">TEST</span></h1>
        </div>

        <p>Hello ${nickname},</p>

        <p>This is a test notification email from ${appName}.</p>

        <h2>Your Email Notification Settings</h2>

        <table class="settings-table">
          <tr>
            <th>Setting</th>
            <th>Status</th>
          </tr>
          <tr>
            <td>Email Notifications</td>
            <td class="${emailEnabled ? 'enabled' : 'disabled'}">
              ${emailEnabled ? 'Enabled' : 'Disabled'}
            </td>
          </tr>
          <tr>
            <td>Delivery Frequency</td>
            <td>
              ${frequency === 'instant' ? 'Instant' :
                frequency === 'hourly' ? 'Hourly Digest' :
                frequency === 'daily' ? 'Daily Digest' : 'Never'}
            </td>
          </tr>
          <tr>
            <td>Offline Messages Only</td>
            <td>
              ${offlineOnly ? 'Yes' : 'No'}
            </td>
          </tr>
        </table>

        <p>If you received this email, your email notification settings are working correctly.</p>

        <div style="text-align: center;">
          <a href="${appUrl}/settings" class="button">Manage Settings</a>
        </div>

        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
          <p>
            <small>This is a test email. If you did not request this test, you can safely ignore it.</small>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Call the core sending function
  const result = await sendEmailNotification({
    to: email,
    subject,
    html,
    text // Include text version
  });

  // Return a consistent success/failure object for this specific function
  return {
      success: !!result, // True if result is not null
      messageId: result?.id || null,
      error: result ? null : "Failed to send email via Resend" // Basic error message
  };
};


// --- Remove Old Test Function ---
// The testEmailConfiguration function was specific to Nodemailer/Postfix.
// Testing Resend involves sending a real email and checking the response/dashboard.
// You can use sendTestNotificationEmail or create a simpler dedicated test.

// Example of a simple dedicated test function (optional)
export const testResendConnection = async (testEmail) => {
    logger.info(`Sending Resend test email to: ${testEmail}`);
    const result = await sendEmailNotification({
        to: testEmail,
        subject: `Resend Test from ${config.APP_NAME || 'Flirtss'}`,
        text: `This is a test email sent using Resend from ${config.APP_URL}. Time: ${new Date().toISOString()}`,
        html: `<p>This is a test email sent using <strong>Resend</strong> from ${config.APP_URL}.</p><p>Time: ${new Date().toISOString()}</p>`,
    });
    if (result) {
        logger.info(`Resend test successful. Message ID: ${result.id}`);
        return { success: true, messageId: result.id };
    } else {
        logger.error(`Resend test failed.`);
        return { success: false, error: "Failed to send test email via Resend. Check logs and Resend configuration." };
    }
};


// --- Exports ---
// Export the functions for use in other parts of your application
export default {
  sendEmailNotification,
  sendVerificationEmail,
  sendNewMessageEmail,
  // testEmailConfiguration, // Removed
  sendTestNotificationEmail,
  testResendConnection, // Added new simple test
};
