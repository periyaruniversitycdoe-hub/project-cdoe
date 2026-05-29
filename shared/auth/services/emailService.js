'use strict';

const nodemailer = require('nodemailer');
const path = require('path');

const otpEmailTemplate = require('../templates/otpEmailTemplate');
const passwordChangedTemplate = require('../templates/passwordChangedTemplate');

const port = parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT || '587', 10);
const secure = port === 465;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || process.env.MAIL_HOST,
  port,
  secure,
  family: 4, // Force IPv4 to prevent ENETUNREACH in cloud environments (Render)
  requireTLS: !secure,
  auth: {
    user: process.env.SMTP_USER || process.env.MAIL_USER,
    pass: process.env.SMTP_PASS || process.env.MAIL_PASS,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  tls: {
    rejectUnauthorized: process.env.MAIL_REJECT_UNAUTHORIZED !== 'false',
  }
});

const fromName = process.env.MAIL_FROM_NAME || 'Periyar University PhD Admissions';
const fromAddress = process.env.SMTP_FROM || process.env.MAIL_FROM || process.env.SMTP_USER || process.env.MAIL_USER;
const FROM = `"${fromName}" <${fromAddress}>`;

/**
 * Verifies SMTP connection
 */
async function verifyConnection() {
  try {
    await transporter.verify();
    console.log('[Shared Mail] ✅ SMTP successfully connected.');
    return true;
  } catch (err) {
    console.error('[Shared Mail] ❌ SMTP connection failed:', err.message);
    return false;
  }
}

/**
 * Sends OTP Email
 */
async function sendOtpEmail({ email, otp, portalName, expiresIn = 5 }) {
  try {
    const html = otpEmailTemplate({ email, otp, portalName, expiresIn });
    const mailOptions = {
      from: FROM,
      to: email,
      subject: `Password Reset OTP Verification — Periyar University`,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Shared Mail] OTP sent to ${email}. MessageId: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[Shared Mail] Failed to send OTP email to ${email}:`, err);
    throw err;
  }
}

/**
 * Sends Password Changed confirmation email
 */
async function sendPasswordChangedEmail({ email, portalName }) {
  try {
    const html = passwordChangedTemplate({ email, portalName });
    const mailOptions = {
      from: FROM,
      to: email,
      subject: `Security Alert: Password Changed Successfully — Periyar University`,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Shared Mail] Password changed confirmation sent to ${email}. MessageId: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[Shared Mail] Failed to send password changed confirmation to ${email}:`, err);
    // Non-fatal, just log
    return false;
  }
}

module.exports = {
  sendOtpEmail,
  sendPasswordChangedEmail,
  verifyConnection
};
