const nodemailer = require('nodemailer');
const config = require('../config/config');

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.port === 465,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
});

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `"Services Booking App" <${config.email.user}>`,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('Failed to send email:', error.message);
  }
};

const sendBookingConfirmation = async (to, bookingDetails) => {
  const { serviceName, providerName, bookingTime, address, totalAmount } = bookingDetails;

  const html = `
    <h2>Booking Confirmed</h2>
    <p>Your booking has been confirmed.</p>
    <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
      <tr><td style="padding: 8px; font-weight: bold;">Service</td><td style="padding: 8px;">${serviceName}</td></tr>
      <tr><td style="padding: 8px; font-weight: bold;">Provider</td><td style="padding: 8px;">${providerName}</td></tr>
      <tr><td style="padding: 8px; font-weight: bold;">Date & Time</td><td style="padding: 8px;">${new Date(bookingTime).toLocaleString()}</td></tr>
      <tr><td style="padding: 8px; font-weight: bold;">Address</td><td style="padding: 8px;">${address || 'N/A'}</td></tr>
      <tr><td style="padding: 8px; font-weight: bold;">Total</td><td style="padding: 8px;">$${totalAmount}</td></tr>
    </table>
    <p style="margin-top: 16px;">Thank you for using our service!</p>
  `;

  await sendEmail(to, 'Booking Confirmation', html);
};

const sendPasswordReset = async (to, resetToken) => {
  const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;

  const html = `
    <h2>Password Reset Request</h2>
    <p>You requested a password reset. Click the link below to set a new password:</p>
    <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">Reset Password</a>
    <p style="color: #666;">This link expires in 1 hour.</p>
    <p style="color: #666;">If you did not request this, please ignore this email.</p>
  `;

  await sendEmail(to, 'Password Reset', html);
};

module.exports = {
  sendEmail,
  sendBookingConfirmation,
  sendPasswordReset,
};
