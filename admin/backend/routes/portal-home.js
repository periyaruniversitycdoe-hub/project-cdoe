'use strict';

const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

// ── Upload storage for prospectus PDF ────────────────────────────────────────
const prospectusDir = path.join(__dirname, '../uploads/prospectus');
if (!fs.existsSync(prospectusDir)) fs.mkdirSync(prospectusDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, prospectusDir),
    filename:    (_req, file, cb)  => cb(null, `prospectus_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Only PDF files are allowed'));
    },
});

// ── Auto-create table (idempotent) ────────────────────────────────────────────
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS portal_home_settings (
                id                       INT AUTO_INCREMENT PRIMARY KEY,
                home_page_title          VARCHAR(255) DEFAULT NULL,
                admission_status_text    VARCHAR(255) DEFAULT NULL,
                show_prospectus_btn      TINYINT(1)   DEFAULT 0,
                prospectus_path          VARCHAR(255) DEFAULT NULL,
                prospectus_file_name     VARCHAR(255) DEFAULT NULL,
                created_at               TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
                updated_at               TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Ensure singleton row with id=1 always exists
        await pool.query(`
            INSERT IGNORE INTO portal_home_settings (id) VALUES (1)
        `);

        console.log('✅ portal_home_settings table verified.');

        // Self-healing portal_announcements table check
        await pool.query(`
            CREATE TABLE IF NOT EXISTS portal_announcements (
                id                    INT AUTO_INCREMENT PRIMARY KEY,
                announcement_text     VARCHAR(500) NOT NULL,
                session_text          VARCHAR(100) DEFAULT NULL,
                text_color            VARCHAR(50) DEFAULT '#ffffff',
                background_color      VARCHAR(50) DEFAULT '#991b1b',
                animation_speed       INT DEFAULT 15,
                is_scrolling_enabled  TINYINT(1) DEFAULT 1,
                is_active             TINYINT(1) DEFAULT 1,
                display_order         INT DEFAULT 0,
                created_by            INT DEFAULT NULL,
                updated_by            INT DEFAULT NULL,
                created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ portal_announcements table verified.');
    } catch (err) {
        console.error('[portal-home] Schema error:', err.message);
    }
})();


