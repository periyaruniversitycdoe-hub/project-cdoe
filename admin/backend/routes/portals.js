'use strict';

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { postUploadCheck } = require('../../../shared/security/fileValidator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ── DB Schema Auto-Migration & Seeding ────────────────────────────────────────
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS portal_management (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL UNIQUE,
                description TEXT DEFAULT NULL,
                banner_image VARCHAR(255) DEFAULT NULL,
                icon VARCHAR(255) DEFAULT NULL,
                login_route VARCHAR(255) NOT NULL,
                button_label VARCHAR(100) NOT NULL DEFAULT 'Login',
                display_order INT NOT NULL DEFAULT 0,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                theme_color VARCHAR(50) DEFAULT '#008080',
                created_by INT DEFAULT NULL,
                updated_by INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅ portal_management table verified/created.');

        // Seed default portals if table is empty
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM portal_management');
        if (rows[0].count === 0) {
            const defaults = [
                {
                    name: 'Student Portal',
                    slug: 'student',
                    description: 'Access the PhD admission application form, check application status, download hall tickets, view counselling results, and verify receipts.',
                    banner_image: '/images/portals/student_banner.jpg',
                    icon: 'GraduationCap',
                    login_route: 'http://localhost:5173/login',
                    button_label: 'Student Login',
                    display_order: 1,
                    is_active: 1,
                    theme_color: '#008080'
                },
                {
                    name: 'Supervisor Portal',
                    slug: 'supervisor',
                    description: 'Manage research scholar guide allocations, view supervisor master data, update profile, and process intake statistics.',
                    banner_image: '/images/portals/supervisor_banner.jpg',
                    icon: 'Users',
                    login_route: 'http://localhost:5175/login',
                    button_label: 'Supervisor Login',
                    display_order: 2,
                    is_active: 1,
                    theme_color: '#1e3a8a'
                },
                {
                    name: 'Center Portal',
                    slug: 'center',
                    description: 'Research center management, scholar verification, supervisor approvals, and institutional credential management.',
                    banner_image: '/images/portals/center_banner.jpg',
                    icon: 'Building2',
                    login_route: 'http://localhost:5176/login',
                    button_label: 'Center Login',
                    display_order: 3,
                    is_active: 1,
                    theme_color: '#4f46e5'
                }
            ];

            for (const p of defaults) {
                await pool.execute(
                    `INSERT INTO portal_management 
                     (name, slug, description, banner_image, icon, login_route, button_label, display_order, is_active, theme_color)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [p.name, p.slug, p.description, p.banner_image, p.icon, p.login_route, p.button_label, p.display_order, p.is_active, p.theme_color]
                );
            }
            console.log('✅ Default portal cards seeded successfully.');
        }
    } catch (err) {
        console.error('Error in portal_management auto-migration:', err);
    }
})();

// ── Audit Logger ─────────────────────────────────────────────────────────────
async function auditLog(adminId, action, portalId, oldValue, newValue, ip) {
    try {
        await pool.execute(
            `INSERT INTO eligibility_audit_log 
             (admin_id, action, entity_type, old_value, ip_address) 
             VALUES (?, ?, ?, ?, ?)`,
            [
                adminId || null,
                action,
                'portal_management',
                JSON.stringify({ portal_id: portalId, old: oldValue || {}, new: newValue || {} }),
                ip || null
            ]
        );
    } catch (e) {
        console.error('Portal audit log failed:', e.message);
    }
}

// ── Multer Storage Configuration (Secure Uplods) ──────────────────────────────
const sanitizeFilename = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(__dirname, '../../../uploads/portals');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${sanitizeFilename(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB Limit
    fileFilter: (req, file, cb) => {
        const mimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/jpg'];
        if (mimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPG, JPEG, PNG, WEBP, and SVG are supported.'));
        }
    }
});

// Helper to double-save to student uploads directory for local dev symmetry
function copyToStudentUploads(filename) {
    try {
        const adminSrc = path.join(__dirname, '../../../uploads/portals', filename);
        const studentDestFolder = path.join(__dirname, '../../../student/backend/uploads/portals');
        if (!fs.existsSync(studentDestFolder)) {
            fs.mkdirSync(studentDestFolder, { recursive: true });
        }
        const studentDest = path.join(studentDestFolder, filename);
        fs.copyFileSync(adminSrc, studentDest);
        console.log(`✅ Symmetric local uploads copy succeeded: ${filename}`);
    } catch (e) {
        // Soft fail on symlink/copy issues — non-critical for staging/prod
        console.log(`Symmetric local uploads copy warning: ${e.message}`);
    }
}

// ── CRUD ROUTES ──────────────────────────────────────────────────────────────

// GET /api/portals - Fetch all portals (Admin List)
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM portal_management ORDER BY display_order ASC');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/portals/active - Public Active Portals (Public Landing Page)
router.get('/active', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM portal_management WHERE is_active = 1 ORDER BY display_order ASC');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/portals/:id - Fetch single portal
router.get('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM portal_management WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Portal not found' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/portals - Add portal card
router.post('/', verifyToken, isAdmin, async (req, res) => {
    const { name, slug, description, banner_image, icon, login_route, button_label, display_order, is_active, theme_color } = req.body;
    if (!name || !slug || !login_route) {
        return res.status(400).json({ success: false, message: 'Name, Slug, and Login Route URL are required.' });
    }

    try {
        // Enforce uniqueness of slug
        const [existing] = await pool.execute('SELECT id FROM portal_management WHERE slug = ?', [slug]);
        if (existing.length) {
            return res.status(400).json({ success: false, message: 'Portal slug must be completely unique.' });
        }

        const [result] = await pool.execute(
            `INSERT INTO portal_management 
             (name, slug, description, banner_image, icon, login_route, button_label, display_order, is_active, theme_color, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-'),
                description || null,
                banner_image || null,
                icon || 'HelpCircle',
                login_route,
                button_label || 'Login',
                display_order || 0,
                is_active !== undefined ? is_active : 1,
                theme_color || '#008080',
                req.user.id
            ]
        );

        await auditLog(req.user.id, 'ADD_PORTAL', result.insertId, null, req.body, req.ip);

        res.status(201).json({ success: true, message: 'Portal card created successfully.', id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/portals/:id - Edit portal card
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    const { name, slug, description, banner_image, icon, login_route, button_label, display_order, is_active, theme_color } = req.body;
    if (!name || !slug || !login_route) {
        return res.status(400).json({ success: false, message: 'Name, Slug, and Login Route URL are required.' });
    }

    try {
        const [oldRows] = await pool.execute('SELECT * FROM portal_management WHERE id = ?', [req.params.id]);
        if (!oldRows.length) return res.status(404).json({ success: false, message: 'Portal not found' });

        // Enforce uniqueness of slug if slug changes
        const [existing] = await pool.execute('SELECT id FROM portal_management WHERE slug = ? AND id != ?', [slug, req.params.id]);
        if (existing.length) {
            return res.status(400).json({ success: false, message: 'Portal slug is already in use by another card.' });
        }

        await pool.execute(
            `UPDATE portal_management 
             SET name = ?, slug = ?, description = ?, banner_image = ?, icon = ?, login_route = ?, button_label = ?, display_order = ?, is_active = ?, theme_color = ?, updated_by = ?
             WHERE id = ?`,
            [
                name,
                slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-'),
                description || null,
                banner_image || null,
                icon || 'HelpCircle',
                login_route,
                button_label || 'Login',
                display_order || 0,
                is_active !== undefined ? is_active : 1,
                theme_color || '#008080',
                req.user.id,
                req.params.id
            ]
        );

        await auditLog(req.user.id, 'EDIT_PORTAL', req.params.id, oldRows[0], req.body, req.ip);

        res.json({ success: true, message: 'Portal card updated successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PATCH /api/portals/:id/status - Toggle Portal Status
router.patch('/:id/status', verifyToken, isAdmin, async (req, res) => {
    const { is_active } = req.body;
    if (is_active === undefined) {
        return res.status(400).json({ success: false, message: 'is_active status is required.' });
    }

    try {
        const [oldRows] = await pool.execute('SELECT * FROM portal_management WHERE id = ?', [req.params.id]);
        if (!oldRows.length) return res.status(404).json({ success: false, message: 'Portal not found' });

        await pool.execute('UPDATE portal_management SET is_active = ?, updated_by = ? WHERE id = ?', [is_active ? 1 : 0, req.user.id, req.params.id]);

        await auditLog(req.user.id, 'TOGGLE_PORTAL_STATUS', req.params.id, oldRows[0], { is_active }, req.ip);

        res.json({ success: true, message: 'Portal status toggled successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/portals/reorder - Reorder portal display sequence
router.put('/reorder', verifyToken, isAdmin, async (req, res) => {
    const { orders } = req.body; // Expects array of objects [{ id: 1, display_order: 1 }, ...]
    if (!orders || !Array.isArray(orders)) {
        return res.status(400).json({ success: false, message: 'Orders array is required.' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (const item of orders) {
            await conn.execute('UPDATE portal_management SET display_order = ? WHERE id = ?', [item.display_order, item.id]);
        }
        await conn.commit();
        await auditLog(req.user.id, 'REORDER_PORTALS', null, null, { orders }, req.ip);
        res.json({ success: true, message: 'Portals reordered successfully.' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// DELETE /api/portals/:id - Delete portal card
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [oldRows] = await pool.execute('SELECT * FROM portal_management WHERE id = ?', [req.params.id]);
        if (!oldRows.length) return res.status(404).json({ success: false, message: 'Portal not found' });

        await pool.execute('DELETE FROM portal_management WHERE id = ?', [req.params.id]);

        await auditLog(req.user.id, 'DELETE_PORTAL', req.params.id, oldRows[0], null, req.ip);

        res.json({ success: true, message: 'Portal card deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/portals/upload - Dynamic Banner / Icon Upload
router.post('/upload', verifyToken, isAdmin, upload.single('image'), postUploadCheck(), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file was uploaded.' });
    }

    const relativePath = `/uploads/portals/${req.file.filename}`;
    copyToStudentUploads(req.file.filename);

    res.json({ success: true, path: relativePath });
});

module.exports = router;
