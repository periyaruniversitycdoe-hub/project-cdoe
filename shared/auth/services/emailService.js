'use strict';

const path = require('path');
const { sendTransacEmail } = require('../../../backend/src/services/emailService');

const otpEmailTemplate = require('../templates/otpEmailTemplate');
const passwordChangedTemplate = require('../templates/passwordChangedTemplate');

/**
 * Verifies connection (now checking Brevo API Key)
 */
async function verifyConnection() {
  if (!process.env.BREVO_API_KEY) {
    console.warn('[Shared Mail Stub] ⚠️ BREVO_API_KEY is not set — email delivery will fail.');
    return false;
  }
  console.log('[Shared Mail Stub] ✅ Brevo TransacEmail service configured (HTTPS Port 443).');
  return true;
}

/**
 * Sends OTP Email
 */
async function sendOtpEmail({ email, otp, portalName, expiresIn = 5 }) {
  try {
    const html = otpEmailTemplate({ email, otp, portalName, expiresIn });
    const info = await sendTransacEmail({
      to: email,
      subject: `Password Reset OTP Verification — Periyar University`,
      html
    });
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
    const info = await sendTransacEmail({
      to: email,
      subject: `Security Alert: Password Changed Successfully — Periyar University`,
      html
    });
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
