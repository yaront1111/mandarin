import nodemailer from "nodemailer"
import config from "../config.js"
import logger from "../logger.js"

const log = logger.child({ component: "EmailService" })

// Pull email settings from config (with sane defaults)
const {
  EMAIL_HOST = "localhost",
  EMAIL_PORT = 25,
  EMAIL_SECURE = false,
  EMAIL_USER,
  EMAIL_PASSWORD,
  EMAIL_FROM = `noreply@${config.APP_DOMAIN || "flirtss.com"}`,
  APP_NAME = "Flirtss",
  APP_URL = "https://flirtss.com",
  EMAIL_POOL_MAX_CONNECTIONS = 5,
  EMAIL_POOL_MAX_MESSAGES = 100,
} = config

// Create a pooled transporter for performance
const transporter = nodemailer.createTransport({
  pool: true,
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: EMAIL_SECURE, // true for 465, false for other ports
  auth: EMAIL_USER && EMAIL_PASSWORD
    ? { user: EMAIL_USER, pass: EMAIL_PASSWORD }
    : undefined,
  tls: { rejectUnauthorized: config.EMAIL_TLS_REJECT_UNAUTHORIZED ?? false },
  maxConnections: EMAIL_POOL_MAX_CONNECTIONS,
  maxMessages: EMAIL_POOL_MAX_MESSAGES,
})

// Verify SMTP configuration on startup
transporter.verify()
  .then(() => log.info("SMTP transporter verified and ready"))
  .catch(err => log.error(`SMTP verification failed: ${err.message}`))

/**
 * Send a raw email
 * @param {import("nodemailer").SendMailOptions} mailOptions
 * @returns {Promise<import("nodemailer").SentMessageInfo>}
 */
export async function sendEmailNotification(mailOptions) {
  try {
    const info = await transporter.sendMail({
      from: `"${APP_NAME}" <${EMAIL_FROM}>`,
      ...mailOptions,
    })
    log.info({ to: mailOptions.to, messageId: info.messageId }, "Email sent")
    return info
  } catch (err) {
    log.error({ to: mailOptions.to, error: err.message }, "Email send failed")
    throw err
  }
}

/**
 * Generate verification email subject/text/html
 * @param {string} nickname
 * @param {string} token
 */
function buildVerificationEmail(nickname, token) {
  const verificationUrl = `${APP_URL}/verify-email?token=${token}`
  const subject = `Verify your email for ${APP_NAME}`

  const text = `
Hello ${nickname},

Thank you for registering with ${APP_NAME}!

Please verify your email address by clicking the link below:
${verificationUrl}

This link will expire in 24 hours.

If you did not create an account, please ignore this email.

Best regards,
The ${APP_NAME} Team
`.trim()

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
  <style>
    body { font-family: sans-serif; color: #333; background: #f9f9f9; padding: 20px; }
    .container { max-width: 600px; margin: auto; background: #fff; padding: 25px; border-radius: 8px; }
    .button { display: inline-block; padding: 12px 24px; background: #ff2d73; color: #fff; text-decoration: none; border-radius: 50px; }
    .footer { text-align: center; font-size: 12px; color: #888; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Welcome, ${nickname}!</h2>
    <p>Thank you for joining <strong>${APP_NAME}</strong>. Please verify your email to unlock all features:</p>
    <p style="text-align:center;">
      <a href="${verificationUrl}" class="button">Verify Email Address</a>
    </p>
    <p>If the button above doesn’t work, copy and paste this URL into your browser:</p>
    <p><a href="${verificationUrl}">${verificationUrl}</a></p>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
    </div>
  </div>
</body>
</html>
`.trim()

  return { subject, text, html }
}

/**
 * Generate new‑message notification email
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
  const senderName = sender.nickname || "Someone"
  const subject = `${senderName} sent you a message on ${APP_NAME}`

  const text = `
Hello ${recipientName},

${senderName} sent you a new message:

"${messagePreview}"

View and reply here:
${conversationUrl}

Best,
The ${APP_NAME} Team
`.trim()

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
  <style>
    body { font-family: sans-serif; color: #333; background: #f9f9f9; padding: 20px; }
    .container { max-width: 600px; margin: auto; background: #fff; padding: 25px; border-radius: 8px; }
    .button { display: inline-block; padding: 12px 24px; background: #ff4b7d; color: #fff; text-decoration: none; border-radius: 4px; }
    .preview { padding: 15px; background: #f5f5f5; border-left: 4px solid #ff4b7d; margin: 20px 0; }
    .footer { text-align: center; font-size: 12px; color: #888; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>New message from ${senderName}</h2>
    <div class="preview">
      ${messagePreview}
    </div>
    <p style="text-align:center;">
      <a href="${conversationUrl}" class="button">View & Reply</a>
    </p>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
    </div>
  </div>
</body>
</html>
`.trim()

  return { subject, text, html }
}

/**
 * Send a verification email
 * @param {{ email: string, nickname: string, token: string }} opts
 */
export async function sendVerificationEmail(opts) {
  const { subject, text, html } = buildVerificationEmail(opts.nickname, opts.token)
  return sendEmailNotification({ to: opts.email, subject, text, html })
}

/**
 * Send a new‑message notification email
 * @param {Object} opts see buildNewMessageEmail args
 */
export async function sendNewMessageEmail(opts) {
  const { subject, text, html } = buildNewMessageEmail(opts)
  return sendEmailNotification({
    to: opts.recipientEmail,
    subject,
    text,
    html,
  })
}

/**
 * Test email configuration by sending a test message
 * @param {string} testEmail
 */
export async function testEmailConfiguration(testEmail) {
  const info = await sendEmailNotification({
    to: testEmail,
    subject: `${APP_NAME} SMTP Configuration Test`,
    text: "If you’re reading this, your email configuration is working!",
    html: `<p>If you’re reading this, your email configuration is working!</p><p>Server time: ${new Date().toISOString()}</p>`
  })
  return { success: true, messageId: info.messageId, response: info.response }
}

export default {
  sendEmailNotification,
  sendVerificationEmail,
  sendNewMessageEmail,
  testEmailConfiguration,
}
