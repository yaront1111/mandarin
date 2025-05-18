import { Resend } from 'resend';
import config from "../config.js";
import logger from "../logger.js";

const log = logger.child({ component: "ResendEmailService" });

// Note: Resend has rate limits:
// - Trial accounts: 1 email per second, 100 emails per day
// - Free plan: 3,000 emails per month
// - Paid plans: Higher limits
// We implement retry logic with exponential backoff to handle rate limits

// Initialize Resend with your API key
const resend = new Resend(config.RESEND_API_KEY);

// Pull email settings from config (with sane defaults)
const {
  EMAIL_FROM = `noreply@${config.APP_DOMAIN || "flirtss.com"}`,
  APP_NAME = "Flirtss",
  APP_URL = "https://flirtss.com",
} = config;

// Verify configuration on startup
(async () => {
  try {
    await resend.emails.send({
      from: `${APP_NAME} <${EMAIL_FROM}>`,
      to: 'delivered@resend.dev',
      subject: 'Resend Email Service Test',
      text: 'Testing Resend configuration',
    });
    log.info("Resend email service configured and ready");
  } catch (err) {
    log.error(`Resend configuration test failed: ${err.message}`);
  }
})();

/**
 * Send a raw email using Resend with retry logic for rate limits
 * @param {Object} mailOptions
 * @returns {Promise<Object>}
 */
export async function sendEmailNotification(mailOptions) {
  const maxRetries = 3;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const result = await resend.emails.send({
        from: `${APP_NAME} <${EMAIL_FROM}>`,
        ...mailOptions,
      });
      log.info({ to: mailOptions.to, id: result.id }, "Email sent via Resend");
      return result;
    } catch (err) {
      // Check if it's a rate limit error
      if (err.statusCode === 429 || err.message.includes('429')) {
        retries++;
        if (retries >= maxRetries) {
          log.error({ to: mailOptions.to, error: err.message }, "Resend email send failed after max retries");
          throw err;
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, retries - 1) * 1000;
        log.warn({ 
          to: mailOptions.to, 
          retries: retries, 
          delay: delay 
        }, "Rate limited by Resend, retrying after delay");
        
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If it's not a rate limit error, throw immediately
      log.error({ to: mailOptions.to, error: err.message }, "Resend email send failed");
      throw err;
    }
  }
}

/**
 * Generate verification email subject/text/html
 * @param {string} nickname
 * @param {string} token
 */
function buildVerificationEmail(nickname, token) {
  const verificationUrl = `${APP_URL}/verify-email?token=${token}`;
  const subject = `Verify your email for ${APP_NAME}`;

  const text = `
Hello ${nickname},

Thank you for registering with ${APP_NAME}!

Please verify your email address by clicking the link below:
${verificationUrl}

This link will expire in 24 hours.

If you did not create an account, please ignore this email.

Best regards,
The ${APP_NAME} Team
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; background: #f9f9f9; padding: 20px; margin: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h2 { color: #333; margin: 0 0 20px; }
    p { line-height: 1.6; margin: 16px 0; }
    .button { display: inline-block; padding: 14px 30px; background: #ff2d73; color: #fff; text-decoration: none; border-radius: 50px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #e02361; }
    .link { color: #ff2d73; word-break: break-all; }
    .footer { text-align: center; font-size: 12px; color: #888; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Welcome to ${APP_NAME}, ${nickname}!</h2>
    <p>Thank you for joining our community. To get started and unlock all features, please verify your email address:</p>
    <p style="text-align:center;">
      <a href="${verificationUrl}" class="button">Verify Email Address</a>
    </p>
    <p>If the button above doesn't work, copy and paste this URL into your browser:</p>
    <p><a href="${verificationUrl}" class="link">${verificationUrl}</a></p>
    <p><small>This verification link will expire in 24 hours for security reasons.</small></p>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
      <p>This email was sent to you because someone registered with your email address. If this wasn't you, please ignore this email.</p>
    </div>
  </div>
</body>
</html>
`.trim();

  return { subject, text, html };
}

/**
 * Generate password reset email
 * @param {string} nickname
 * @param {string} token
 */
