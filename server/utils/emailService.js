// server/utils/emailService.js
import nodemailer from "nodemailer"
import config from "../config.js"
import logger from "../logger.js"

// Configure the transporter for GoDaddy's SMTP relay
const transporter = nodemailer.createTransport({
  host: "n1smtpout.europe.secureserver.net",
  port: 25, // You might also try 80 or 3535 if needed
  secure: false, // Use false if you're on port 25/80/3535
  // Uncomment and fill these if authentication is required:
  // auth: {
  //   user: "your-username",
  //   pass: "your-password"
  // },
  tls: {
    // Do not fail on invalid certs if necessary (not recommended for production)
    rejectUnauthorized: false,
  },
})

// Function to send an email notification
export const sendEmailNotification = async ({ to, subject, text, html }) => {
  try {
    const info = await transporter.sendMail({
      from: '"Your App Name" <your-email@yourdomain.com>', // Sender address (must be authorized)
      to, // Recipient's email
      subject, // Subject line
      text, // Plain text body
      html, // HTML body (optional)
    })
    logger.info(`Email sent to ${to}: ${info.messageId}`)
    return info
  } catch (err) {
    logger.error(`Error sending email: ${err.message}`)
    throw err
  }
}

/**
 * Generates and sends a verification email
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.nickname - User's nickname
 * @param {string} options.token - Verification token
 * @returns {Promise} - Nodemailer info object
 */
export const sendVerificationEmail = async ({ email, nickname, token }) => {
  const appName = config.APP_NAME || "Your Dating App"
  const appUrl = config.APP_URL || "https://yourdatingapp.com"
  const verificationUrl = `${appUrl}/verify-email?token=${token}`

  const subject = `Verify your email for ${appName}`

  // Plain text version
  const text = `
    Hello ${nickname},
    
    Thank you for registering with ${appName}!
    
    Please verify your email address by clicking the link below:
    ${verificationUrl}
    
    This link will expire in 24 hours.
    
    If you did not create an account, please ignore this email.
    
    Best regards,
    The ${appName} Team
  `

  // HTML version
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          border: 1px solid #e1e1e1;
          border-radius: 5px;
          padding: 20px;
          background-color: #fff;
        }
        .header {
          text-align: center;
          padding-bottom: 20px;
          border-bottom: 1px solid #e1e1e1;
          margin-bottom: 20px;
        }
        .logo {
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
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 12px;
          color: #888;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${appName}</h1>
        </div>
        
        <p>Hello ${nickname},</p>
        
        <p>Thank you for registering with ${appName}! We're excited to have you join our community.</p>
        
        <p>Please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center;">
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
        </div>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; font-size: 14px;"><a href="${verificationUrl}">${verificationUrl}</a></p>
        
        <p>This link will expire in 24 hours.</p>
        
        <p>If you did not create an account, please ignore this email.</p>
        
        <p>Best regards,<br>The ${appName} Team</p>
        
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
          <p>This is an automated message, please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmailNotification({
    to: email,
    subject,
    text,
    html,
  })
}

/**
 * Generates and sends a new message notification email with user card
 * @param {Object} options - Email options
 * @param {string} options.recipientEmail - Recipient email
 * @param {string} options.recipientName - Recipient's nickname
 * @param {Object} options.sender - Sender user object
 * @param {string} options.messagePreview - Preview of the message content
 * @param {string} options.messageType - Type of message (text, image, etc.)
 * @param {string} options.conversationUrl - URL to the conversation
 * @returns {Promise} - Nodemailer info object
 */
export const sendNewMessageEmail = async ({
  recipientEmail,
  recipientName,
  sender,
  messagePreview,
  messageType,
  conversationUrl,
}) => {
  const appName = config.APP_NAME || "Your Dating App"
  const appUrl = config.APP_URL || "https://yourdatingapp.com"

  // Default values if sender info is incomplete
  const senderName = sender?.nickname || "Someone"
  const senderAge = sender?.details?.age ? `, ${sender.details.age}` : ""
  const senderLocation = sender?.details?.location || "Unknown location"
  const senderPhoto = sender?.photos?.length > 0 ? sender.photos[0].url : `${appUrl}/default-avatar.png`
  const senderIdentity = sender?.details?.iAm || ""
  const senderLookingFor = sender?.details?.lookingFor?.length > 0 ? sender.details.lookingFor[0] : ""

  const subject = `${senderName} sent you a message on ${appName}`

  // Plain text version
  const text = `
    Hello ${recipientName},
    
    You have received a new message from ${senderName}${senderAge} on ${appName}.
    
    Message preview: "${messagePreview}"
    
    To view and reply to this message, click here:
    ${conversationUrl}
    
    Best regards,
    The ${appName} Team
  `

  // HTML version with user card
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
        .logo {
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
          height: 200px;
          object-fit: cover;
          display: block;
        }
        .user-info {
          padding: 15px;
        }
        .user-name {
          font-size: 18px;
          font-weight: bold;
          margin: 0 0 5px 0;
        }
        .user-subtitle {
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
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${appName}</h1>
        </div>
        
        <p>Hello ${recipientName},</p>
        
        <p>You have received a new message from:</p>
        
        <!-- User Card -->
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
        
        <!-- Message Preview -->
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
  `

  return sendEmailNotification({
    to: recipientEmail,
    subject,
    text,
    html,
  })
}

// Example usage:
// sendVerificationEmail({
//   email: "user@example.com",
//   nickname: "JohnDoe",
//   token: "verification-token-123"
// });

// sendNewMessageEmail({
//   recipientEmail: "recipient@example.com",
//   recipientName: "Jane",
//   sender: {
//     nickname: "John",
//     details: {
//       age: 28,
//       location: "New York",
//       iAm: "Man",
//       lookingFor: ["Women"]
//     },
//     photos: [{ url: "https://example.com/photo.jpg" }]
//   },
//   messagePreview: "Hey there! How are you doing today?",
//   messageType: "text",
//   conversationUrl: "https://yourdatingapp.com/messages/user123"
// });

export default {
  sendEmailNotification,
  sendVerificationEmail,
  sendNewMessageEmail,
}
