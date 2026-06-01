'use strict';

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ── Multer Setup ───────────────────────────────────────────────────────────────
const sanitizeFilename = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');

const allowedMimetypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed',
    'application/vnd.rar',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
];

const attachmentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(__dirname, '../../../uploads/announcements');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${sanitizeFilename(file.originalname)}`),
});

const upload = multer({
    storage: attachmentStorage,
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (allowedMimetypes.includes(file.mimetype)) return cb(null, true);
        cb(new Error('File type not allowed'));
    },
});

// ── Auto-migration ─────────────────────────────────────────────────────────────
(async () => {
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS announcement_categories (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                name        VARCHAR(150) NOT NULL,
                slug        VARCHAR(150) NOT NULL,
                is_active   TINYINT(1)   NOT NULL DEFAULT 1,
                is_system   TINYINT(1)   NOT NULL DEFAULT 0,
                sort_order  INT          NOT NULL DEFAULT 0,
                created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_cat_slug (slug)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Seed system categories if empty
        const [catRows] = await pool.execute('SELECT COUNT(*) AS cnt FROM announcement_categories');
        if (catRows[0].cnt === 0) {
            const systemCats = [
                ['General Notice',          'general-notice',          1],
                ['Admission Notice',        'admission-notice',        1],
                ['Entrance Examination',    'entrance-examination',    1],
                ['Counselling Notice',      'counselling-notice',      1],
                ['Result Notice',           'result-notice',           1],
                ['Fee Notice',              'fee-notice',              1],
                ['Research Notice',         'research-notice',         1],
                ['Emergency Notice',        'emergency-notice',        1],
                ['Holiday Notice',          'holiday-notice',          1],
                ['University Circular',     'university-circular',     1],
                ['Custom Category',         'custom-category',         0],
            ];
            for (const [name, slug, isSystem] of systemCats) {
                await pool.execute(
                    'INSERT IGNORE INTO announcement_categories (name, slug, is_system) VALUES (?, ?, ?)',
                    [name, slug, isSystem]
                );
            }
        }

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS announcements (
                id               INT AUTO_INCREMENT PRIMARY KEY,
                title            VARCHAR(500)  NOT NULL,
                content          LONGTEXT      NOT NULL,
                category_id      INT           NOT NULL,
                display_mode     ENUM('ticker','static','popup','card','alert') NOT NULL DEFAULT 'static',
                ticker_direction ENUM('left','right') NOT NULL DEFAULT 'right',
                ticker_speed     INT           NOT NULL DEFAULT 50,
                position         ENUM('top-header','below-header','above-portals','below-portals','footer') NOT NULL DEFAULT 'below-header',
                priority         ENUM('critical','high','medium','normal','low') NOT NULL DEFAULT 'normal',
                bg_color         VARCHAR(20)   NOT NULL DEFAULT '#1e3a5f',
                text_color       VARCHAR(20)   NOT NULL DEFAULT '#ffffff',
                border_color     VARCHAR(20)   NOT NULL DEFAULT '#2a52b4',
                highlight_color  VARCHAR(20)   NOT NULL DEFAULT '#f59e0b',
                attachment_path  VARCHAR(500)  NULL,
                attachment_name  VARCHAR(255)  NULL,
                attachment_size  INT           NULL,
                status           ENUM('draft','scheduled','published','expired','archived','inactive') NOT NULL DEFAULT 'draft',
                start_at         DATETIME      NOT NULL,
                end_at           DATETIME      NOT NULL,
                popup_reappear   TINYINT(1)   NOT NULL DEFAULT 0,
                popup_delay_mins INT           NOT NULL DEFAULT 60,
                created_by       INT           NOT NULL,
                created_by_email VARCHAR(255)  NULL,
                updated_by       INT           NULL,
                updated_by_email VARCHAR(255)  NULL,
                published_by     INT           NULL,
                published_by_email VARCHAR(255) NULL,
                published_at     DATETIME      NULL,
                archived_by      INT           NULL,
                archived_by_email VARCHAR(255) NULL,
                archived_at      DATETIME      NULL,
                deleted_by       INT           NULL,
                deleted_by_email VARCHAR(255)  NULL,
                deleted_at       DATETIME      NULL,
                is_deleted       TINYINT(1)   NOT NULL DEFAULT 0,
                created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES announcement_categories(id) ON DELETE RESTRICT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS announcement_audit_log (
                id               INT AUTO_INCREMENT PRIMARY KEY,
                announcement_id  INT           NULL,
                action           VARCHAR(50)   NOT NULL,
                actor_id         INT           NULL,
                actor_email      VARCHAR(255)  NULL,
                ip_address       VARCHAR(45)   NULL,
                old_value        LONGTEXT      NULL,
                new_value        LONGTEXT      NULL,
                created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('✅ Announcement Management schema verified.');
    } catch (err) {
        console.error('[announcements] Schema error:', err.message);
    }
})();

// ── Helpers ────────────────────────────────────────────────────────────────────
const PRIORITY_ORDER = { critical: 5, high: 4, medium: 3, normal: 2, low: 1 };

function autoExpireStatus(row) {
    const now = new Date();
    if (row.status === 'published') {
        if (new Date(row.start_at) > now) return 'scheduled';
        if (new Date(row.end_at) < now)   return 'expired';
    }
    return row.status;
}

async function auditLog(announcementId, action, actor, ip, oldVal, newVal) {
    try {
        await pool.execute(
            `INSERT INTO announcement_audit_log
                (announcement_id, action, actor_id, actor_email, ip_address, old_value, new_value)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                announcementId,
                action,
                actor?.id   || null,
                actor?.email || null,
                ip || null,
                oldVal ? JSON.stringify(oldVal) : null,
                newVal ? JSON.stringify(newVal) : null,
            ]
        );
    } catch (e) {
        console.error('[announcements] Audit log error:', e.message);
    }
}

