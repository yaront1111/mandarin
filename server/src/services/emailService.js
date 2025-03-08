// For demonstration, we'll just log emails.
// If you want real emailing, install 'nodemailer' and set it up.

const config = require('../config');

exports.sendEmail = async ({ to, subject, text, html }) => {
  // Real implementation might use nodemailer:
  // const nodemailer = require('nodemailer');
  // const transporter = nodemailer.createTransport({
  //   host: config.email.host,
  //   port: config.email.port,
  //   auth: {
  //     user: config.email.user,
  //     pass: config.email.pass
  //   }
  // });
  // return transporter.sendMail({ from, to, subject, text, html });

  console.log('Sending email to:', to);
  console.log('Subject:', subject);
  console.log('Text:', text);
  console.log('HTML:', html);
  // Mock success
  return true;
};
