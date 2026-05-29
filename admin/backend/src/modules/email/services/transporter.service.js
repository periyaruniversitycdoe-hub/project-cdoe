'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../../.env') });

const verifyConnection = async () => {
  if (!process.env.BREVO_API_KEY) {
    console.warn('[Admin Mail Stub] ⚠️ BREVO_API_KEY is not set — email delivery will fail.');
    return false;
  }
  console.log('[Admin Mail Stub] ✅ Brevo TransacEmail service configured (HTTPS Port 443).');
  return true;
};

// Dummy transporter for interface compatibility
const transporter = {
  sendMail: async () => {
    throw new Error('Nodemailer SMTP transporter is deprecated. Use the Brevo service instead.');
  },
  verify: async () => {
    return verifyConnection();
  }
};

module.exports = { transporter, verifyConnection };
