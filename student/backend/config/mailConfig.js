'use strict';

/**
 * Nodemailer SMTP transporter configuration.
 *
 * Supports: Gmail, Hostinger, cPanel, Outlook, Zoho, and any standard SMTP.
 *
 * Port guide:
 *   465  → SSL/TLS     (secure: true)
 *   587  → STARTTLS    (secure: false, requireTLS: true)  ← recommended
 *   25   → plain SMTP  (not recommended in production)
 */

const nodemailer = require('nodemailer');
const path       = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

// ─── Build transporter ────────────────────────────────────────────────────────

const port   = parseInt(process.env.MAIL_PORT || '587', 10);
const secure = port === 465; // true only for port 465 (SSL); STARTTLS uses false

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port,
  secure,
  requireTLS: !secure, // force STARTTLS upgrade on port 587/25
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },

  // Connection pool — reuse SMTP connections for burst sending
  pool:           true,
  maxConnections: 5,
  maxMessages:    100,
  rateDelta:      1_000, // ms window for rate limiting
  rateLimit:      5,     // max messages per rateDelta window

  // Timeouts — prevent hanging connections from blocking the server
  connectionTimeout: 10_000, // 10 s to establish TCP connection
  greetingTimeout:   10_000, // 10 s for SMTP greeting
  socketTimeout:     20_000, // 20 s for socket inactivity

  tls: {
    // In production, always verify the SMTP server's TLS certificate.
    // Set MAIL_REJECT_UNAUTHORIZED=false ONLY for local/dev self-signed certs.
    rejectUnauthorized: process.env.MAIL_REJECT_UNAUTHORIZED !== 'false',
  },

  // Uncomment to debug raw SMTP conversation in development:
  // logger: process.env.NODE_ENV !== 'production',
  // debug:  process.env.NODE_ENV !== 'production',
});

// ─── Verify connection on startup ─────────────────────────────────────────────

/**
 * Verify SMTP credentials once on server start.
 * Logs success or failure — never throws (email is non-critical infrastructure).
 */
const verifyConnection = async () => {
  if (!process.env.MAIL_HOST || !process.env.MAIL_USER) {
    console.warn('[Mail] MAIL_HOST or MAIL_USER not set — email disabled.');
    return false;
  }
  try {
    await transporter.verify();
    console.log(`[Mail] ✅ SMTP connected → ${process.env.MAIL_HOST}:${port}`);
    return true;
  } catch (err) {
    console.error(`[Mail] ❌ SMTP connection failed → ${err.message}`);
    // Non-fatal: server continues without email capability
    return false;
  }
};

module.exports = { transporter, verifyConnection };