function buildPasswordResetEmail(nickname, token) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const subject = `Reset your ${APP_NAME} password`;

  const text = `
Hello ${nickname},

We received a request to reset your password for your ${APP_NAME} account.

To reset your password, click the link below:
${resetUrl}

This link will expire in 2 hours for security reasons.

If you did not request a password reset, please ignore this email and your password will remain unchanged.

Best regards,
The ${APP_NAME} Team
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; background: #f9f9f9; padding: 20px; margin: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h2 { color: #333; margin: 0 0 20px; }
    p { line-height: 1.6; margin: 16px 0; }
    .button { display: inline-block; padding: 14px 30px; background: #ff2d73; color: #fff; text-decoration: none; border-radius: 50px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #e02361; }
    .link { color: #ff2d73; word-break: break-all; }
    .warning { background: #fef3cd; border: 1px solid #feeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; font-size: 12px; color: #888; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Password Reset Request</h2>
    <p>Hello ${nickname},</p>
    <p>We received a request to reset your password for your ${APP_NAME} account.</p>
    <p style="text-align:center;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </p>
    <p>If the button above doesn't work, copy and paste this URL into your browser:</p>
    <p><a href="${resetUrl}" class="link">${resetUrl}</a></p>
    <div class="warning">
      <p><strong>Security Notice:</strong> This link will expire in 2 hours. If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
      <p>This email was sent to the email address associated with your account.</p>
    </div>
  </div>
</body>
</html>
`.trim();

  return { subject, text, html };
}

/**
 * Generate new message notification email
 * @param {Object} opts
 * @param {string} opts.recipientName
 * @param {string} opts.recipientEmail
 * @param {Object} opts.sender
 * @param {string} opts.messagePreview
 * @param {string} opts.messageType
 * @param {string} opts.conversationUrl
 */
function buildNewMessageEmail({
  recipientName,
  sender,
  messagePreview,
  messageType,
  conversationUrl
}) {
  const senderName = sender.nickname || "Someone";
  const subject = `${senderName} sent you a message on ${APP_NAME}`;

  const text = `
Hello ${recipientName},

${senderName} sent you a new message:

"${messagePreview}"

View and reply here:
${conversationUrl}

Best,
The ${APP_NAME} Team
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; background: #f9f9f9; padding: 20px; margin: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h2 { color: #333; margin: 0 0 20px; }
    p { line-height: 1.6; margin: 16px 0; }
    .button { display: inline-block; padding: 14px 30px; background: #ff2d73; color: #fff; text-decoration: none; border-radius: 50px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #e02361; }
    .preview { padding: 20px; background: #f8f9fa; border-left: 4px solid #ff2d73; margin: 20px 0; border-radius: 6px; }
    .sender-info { display: flex; align-items: center; margin-bottom: 20px; }
    .sender-avatar { width: 50px; height: 50px; border-radius: 50%; margin-right: 15px; }
    .footer { text-align: center; font-size: 12px; color: #888; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <h2>New message from ${senderName}</h2>
    ${sender.photo ? `
    <div class="sender-info">
      <img src="${sender.photo}" alt="${senderName}" class="sender-avatar" />
      <div>
        <strong>${senderName}</strong>
        ${messageType === 'wink' ? '<br>sent you a wink 😉' : ''}
      </div>
    </div>
    ` : ''}
    <div class="preview">
      ${messagePreview}
    </div>
    <p style="text-align:center;">
      <a href="${conversationUrl}" class="button">View & Reply</a>
    </p>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
      <p>You're receiving this because you have message notifications enabled.</p>
    </div>
  </div>
</body>
</html>
`.trim();

  return { subject, text, html };
}

/**
 * Send a verification email
 * @param {{ email: string, nickname: string, token: string }} opts
 */
export async function sendVerificationEmail(opts) {
  const { subject, text, html } = buildVerificationEmail(opts.nickname, opts.token);
  return sendEmailNotification({ to: opts.email, subject, text, html });
}

/**
 * Send a password reset email
 * @param {{ email: string, nickname: string, token: string }} opts
 */
export async function sendPasswordResetEmail(opts) {
  const { subject, text, html } = buildPasswordResetEmail(opts.nickname, opts.token);
  return sendEmailNotification({ to: opts.email, subject, text, html });
}

/**
 * Send a new message notification email
 * @param {Object} opts see buildNewMessageEmail args
 */
export async function sendNewMessageEmail(opts) {
  const { subject, text, html } = buildNewMessageEmail(opts);
  return sendEmailNotification({
    to: opts.recipientEmail,
    subject,
    text,
    html,
  });
}

/**
 * Test email configuration by sending a test message
 * @param {string} testEmail
 */
export async function testEmailConfiguration(testEmail) {
  const result = await sendEmailNotification({
    to: testEmail,
    subject: `${APP_NAME} Resend Configuration Test`,
    text: "If you're reading this, your Resend email configuration is working!",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px;">
        <h2>Email Configuration Test</h2>
        <p>If you're reading this, your Resend email configuration is working!</p>
        <p>Server time: ${new Date().toISOString()}</p>
        <p>Email service: Resend</p>
      </div>
    `
  });
  return { success: true, id: result.id, ...result };
}

export default {
  sendEmailNotification,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendNewMessageEmail,
  testEmailConfiguration,
};