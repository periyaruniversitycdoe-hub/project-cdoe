'use strict';

/**
 * Thin wrapper that exposes the same sendTransacEmail() interface as before,
 * now backed by the centralized failover engine (Nodemailer → Brevo).
 *
 * All existing callers keep working without any changes:
 *   - student/backend/services/emailWorker.js
 *   - shared/auth/services/emailService.js
 *   - admin/backend/src/modules/email/services/email.service.js
 */

const path = require('path');

// Load .env (idempotent — dotenv ignores subsequent calls)
try {
    require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
} catch (_) {}

const failover = require('../../../shared/email/failoverEmailService');

/**
 * Send a transactional email with automatic provider failover.
 * Interface is identical to the previous Brevo-only implementation.
 */
async function sendTransacEmail(opts) {
    return failover.sendTransacEmail(opts);
}

module.exports = {
    sendTransacEmail,
    // Preserve legacy named exports used by callers that destructure the module
    apiKey:      process.env.BREVO_API_KEY,
    senderEmail: failover.FROM_ADDR   || failover.BREVO_SENDER,
    senderName:  failover.BREVO_NAME,
};
