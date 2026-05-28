'use strict';

/**
 * Centralized structured email logger.
 * Writes JSON-line entries to logs/email.log and pretty-prints to console.
 */

const fs   = require('fs');
const path = require('path');

const LOG_DIR  = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'email.log');

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

const C = {
    reset:  '\x1b[0m',
    green:  '\x1b[32m',
    red:    '\x1b[31m',
    yellow: '\x1b[33m',
    cyan:   '\x1b[36m',
    grey:   '\x1b[90m',
};

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

    fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', (writeErr) => {
        if (writeErr) console.error('[Mail] Log write error:', writeErr.message);
    });
}

const logSent    = (to, subject, messageId, template) =>
    logEmail({ status: 'sent',    to, subject, messageId, template });

const logFailed  = (to, subject, error, template) =>
    logEmail({ status: 'failed',  to, subject, error, template });

const logSkipped = (to, subject, reason) =>
    logEmail({ status: 'skipped', to, subject, error: reason });

module.exports = { logEmail, logSent, logFailed, logSkipped };
