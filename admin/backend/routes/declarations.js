'use strict';

const express = require('express');
const http = require('http');
const { safeError } = require('../../../shared/security/safeError');
const router  = express.Router();

function notifyStudentHomeData() {
    try {
        const req = http.request({ hostname: '127.0.0.1', port: 5000, path: '/internal/home-data-invalidate', method: 'POST', headers: { 'Content-Length': '0', 'Content-Type': 'application/json' } });
        req.on('error', () => {});
        req.end();
    } catch (_) {}
}
const pool    = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { postUploadCheck } = require('../../../shared/security/fileValidator');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

// ── Self-healing tables init (run once on load) ────────────────────────────────
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS home_page_declarations (
              id INT AUTO_INCREMENT PRIMARY KEY,
              title VARCHAR(255) NOT NULL,
              declaration_content TEXT NOT NULL,
              is_active TINYINT(1) NOT NULL DEFAULT 1,
              display_order INT NOT NULL DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ home_page_declarations table verified.');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS home_page_attachments (
              id INT AUTO_INCREMENT PRIMARY KEY,
              declaration_id INT NOT NULL,
              file_name VARCHAR(255) NOT NULL,
              original_name VARCHAR(255) NOT NULL,
              file_path VARCHAR(255) NOT NULL,
              file_size INT NOT NULL,
              file_type VARCHAR(100) NOT NULL,
              display_order INT NOT NULL DEFAULT 0,
              is_active TINYINT(1) NOT NULL DEFAULT 1,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (declaration_id) REFERENCES home_page_declarations(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ home_page_attachments table verified.');

        // Update/Verify layout block row for guidelines to be Guidelines & Declarations
        await pool.query(`
            UPDATE home_layout 
            SET block_label = 'Guidelines & Declarations'
            WHERE block_key = 'guidelines'
        `);
        // Remove declarations_guidelines block to prevent duplication
        await pool.query(`
            DELETE FROM home_layout WHERE block_key = 'declarations_guidelines'
        `);
        console.log('✅ guidelines home layout block updated and declarations_guidelines removed.');
    } catch (err) {
        console.error('[declarations-init] Schema verification error:', err.message);
    }
})();

// ── Audit Helper ──────────────────────────────────────────────────────────────
async function audit(action, entityId, oldVal, newVal, req) {
    try {
        const who = req.user?.email || req.user?.username || 'admin';
        const ip  = req.ip || req.headers['x-forwarded-for'] || null;
        await pool.query(
            `INSERT INTO home_audit_logs (action, section, entity_id, old_value, new_value, performed_by, ip_address)
             VALUES (?, 'declarations', ?, ?, ?, ?, ?)`,
            [action, entityId || null,
             oldVal ? JSON.stringify(oldVal) : null,
             newVal ? JSON.stringify(newVal) : null,
             who, ip]
        );
    } catch (_) { /* non-fatal */ }
}

