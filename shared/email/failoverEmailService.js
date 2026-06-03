'use strict';

/**
 * ENTERPRISE EMAIL FAILOVER SERVICE
 *
 * Delivery hierarchy:
 *   1. Nodemailer (SMTP) — Primary
 *   2. Brevo (HTTP API) — Fallback
 *
 * All delivery attempts are logged to email_delivery_log.
 * Fallback events are visible only to administrators via /api/mail/delivery-log.
 * Users always receive the email; the provider switch is fully transparent.
 */

const fs   = require('fs');
const path = require('path');

// ── Load .env from root ───────────────────────────────────────────────────────
try {
    require('dotenv').config({ path: path.join(__dirname, '../../.env') });
} catch (_) { /* already loaded */ }

// ── Shared DB (for delivery logging + table migration) ────────────────────────
let db = null;
try {
    db = require('../config/db');
} catch (err) {
    console.warn('[EmailFailover] Shared DB not available — delivery logging disabled:', err.message);
}

// ── Nodemailer (Primary provider) ─────────────────────────────────────────────
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (_) { /* not installed */ }

const SMTP_HOST   = process.env.SMTP_HOST;
const SMTP_PORT   = parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT || '465', 10);
const SMTP_USER   = process.env.SMTP_USER  || process.env.MAIL_USER;
const SMTP_PASS   = process.env.SMTP_PASS  || process.env.MAIL_PASS;
const SMTP_SECURE = SMTP_PORT === 465 || process.env.SMTP_SECURE === 'true';
const FROM_NAME   = process.env.MAIL_FROM_NAME || 'Periyar University PhD Portal';
const FROM_ADDR   = process.env.MAIL_FROM || process.env.SMTP_FROM || SMTP_USER;

let smtpTransporter = null;
if (nodemailer && SMTP_HOST && SMTP_USER && SMTP_PASS) {
    smtpTransporter = nodemailer.createTransport({
        host:   SMTP_HOST,
        port:   SMTP_PORT,
        secure: SMTP_SECURE,
        auth:   { user: SMTP_USER, pass: SMTP_PASS },
        tls:    { rejectUnauthorized: process.env.MAIL_REJECT_UNAUTHORIZED !== 'false' },
        pool:   true,
        maxConnections: 3,
    });
    console.log(`[EmailFailover] ✅ Primary (Nodemailer SMTP) configured → ${SMTP_HOST}:${SMTP_PORT}`);
} else {
    console.warn('[EmailFailover] ⚠️  Primary (Nodemailer) not configured — Brevo will act as sole provider.');
}

// ── Brevo (Fallback provider) ─────────────────────────────────────────────────
const BREVO_API_KEY   = process.env.BREVO_API_KEY;
const BREVO_SENDER    = process.env.BREVO_SENDER_EMAIL || SMTP_USER || 'noreply@yourdomain.com';
const BREVO_NAME      = process.env.BREVO_SENDER_NAME  || 'PhD Research Portal';

let BrevoClient = null;
let brevoInstance = null;
try {
    ({ BrevoClient } = require('@getbrevo/brevo'));
    if (BREVO_API_KEY) {
        brevoInstance = new BrevoClient({ apiKey: BREVO_API_KEY });
        console.log('[EmailFailover] ✅ Fallback (Brevo) configured.');
    } else {
        console.warn('[EmailFailover] ⚠️  BREVO_API_KEY not set — fallback disabled.');
    }
} catch (err) {
    console.warn('[EmailFailover] ⚠️  @getbrevo/brevo not available:', err.message);
}

