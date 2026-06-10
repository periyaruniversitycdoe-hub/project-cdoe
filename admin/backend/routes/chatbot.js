'use strict';

const express = require('express');
const { safeError } = require('../../../shared/security/safeError');
const router  = express.Router();
const db      = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// â”€â”€ Auto-migration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
(async () => {
    const ddl = [
        `CREATE TABLE IF NOT EXISTS chatbot_settings (
            id               INT AUTO_INCREMENT PRIMARY KEY,
            portal_key       VARCHAR(50)  NOT NULL UNIQUE,
            is_enabled       TINYINT(1)   NOT NULL DEFAULT 1,
            welcome_message  TEXT         DEFAULT NULL,
            offline_message  TEXT         DEFAULT NULL,
            placeholder_text VARCHAR(255) DEFAULT 'Type your question here...',
            updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS kb_categories (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            name        VARCHAR(100) NOT NULL,
            slug        VARCHAR(120) NOT NULL UNIQUE,
            description TEXT         DEFAULT NULL,
            is_active   TINYINT(1)   NOT NULL DEFAULT 1,
            sort_order  INT          DEFAULT 0,
            created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS knowledge_base (
            id                INT AUTO_INCREMENT PRIMARY KEY,
            category_id       INT          DEFAULT NULL,
            title             VARCHAR(255) NOT NULL,
            short_description TEXT         DEFAULT NULL,
            content           LONGTEXT     DEFAULT NULL,
            status            ENUM('draft','published','archived') DEFAULT 'draft',
            visibility        ENUM('private','group','public')     DEFAULT 'public',
            portal_visibility JSON         DEFAULT NULL,
            publish_date      DATETIME     DEFAULT NULL,
            view_count        INT          DEFAULT 0,
            created_by        INT          DEFAULT NULL,
            is_deleted        TINYINT(1)   DEFAULT 0,
            created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES kb_categories(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS kb_attachments (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            kb_id      INT          NOT NULL,
            file_path  VARCHAR(500) NOT NULL,
            file_name  VARCHAR(255) NOT NULL,
            file_type  VARCHAR(50)  DEFAULT NULL,
            file_size  INT          DEFAULT NULL,
            created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (kb_id) REFERENCES knowledge_base(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS faqs (
            id               INT AUTO_INCREMENT PRIMARY KEY,
            category_id      INT          DEFAULT NULL,
            question         TEXT         NOT NULL,
            answer           LONGTEXT     NOT NULL,
            status           ENUM('active','inactive','archived') DEFAULT 'active',
            visibility       ENUM('private','group','public')     DEFAULT 'public',
            portal_visibility JSON        DEFAULT NULL,
            sort_order       INT          DEFAULT 0,
            view_count       INT          DEFAULT 0,
            helpful_count    INT          DEFAULT 0,
            created_by       INT          DEFAULT NULL,
            is_deleted       TINYINT(1)   DEFAULT 0,
            created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES kb_categories(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS chat_queries (
            id               INT AUTO_INCREMENT PRIMARY KEY,
            query_ref        VARCHAR(25)  NOT NULL UNIQUE,
            user_id          INT          DEFAULT NULL,
            user_type        ENUM('public','student','supervisor','center') NOT NULL DEFAULT 'public',
            user_name        VARCHAR(255) DEFAULT NULL,
            user_email       VARCHAR(255) DEFAULT NULL,
            portal_source    ENUM('public','student','supervisor','center') NOT NULL DEFAULT 'public',
            question         TEXT         NOT NULL,
            category_id      INT          DEFAULT NULL,
            status           ENUM('new','pending_review','in_progress','answered','published','closed') DEFAULT 'new',
            priority         ENUM('low','medium','high','urgent') DEFAULT 'medium',
            visibility       ENUM('private','group','public')     DEFAULT 'private',
            matched_faq_id   INT          DEFAULT NULL,
            matched_kb_id    INT          DEFAULT NULL,
            is_auto_answered TINYINT(1)   DEFAULT 0,
            is_deleted       TINYINT(1)   DEFAULT 0,
            closed_at        DATETIME     DEFAULT NULL,
            created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES kb_categories(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS chat_query_answers (
            id                INT AUTO_INCREMENT PRIMARY KEY,
            query_id          INT          NOT NULL,
            answer            LONGTEXT     NOT NULL,
            answered_by       INT          DEFAULT NULL,
            answered_by_name  VARCHAR(255) DEFAULT NULL,
            is_published      TINYINT(1)   DEFAULT 0,
            published_to_kb   TINYINT(1)   DEFAULT 0,
            kb_id             INT          DEFAULT NULL,
            email_sent        TINYINT(1)   DEFAULT 0,
            notification_sent TINYINT(1)   DEFAULT 0,
            created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (query_id) REFERENCES chat_queries(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS chat_answer_history (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            answer_id       INT          NOT NULL,
            previous_answer LONGTEXT     NOT NULL,
            edited_by       INT          DEFAULT NULL,
            edited_by_name  VARCHAR(255) DEFAULT NULL,
            edited_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (answer_id) REFERENCES chat_query_answers(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS chatbot_notifications (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            user_id     INT          DEFAULT NULL,
            user_type   VARCHAR(50)  DEFAULT NULL,
            user_email  VARCHAR(255) DEFAULT NULL,
            query_id    INT          DEFAULT NULL,
            title       VARCHAR(255) NOT NULL,
            message     TEXT         DEFAULT NULL,
            action_link VARCHAR(500) DEFAULT NULL,
            is_read     TINYINT(1)   DEFAULT 0,
            created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (query_id) REFERENCES chat_queries(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS chatbot_audit_log (
            id                INT AUTO_INCREMENT PRIMARY KEY,
            action            VARCHAR(100) NOT NULL,
            entity_type       VARCHAR(50)  DEFAULT NULL,
            entity_id         INT          DEFAULT NULL,
            performed_by      INT          DEFAULT NULL,
            performed_by_name VARCHAR(255) DEFAULT NULL,
            details           LONGTEXT     DEFAULT NULL,
            created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    ];

    for (const sql of ddl) {
        try { await db.execute(sql); } catch (e) { console.error('[Chatbot DDL]', e.message); }
    }

    // Seed default settings for all portals
    const portals = ['global', 'public', 'student', 'supervisor', 'center'];
    for (const pk of portals) {
        try {
            await db.execute(
                `INSERT IGNORE INTO chatbot_settings (portal_key, is_enabled, welcome_message, offline_message, placeholder_text)
                 VALUES (?, 1, 'Hello! Welcome to the PhD Portal. How can I help you today?',
                         'Our support team will respond to your question shortly.', 'Type your question here...')`,
                [pk]
            );
        } catch (_) {}
    }

    // Seed default categories
    const cats = [
        ['Admission', 'admission'], ['Eligibility', 'eligibility'], ['Registration', 'registration'],
        ['Fees', 'fees'], ['Supervisor', 'supervisor'], ['Research Center', 'research-center'],
        ['Documents', 'documents'], ['Fellowship', 'fellowship'],
        ['General Information', 'general-information'],
        ['Technical Support', 'technical-support'], ['Others', 'others'],
    ];
    for (const [name, slug] of cats) {
        try {
            await db.execute(
                `INSERT IGNORE INTO kb_categories (name, slug, is_active, sort_order) VALUES (?, ?, 1, 0)`,
                [name, slug]
            );
        } catch (_) {}
    }

    console.log('âœ… Chatbot System schema verified.');
})();

// â”€â”€ Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function genRef() {
    const n = new Date();
    const r = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `Q-${n.getFullYear()}${String(n.getMonth()+1).padStart(2,'0')}${String(n.getDate()).padStart(2,'0')}-${r}`;
}

async function auditLog(actionName, entityType, entityId, user) {
    try {
        await db.execute(
            `INSERT INTO chatbot_audit_log (action, entity_type, entity_id, performed_by, performed_by_name)
             VALUES (?,?,?,?,?)`,
            [actionName, entityType, entityId||null, user?.id||null, user?.email||'admin']
        );
    } catch (_) {}
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SETTINGS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

router.get('/settings', verifyToken, isAdmin, async (_req, res) => {
    try {
        const [rows] = await db.query(`SELECT * FROM chatbot_settings ORDER BY portal_key ASC`);
        res.json({ success: true, data: rows });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

router.put('/settings/:portal_key', verifyToken, isAdmin, async (req, res) => {
    const { is_enabled, welcome_message, offline_message, placeholder_text } = req.body;
    try {
        await db.execute(
            `UPDATE chatbot_settings SET is_enabled=?, welcome_message=?, offline_message=?, placeholder_text=? WHERE portal_key=?`,
            [is_enabled ? 1 : 0, welcome_message||null, offline_message||null, placeholder_text||null, req.params.portal_key]
        );
        await auditLog('update_settings', 'settings', null, req.user);
        res.json({ success: true, message: 'Settings updated' });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CATEGORIES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

router.get('/categories', async (_req, res) => {
    try {
        const [rows] = await db.query(`SELECT * FROM kb_categories WHERE is_active=1 ORDER BY sort_order ASC, name ASC`);
        res.json({ success: true, data: rows });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

router.get('/categories/all', verifyToken, isAdmin, async (_req, res) => {
    try {
        const [rows] = await db.query(`SELECT * FROM kb_categories ORDER BY sort_order ASC, name ASC`);
        res.json({ success: true, data: rows });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

router.post('/categories', verifyToken, isAdmin, async (req, res) => {
    const { name, description, sort_order = 0 } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
    try {
        const [r] = await db.execute(
            `INSERT INTO kb_categories (name, slug, description, sort_order) VALUES (?,?,?,?)`,
            [name, slug, description||null, sort_order]
        );
        res.json({ success: true, id: r.insertId, message: 'Category created' });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

router.put('/categories/:id', verifyToken, isAdmin, async (req, res) => {
    const { name, description, is_active, sort_order } = req.body;
    try {
        await db.execute(
            `UPDATE kb_categories SET name=?, description=?, is_active=?, sort_order=? WHERE id=?`,
            [name, description||null, is_active === false || is_active === 0 ? 0 : 1, sort_order||0, req.params.id]
        );
        res.json({ success: true, message: 'Category updated' });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FAQs
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

router.get('/faqs', async (req, res) => {
    const { category_id, status, search, page = 1, limit = 20 } = req.query;
    const off = (parseInt(page) - 1) * parseInt(limit);
    let w = 'f.is_deleted=0', p = [];
    if (category_id) { w += ' AND f.category_id=?'; p.push(category_id); }
    if (status)      { w += ' AND f.status=?';       p.push(status); }
    if (search)      { w += ' AND (f.question LIKE ? OR f.answer LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
    try {
        const [rows] = await db.query(
            `SELECT f.*, c.name AS category_name FROM faqs f
             LEFT JOIN kb_categories c ON f.category_id=c.id
             WHERE ${w} ORDER BY f.sort_order ASC, f.created_at DESC LIMIT ? OFFSET ?`,
            [...p, parseInt(limit), off]
        );
        const [[{total}]] = await db.query(`SELECT COUNT(*) AS total FROM faqs f WHERE ${w}`, p);
        res.json({ success: true, data: rows, total, page: parseInt(page) });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

router.post('/faqs', verifyToken, isAdmin, async (req, res) => {
    const { question, answer, category_id, status = 'active', visibility = 'public', portal_visibility, sort_order = 0 } = req.body;
    if (!question || !answer) return res.status(400).json({ success: false, message: 'Question and answer required' });
    try {
        const [r] = await db.execute(
            `INSERT INTO faqs (question, answer, category_id, status, visibility, portal_visibility, sort_order, created_by)
             VALUES (?,?,?,?,?,?,?,?)`,
            [question, answer, category_id||null, status, visibility,
             portal_visibility ? JSON.stringify(portal_visibility) : null, sort_order, req.user.id||null]
        );
        await auditLog('create_faq', 'faq', r.insertId, req.user);
        res.json({ success: true, id: r.insertId, message: 'FAQ created' });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

router.put('/faqs/:id', verifyToken, isAdmin, async (req, res) => {
    const { question, answer, category_id, status, visibility, portal_visibility, sort_order } = req.body;
    try {
        await db.execute(
            `UPDATE faqs SET question=?, answer=?, category_id=?, status=?, visibility=?, portal_visibility=?, sort_order=?, updated_at=NOW()
             WHERE id=? AND is_deleted=0`,
            [question, answer, category_id||null, status||'active', visibility||'public',
             portal_visibility ? JSON.stringify(portal_visibility) : null, sort_order||0, req.params.id]
        );
        await auditLog('update_faq', 'faq', req.params.id, req.user);
        res.json({ success: true, message: 'FAQ updated' });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

router.delete('/faqs/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await db.execute(`UPDATE faqs SET is_deleted=1 WHERE id=?`, [req.params.id]);
        await auditLog('delete_faq', 'faq', req.params.id, req.user);
        res.json({ success: true, message: 'FAQ deleted' });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

router.patch('/faqs/:id/toggle', verifyToken, isAdmin, async (req, res) => {
    try {
        await db.execute(`UPDATE faqs SET status = IF(status='active','inactive','active'), updated_at=NOW() WHERE id=?`, [req.params.id]);
        res.json({ success: true, message: 'FAQ toggled' });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// KNOWLEDGE BASE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

router.get('/knowledge-base', async (req, res) => {
    const { category_id, status, search, page = 1, limit = 20 } = req.query;
    const off = (parseInt(page) - 1) * parseInt(limit);
    let w = 'k.is_deleted=0', p = [];
    if (category_id) { w += ' AND k.category_id=?'; p.push(category_id); }
    if (status)      { w += ' AND k.status=?';       p.push(status); }
    if (search)      { w += ' AND (k.title LIKE ? OR k.short_description LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
    try {
        const [rows] = await db.query(
            `SELECT k.*, c.name AS category_name FROM knowledge_base k
             LEFT JOIN kb_categories c ON k.category_id=c.id
             WHERE ${w} ORDER BY k.created_at DESC LIMIT ? OFFSET ?`,
            [...p, parseInt(limit), off]
        );
        const [[{total}]] = await db.query(`SELECT COUNT(*) AS total FROM knowledge_base k WHERE ${w}`, p);
        res.json({ success: true, data: rows, total, page: parseInt(page) });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

router.get('/knowledge-base/:id', async (req, res) => {
    try {
        const [[row]] = await db.query(
            `SELECT k.*, c.name AS category_name FROM knowledge_base k
             LEFT JOIN kb_categories c ON k.category_id=c.id
             WHERE k.id=? AND k.is_deleted=0`, [req.params.id]
        );
        if (!row) return res.status(404).json({ success: false, message: 'Not found' });
        await db.execute(`UPDATE knowledge_base SET view_count=view_count+1 WHERE id=?`, [req.params.id]);
        res.json({ success: true, data: row });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

router.post('/knowledge-base', verifyToken, isAdmin, async (req, res) => {
    const { title, short_description, content, category_id, status = 'draft', visibility = 'public', portal_visibility, publish_date } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title required' });
    try {
        const [r] = await db.execute(
            `INSERT INTO knowledge_base (title, short_description, content, category_id, status, visibility, portal_visibility, publish_date, created_by)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [title, short_description||null, content||null, category_id||null, status, visibility,
             portal_visibility ? JSON.stringify(portal_visibility) : null, publish_date||null, req.user.id||null]
        );
        await auditLog('create_kb', 'knowledge_base', r.insertId, req.user);
        res.json({ success: true, id: r.insertId, message: 'Article created' });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

router.put('/knowledge-base/:id', verifyToken, isAdmin, async (req, res) => {
    const { title, short_description, content, category_id, status, visibility, portal_visibility, publish_date } = req.body;
    try {
        await db.execute(
            `UPDATE knowledge_base SET title=?, short_description=?, content=?, category_id=?, status=?, visibility=?,
             portal_visibility=?, publish_date=?, updated_at=NOW() WHERE id=? AND is_deleted=0`,
            [title, short_description||null, content||null, category_id||null, status||'draft', visibility||'public',
             portal_visibility ? JSON.stringify(portal_visibility) : null, publish_date||null, req.params.id]
        );
        await auditLog('update_kb', 'knowledge_base', req.params.id, req.user);
        res.json({ success: true, message: 'Article updated' });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

router.delete('/knowledge-base/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await db.execute(`UPDATE knowledge_base SET is_deleted=1 WHERE id=?`, [req.params.id]);
        await auditLog('delete_kb', 'knowledge_base', req.params.id, req.user);
        res.json({ success: true, message: 'Article deleted' });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// QUERY MANAGEMENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Stats dashboard
router.get('/queries/stats', verifyToken, isAdmin, async (_req, res) => {
    try {
        const [[stats]] = await db.query(`
            SELECT COUNT(*) AS total,
                   SUM(status='new')            AS new_count,
                   SUM(status='pending_review') AS pending_count,
                   SUM(status='in_progress')    AS in_progress_count,
                   SUM(status='answered')       AS answered_count,
                   SUM(status='published')      AS published_count,
                   SUM(status='closed')         AS closed_count
            FROM chat_queries WHERE is_deleted=0
        `);
        const [[faq]] = await db.query(`SELECT COUNT(*) AS c FROM faqs WHERE is_deleted=0 AND status='active'`);
        const [[kb]]  = await db.query(`SELECT COUNT(*) AS c FROM knowledge_base WHERE is_deleted=0 AND status='published'`);
        res.json({ success: true, data: { ...stats, faq_count: faq.c, kb_count: kb.c } });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

// List queries
router.get('/queries', verifyToken, isAdmin, async (req, res) => {
    const { status, priority, user_type, portal_source, category_id, search, page = 1, limit = 20 } = req.query;
    const off = (parseInt(page) - 1) * parseInt(limit);
    let w = 'q.is_deleted=0', p = [];
    if (status)        { w += ' AND q.status=?';        p.push(status); }
    if (priority)      { w += ' AND q.priority=?';      p.push(priority); }
    if (user_type)     { w += ' AND q.user_type=?';     p.push(user_type); }
    if (portal_source) { w += ' AND q.portal_source=?'; p.push(portal_source); }
    if (category_id)   { w += ' AND q.category_id=?';   p.push(category_id); }
    if (search) {
        w += ' AND (q.question LIKE ? OR q.user_name LIKE ? OR q.user_email LIKE ? OR q.query_ref LIKE ?)';
        p.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    try {
        const [rows] = await db.query(
            `SELECT q.*, c.name AS category_name,
                    a.id AS answer_id, a.answer, a.answered_by_name,
                    a.is_published, a.email_sent, a.created_at AS answered_at
             FROM chat_queries q
             LEFT JOIN kb_categories c ON q.category_id=c.id
             LEFT JOIN chat_query_answers a ON a.query_id=q.id
             WHERE ${w} ORDER BY q.created_at DESC LIMIT ? OFFSET ?`,
            [...p, parseInt(limit), off]
        );
        const [[{total}]] = await db.query(`SELECT COUNT(*) AS total FROM chat_queries q WHERE ${w}`, p);
        res.json({ success: true, data: rows, total, page: parseInt(page) });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

// Single query detail
router.get('/queries/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[query]] = await db.query(
            `SELECT q.*, c.name AS category_name FROM chat_queries q
             LEFT JOIN kb_categories c ON q.category_id=c.id
             WHERE q.id=? AND q.is_deleted=0`, [req.params.id]
        );
        if (!query) return res.status(404).json({ success: false, message: 'Not found' });
        const [answers] = await db.query(
            `SELECT a.*, GROUP_CONCAT(h.previous_answer SEPARATOR '|||') AS history
             FROM chat_query_answers a
             LEFT JOIN chat_answer_history h ON h.answer_id=a.id
             WHERE a.query_id=? GROUP BY a.id`, [req.params.id]
        );
        res.json({ success: true, data: { ...query, answers } });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

// Submit answer
router.post('/queries/:id/answer', verifyToken, isAdmin, async (req, res) => {
    const { answer, visibility = 'private', publish_to_kb = false } = req.body;
    if (!answer || !answer.trim()) return res.status(400).json({ success: false, message: 'Answer required' });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [[query]] = await conn.query(
            `SELECT * FROM chat_queries WHERE id=? AND is_deleted=0`, [req.params.id]
        );
        if (!query) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Query not found' }); }

        // Check if answer already exists (re-answer updates it)
        const [[existing]] = await conn.query(`SELECT id FROM chat_query_answers WHERE query_id=?`, [req.params.id]);
        let answerId;
        if (existing) {
            await conn.execute(
                `INSERT INTO chat_answer_history (answer_id, previous_answer, edited_by, edited_by_name)
                 SELECT id, answer, ?, ? FROM chat_query_answers WHERE id=?`,
                [req.user.id||null, req.user.email||'Admin', existing.id]
            );
            await conn.execute(
                `UPDATE chat_query_answers SET answer=?, answered_by=?, answered_by_name=?, updated_at=NOW() WHERE id=?`,
                [answer.trim(), req.user.id||null, req.user.email||'Admin', existing.id]
            );
            answerId = existing.id;
        } else {
            const [ar] = await conn.execute(
                `INSERT INTO chat_query_answers (query_id, answer, answered_by, answered_by_name)
                 VALUES (?,?,?,?)`,
                [req.params.id, answer.trim(), req.user.id||null, req.user.email||'Admin']
            );
            answerId = ar.insertId;
        }

        // Update query status
        const newStatus = visibility === 'public' ? 'published' : 'answered';
        await conn.execute(
            `UPDATE chat_queries SET status=?, visibility=?, updated_at=NOW() WHERE id=?`,
            [newStatus, visibility, req.params.id]
        );

        // Create chatbot notification
        if (query.user_id || query.user_email) {
            await conn.execute(
                `INSERT INTO chatbot_notifications (user_id, user_type, user_email, query_id, title, message)
                 VALUES (?,?,?,?,?,?)`,
                [query.user_id||null, query.user_type, query.user_email||null, req.params.id,
                 'Your question has been answered',
                 `Your question has been answered by the support team.`]
            );
        }

        // Publish to KB if requested
        let newKbId = null;
        if (publish_to_kb && visibility === 'public') {
            const [kr] = await conn.execute(
                `INSERT INTO knowledge_base (title, short_description, content, status, visibility, created_by)
                 VALUES (?, NULL, ?, 'published', 'public', ?)`,
                [query.question.substring(0, 200), answer.trim(), req.user.id||null]
            );
            newKbId = kr.insertId;
            await conn.execute(
                `UPDATE chat_query_answers SET published_to_kb=1, kb_id=? WHERE id=?`,
                [newKbId, answerId]
            );
        }

        // Enqueue email notification (best-effort)
        if (query.user_email) {
            try {
                const emailHtml = `<div style="font-family:sans-serif;padding:20px;max-width:600px">
                    <h3 style="color:#1e3a5f">Your Question Has Been Answered</h3>
                    <p>Hello ${query.user_name || 'User'},</p>
                    <p>Your question submitted to PhD Portal has been answered by the support team.</p>
                    <div style="background:#f0f9ff;border-left:4px solid #0369a1;padding:15px;margin:15px 0;border-radius:4px">
                        <strong>Your Question:</strong><br>${query.question}
                    </div>
                    <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:15px;margin:15px 0;border-radius:4px">
                        <strong>Answer:</strong><br>${answer.trim()}
                    </div>
                    <p>Please login to your portal to view the full response and ask follow-up questions.</p>
                </div>`;
                await conn.execute(
                    `INSERT INTO email_queue (to_email, subject, html_body, text_body, template_name, status)
                     VALUES (?,?,?,?,?,'pending')`,
                    [query.user_email, 'Your question has been answered - PhD Portal',
                     emailHtml, `Your question "${query.question}" has been answered.`, 'chatbot_answer']
                );
                await conn.execute(`UPDATE chat_query_answers SET email_sent=1 WHERE id=?`, [answerId]);
            } catch (emailErr) {
                console.error('[Chatbot] Email queue error:', emailErr.message);
            }
        }

        await conn.execute(
            `INSERT INTO chatbot_audit_log (action, entity_type, entity_id, performed_by, performed_by_name, details)
             VALUES ('answer_query','query',?,?,?,?)`,
            [req.params.id, req.user.id||null, req.user.email||'admin',
             JSON.stringify({ visibility, publish_to_kb, kb_id: newKbId })]
        );

        await conn.commit();
        res.json({ success: true, message: 'Answer submitted successfully', answer_id: answerId });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ success: false, message: safeError(e) });
    } finally {
        conn.release();
    }
});

// Update query status / priority / category
router.patch('/queries/:id/status', verifyToken, isAdmin, async (req, res) => {
    const { status, priority, category_id } = req.body;
    const sets = ['updated_at=NOW()'], p = [];
    if (status)              { sets.push('status=?');      p.push(status); }
    if (priority)            { sets.push('priority=?');    p.push(priority); }
    if (category_id !== undefined) { sets.push('category_id=?'); p.push(category_id||null); }
    if (status === 'closed') { sets.push('closed_at=NOW()'); }
    p.push(req.params.id);
    try {
        await db.execute(`UPDATE chat_queries SET ${sets.join(',')} WHERE id=?`, p);
        res.json({ success: true, message: 'Query updated' });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

// Update visibility
router.patch('/queries/:id/visibility', verifyToken, isAdmin, async (req, res) => {
    const { visibility } = req.body;
    try {
        await db.execute(`UPDATE chat_queries SET visibility=?, updated_at=NOW() WHERE id=?`, [visibility, req.params.id]);
        if (visibility === 'public') {
            await db.execute(`UPDATE chat_queries SET status='published' WHERE id=? AND status='answered'`, [req.params.id]);
            await db.execute(`UPDATE chat_query_answers SET is_published=1 WHERE query_id=?`, [req.params.id]);
        }
        res.json({ success: true, message: 'Visibility updated' });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

// Reopen closed query
router.patch('/queries/:id/reopen', verifyToken, isAdmin, async (req, res) => {
    try {
        await db.execute(
            `UPDATE chat_queries SET status='pending_review', closed_at=NULL, updated_at=NOW() WHERE id=?`,
            [req.params.id]
        );
        res.json({ success: true, message: 'Query reopened' });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

// Delete query (soft)
router.delete('/queries/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await db.execute(`UPDATE chat_queries SET is_deleted=1, updated_at=NOW() WHERE id=?`, [req.params.id]);
        await auditLog('delete_query', 'query', req.params.id, req.user);
        res.json({ success: true, message: 'Query deleted' });
    } catch (e) { res.status(500).json({ success: false, message: safeError(e) }); }
});

module.exports = router;
