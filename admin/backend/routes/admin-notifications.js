'use strict';
/**
 * Admin Notification Routes — Enterprise Edition
 *
 * GET    /api/admin-notifications              — paginated list + unread count
 * GET    /api/admin-notifications/count        — unread count + by_source breakdown
 * GET    /api/admin-notifications/stream       — Server-Sent Events real-time feed
 * GET    /api/admin-notifications/export       — Download Excel report
 * GET    /api/admin-notifications/preferences  — Get notification preferences
 * PUT    /api/admin-notifications/preferences  — Update notification preferences
 * PATCH  /api/admin-notifications/read-all     — Mark all as read
 * PATCH  /api/admin-notifications/:id/read     — Mark one as read
 * DELETE /api/admin-notifications/bulk         — Delete multiple by IDs
 * DELETE /api/admin-notifications/cleared      — Delete all read notifications
 * DELETE /api/admin-notifications/:id          — Delete one
 */

const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { safeError }            = require('../../../shared/security/safeError');
const ExcelJS                  = require('exceljs');
const {
    notifyAdmin,
    addSseClient,
    removeSseClient,
    broadcastToSseClients,
} = require('../services/notifyAdmin');

// ── Startup: auto-create tables + auto-expire cleanup ────────────────────────
(async () => {
    try {
        // Main notifications table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_notifications (
                id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                title       VARCHAR(255)  NOT NULL,
                message     TEXT          NOT NULL DEFAULT '',
                type        ENUM('info','success','warning','danger','payment','application','system')
                            NOT NULL DEFAULT 'info',
                source_type ENUM('application','payment','supervisor','center','student',
                                  'system','hall_ticket','result','counselling')
                            NOT NULL DEFAULT 'system',
                source_id   VARCHAR(100)  DEFAULT NULL,
                link        VARCHAR(500)  DEFAULT NULL,
                is_read     TINYINT(1)    NOT NULL DEFAULT 0,
                created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_is_read  (is_read),
                INDEX idx_created  (created_at DESC),
                INDEX idx_source   (source_type, source_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Preferences table — one row per source_type
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_notification_preferences (
                source_type     VARCHAR(50)  NOT NULL PRIMARY KEY,
                enabled         TINYINT(1)   NOT NULL DEFAULT 1,
                toast_enabled   TINYINT(1)   NOT NULL DEFAULT 1,
                sound_enabled   TINYINT(1)   NOT NULL DEFAULT 1,
                push_enabled    TINYINT(1)   NOT NULL DEFAULT 1,
                updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Extend ENUM to include chatbot + password_reset (safe on existing installs)
        await pool.query(`
            ALTER TABLE admin_notifications
            MODIFY COLUMN source_type
            ENUM('application','payment','supervisor','center','student',
                 'system','hall_ticket','result','counselling','chatbot','password_reset')
            NOT NULL DEFAULT 'system'
        `).catch(() => {});

        // Notification Rules table — admin-configurable per-event toggles
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_notification_rules (
                event_key   VARCHAR(100)  NOT NULL PRIMARY KEY,
                label       VARCHAR(255)  NOT NULL,
                description TEXT,
                source_type VARCHAR(50)   NOT NULL DEFAULT 'system',
                category    VARCHAR(80)   NOT NULL DEFAULT 'General',
                is_active   TINYINT(1)    NOT NULL DEFAULT 1,
                updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Seed default rules (all enabled by default)
        const DEFAULT_RULES = [
            ['student.register',            'New Student Registration',           'Notify when a new student registers on the portal',                     'student',        'Student Portal'],
            ['student.password_reset',      'Student Password Reset',             'Notify when a student resets their password',                           'password_reset', 'Student Portal'],
            ['student.payment.submit',      'Student Payment Submission',         'Notify when a student submits payment details',                         'payment',        'Student Portal'],
            ['student.counselling.submit',  'Student Counselling Submission',     'Notify when a student submits a counselling form',                      'counselling',    'Student Portal'],
            ['student.chatbot.query',       'Student Chatbot Query',              'Notify when a student submits an unanswered chatbot question',           'chatbot',        'Student Portal'],
            ['supervisor.register',         'Supervisor Self-Registration',       'Notify when a supervisor completes self-registration',                   'supervisor',     'Supervisor Portal'],
            ['supervisor.password_reset',   'Supervisor Password Reset',          'Notify when a supervisor resets their password',                         'password_reset', 'Supervisor Portal'],
            ['supervisor.chatbot.query',    'Supervisor Chatbot Query',           'Notify when a supervisor submits an unanswered chatbot question',        'chatbot',        'Supervisor Portal'],
            ['center.register',             'Centre Self-Registration',           'Notify when a research centre completes self-registration',              'center',         'Centre Portal'],
            ['center.password_reset',       'Centre Password Reset',              'Notify when a centre user resets their password',                        'password_reset', 'Centre Portal'],
            ['center.chatbot.query',        'Centre Chatbot Query',               'Notify when a centre user submits an unanswered chatbot question',       'chatbot',        'Centre Portal'],
            ['application.status_change',   'Application Status Changed',         'Notify when an application status is updated by admin',                  'application',    'Admin Actions'],
            ['payment.approve_reject',      'Payment Approved / Rejected',        'Notify when admin approves or rejects a student payment',                'payment',        'Admin Actions'],
            ['hall_ticket.generate_single', 'Single Hall Ticket Generated',       'Notify when admin generates a hall ticket for one student',              'hall_ticket',    'Admin Actions'],
            ['hall_ticket.generate_bulk',   'Bulk Hall Tickets Generated',        'Notify when admin generates hall tickets in bulk',                       'hall_ticket',    'Admin Actions'],
            ['result.publish',              'Entrance Results Published',          'Notify when admin publishes entrance exam results',                      'result',         'Admin Actions'],
        ];
        for (const [event_key, label, description, source_type, category] of DEFAULT_RULES) {
            await pool.query(
                `INSERT IGNORE INTO admin_notification_rules (event_key, label, description, source_type, category) VALUES (?,?,?,?,?)`,
                [event_key, label, description, source_type, category]
            );
        }

        // Seed default rows for every source_type if not exist
        const SOURCES = ['application','payment','supervisor','center','student',
                         'system','hall_ticket','result','counselling','chatbot','password_reset'];
        for (const src of SOURCES) {
            await pool.query(
                `INSERT IGNORE INTO admin_notification_preferences (source_type) VALUES (?)`, [src]
            );
        }

        // Retention setting in preferences (retention_days — stored as a special row)
        await pool.query(
            `INSERT IGNORE INTO admin_notification_preferences (source_type, enabled) VALUES ('__retention__', 90)`
        );

        // Auto-expire: delete notifications older than retention_days
        const [[retRow]] = await pool.query(
            `SELECT enabled AS days FROM admin_notification_preferences WHERE source_type = '__retention__' LIMIT 1`
        );
        const retentionDays = retRow?.days > 0 ? retRow.days : 90;
        await pool.query(
            `DELETE FROM admin_notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
            [retentionDays]
        );

    } catch (err) {
        console.error('[admin-notifications] Schema init error:', err.message);
    }
})();

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getUnreadCount() {
    const [[row]] = await pool.query(
        'SELECT COUNT(*) AS cnt FROM admin_notifications WHERE is_read = 0'
    );
    return Number(row.cnt);
}

async function getSourceCounts() {
    const [rows] = await pool.query(
        `SELECT source_type, COUNT(*) AS cnt
         FROM admin_notifications
         WHERE is_read = 0
         GROUP BY source_type`
    );
    const map = {};
    for (const r of rows) map[r.source_type] = Number(r.cnt);
    return map;
}

// ── GET / — paginated list ────────────────────────────────────────────────────
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const page       = Math.max(1, parseInt(req.query.page)  || 1);
        const limit      = Math.min(100, parseInt(req.query.limit) || 20);
        const offset     = (page - 1) * limit;
        const unreadOnly = req.query.unread === 'true';
        const srcType    = req.query.source_type || null;

        const conds = [];
        const params = [];
        if (unreadOnly) { conds.push('is_read = 0'); }
        if (srcType)    { conds.push('source_type = ?'); params.push(srcType); }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total FROM admin_notifications ${where}`, params
        );
        const [rows] = await pool.query(
            `SELECT * FROM admin_notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );
        const unread_count = await getUnreadCount();
        const by_source    = await getSourceCounts();

        res.json({ success: true, data: rows, total, unread_count, by_source, page, limit });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── GET /count — unread count + per-source breakdown ─────────────────────────
router.get('/count', verifyToken, isAdmin, async (_req, res) => {
    try {
        const count      = await getUnreadCount();
        const by_source  = await getSourceCounts();
        res.json({ success: true, count, by_source });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── POST / — create manual admin notification ──────────────────────────────
router.post('/', verifyToken, isAdmin, async (req, res) => {
    const { title, message, type = 'info', source_type = 'system', link } = req.body;
    if (!title) {
        return res.status(400).json({ success: false, message: 'Title is required' });
    }
    try {
        await notifyAdmin(null, {
            title,
            message: message || '',
            type,
            source_type,
            link: link || null
        });
        res.status(201).json({ success: true, message: 'Notification created' });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── GET /stream — SSE real-time feed ─────────────────────────────────────────
router.get('/stream', verifyToken, isAdmin, async (req, res) => {
    res.setHeader('Content-Type',      'text/event-stream');
    res.setHeader('Cache-Control',     'no-cache, no-transform');
    res.setHeader('Connection',        'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const clientId = addSseClient(res, req.user?.id);

    // Send init payload
    try {
        const count     = await getUnreadCount();
        const by_source = await getSourceCounts();
        res.write(`data: ${JSON.stringify({ event: 'init', data: { unread_count: count, by_source } })}\n\n`);
    } catch (_) {}

    // Heartbeat every 25 s
    const heartbeat = setInterval(() => {
        try { res.write(': heartbeat\n\n'); } catch (_) { clearInterval(heartbeat); }
    }, 25_000);

    // Cross-process poll every 5 s (picks up notifications from student/supervisor/center backends)
    let lastSeenId = 0;
    try {
        const [[row]] = await pool.query('SELECT COALESCE(MAX(id),0) AS max_id FROM admin_notifications');
        lastSeenId = Number(row.max_id);
    } catch (_) {}

    const poll = setInterval(async () => {
        try {
            const [newRows] = await pool.query(
                `SELECT * FROM admin_notifications WHERE id > ? ORDER BY id ASC LIMIT 10`,
                [lastSeenId]
            );
            if (newRows.length > 0) {
                lastSeenId = newRows[newRows.length - 1].id;
                for (const row of newRows) {
                    res.write(`data: ${JSON.stringify({ event: 'notification', data: row })}\n\n`);
                }
            }
        } catch (_) {}
    }, 5_000);

    req.on('close', () => {
        clearInterval(heartbeat);
        clearInterval(poll);
        removeSseClient(clientId);
    });
});

// ── GET /export — Excel download ──────────────────────────────────────────────
router.get('/export', verifyToken, isAdmin, async (req, res) => {
    try {
        const srcType    = req.query.source_type || null;
        const unreadOnly = req.query.unread === 'true';
        const conds = [];
        const params = [];
        if (unreadOnly) { conds.push('is_read = 0'); }
        if (srcType)    { conds.push('source_type = ?'); params.push(srcType); }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

        const [rows] = await pool.query(
            `SELECT id, title, message, type, source_type, source_id, is_read, created_at
             FROM admin_notifications ${where}
             ORDER BY created_at DESC LIMIT 10000`,
            params
        );

        const wb = new ExcelJS.Workbook();
        wb.creator = 'Periyar University PhD ERP';
        wb.created = new Date();

        const ws = wb.addWorksheet('Notifications');
        ws.columns = [
            { header: 'ID',          key: 'id',          width: 8  },
            { header: 'Title',       key: 'title',       width: 45 },
            { header: 'Message',     key: 'message',     width: 60 },
            { header: 'Type',        key: 'type',        width: 14 },
            { header: 'Source',      key: 'source_type', width: 16 },
            { header: 'Source ID',   key: 'source_id',   width: 18 },
            { header: 'Read',        key: 'is_read',     width: 8  },
            { header: 'Date & Time', key: 'created_at',  width: 22 },
        ];

        // Header style
        ws.getRow(1).eachCell(cell => {
            cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
            cell.font   = { color: { argb: 'FFFFFFFF' }, bold: true };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
        });

        const TYPE_COLOR = { success: 'FF22C55E', danger: 'FFEF4444', warning: 'FFF59E0B', info: 'FF3B82F6', payment: 'FFF59E0B', application: 'FF3B82F6', system: 'FF6B7280' };

        rows.forEach(r => {
            const row = ws.addRow({
                ...r,
                is_read:    r.is_read ? 'Yes' : 'No',
                created_at: new Date(r.created_at).toLocaleString('en-IN'),
            });
            const color = TYPE_COLOR[r.type] || 'FF6B7280';
            row.getCell('type').font = { color: { argb: color }, bold: true };
            if (!r.is_read) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="admin-notifications-${Date.now()}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── GET /preferences ──────────────────────────────────────────────────────────
router.get('/preferences', verifyToken, isAdmin, async (_req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM admin_notification_preferences WHERE source_type != '__retention__'`
        );
        const [[retRow]] = await pool.query(
            `SELECT enabled AS days FROM admin_notification_preferences WHERE source_type = '__retention__'`
        );
        res.json({ success: true, data: rows, retention_days: retRow?.days ?? 90 });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── PUT /preferences ──────────────────────────────────────────────────────────
router.put('/preferences', verifyToken, isAdmin, async (req, res) => {
    const { preferences = [], retention_days } = req.body;
    try {
        for (const pref of preferences) {
            const { source_type, enabled, toast_enabled, sound_enabled, push_enabled } = pref;
            await pool.query(
                `INSERT INTO admin_notification_preferences
                    (source_type, enabled, toast_enabled, sound_enabled, push_enabled)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    enabled=VALUES(enabled), toast_enabled=VALUES(toast_enabled),
                    sound_enabled=VALUES(sound_enabled), push_enabled=VALUES(push_enabled)`,
                [source_type, enabled ? 1 : 0, toast_enabled ? 1 : 0,
                 sound_enabled ? 1 : 0, push_enabled ? 1 : 0]
            );
        }
        if (retention_days !== undefined) {
            const days = Math.min(365, Math.max(7, parseInt(retention_days) || 90));
            await pool.query(
                `UPDATE admin_notification_preferences SET enabled = ? WHERE source_type = '__retention__'`,
                [days]
            );
        }
        res.json({ success: true, message: 'Preferences saved' });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── PATCH /read-all ───────────────────────────────────────────────────────────
router.patch('/read-all', verifyToken, isAdmin, async (_req, res) => {
    try {
        await pool.query('UPDATE admin_notifications SET is_read = 1 WHERE is_read = 0');
        broadcastToSseClients({ event: 'unread_count', data: { count: 0, by_source: {} } });
        res.json({ success: true, unread_count: 0 });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── PATCH /:id/read ───────────────────────────────────────────────────────────
router.patch('/:id/read', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.query('UPDATE admin_notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
        const count     = await getUnreadCount();
        const by_source = await getSourceCounts();
        broadcastToSseClients({ event: 'unread_count', data: { count, by_source } });
        res.json({ success: true, unread_count: count, by_source });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── DELETE /bulk — delete multiple by IDs ─────────────────────────────────────
router.delete('/bulk', verifyToken, isAdmin, async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, message: 'ids array required' });
    }
    try {
        const placeholders = ids.map(() => '?').join(',');
        await pool.query(`DELETE FROM admin_notifications WHERE id IN (${placeholders})`, ids);
        const count     = await getUnreadCount();
        const by_source = await getSourceCounts();
        res.json({ success: true, deleted: ids.length, unread_count: count, by_source });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── DELETE /cleared — delete all read notifications ───────────────────────────
router.delete('/cleared', verifyToken, isAdmin, async (_req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM admin_notifications WHERE is_read = 1');
        res.json({ success: true, deleted: result.affectedRows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── GET /rules — list all notification event rules ────────────────────────────
router.get('/rules', verifyToken, isAdmin, async (_req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM admin_notification_rules ORDER BY category ASC, label ASC'
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── PUT /rules/:event_key — toggle a rule on/off ──────────────────────────────
router.put('/rules/:event_key', verifyToken, isAdmin, async (req, res) => {
    const { is_active } = req.body;
    if (is_active === undefined) return res.status(400).json({ success: false, message: 'is_active required' });
    try {
        await pool.query(
            'UPDATE admin_notification_rules SET is_active = ? WHERE event_key = ?',
            [is_active ? 1 : 0, req.params.event_key]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── DELETE /:id — delete one ──────────────────────────────────────────────────
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM admin_notifications WHERE id = ?', [req.params.id]);
        const count     = await getUnreadCount();
        const by_source = await getSourceCounts();
        res.json({ success: true, unread_count: count, by_source });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

module.exports = router;