// ── Auto-migrate email_delivery_log table ─────────────────────────────────────
(async () => {
    if (!db) return;
    const MAX = 3;
    for (let attempt = 1; attempt <= MAX; attempt++) {
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS email_delivery_log (
                    id                    INT AUTO_INCREMENT PRIMARY KEY,
                    ref_id                VARCHAR(50)  NOT NULL UNIQUE,
                    to_email              VARCHAR(255) NOT NULL,
                    subject               VARCHAR(500) NOT NULL,
                    template_name         VARCHAR(100) NULL,
                    primary_provider      VARCHAR(50)  NOT NULL DEFAULT 'nodemailer',
                    fallback_provider     VARCHAR(50)  NOT NULL DEFAULT 'brevo',
                    delivered_by          VARCHAR(50)  NULL     COMMENT 'nodemailer | brevo | NULL = failed both',
                    delivery_status       ENUM('delivered_primary','delivered_fallback','failed_both','in_progress')
                                          NOT NULL DEFAULT 'in_progress',
                    primary_attempted     TINYINT(1)   NOT NULL DEFAULT 0,
                    fallback_triggered    TINYINT(1)   NOT NULL DEFAULT 0,
                    primary_error         TEXT         NULL,
                    fallback_error        TEXT         NULL,
                    primary_message_id    VARCHAR(255) NULL,
                    fallback_message_id   VARCHAR(255) NULL,
                    processing_duration_ms INT         NULL,
                    created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    sent_at               DATETIME     NULL,
                    INDEX idx_status      (delivery_status),
                    INDEX idx_to_email    (to_email),
                    INDEX idx_created     (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('[EmailFailover] ✅ email_delivery_log table ready');
            break;
        } catch (err) {
            if (attempt < MAX) {
                await new Promise(r => setTimeout(r, 4000));
            } else {
                console.error('[EmailFailover] Failed to create email_delivery_log:', err.message);
            }
        }
    }
})();

// ── Helpers ───────────────────────────────────────────────────────────────────
function genRef() {
    const d  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rnd = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `EML-${d}-${rnd}`;
}

function toEmailStr(to) {
    if (typeof to === 'string') return to;
    if (Array.isArray(to))     return to.map(t => (typeof t === 'string' ? t : t.email)).filter(Boolean).join(', ');
    if (to && to.email)        return to.email;
    return 'unknown';
}

async function patchLog(refId, fields) {
    if (!db) return;
    try {
        const set = Object.keys(fields).map(k => `\`${k}\` = ?`).join(', ');
        await db.query(`UPDATE email_delivery_log SET ${set} WHERE ref_id = ?`, [...Object.values(fields), refId]);
    } catch (_) { /* non-critical */ }
}

// ── Internal: send via Nodemailer ─────────────────────────────────────────────
async function _sendViaNM({ to, subject, html, text, attachments }) {
    if (!smtpTransporter) throw new Error('Nodemailer SMTP transporter not configured');

    const mailOpts = {
        from:    `"${FROM_NAME}" <${FROM_ADDR}>`,
        to:      toEmailStr(to),
        subject,
        html:    html  || '',
        text:    text  || '',
    };

    if (attachments && attachments.length > 0) {
        mailOpts.attachments = attachments.map(att => {
            if (att.cid  && att.path)            return { filename: att.filename,                             path: att.path,    cid: att.cid };
            if (att.content && att.filename)      return { filename: att.filename,                             content: att.content };
            if (att.path)                         return { filename: att.filename || path.basename(att.path), path: att.path };
            return null;
        }).filter(Boolean);
    }

    const info = await smtpTransporter.sendMail(mailOpts);
    return { messageId: info.messageId };
}

// ── Internal: send via Brevo ──────────────────────────────────────────────────
async function _sendViaBrevo({ to, subject, html, text, attachments }) {
    if (!brevoInstance) throw new Error('Brevo API client not configured (missing BREVO_API_KEY)');

    let toList = [];
    if (typeof to === 'string')          toList = [{ email: to }];
    else if (Array.isArray(to))          toList = to.map(t => (typeof t === 'string' ? { email: t } : { email: t.email, name: t.name })).filter(t => t.email);
    else if (to && typeof to === 'object') toList = [{ email: to.email, name: to.name }];

    if (toList.length === 0) throw new Error('No valid recipients for Brevo');

    const payload = {
        to:          toList,
        subject,
        htmlContent: html,
        sender:      { email: BREVO_SENDER, name: BREVO_NAME },
    };
    if (text) payload.textContent = text;

    if (attachments && attachments.length > 0) {
        payload.attachment = attachments.map(att => {
            if (att.content && att.filename) return { content: att.content, name: att.filename };
            if (att.path) {
                try {
                    const rp = path.resolve(att.path);
                    if (fs.existsSync(rp)) return { content: fs.readFileSync(rp).toString('base64'), name: att.filename || path.basename(rp) };
                } catch (_) {}
            }
            if (att.url) return { url: att.url, name: att.filename || path.basename(att.url) };
            return null;
        }).filter(Boolean);
    }

    const result = await brevoInstance.transactionalEmails.sendTransacEmail(payload);
    const mid = result.messageId || (result.body && result.body.messageId) || (result.data && result.data.messageId) || null;
    return { messageId: mid };
}

// ── Public: sendTransacEmail (failover-aware) ─────────────────────────────────
/**
 * Send a transactional email with automatic Nodemailer → Brevo failover.
 * Drop-in replacement for the old Brevo-only sendTransacEmail.
 *
 * @param {object} opts
 * @param {string|string[]|object|object[]} opts.to
 * @param {string}   opts.subject
 * @param {string}   opts.html
 * @param {string}   [opts.text]
 * @param {object[]} [opts.attachments]
 * @param {string}   [opts.templateName]
 */
async function sendTransacEmail({ to, subject, html, text, attachments = [], templateName = 'general' }) {
    const refId    = genRef();
    const t0       = Date.now();
    const toStr    = toEmailStr(to);
    const subj500  = (subject || '').substring(0, 500);

    // Record delivery attempt
    if (db) {
        try {
            await db.query(
                `INSERT INTO email_delivery_log
                    (ref_id, to_email, subject, template_name, primary_provider, fallback_provider, delivery_status)
                 VALUES (?, ?, ?, ?, 'nodemailer', 'brevo', 'in_progress')`,
                [refId, toStr, subj500, templateName]
            );
        } catch (_) { /* non-critical */ }
    }

    const ms = () => Date.now() - t0;

    // ── Step 1: Nodemailer (Primary) ─────────────────────────────────────────
    if (smtpTransporter) {
        try {
            console.log(`[EmailFailover] 📤 Primary (Nodemailer) → ${toStr} | "${subject}"`);
            const res = await _sendViaNM({ to, subject, html, text, attachments });

            await patchLog(refId, {
                delivery_status:        'delivered_primary',
                delivered_by:           'nodemailer',
                primary_attempted:      1,
                fallback_triggered:     0,
                primary_message_id:     res.messageId || '',
                processing_duration_ms: ms(),
                sent_at:                new Date(),
            });

            console.log(`[EmailFailover] ✅ Delivered via Nodemailer (${ms()}ms) | MsgId: ${res.messageId}`);
            return { success: true, deliveredBy: 'nodemailer', messageId: res.messageId, fallbackTriggered: false };

        } catch (nmErr) {
            const errStr = (nmErr.message || 'Unknown SMTP error').substring(0, 1000);
            console.warn(`[EmailFailover] ⚠️  Primary (Nodemailer) failed: ${errStr} — activating Brevo fallback`);

            await patchLog(refId, {
                primary_attempted:  1,
                primary_error:      errStr,
                fallback_triggered: 1,
            });
        }
    }

    // ── Step 2: Brevo (Fallback) ──────────────────────────────────────────────
    try {
        const isOnlyProvider = !smtpTransporter;
        if (isOnlyProvider) {
            console.log(`[EmailFailover] 📤 Provider (Brevo) → ${toStr} | "${subject}"`);
        } else {
            console.log(`[EmailFailover] 🔄 Fallback (Brevo) → ${toStr} | "${subject}"`);
        }

        const res = await _sendViaBrevo({ to, subject, html, text, attachments });

        await patchLog(refId, {
            delivery_status:        isOnlyProvider ? 'delivered_primary' : 'delivered_fallback',
            delivered_by:           'brevo',
            fallback_triggered:     isOnlyProvider ? 0 : 1,
            fallback_message_id:    res.messageId || '',
            processing_duration_ms: ms(),
            sent_at:                new Date(),
        });

        console.log(`[EmailFailover] ✅ Delivered via Brevo (${ms()}ms) | MsgId: ${res.messageId}`);
        return {
            success:          true,
            deliveredBy:      'brevo',
            messageId:        res.messageId,
            fallbackTriggered: !isOnlyProvider,
        };

    } catch (brevoErr) {
        const errStr = (brevoErr.message || 'Unknown Brevo error').substring(0, 1000);
        console.error(`[EmailFailover] ❌ Fallback (Brevo) also failed: ${errStr}`);
        if (brevoErr.response && brevoErr.response.body) {
            console.error('[EmailFailover] Brevo API body:', JSON.stringify(brevoErr.response.body));
        }

        await patchLog(refId, {
            delivery_status:        'failed_both',
            fallback_triggered:     1,
            fallback_error:         errStr,
            processing_duration_ms: ms(),
        });

        const primaryMsg = smtpTransporter ? 'Primary (Nodemailer) failed — see primary_error in delivery log. ' : '';
        throw new Error(`${primaryMsg}Fallback (Brevo) also failed: ${errStr}`);
    }
}

module.exports = {
    sendTransacEmail,
    // Expose config info for health-check endpoints
    primaryConfigured:  !!smtpTransporter,
    fallbackConfigured: !!brevoInstance,
    BREVO_SENDER,
    BREVO_NAME,
    FROM_ADDR,
};