// ── Multer Storage Configuration ───────────────────────────────────────────────
const declarationsUploadsDir = path.join(__dirname, '../../../uploads/declarations');
if (!fs.existsSync(declarationsUploadsDir)) {
    fs.mkdirSync(declarationsUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, declarationsUploadsDir),
    filename: (_req, file, cb) => {
        const cleanExt = path.extname(file.originalname).toLowerCase();
        cb(null, `declaration_att_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${cleanExt}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
    fileFilter: (_req, file, cb) => {
        const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Supported types: PDF, DOC, DOCX, JPEG, JPG, PNG'));
        }
    }
});

// ── Express Endpoints ─────────────────────────────────────────────────────────

// GET /api/declarations - Get all declarations with attachments
router.get('/', verifyToken, isAdmin, async (_req, res) => {
    try {
        const [declarations] = await pool.query('SELECT * FROM home_page_declarations ORDER BY display_order ASC, created_at DESC');
        for (const dec of declarations) {
            const [attachments] = await pool.query('SELECT * FROM home_page_attachments WHERE declaration_id = ? ORDER BY display_order ASC', [dec.id]);
            dec.attachments = attachments;
        }
        res.json({ success: true, data: declarations });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// POST /api/declarations - Create declaration
router.post('/', verifyToken, isAdmin, async (req, res) => {
    const { title, declaration_content, is_active = 1, display_order = 0 } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    if (!declaration_content?.trim()) return res.status(400).json({ success: false, message: 'Declaration content is required' });
    try {
        const [result] = await pool.query(
            `INSERT INTO home_page_declarations (title, declaration_content, is_active, display_order)
             VALUES (?, ?, ?, ?)`,
            [title.trim(), declaration_content.trim(), is_active ? 1 : 0, parseInt(display_order) || 0]
        );
        await audit('create', result.insertId, null, req.body, req);
        notifyStudentHomeData();
        res.status(201).json({ success: true, message: 'Declaration created successfully', id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// PUT /api/declarations/:id - Update declaration
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    const { title, declaration_content, is_active, display_order } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    if (!declaration_content?.trim()) return res.status(400).json({ success: false, message: 'Declaration content is required' });
    try {
        const [[oldRow]] = await pool.query('SELECT * FROM home_page_declarations WHERE id = ?', [req.params.id]);
        if (!oldRow) return res.status(404).json({ success: false, message: 'Declaration not found' });

        await pool.query(
            `UPDATE home_page_declarations
             SET title = ?, declaration_content = ?, is_active = ?, display_order = ?, updated_at = NOW()
             WHERE id = ?`,
            [title.trim(), declaration_content.trim(), is_active ? 1 : 0, parseInt(display_order) || 0, req.params.id]
        );
        await audit('update', req.params.id, oldRow, req.body, req);
        notifyStudentHomeData();
        res.json({ success: true, message: 'Declaration updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// DELETE /api/declarations/:id - Delete declaration
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[oldRow]] = await pool.query('SELECT * FROM home_page_declarations WHERE id = ?', [req.params.id]);
        if (!oldRow) return res.status(404).json({ success: false, message: 'Declaration not found' });

        // Fetch attachments to delete files from disk
        const [attachments] = await pool.query('SELECT file_path FROM home_page_attachments WHERE declaration_id = ?', [req.params.id]);
        for (const att of attachments) {
            const fullPath = path.join(__dirname, '../', att.file_path);
            if (fs.existsSync(fullPath)) {
                try { fs.unlinkSync(fullPath); } catch (_) {}
            }
        }

        await pool.query('DELETE FROM home_page_declarations WHERE id = ?', [req.params.id]);
        await audit('delete', req.params.id, oldRow, null, req);
        notifyStudentHomeData();
        res.json({ success: true, message: 'Declaration deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// PATCH /api/declarations/:id/toggle - Toggle declaration
router.patch('/:id/toggle', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[oldRow]] = await pool.query('SELECT * FROM home_page_declarations WHERE id = ?', [req.params.id]);
        if (!oldRow) return res.status(404).json({ success: false, message: 'Declaration not found' });

        const nextActive = oldRow.is_active ? 0 : 1;
        await pool.query('UPDATE home_page_declarations SET is_active = ?, updated_at = NOW() WHERE id = ?', [nextActive, req.params.id]);
        await audit('toggle', req.params.id, oldRow, { is_active: nextActive }, req);
        notifyStudentHomeData();
        res.json({ success: true, message: 'Declaration toggled successfully', is_active: nextActive });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// PUT /api/declarations/reorder - Reorder declarations
router.put('/reorder', verifyToken, isAdmin, async (req, res) => {
    const { orders } = req.body;
    if (!Array.isArray(orders)) return res.status(400).json({ success: false, message: 'orders array is required' });
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (const item of orders) {
            await conn.query('UPDATE home_page_declarations SET display_order = ?, updated_at = NOW() WHERE id = ?', [parseInt(item.display_order) || 0, item.id]);
        }
        await conn.commit();
        await audit('reorder', null, null, orders, req);
        res.json({ success: true, message: 'Declarations reordered successfully' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: safeError(err) });
    } finally {
        conn.release();
    }
});

// ── Attachment Endpoints ───────────────────────────────────────────────────────

// POST /api/declarations/:id/attachments - Upload attachment
router.post('/:id/attachments', verifyToken, isAdmin, upload.single('attachment'), postUploadCheck(), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const declarationId = req.params.id;
    try {
        const [[dec]] = await pool.query('SELECT id FROM home_page_declarations WHERE id = ?', [declarationId]);
        if (!dec) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: 'Declaration not found' });
        }

        const [[maxRow]] = await pool.query('SELECT MAX(display_order) as max_order FROM home_page_attachments WHERE declaration_id = ?', [declarationId]);
        const maxOrder = (maxRow?.max_order || 0) + 10;

        const relativePath = `uploads/declarations/${req.file.filename}`;
        const [result] = await pool.query(
            `INSERT INTO home_page_attachments (declaration_id, file_name, original_name, file_path, file_size, file_type, display_order)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [declarationId, req.file.filename, req.file.originalname, relativePath, req.file.size, req.file.mimetype, maxOrder]
        );

        await audit('update', declarationId, null, { action: 'upload_attachment', file_name: req.file.originalname }, req);
        res.status(201).json({
            success: true,
            message: 'Attachment uploaded successfully',
            data: { id: result.insertId, original_name: req.file.originalname, file_path: relativePath }
        });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// PUT /api/declarations/:id/attachments/:attachmentId - Replace attachment
router.put('/:id/attachments/:attachmentId', verifyToken, isAdmin, upload.single('attachment'), postUploadCheck(), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const declarationId = req.params.id;
    const attachmentId = req.params.attachmentId;
    try {
        const [[oldAtt]] = await pool.query('SELECT * FROM home_page_attachments WHERE id = ? AND declaration_id = ?', [attachmentId, declarationId]);
        if (!oldAtt) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: 'Attachment not found' });
        }

        // Delete old file from disk
        const oldFullPath = path.join(__dirname, '../', oldAtt.file_path);
        if (fs.existsSync(oldFullPath)) {
            try { fs.unlinkSync(oldFullPath); } catch (_) {}
        }

        const relativePath = `uploads/declarations/${req.file.filename}`;
        await pool.query(
            `UPDATE home_page_attachments
             SET file_name = ?, original_name = ?, file_path = ?, file_size = ?, file_type = ?, updated_at = NOW()
             WHERE id = ?`,
            [req.file.filename, req.file.originalname, relativePath, req.file.size, req.file.mimetype, attachmentId]
        );

        await audit('update', declarationId, oldAtt, { action: 'replace_attachment', file_name: req.file.originalname }, req);
        res.json({
            success: true,
            message: 'Attachment replaced successfully',
            data: { id: attachmentId, original_name: req.file.originalname, file_path: relativePath }
        });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// DELETE /api/declarations/:id/attachments/:attachmentId - Delete attachment
router.delete('/:id/attachments/:attachmentId', verifyToken, isAdmin, async (req, res) => {
    const declarationId = req.params.id;
    const attachmentId = req.params.attachmentId;
    try {
        const [[oldAtt]] = await pool.query('SELECT * FROM home_page_attachments WHERE id = ? AND declaration_id = ?', [attachmentId, declarationId]);
        if (!oldAtt) return res.status(404).json({ success: false, message: 'Attachment not found' });

        // Delete file from disk
        const fullPath = path.join(__dirname, '../', oldAtt.file_path);
        if (fs.existsSync(fullPath)) {
            try { fs.unlinkSync(fullPath); } catch (_) {}
        }

        await pool.query('DELETE FROM home_page_attachments WHERE id = ?', [attachmentId]);
        await audit('update', declarationId, oldAtt, { action: 'delete_attachment' }, req);
        res.json({ success: true, message: 'Attachment deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// PUT /api/declarations/:id/attachments/reorder - Reorder attachments
router.put('/:id/attachments/reorder', verifyToken, isAdmin, async (req, res) => {
    const { orders } = req.body;
    if (!Array.isArray(orders)) return res.status(400).json({ success: false, message: 'orders array is required' });
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (const item of orders) {
            await conn.query('UPDATE home_page_attachments SET display_order = ?, updated_at = NOW() WHERE id = ? AND declaration_id = ?', [parseInt(item.display_order) || 0, item.id, req.params.id]);
        }
        await conn.commit();
        await audit('reorder', req.params.id, null, orders, req);
        res.json({ success: true, message: 'Attachments reordered successfully' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: safeError(err) });
    } finally {
        conn.release();
    }
});

module.exports = router;
