// server/utils/emailService.js
import nodemailer from "nodemailer";

// Configure the transporter for GoDaddy's SMTP relay
const transporter = nodemailer.createTransport({
  host: "n1smtpout.europe.secureserver.net",
  port: 25,              // You might also try 80 or 3535 if needed
  secure: false,         // Use false if you're on port 25/80/3535
  // Uncomment and fill these if authentication is required:
  // auth: {
  //   user: "your-username",
  //   pass: "your-password"
  // },
  tls: {
    // Do not fail on invalid certs if necessary (not recommended for production)
    rejectUnauthorized: false,
  },
});

// Function to send an email notification
export const sendEmailNotification = async ({ to, subject, text, html }) => {
  try {
    const info = await transporter.sendMail({
      from: '"Your App Name" <your-email@yourdomain.com>', // Sender address (must be authorized)
      to,        // Recipient's email
      subject,   // Subject line
      text,      // Plain text body
      html,      // HTML body (optional)
    });
    console.log("Email sent: ", info.messageId);
    return info;
  } catch (err) {
    console.error("Error sending email: ", err);
    throw err;
  }
};

export default { sendEmailNotification };