// ── PUBLIC ENDPOINT — no auth required (portal-dashboard reads this) ───────────
router.get('/public', async (req, res) => {
    try {
        const now = new Date();
        const [rows] = await pool.query(
            `SELECT a.*, c.name AS category_name
             FROM announcements a
             JOIN announcement_categories c ON a.category_id = c.id
             WHERE a.is_deleted = 0
               AND a.status = 'published'
               AND a.start_at <= ?
               AND a.end_at   >= ?
             ORDER BY
               FIELD(a.priority, 'critical','high','medium','normal','low'),
               a.created_at DESC`,
            [now, now]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── CATEGORY CRUD ──────────────────────────────────────────────────────────────

// GET all categories
router.get('/categories', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM announcement_categories ORDER BY sort_order ASC, name ASC'
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST create category
router.post('/categories', verifyToken, isAdmin, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Category name is required' });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    try {
        const [result] = await pool.execute(
            'INSERT INTO announcement_categories (name, slug, is_system) VALUES (?, ?, 0)',
            [name.trim(), slug]
        );
        res.status(201).json({ success: true, message: 'Category created', id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Category already exists' });
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT update category
router.put('/categories/:id', verifyToken, isAdmin, async (req, res) => {
    const { name, is_active } = req.body;
    try {
        await pool.execute(
            'UPDATE announcement_categories SET name=?, is_active=? WHERE id=?',
            [name, is_active ? 1 : 0, req.params.id]
        );
        res.json({ success: true, message: 'Category updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE category (only non-system)
router.delete('/categories/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [cats] = await pool.execute('SELECT is_system FROM announcement_categories WHERE id=?', [req.params.id]);
        if (!cats[0]) return res.status(404).json({ success: false, message: 'Category not found' });
        if (cats[0].is_system) return res.status(400).json({ success: false, message: 'System categories cannot be deleted' });
        await pool.execute('DELETE FROM announcement_categories WHERE id=?', [req.params.id]);
        res.json({ success: true, message: 'Category deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── ANNOUNCEMENT CRUD ──────────────────────────────────────────────────────────

// GET list with filters, search, pagination
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const {
            page = 1, limit = 20,
            search = '', category = '', status = '',
            display_mode = '', priority = '',
            start_from = '', start_to = '',
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const params = [];
        let where = 'WHERE a.is_deleted = 0';

        if (search) {
            where += ' AND (a.title LIKE ? OR a.content LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        if (category) { where += ' AND a.category_id = ?'; params.push(category); }
        if (status)   { where += ' AND a.status = ?';      params.push(status); }
        if (display_mode) { where += ' AND a.display_mode = ?'; params.push(display_mode); }
        if (priority) { where += ' AND a.priority = ?';    params.push(priority); }
        if (start_from) { where += ' AND a.start_at >= ?'; params.push(start_from); }
        if (start_to)   { where += ' AND a.start_at <= ?'; params.push(start_to); }

        // Use pool.query() (non-prepared) for dynamic WHERE + LIMIT/OFFSET —
        // pool.execute() prepared statements reject LIMIT/OFFSET params in some MySQL versions.
        const safeLimit  = Math.max(1, parseInt(limit)  || 20);
        const safeOffset = Math.max(0, parseInt(offset) || (parseInt(page) - 1) * safeLimit);

        const [countRows] = await pool.query(
            `SELECT COUNT(*) AS total FROM announcements a ${where}`,
            params
        );
        const total = countRows[0].total;

        const [rows] = await pool.query(
            `SELECT a.*, c.name AS category_name
             FROM announcements a
             JOIN announcement_categories c ON a.category_id = c.id
             ${where}
             ORDER BY FIELD(a.priority,'critical','high','medium','normal','low'), a.created_at DESC
             LIMIT ${safeLimit} OFFSET ${safeOffset}`,
            params
        );

        // Auto-update expired published announcements status in DB
        for (const row of rows) {
            const computedStatus = autoExpireStatus(row);
            if (computedStatus !== row.status && row.status === 'published') {
                await pool.execute('UPDATE announcements SET status=? WHERE id=?', [computedStatus, row.id]);
                row.status = computedStatus;
            }
        }

        res.json({ success: true, data: rows, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET single announcement
router.get('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT a.*, c.name AS category_name
             FROM announcements a
             JOIN announcement_categories c ON a.category_id = c.id
             WHERE a.id = ? AND a.is_deleted = 0`,
            [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ success: false, message: 'Announcement not found' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST create announcement
router.post('/', verifyToken, isAdmin, upload.single('attachment'), async (req, res) => {
    const actor = req.user;
    const {
        title, content, category_id, display_mode = 'static',
        ticker_direction = 'right', ticker_speed = 50,
        position = 'below-header', priority = 'normal',
        bg_color = '#1e3a5f', text_color = '#ffffff',
        border_color = '#2a52b4', highlight_color = '#f59e0b',
        status = 'draft', start_at, end_at,
        popup_reappear = 0, popup_delay_mins = 60,
    } = req.body;

    if (!title || !content || !category_id || !start_at || !end_at) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ success: false, message: 'title, content, category_id, start_at and end_at are required' });
    }

    const attachmentPath = req.file ? `/uploads/announcements/${req.file.filename}` : null;
    const attachmentName = req.file ? req.file.originalname : null;
    const attachmentSize = req.file ? req.file.size : null;

    try {
        const [result] = await pool.execute(
            `INSERT INTO announcements
                (title, content, category_id, display_mode, ticker_direction, ticker_speed,
                 position, priority, bg_color, text_color, border_color, highlight_color,
                 attachment_path, attachment_name, attachment_size,
                 status, start_at, end_at, popup_reappear, popup_delay_mins,
                 created_by, created_by_email)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                title, content, category_id, display_mode, ticker_direction, parseInt(ticker_speed),
                position, priority, bg_color, text_color, border_color, highlight_color,
                attachmentPath, attachmentName, attachmentSize,
                status, start_at, end_at, popup_reappear ? 1 : 0, parseInt(popup_delay_mins),
                actor.id, actor.email,
            ]
        );
        await auditLog(result.insertId, 'create', actor, req.ip, null, { title, status });
        res.status(201).json({ success: true, message: 'Announcement created', id: result.insertId });
    } catch (err) {
        if (req.file) fs.unlink(req.file.path, () => {});
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT update announcement
router.put('/:id', verifyToken, isAdmin, upload.single('attachment'), async (req, res) => {
    const actor = req.user;
    const {
        title, content, category_id, display_mode,
        ticker_direction, ticker_speed,
        position, priority,
        bg_color, text_color, border_color, highlight_color,
        status, start_at, end_at,
        popup_reappear, popup_delay_mins,
        remove_attachment,
    } = req.body;

    try {
        const [existing] = await pool.execute(
            'SELECT * FROM announcements WHERE id=? AND is_deleted=0', [req.params.id]
        );
        if (!existing[0]) return res.status(404).json({ success: false, message: 'Announcement not found' });
        const old = existing[0];

        let attachmentPath = old.attachment_path;
        let attachmentName = old.attachment_name;
        let attachmentSize = old.attachment_size;

        if (remove_attachment === 'true' || remove_attachment === '1') {
            if (old.attachment_path) {
                const fullPath = path.join(__dirname, '../../../', old.attachment_path);
                if (fs.existsSync(fullPath)) fs.unlink(fullPath, () => {});
            }
            attachmentPath = null; attachmentName = null; attachmentSize = null;
        }

        if (req.file) {
            if (attachmentPath) {
                const fullPath = path.join(__dirname, '../../../', attachmentPath);
                if (fs.existsSync(fullPath)) fs.unlink(fullPath, () => {});
            }
            attachmentPath = `/uploads/announcements/${req.file.filename}`;
            attachmentName = req.file.originalname;
            attachmentSize = req.file.size;
        }

        await pool.execute(
            `UPDATE announcements SET
                title=?, content=?, category_id=?, display_mode=?, ticker_direction=?, ticker_speed=?,
                position=?, priority=?, bg_color=?, text_color=?, border_color=?, highlight_color=?,
                attachment_path=?, attachment_name=?, attachment_size=?,
                status=?, start_at=?, end_at=?, popup_reappear=?, popup_delay_mins=?,
                updated_by=?, updated_by_email=?, updated_at=NOW()
             WHERE id=?`,
            [
                title, content, category_id, display_mode, ticker_direction, parseInt(ticker_speed),
                position, priority, bg_color, text_color, border_color, highlight_color,
                attachmentPath, attachmentName, attachmentSize,
                status, start_at, end_at, popup_reappear ? 1 : 0, parseInt(popup_delay_mins),
                actor.id, actor.email,
                req.params.id,
            ]
        );
        await auditLog(req.params.id, 'update', actor, req.ip, old, { title, status });
        res.json({ success: true, message: 'Announcement updated' });
    } catch (err) {
        if (req.file) fs.unlink(req.file.path, () => {});
        res.status(500).json({ success: false, message: err.message });
    }
});

// PATCH publish
router.patch('/:id/publish', verifyToken, isAdmin, async (req, res) => {
    const actor = req.user;
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM announcements WHERE id=? AND is_deleted=0', [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ success: false, message: 'Not found' });
        await pool.execute(
            'UPDATE announcements SET status=?, published_by=?, published_by_email=?, published_at=NOW(), updated_by=?, updated_by_email=? WHERE id=?',
            ['published', actor.id, actor.email, actor.id, actor.email, req.params.id]
        );
        await auditLog(req.params.id, 'publish', actor, req.ip, { status: rows[0].status }, { status: 'published' });
        res.json({ success: true, message: 'Announcement published' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PATCH unpublish
router.patch('/:id/unpublish', verifyToken, isAdmin, async (req, res) => {
    const actor = req.user;
    try {
        await pool.execute(
            'UPDATE announcements SET status=?, updated_by=?, updated_by_email=? WHERE id=? AND is_deleted=0',
            ['inactive', actor.id, actor.email, req.params.id]
        );
        await auditLog(req.params.id, 'unpublish', actor, req.ip, null, { status: 'inactive' });
        res.json({ success: true, message: 'Announcement unpublished' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PATCH archive
router.patch('/:id/archive', verifyToken, isAdmin, async (req, res) => {
    const actor = req.user;
    try {
        await pool.execute(
            'UPDATE announcements SET status=?, archived_by=?, archived_by_email=?, archived_at=NOW(), updated_by=?, updated_by_email=? WHERE id=? AND is_deleted=0',
            ['archived', actor.id, actor.email, actor.id, actor.email, req.params.id]
        );
        await auditLog(req.params.id, 'archive', actor, req.ip, null, { status: 'archived' });
        res.json({ success: true, message: 'Announcement archived' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PATCH restore (from archive/inactive)
router.patch('/:id/restore', verifyToken, isAdmin, async (req, res) => {
    const actor = req.user;
    try {
        await pool.execute(
            'UPDATE announcements SET status=?, updated_by=?, updated_by_email=? WHERE id=? AND is_deleted=0',
            ['draft', actor.id, actor.email, req.params.id]
        );
        await auditLog(req.params.id, 'restore', actor, req.ip, null, { status: 'draft' });
        res.json({ success: true, message: 'Announcement restored to draft' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST duplicate
router.post('/:id/duplicate', verifyToken, isAdmin, async (req, res) => {
    const actor = req.user;
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM announcements WHERE id=? AND is_deleted=0', [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ success: false, message: 'Not found' });
        const src = rows[0];
        const [result] = await pool.execute(
            `INSERT INTO announcements
                (title, content, category_id, display_mode, ticker_direction, ticker_speed,
                 position, priority, bg_color, text_color, border_color, highlight_color,
                 status, start_at, end_at, popup_reappear, popup_delay_mins,
                 created_by, created_by_email)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                `Copy of ${src.title}`, src.content, src.category_id, src.display_mode,
                src.ticker_direction, src.ticker_speed, src.position, src.priority,
                src.bg_color, src.text_color, src.border_color, src.highlight_color,
                'draft', src.start_at, src.end_at, src.popup_reappear, src.popup_delay_mins,
                actor.id, actor.email,
            ]
        );
        await auditLog(result.insertId, 'duplicate', actor, req.ip, { source_id: src.id }, null);
        res.status(201).json({ success: true, message: 'Announcement duplicated', id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE soft-delete
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    const actor = req.user;
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM announcements WHERE id=? AND is_deleted=0', [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ success: false, message: 'Not found' });
        await pool.execute(
            'UPDATE announcements SET is_deleted=1, deleted_by=?, deleted_by_email=?, deleted_at=NOW() WHERE id=?',
            [actor.id, actor.email, req.params.id]
        );
        await auditLog(req.params.id, 'delete', actor, req.ip, { title: rows[0].title }, null);
        res.json({ success: true, message: 'Announcement deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET audit trail for an announcement
router.get('/:id/audit', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM announcement_audit_log WHERE announcement_id=? ORDER BY created_at DESC',
            [req.params.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
