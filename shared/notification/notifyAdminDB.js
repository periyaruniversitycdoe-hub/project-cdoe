'use strict';
/**
 * Direct DB notification writer for portal backends (student / supervisor / center).
 *
 * Checks admin_notification_rules before inserting — if the admin has disabled
 * a specific event_key, the notification is silently skipped.
 *
 * Usage (fire-and-forget):
 *   const { notifyAdminDB } = require('../../shared/notification/notifyAdminDB');
 *   notifyAdminDB(db, { event_key: 'student.register', title: '...', ... });
 */

async function notifyAdminDB(db, {
    event_key    = null,
    title,
    message      = '',
    type         = 'info',
    source_type  = 'system',
    source_id    = null,
    link         = null,
} = {}) {
    if (!title) return;
    try {
        // Check admin_notification_rules if event_key supplied
        if (event_key) {
            const [[rule]] = await db.query(
                'SELECT is_active FROM admin_notification_rules WHERE event_key = ? LIMIT 1',
                [event_key]
            );
            // If a rule row exists and is explicitly disabled → skip
            if (rule && rule.is_active === 0) return;
        }

        await db.query(
            `INSERT INTO admin_notifications
             (title, message, type, source_type, source_id, link, is_read)
             VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [
                String(title).slice(0, 255),
                message ? String(message).slice(0, 1000) : '',
                type,
                source_type,
                source_id !== null && source_id !== undefined ? String(source_id).slice(0, 100) : null,
                link       ? String(link).slice(0, 500) : null,
            ]
        );
    } catch (_) {
        // Non-critical — never break the calling flow
    }
}

module.exports = { notifyAdminDB };
