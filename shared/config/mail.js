'use strict';

/**
 * Centralized Nodemailer SMTP transporter.
 * All modules import this for email delivery.
 * Reads SMTP credentials from the root .env file.
 *
 * Port guide:
 *   465 → SSL/TLS     (secure: true)
 *   587 → STARTTLS    (secure: false, requireTLS: true) ← recommended
 */

const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const port   = parseInt(process.env.MAIL_PORT || '587', 10);
const secure = port === 465;

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port,
    secure,
    requireTLS: !secure,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
    pool:           true,
    maxConnections: 5,
    maxMessages:    100,
    rateDelta:      1_000,
    rateLimit:      5,
    connectionTimeout: 10_000,
    greetingTimeout:   10_000,
    socketTimeout:     20_000,
    tls: {
        rejectUnauthorized: process.env.MAIL_REJECT_UNAUTHORIZED !== 'false',
    },
});

const verifyConnection = async () => {
    if (!process.env.MAIL_HOST || !process.env.MAIL_USER) {
        console.warn('[Shared Mail] MAIL_HOST or MAIL_USER not set — email disabled.');
        return false;
    }
    try {
        await transporter.verify();
        console.log(`[Shared Mail] ✅ SMTP connected → ${process.env.MAIL_HOST}:${port}`);
        return true;
    } catch (err) {
        console.error(`[Shared Mail] ❌ SMTP connection failed → ${err.message}`);
        return false;
    }
};

module.exports = { transporter, verifyConnection };
