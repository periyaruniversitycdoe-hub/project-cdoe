'use strict';
/**
 * Admin Notification Service
 *
 * Two responsibilities:
 *  1. SSE Broker  — keeps a registry of live admin SSE connections and broadcasts events.
 *  2. DB Writer   — inserts rows into admin_notifications and immediately broadcasts to open clients.
 *
 * Any admin-backend route can call  notifyAdmin(conn, { title, event_key, ... })
 * Any other backend (student/supervisor/center) should use shared/notification/notifyAdminDB.js
 *
 * event_key (optional): if supplied, the admin_notification_rules table is checked first.
 * If the admin disabled that rule, the notification is silently skipped.
 */

const pool = require('../config/db');

// ── SSE connection registry ───────────────────────────────────────────────────
const _clients = new Map(); // id → { res, adminId }
let _nextId = 1;

function addSseClient(res, adminId) {
    const id = _nextId++;
    _clients.set(id, { res, adminId });
    return id;
}

function removeSseClient(id) {
    _clients.delete(id);
}

function broadcastToSseClients(payload) {
    const chunk = `data: ${JSON.stringify(payload)}\n\n`;
    for (const [id, { res }] of _clients) {
        try {
            res.write(chunk);
        } catch (_) {
            _clients.delete(id);
        }
    }
}

// ── Rule check helper ─────────────────────────────────────────────────────────
async function isEventEnabled(event_key) {
    try {
        const [[row]] = await pool.query(
            'SELECT is_active FROM admin_notification_rules WHERE event_key = ? LIMIT 1',
            [event_key]
        );
        return !row || row.is_active !== 0; // default enabled if no rule row found
    } catch (_) {
        return true; // table may not exist yet on first boot — allow
    }
}

// ── DB writer ─────────────────────────────────────────────────────────────────
/**
 * @param {object|null} conn         mysql2 connection (inside a txn) OR null (uses pool)
 * @param {object}      opts
 * @param {string}      opts.title
 * @param {string}     [opts.message]
 * @param {string}     [opts.type]         info|success|warning|danger|payment|application|system
 * @param {string}     [opts.source_type]  application|payment|supervisor|center|student|system|...
 * @param {string|number|null} [opts.source_id]
 * @param {string|null} [opts.link]         frontend route to navigate to on click
 * @param {string|null} [opts.event_key]    rule key — if admin disabled this rule, skip silently
 */
async function notifyAdmin(conn, {
    title,
    message      = '',
    type         = 'info',
    source_type  = 'system',
    source_id    = null,
    link         = null,
    event_key    = null,
} = {}) {
    if (!title) return;
    try {
        // Check admin-configurable rule if event_key supplied
        if (event_key && !(await isEventEnabled(event_key))) return;

        const db = conn || pool;
        const [result] = await db.execute(
            `INSERT INTO admin_notifications (title, message, type, source_type, source_id, link, is_read)
             VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [
                String(title).slice(0, 255),
                message ? String(message).slice(0, 1000) : '',
                type,
                source_type || 'system',
                source_id !== null && source_id !== undefined ? String(source_id).slice(0, 100) : null,
                link ? String(link).slice(0, 500) : null,
            ]
        );

        broadcastToSseClients({
            event: 'notification',
            data: {
                id:          result.insertId,
                title,
                message:     message || '',
                type,
                source_type: source_type || 'system',
                source_id:   source_id !== null ? String(source_id) : null,
                link:        link || null,
                is_read:     0,
                created_at:  new Date().toISOString(),
            },
        });
    } catch (_) {
        // Non-critical — never break the calling flow
    }
}

module.exports = { notifyAdmin, addSseClient, removeSseClient, broadcastToSseClients };
