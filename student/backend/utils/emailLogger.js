'use strict';

/**
 * Lightweight structured email logger.
 * Writes JSON-line entries to backend/logs/email.log and pretty-prints to console.
 * Uses only Node.js built-ins — no third-party deps required.
 */

const fs   = require('fs');
const path = require('path');

const LOG_DIR  = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'email.log');

// Ensure the logs directory exists at module load time
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ─── Console colour helpers ───────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  grey:   '\x1b[90m',
};

// ─── Core log function ────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {'sent'|'failed'|'skipped'|'retry'} opts.status
 * @param {string}  opts.to        - recipient email
 * @param {string}  opts.subject   - email subject
 * @param {string}  [opts.messageId] - SMTP message-id on success
 * @param {string}  [opts.error]   - error message on failure
 * @param {string}  [opts.template] - template name (optional context)
 * @param {number}  [opts.attempt]  - retry attempt number
 */
function logEmail({ status, to, subject, messageId, error, template, attempt }) {
  const ts    = new Date().toISOString();
  const entry = {
    timestamp: ts,
    status,
    to,
    subject,
    ...(template  ? { template }  : {}),
    ...(messageId ? { messageId } : {}),
    ...(attempt   ? { attempt }   : {}),
    ...(error     ? { error }     : {}),
  };

  // ── Console output ──
  const icons  = { sent: '✅', failed: '❌', skipped: '⏭', retry: '🔄' };
  const colors = { sent: C.green, failed: C.red, skipped: C.yellow, retry: C.yellow };
  const icon   = icons[status]  || '📧';
  const color  = colors[status] || C.cyan;

  const parts = [
    `${C.grey}${ts}${C.reset}`,
    `[Mail]`,
    `${color}${icon} ${status.toUpperCase()}${C.reset}`,
    `→ ${C.cyan}${to}${C.reset}`,
    `| ${subject}`,
  ];
  if (template)  parts.push(`| tpl:${template}`);
  if (messageId) parts.push(`| ${C.grey}MsgID:${messageId}${C.reset}`);
  if (attempt)   parts.push(`| attempt:${attempt}`);
  if (error)     parts.push(`| ${C.red}${error}${C.reset}`);

  console.log(parts.join(' '));

  // ── File append (non-blocking) ──
  fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', (writeErr) => {
    if (writeErr) console.error('[Mail] Log write error:', writeErr.message);
  });
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

const logSent    = (to, subject, messageId, template) =>
  logEmail({ status: 'sent',    to, subject, messageId, template });

const logFailed  = (to, subject, error, template) =>
  logEmail({ status: 'failed',  to, subject, error, template });

const logSkipped = (to, subject, reason) =>
  logEmail({ status: 'skipped', to, subject, error: reason });

module.exports = { logEmail, logSent, logFailed, logSkipped };
