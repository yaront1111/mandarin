import config from "../config.js";
import nodemailerService from "./emailService.js";
import resendService from "./resendEmailService.js";
import logger from "../logger.js";

const log = logger.child({ component: "UnifiedEmailService" });

// Select the appropriate email service based on configuration
const emailService = config.USE_RESEND ? resendService : nodemailerService;

log.info(`Using ${config.USE_RESEND ? 'Resend' : 'Nodemailer'} email service`);

// Export all functions from the selected service
export const {
  sendEmailNotification,
  sendVerificationEmail,
  sendNewMessageEmail,
  testEmailConfiguration,
} = emailService;

// Also export sendPasswordResetEmail if it exists in the service
export const sendPasswordResetEmail = emailService.sendPasswordResetEmail || async function(opts) {
  // Fallback implementation using sendEmailNotification
  const verificationUrl = `${config.APP_URL}/reset-password?token=${opts.token}`;
  const subject = `Reset your ${config.APP_NAME} password`;
  
  const text = `
Hello ${opts.nickname},

We received a request to reset your password.

Please click the link below to reset your password:
${verificationUrl}

This link will expire in 2 hours.

If you did not request this, please ignore this email.

Best regards,
The ${config.APP_NAME} Team
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <style>
    body { font-family: sans-serif; color: #333; background: #f9f9f9; padding: 20px; }
    .container { max-width: 600px; margin: auto; background: #fff; padding: 25px; border-radius: 8px; }
    .button { display: inline-block; padding: 12px 24px; background: #ff2d73; color: #fff; text-decoration: none; border-radius: 50px; }
    .footer { text-align: center; font-size: 12px; color: #888; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Password Reset Request</h2>
    <p>Hello ${opts.nickname},</p>
    <p>To reset your password, click the link below:</p>
    <p style="text-align:center;">
      <a href="${verificationUrl}" class="button">Reset Password</a>
    </p>
    <p>If the button doesn't work, copy and paste this URL into your browser:</p>
    <p><a href="${verificationUrl}">${verificationUrl}</a></p>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${config.APP_NAME}. All rights reserved.
    </div>
  </div>
</body>
</html>
`.trim();

  return sendEmailNotification({ to: opts.email, subject, text, html });
};

export default {
  sendEmailNotification,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendNewMessageEmail,
  testEmailConfiguration,
};