// ── GET /api/portal-home/settings (public — also called by student frontend) ──
router.get('/settings', async (_req, res) => {
    try {
        const [[row]] = await pool.query('SELECT * FROM portal_home_settings WHERE id = 1');
        res.json({ success: true, data: row || {} });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PUT /api/portal-home/settings — update text settings ─────────────────────
router.put('/settings', verifyToken, isAdmin, async (req, res) => {
    const { home_page_title, admission_status_text, show_prospectus_btn } = req.body;
    try {
        await pool.query(
            `UPDATE portal_home_settings
             SET home_page_title = ?, admission_status_text = ?, show_prospectus_btn = ?, updated_at = NOW()
             WHERE id = 1`,
            [home_page_title || null, admission_status_text || null, show_prospectus_btn ? 1 : 0]
        );
        res.json({ success: true, message: 'Settings saved successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/portal-home/prospectus — upload/replace PDF ────────────────────
router.post('/prospectus', verifyToken, isAdmin, upload.single('prospectus'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No PDF file provided' });
    try {
        // Delete previous file if any
        const [[old]] = await pool.query('SELECT prospectus_path FROM portal_home_settings WHERE id = 1');
        if (old?.prospectus_path) {
            const oldFull = path.join(__dirname, '../', old.prospectus_path);
            if (fs.existsSync(oldFull)) fs.unlinkSync(oldFull);
        }

        const relativePath = `uploads/prospectus/${req.file.filename}`;
        await pool.query(
            `UPDATE portal_home_settings
             SET prospectus_path = ?, prospectus_file_name = ?, show_prospectus_btn = 1, updated_at = NOW()
             WHERE id = 1`,
            [relativePath, req.file.originalname]
        );
        res.json({
            success: true,
            message: 'Prospectus uploaded successfully',
            data: { path: relativePath, name: req.file.originalname }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── DELETE /api/portal-home/prospectus — remove PDF ──────────────────────────
router.delete('/prospectus', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[row]] = await pool.query('SELECT prospectus_path FROM portal_home_settings WHERE id = 1');
        if (row?.prospectus_path) {
            const full = path.join(__dirname, '../', row.prospectus_path);
            if (fs.existsSync(full)) fs.unlinkSync(full);
        }
        await pool.query(
            `UPDATE portal_home_settings
             SET prospectus_path = NULL, prospectus_file_name = NULL, show_prospectus_btn = 0, updated_at = NOW()
             WHERE id = 1`
        );
        res.json({ success: true, message: 'Prospectus removed' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/portal-home/prospectus/download — stream file ───────────────────
router.get('/prospectus/download', async (_req, res) => {
    try {
        const [[row]] = await pool.query(
            'SELECT prospectus_path, prospectus_file_name FROM portal_home_settings WHERE id = 1'
        );
        if (!row?.prospectus_path) return res.status(404).json({ success: false, message: 'No prospectus uploaded' });

        const full = path.join(__dirname, '../', row.prospectus_path);
        if (!fs.existsSync(full)) return res.status(404).json({ success: false, message: 'File not found on server' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${row.prospectus_file_name || 'prospectus.pdf'}"`);
        fs.createReadStream(full).pipe(res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS CRUD (type-aware: notification | date | guideline)
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/portal-home/notifications[?type=notification|date|guideline]
router.get('/notifications', verifyToken, isAdmin, async (req, res) => {
    try {
        const { type } = req.query;
        let sql    = 'SELECT * FROM portal_notifications';
        const args = [];
        if (type) { sql += ' WHERE type = ?'; args.push(type); }
        sql += ' ORDER BY priority DESC, published_at DESC';
        const [rows] = await pool.query(sql, args);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/portal-home/notifications
router.post('/notifications', verifyToken, isAdmin, async (req, res) => {
    const { title, content, type = 'notification', priority = 0, is_active = 1, published_at } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    try {
        const [result] = await pool.query(
            `INSERT INTO portal_notifications (title, content, type, priority, is_active, published_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [title.trim(), content?.trim() || null, type, priority, is_active ? 1 : 0, published_at || new Date()]
        );
        res.status(201).json({ success: true, message: 'Created', id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/portal-home/notifications/:id
router.put('/notifications/:id', verifyToken, isAdmin, async (req, res) => {
    const { title, content, type, priority, is_active, published_at } = req.body;
    try {
        await pool.query(
            `UPDATE portal_notifications
             SET title=?, content=?, type=?, priority=?, is_active=?, published_at=?, updated_at=NOW()
             WHERE id=?`,
            [title?.trim(), content?.trim() || null, type, priority, is_active ? 1 : 0, published_at, req.params.id]
        );
        res.json({ success: true, message: 'Updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/portal-home/notifications/:id
router.delete('/notifications/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM portal_notifications WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PATCH /api/portal-home/notifications/:id/toggle
router.patch('/notifications/:id/toggle', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.query(
            'UPDATE portal_notifications SET is_active = NOT is_active, updated_at = NOW() WHERE id = ?',
            [req.params.id]
        );
        res.json({ success: true, message: 'Toggled' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// DYNAMIC MOVING ANNOUNCEMENTS CRUD
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/portal-home/announcements
router.get('/announcements', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM portal_announcements ORDER BY display_order ASC, created_at DESC');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/portal-home/announcements
router.post('/announcements', verifyToken, isAdmin, async (req, res) => {
    const {
        announcement_text,
        session_text,
        text_color = '#ffffff',
        background_color = '#991b1b',
        animation_speed = 15,
        is_scrolling_enabled = 1,
        is_active = 1,
        display_order = 0
    } = req.body;

    if (!announcement_text?.trim()) {
        return res.status(400).json({ success: false, message: 'Announcement text is required' });
    }

    try {
        const [result] = await pool.query(
            `INSERT INTO portal_announcements 
             (announcement_text, session_text, text_color, background_color, animation_speed, is_scrolling_enabled, is_active, display_order, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                announcement_text.trim(),
                session_text?.trim() || null,
                text_color,
                background_color,
                parseInt(animation_speed) || 15,
                is_scrolling_enabled ? 1 : 0,
                is_active ? 1 : 0,
                parseInt(display_order) || 0,
                req.user?.id || null
            ]
        );

        const newVal = { id: result.insertId, announcement_text: announcement_text.trim(), session_text, text_color, background_color, animation_speed, is_scrolling_enabled, is_active, display_order };
        await pool.query(
            'INSERT INTO settings_audit_logs (admin_id, action, field_name, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'CREATE_ANNOUNCEMENT', 'announcement', JSON.stringify(newVal), req.ip, req.headers['user-agent']]
        );

        res.status(201).json({ success: true, message: 'Announcement created successfully', id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/portal-home/announcements/:id
router.put('/announcements/:id', verifyToken, isAdmin, async (req, res) => {
    const {
        announcement_text,
        session_text,
        text_color,
        background_color,
        animation_speed,
        is_scrolling_enabled,
        is_active,
        display_order
    } = req.body;

    if (!announcement_text?.trim()) {
        return res.status(400).json({ success: false, message: 'Announcement text is required' });
    }

    try {
        const [[oldRow]] = await pool.query('SELECT * FROM portal_announcements WHERE id = ?', [req.params.id]);
        if (!oldRow) {
            return res.status(404).json({ success: false, message: 'Announcement not found' });
        }

        await pool.query(
            `UPDATE portal_announcements
             SET announcement_text = ?, session_text = ?, text_color = ?, background_color = ?, 
                 animation_speed = ?, is_scrolling_enabled = ?, is_active = ?, display_order = ?, updated_by = ?, updated_at = NOW()
             WHERE id = ?`,
            [
                announcement_text.trim(),
                session_text?.trim() || null,
                text_color,
                background_color,
                parseInt(animation_speed) || 15,
                is_scrolling_enabled ? 1 : 0,
                is_active ? 1 : 0,
                parseInt(display_order) || 0,
                req.user?.id || null,
                req.params.id
            ]
        );

        const newVal = { id: req.params.id, announcement_text: announcement_text.trim(), session_text, text_color, background_color, animation_speed, is_scrolling_enabled, is_active, display_order };
        await pool.query(
            'INSERT INTO settings_audit_logs (admin_id, action, field_name, old_value, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.user.id, 'UPDATE_ANNOUNCEMENT', 'announcement', JSON.stringify(oldRow), JSON.stringify(newVal), req.ip, req.headers['user-agent']]
        );

        res.json({ success: true, message: 'Announcement updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/portal-home/announcements/:id
router.delete('/announcements/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[oldRow]] = await pool.query('SELECT * FROM portal_announcements WHERE id = ?', [req.params.id]);
        if (!oldRow) {
            return res.status(404).json({ success: false, message: 'Announcement not found' });
        }

        await pool.query('DELETE FROM portal_announcements WHERE id = ?', [req.params.id]);

        await pool.query(
            'INSERT INTO settings_audit_logs (admin_id, action, field_name, old_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'DELETE_ANNOUNCEMENT', 'announcement', JSON.stringify(oldRow), req.ip, req.headers['user-agent']]
        );

        res.json({ success: true, message: 'Announcement deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PATCH /api/portal-home/announcements/:id/toggle
router.patch('/announcements/:id/toggle', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[oldRow]] = await pool.query('SELECT * FROM portal_announcements WHERE id = ?', [req.params.id]);
        if (!oldRow) {
            return res.status(404).json({ success: false, message: 'Announcement not found' });
        }

        const newActive = oldRow.is_active ? 0 : 1;
        await pool.query(
            'UPDATE portal_announcements SET is_active = ?, updated_at = NOW() WHERE id = ?',
            [newActive, req.params.id]
        );

        await pool.query(
            'INSERT INTO settings_audit_logs (admin_id, action, field_name, old_value, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.user.id, 'TOGGLE_ANNOUNCEMENT', 'announcement', JSON.stringify(oldRow), JSON.stringify({ is_active: newActive }), req.ip, req.headers['user-agent']]
        );

        res.json({ success: true, message: 'Announcement visibility toggled successfully', is_active: newActive });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/portal-home/announcements/reorder
router.put('/announcements/reorder', verifyToken, isAdmin, async (req, res) => {
    const { orders } = req.body;
    if (!Array.isArray(orders)) {
        return res.status(400).json({ success: false, message: 'Orders array is required' });
    }

    try {
        for (const item of orders) {
            await pool.query(
                'UPDATE portal_announcements SET display_order = ?, updated_at = NOW() WHERE id = ?',
                [parseInt(item.display_order) || 0, item.id]
            );
        }

        await pool.query(
            'INSERT INTO settings_audit_logs (admin_id, action, field_name, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'REORDER_ANNOUNCEMENTS', 'announcement', JSON.stringify(orders), req.ip, req.headers['user-agent']]
        );

        res.json({ success: true, message: 'Announcements reordered successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;

