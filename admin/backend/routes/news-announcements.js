'use strict';

const express = require('express');
const { safeError } = require('../../../shared/security/safeError');
const router  = express.Router();
const pool    = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { postUploadCheck } = require('../../../shared/security/fileValidator');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

// â”€â”€ Multer Setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const sanitize = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const dest = path.join(__dirname, '../../../uploads/news-announcements');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${sanitize(file.originalname)}`),
});

const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ok = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (ok.includes(file.mimetype)) return cb(null, true);
        cb(new Error('Only PDF, DOC, DOCX and images allowed'));
    },
});

// â”€â”€ Auto-migration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
(async () => {
    try {
        // 1. Create categories table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS news_announcement_categories (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                category_key VARCHAR(100) NOT NULL UNIQUE,
                label        VARCHAR(100) NOT NULL,
                icon         VARCHAR(50)  NOT NULL DEFAULT 'ðŸ“¢',
                color        VARCHAR(50)  NOT NULL DEFAULT '#7c3aed',
                bg           VARCHAR(50)  NOT NULL DEFAULT '#ede9fe',
                is_active    TINYINT(1)   NOT NULL DEFAULT 1
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 2. Seed standard default categories
        await pool.execute(`
            INSERT IGNORE INTO news_announcement_categories (category_key, label, icon, color, bg) VALUES 
            ('news', 'News', 'ðŸ“°', '#0369a1', '#e0f2fe'),
            ('announcement', 'Announcement', 'ðŸ“¢', '#7c3aed', '#ede9fe'),
            ('circular', 'Circular', 'ðŸ“‹', '#0f766e', '#ccfbf1'),
            ('alert', 'Alert', 'ðŸš¨', '#dc2626', '#fee2e2'),
            ('deadline', 'Deadline', 'â°', '#d97706', '#fef3c7'),
            ('event', 'Event', 'ðŸŽ“', '#059669', '#d1fae5')
        `);

        // 3. Create news_announcements table with category as VARCHAR instead of ENUM
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS news_announcements (
                id               INT AUTO_INCREMENT PRIMARY KEY,
                title            VARCHAR(500)  NOT NULL,
                description      LONGTEXT      NOT NULL,
                category         VARCHAR(100)  NOT NULL DEFAULT 'announcement',
                priority         ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
                audience         ENUM('all','student','supervisor','centre')
                                 NOT NULL DEFAULT 'all',
                attachment_path  VARCHAR(500)  NULL,
                attachment_name  VARCHAR(255)  NULL,
                redirect_url     VARCHAR(500)  NULL,
                publish_date     DATETIME      NOT NULL,
                expiry_date      DATETIME      NOT NULL,
                status           ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
                is_pinned        TINYINT(1)    NOT NULL DEFAULT 0,
                created_by       INT           NOT NULL,
                created_by_email VARCHAR(255)  NULL,
                updated_by       INT           NULL,
                updated_by_email VARCHAR(255)  NULL,
                is_deleted       TINYINT(1)    NOT NULL DEFAULT 0,
                created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 4. Safely alter category column from ENUM to VARCHAR if it is currently ENUM
        try {
            await pool.execute(`
                ALTER TABLE news_announcements 
                MODIFY COLUMN category VARCHAR(100) NOT NULL DEFAULT 'announcement'
            `);
        } catch (e) { /* ignore */ }

        // 5. Add redirect_url column if not exists
        try {
            await pool.execute(`
                ALTER TABLE news_announcements 
                ADD COLUMN redirect_url VARCHAR(500) NULL AFTER attachment_name
            `);
        } catch (e) { /* ignore if already exists */ }

        console.log('âœ… News & Announcements & Categories schema verified.');
    } catch (err) {
        console.error('[news-announcements] Schema error:', err.message);
    }
})();

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PRIORITY_ORDER = "'urgent','high','medium','low'";

// Build audience WHERE clause. Returns { clause, params } — caller must append params to their
// parameter array to keep the query fully parameterized (no string interpolation of user input).
function audienceWhere(audience) {
    if (!audience || audience === 'all') return { clause: `(na.audience = 'all')`, params: [] };
    return { clause: `(na.audience = 'all' OR na.audience = ?)`, params: [audience] };
}

// â”€â”€ ADMIN CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET list â€” admin view with full filters
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const {
            page = 1, limit = 20,
            search = '', category = '', status = '',
            audience = '', priority = '',
        } = req.query;

        const safeLimit  = Math.max(1, parseInt(limit)  || 20);
        const safeOffset = Math.max(0, (parseInt(page) - 1) * safeLimit);

        const params = [];
        let where = 'WHERE na.is_deleted = 0';

        if (search)   { where += ' AND (na.title LIKE ? OR na.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
        if (category) { where += ' AND na.category = ?';  params.push(category); }
        if (status)   { where += ' AND na.status = ?';    params.push(status); }
        if (audience) { where += ' AND na.audience = ?';  params.push(audience); }
        if (priority) { where += ' AND na.priority = ?';  params.push(priority); }

        const [countRows] = await pool.query(
            `SELECT COUNT(*) AS total FROM news_announcements na ${where}`, params
        );
        const total = countRows[0].total;

        const [rows] = await pool.query(
            `SELECT na.*
             FROM news_announcements na
             ${where}
             ORDER BY na.is_pinned DESC,
               FIELD(na.priority, ${PRIORITY_ORDER}),
               na.publish_date DESC
             LIMIT ${safeLimit} OFFSET ${safeOffset}`,
            params
        );

        res.json({ success: true, data: rows, total, page: parseInt(page), limit: safeLimit });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── Category CRUD Endpoints (must be BEFORE /:id to avoid param capture) ──

// GET all active categories (Public access)
router.get('/categories', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM news_announcement_categories WHERE is_active = 1 ORDER BY label ASC');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// POST add new category (Admin only)
router.post('/categories', verifyToken, isAdmin, async (req, res) => {
    const { category_key, label, icon = '📢', color = '#7c3aed', bg = '#ede9fe' } = req.body;
    if (!category_key || !label) {
        return res.status(400).json({ success: false, message: 'category_key and label are required' });
    }
    const cleanKey = category_key.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    try {
        const [[exist]] = await pool.execute('SELECT id FROM news_announcement_categories WHERE category_key = ?', [cleanKey]);
        if (exist) {
            return res.status(400).json({ success: false, message: 'Category key already exists' });
        }
        await pool.execute(
            `INSERT INTO news_announcement_categories (category_key, label, icon, color, bg) VALUES (?, ?, ?, ?, ?)`,
            [cleanKey, label, icon, color, bg]
        );
        res.status(201).json({ success: true, message: 'Category created successfully', data: { category_key: cleanKey, label, icon, color, bg } });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// PUT update category (Admin only)
router.put('/categories/:id', verifyToken, isAdmin, async (req, res) => {
    const { label, icon, color, bg, is_active } = req.body;
    try {
        const [existing] = await pool.execute('SELECT * FROM news_announcement_categories WHERE id = ?', [req.params.id]);
        if (!existing[0]) return res.status(404).json({ success: false, message: 'Category not found' });
        await pool.execute(
            `UPDATE news_announcement_categories SET label = ?, icon = ?, color = ?, bg = ?, is_active = ? WHERE id = ?`,
            [
                label !== undefined ? label : existing[0].label,
                icon !== undefined ? icon : existing[0].icon,
                color !== undefined ? color : existing[0].color,
                bg !== undefined ? bg : existing[0].bg,
                is_active !== undefined ? is_active : existing[0].is_active,
                req.params.id
            ]
        );
        res.json({ success: true, message: 'Category updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// DELETE category (Admin only)
router.delete('/categories/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [existing] = await pool.execute('SELECT * FROM news_announcement_categories WHERE id = ?', [req.params.id]);
        if (!existing[0]) return res.status(404).json({ success: false, message: 'Category not found' });
        await pool.execute('DELETE FROM news_announcement_categories WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Category deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// GET single
router.get('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM news_announcements WHERE id=? AND is_deleted=0', [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// POST create
router.post('/', verifyToken, isAdmin, upload.single('attachment'), postUploadCheck(), async (req, res) => {
    const actor = req.user;
    const {
        title, description, category = 'announcement', priority = 'medium',
        audience = 'all', publish_date, expiry_date,
        status = 'draft', is_pinned = 0, redirect_url,
    } = req.body;

    if (!title || !description || !publish_date || !expiry_date) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ success: false, message: 'title, description, publish_date and expiry_date are required' });
    }

    const attachmentPath = req.file ? `/uploads/news-announcements/${req.file.filename}` : null;
    const attachmentName = req.file ? req.file.originalname : null;

    try {
        const [result] = await pool.execute(
            `INSERT INTO news_announcements
                (title, description, category, priority, audience,
                 attachment_path, attachment_name, redirect_url,
                 publish_date, expiry_date, status, is_pinned,
                 created_by, created_by_email)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [title, description, category, priority, audience,
             attachmentPath, attachmentName, redirect_url || null,
             publish_date, expiry_date, status, is_pinned ? 1 : 0,
             actor.id, actor.email]
        );
        res.status(201).json({ success: true, message: 'Announcement created', id: result.insertId });
    } catch (err) {
        if (req.file) fs.unlink(req.file.path, () => {});
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// PUT update
router.put('/:id', verifyToken, isAdmin, upload.single('attachment'), postUploadCheck(), async (req, res) => {
    const actor = req.user;
    const {
        title, description, category, priority, audience,
        publish_date, expiry_date, status, is_pinned,
        remove_attachment, redirect_url,
    } = req.body;

    try {
        const [existing] = await pool.execute(
            'SELECT * FROM news_announcements WHERE id=? AND is_deleted=0', [req.params.id]
        );
        if (!existing[0]) return res.status(404).json({ success: false, message: 'Not found' });
        const old = existing[0];

        let attachPath = old.attachment_path;
        let attachName = old.attachment_name;

        if (remove_attachment === 'true' || remove_attachment === '1') {
            if (old.attachment_path) {
                const full = path.join(__dirname, '../../../', old.attachment_path);
                if (fs.existsSync(full)) fs.unlink(full, () => {});
            }
            attachPath = null; attachName = null;
        }
        if (req.file) {
            if (attachPath) {
                const full = path.join(__dirname, '../../../', attachPath);
                if (fs.existsSync(full)) fs.unlink(full, () => {});
            }
            attachPath = `/uploads/news-announcements/${req.file.filename}`;
            attachName = req.file.originalname;
        }

        await pool.execute(
            `UPDATE news_announcements SET
                title=?, description=?, category=?, priority=?, audience=?,
                attachment_path=?, attachment_name=?, redirect_url=?,
                publish_date=?, expiry_date=?, status=?, is_pinned=?,
                updated_by=?, updated_by_email=?, updated_at=NOW()
             WHERE id=?`,
            [title, description, category, priority, audience,
             attachPath, attachName, redirect_url || null,
             publish_date, expiry_date, status, is_pinned ? 1 : 0,
             actor.id, actor.email,
             req.params.id]
        );
        res.json({ success: true, message: 'Updated successfully' });
    } catch (err) {
        if (req.file) fs.unlink(req.file.path, () => {});
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// PATCH publish
router.patch('/:id/publish', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.execute(
            'UPDATE news_announcements SET status=?, updated_by=?, updated_by_email=? WHERE id=? AND is_deleted=0',
            ['published', req.user.id, req.user.email, req.params.id]
        );
        res.json({ success: true, message: 'Published' });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// PATCH unpublish
router.patch('/:id/unpublish', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.execute(
            'UPDATE news_announcements SET status=?, updated_by=?, updated_by_email=? WHERE id=? AND is_deleted=0',
            ['draft', req.user.id, req.user.email, req.params.id]
        );
        res.json({ success: true, message: 'Unpublished' });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// PATCH archive
router.patch('/:id/archive', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.execute(
            'UPDATE news_announcements SET status=?, updated_by=?, updated_by_email=? WHERE id=? AND is_deleted=0',
            ['archived', req.user.id, req.user.email, req.params.id]
        );
        res.json({ success: true, message: 'Archived' });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// PATCH pin toggle
router.patch('/:id/pin', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.execute(
            'UPDATE news_announcements SET is_pinned = NOT is_pinned, updated_by=?, updated_by_email=? WHERE id=? AND is_deleted=0',
            [req.user.id, req.user.email, req.params.id]
        );
        res.json({ success: true, message: 'Pin toggled' });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// DELETE soft-delete
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT attachment_path FROM news_announcements WHERE id=? AND is_deleted=0', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ success: false, message: 'Not found' });
        await pool.execute(
            'UPDATE news_announcements SET is_deleted=1, updated_by=?, updated_by_email=? WHERE id=?',
            [req.user.id, req.user.email, req.params.id]
        );
        res.json({ success: true, message: 'Deleted' });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// â”€â”€ PORTAL READ ENDPOINTS (auth-protected, audience-filtered) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// These are called by student/supervisor/center backends or directly from their frontends
// via the admin API with portal-specific tokens. Since each portal has its own JWT,
// we expose a public-within-auth endpoint per audience.

function makePortalEndpoint(audienceValue) {
    return async (req, res) => {
        try {
            const now = new Date();
            const [rows] = await pool.query(
                `SELECT id, title, description, category, priority, audience,
                        attachment_path, attachment_name,
                        publish_date, expiry_date, is_pinned, created_at
                 FROM news_announcements
                 WHERE is_deleted = 0
                   AND status = 'published'
                   AND publish_date <= ?
                   AND expiry_date  >= ?
                   AND (audience = 'all' OR audience = ?)
                 ORDER BY is_pinned DESC,
                   FIELD(priority, ${PRIORITY_ORDER}),
                   publish_date DESC`,
                [now, now, audienceValue]
            );
            res.json({ success: true, data: rows });
        } catch (err) {
            res.status(500).json({ success: false, message: safeError(err) });
        }
    };
}

router.get('/portal/student',    makePortalEndpoint('student'));
router.get('/portal/supervisor', makePortalEndpoint('supervisor'));
router.get('/portal/centre',     makePortalEndpoint('centre'));
router.get('/portal/admin',      verifyToken, isAdmin, makePortalEndpoint('admin'));

module.exports = router;
