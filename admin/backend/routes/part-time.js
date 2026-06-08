const { safeError } = require('../../../shared/security/safeError');
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Enterprise Part-Time Configuration Engine
 * Hierarchy: Category -> Role -> Eligible Area
 */

// Sanitize filename helper
const sanitizeFilename = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');

// Multer storage
const guidanceStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(__dirname, '../../../uploads/settings');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        cb(null, `global_guidance_${Date.now()}_${sanitizeFilename(file.originalname)}`);
    }
});

const uploadGuidance = multer({
    storage: guidanceStorage,
    limits: { fileSize: 25 * 1024 * 1024 }, // Generous limit; actual strict limit will be validated dynamically from database settings
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) return cb(null, true);
        cb(new Error('Only PDF, JPG, JPEG, PNG are allowed'));
    }
});

// â”€â”€â”€ CATEGORIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/categories', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM part_time_categories ORDER BY category_reference_code ASC');
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

router.post('/categories', verifyToken, isAdmin, async (req, res) => {
    const { category_name, category_hint, category_reference_code } = req.body;
    try {
        const [result] = await pool.execute(
            'INSERT INTO part_time_categories (category_name, category_hint, category_reference_code) VALUES (?, ?, ?)',
            [category_name, category_hint ?? null, category_reference_code ?? null]
        );
        try {
            await pool.execute(
                'INSERT INTO settings_audit_logs (admin_id, action, field_name, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    req.user.id || null,
                    'Create Part-Time Category',
                    'category_name/category_hint',
                    `Category: ${category_name}, Hint: ${category_hint || 'None'}`,
                    req.ip || null,
                    req.headers['user-agent'] || null
                ]
            );
        } catch (_) {}
        res.json({ success: true, id: result.insertId });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

router.put('/categories/:id', verifyToken, isAdmin, async (req, res) => {
    const { category_name, category_hint, category_reference_code, status } = req.body;
    try {
        const [oldRows] = await pool.execute('SELECT category_name, category_hint FROM part_time_categories WHERE id = ?', [req.params.id]);

        await pool.execute(
            'UPDATE part_time_categories SET category_name = ?, category_hint = ?, category_reference_code = ?, status = ? WHERE id = ?',
            [category_name, category_hint ?? null, category_reference_code ?? null, status ?? 1, req.params.id]
        );

        if (oldRows.length > 0) {
            const oldVal = oldRows[0];
            // Audit Log
            try {
                await pool.execute(
                    'INSERT INTO settings_audit_logs (admin_id, action, field_name, old_value, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [
                        req.user.id || null,
                        'Edit Part-Time Category',
                        'category_name/category_hint',
                        `Category: ${oldVal.category_name}, Hint: ${oldVal.category_hint || 'None'}`,
                        `Category: ${category_name}, Hint: ${category_hint || 'None'}`,
                        req.ip || null,
                        req.headers['user-agent'] || null
                    ]
                );
            } catch (_) {}
        }

        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

router.delete('/categories/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [oldRows] = await pool.execute('SELECT category_name FROM part_time_categories WHERE id = ?', [req.params.id]);
        await pool.execute('DELETE FROM part_time_categories WHERE id = ?', [req.params.id]);

        if (oldRows.length > 0) {
            // Audit Log
            try {
                await pool.execute(
                    'INSERT INTO settings_audit_logs (admin_id, action, field_name, old_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
                    [
                        req.user.id || null,
                        'Delete Part-Time Category',
                        'category_name',
                        oldRows[0].category_name,
                        req.ip || null,
                        req.headers['user-agent'] || null
                    ]
                );
            } catch (_) {}
        }

        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// â”€â”€â”€ GLOBAL GUIDANCE DOCUMENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /global-guidance - Get global guidance metadata
router.get('/global-guidance', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT file_name, document_type, uploaded_at FROM global_part_time_guidance LIMIT 1');
        if (rows.length === 0) {
            return res.json({ success: true, data: null });
        }
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// POST /global-guidance - Upload or Replace global guidance document
router.post('/global-guidance', verifyToken, isAdmin, uploadGuidance.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    try {
        // Enforce dynamic allowed types & max file size from centralized upload settings
        const [settings] = await pool.execute('SELECT allowed_types, max_size_mb FROM upload_settings LIMIT 1');
        const allowedTypes = settings[0]?.allowed_types || 'jpeg,jpg,png,pdf';
        const maxSizeMb = settings[0]?.max_size_mb || 5;

        const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
        const allowedList = allowedTypes.split(',').map(x => x.trim().toLowerCase());

        if (!allowedList.includes(ext)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: `Unsupported file type. Centralized settings only allow: ${allowedTypes}` });
        }

        if (req.file.size > maxSizeMb * 1024 * 1024) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: `File size exceeds the centralized limit of ${maxSizeMb}MB` });
        }

        // Relative path to save in DB
        const relativePath = `uploads/settings/${req.file.filename}`;
        const docType = ext === 'pdf' ? 'pdf' : 'image';

        // Check if there is an existing global document
        const [existing] = await pool.execute('SELECT id, file_path, file_name FROM global_part_time_guidance LIMIT 1');
        let action = 'Upload Global Guidance Document';
        let oldValue = null;

        if (existing.length > 0) {
            action = 'Replace Global Guidance Document';
            oldValue = existing[0].file_name;

            // Delete old file safely
            const oldAbsPath = path.resolve(__dirname, '..', existing[0].file_path);
            if (fs.existsSync(oldAbsPath)) {
                try {
                    fs.unlinkSync(oldAbsPath);
                } catch (unlinkErr) {
                    console.error('Failed to delete replaced file:', unlinkErr.message);
                }
            }

            // Update database entry
            await pool.execute(
                'UPDATE global_part_time_guidance SET file_path = ?, file_name = ?, document_type = ?, uploaded_by = ?, uploaded_at = NOW() WHERE id = ?',
                [relativePath, req.file.originalname, docType, req.user.id, existing[0].id]
            );
        } else {
            // Insert new database entry
            await pool.execute(
                'INSERT INTO global_part_time_guidance (file_path, file_name, document_type, uploaded_by) VALUES (?, ?, ?, ?)',
                [relativePath, req.file.originalname, docType, req.user.id]
            );
        }

        // Audit Log
        try {
            await pool.execute(
                'INSERT INTO settings_audit_logs (admin_id, action, field_name, old_value, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    req.user.id || null,
                    action,
                    'global_guidance_doc',
                    oldValue,
                    req.file.originalname,
                    req.ip || null,
                    req.headers['user-agent'] || null
                ]
            );
        } catch (auditErr) {
            console.error('Audit logging failed:', auditErr.message);
        }

        res.json({
            success: true,
            message: existing.length > 0 ? 'Document replaced successfully' : 'Document uploaded successfully',
            data: {
                file_name: req.file.originalname,
                document_type: docType
            }
        });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (_) {}
        }
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// DELETE /global-guidance - Delete global guidance document
router.delete('/global-guidance', verifyToken, isAdmin, async (req, res) => {
    try {
        const [existing] = await pool.execute('SELECT id, file_path, file_name FROM global_part_time_guidance LIMIT 1');
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'No guidance document exists' });
        }

        // Delete physical file safely
        const absPath = path.resolve(__dirname, '..', existing[0].file_path);
        if (fs.existsSync(absPath)) {
            try {
                fs.unlinkSync(absPath);
            } catch (unlinkErr) {
                console.error('Failed to delete file from disk:', unlinkErr.message);
            }
        }

        // Remove from DB
        await pool.execute('DELETE FROM global_part_time_guidance WHERE id = ?', [existing[0].id]);

        // Audit Log
        try {
            await pool.execute(
                'INSERT INTO settings_audit_logs (admin_id, action, field_name, old_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    req.user.id || null,
                    'Delete Global Guidance Document',
                    'global_guidance_doc',
                    existing[0].file_name,
                    req.ip || null,
                    req.headers['user-agent'] || null
                ]
            );
        } catch (_) {}

        res.json({ success: true, message: 'Document deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// GET /global-guidance/preview - Secure authenticated preview endpoint
router.get('/global-guidance/preview', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT file_path, document_type, file_name FROM global_part_time_guidance LIMIT 1');
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Guidance document not found' });
        }
        
        const doc = rows[0];
        const absolutePath = path.resolve(__dirname, '..', doc.file_path);
        
        // Security check: path traversal prevention
        const uploadsDir = path.resolve(__dirname, '../uploads');
        if (!absolutePath.startsWith(uploadsDir)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ success: false, message: 'File on disk not found' });
        }

        // Audit Log for preview
        try {
            await pool.execute(
                'INSERT INTO settings_audit_logs (admin_id, action, field_name, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    req.user.id || null,
                    'Preview Global Guidance Document',
                    'global_guidance_doc',
                    doc.file_name,
                    req.ip || null,
                    req.headers['user-agent'] || null
                ]
            );
        } catch (_) {}

        res.setHeader('Content-Type', doc.document_type === 'pdf' ? 'application/pdf' : `image/${doc.document_type}`);
        res.setHeader('Content-Disposition', `inline; filename="${doc.file_name}"`);
        fs.createReadStream(absolutePath).pipe(res);
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// â”€â”€â”€ ROLES (DEPENDENT ON CATEGORY) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/categories/:categoryId/roles', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM part_time_roles WHERE category_id = ? ORDER BY role_name ASC', [req.params.categoryId]);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

router.post('/roles', verifyToken, isAdmin, async (req, res) => {
    const { category_id, role_name, role_hint } = req.body;
    try {
        const [result] = await pool.execute('INSERT INTO part_time_roles (category_id, role_name, role_hint) VALUES (?, ?, ?)', [category_id, role_name, role_hint ?? null]);
        res.json({ success: true, id: result.insertId });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

router.put('/roles/:id', verifyToken, isAdmin, async (req, res) => {
    const { role_name, role_hint, status } = req.body;
    try {
        await pool.execute('UPDATE part_time_roles SET role_name = ?, role_hint = ?, status = ? WHERE id = ?', [role_name, role_hint ?? null, status ?? 1, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

router.delete('/roles/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.execute('DELETE FROM part_time_roles WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// â”€â”€â”€ ELIGIBLE AREAS (DEPENDENT ON ROLE) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/roles/:roleId/areas', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM part_time_eligible_areas WHERE role_id = ? ORDER BY eligible_area_name ASC', [req.params.roleId]);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

router.post('/areas', verifyToken, isAdmin, async (req, res) => {
    const { role_id, eligible_area_name } = req.body;
    try {
        const [result] = await pool.execute('INSERT INTO part_time_eligible_areas (role_id, eligible_area_name) VALUES (?, ?)', [role_id, eligible_area_name]);
        res.json({ success: true, id: result.insertId });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

router.put('/areas/:id', verifyToken, isAdmin, async (req, res) => {
    const { eligible_area_name, status } = req.body;
    try {
        await pool.execute('UPDATE part_time_eligible_areas SET eligible_area_name = ?, status = ? WHERE id = ?', [eligible_area_name, status ?? 1, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

router.delete('/areas/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.execute('DELETE FROM part_time_eligible_areas WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// â”€â”€â”€ DISTRICTS (DEPENDENT ON AREA / STATE) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/areas/:areaId/districts', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM part_time_area_districts WHERE area_id = ? ORDER BY district_name ASC',
            [req.params.areaId]
        );
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

router.post('/districts', verifyToken, isAdmin, async (req, res) => {
    const { area_id, district_name } = req.body;
    if (!area_id || !district_name?.trim()) {
        return res.status(400).json({ success: false, message: 'area_id and district_name are required' });
    }
    try {
        const [result] = await pool.execute(
            'INSERT INTO part_time_area_districts (area_id, district_name) VALUES (?, ?)',
            [area_id, district_name.trim()]
        );
        try {
            await pool.execute(
                'INSERT INTO settings_audit_logs (admin_id, action, field_name, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
                [req.user.id || null, 'Add Working Area District', 'district_name', district_name.trim(), req.ip || null, req.headers['user-agent'] || null]
            );
        } catch (_) {}
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'District already exists under this state' });
        }
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

router.put('/districts/:id', verifyToken, isAdmin, async (req, res) => {
    const { district_name, status } = req.body;
    if (!district_name?.trim()) {
        return res.status(400).json({ success: false, message: 'district_name is required' });
    }
    try {
        const [oldRows] = await pool.execute('SELECT district_name FROM part_time_area_districts WHERE id = ?', [req.params.id]);
        await pool.execute(
            'UPDATE part_time_area_districts SET district_name = ?, status = ? WHERE id = ?',
            [district_name.trim(), status ?? 1, req.params.id]
        );
        if (oldRows.length > 0) {
            try {
                await pool.execute(
                    'INSERT INTO settings_audit_logs (admin_id, action, field_name, old_value, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [req.user.id || null, 'Edit Working Area District', 'district_name', oldRows[0].district_name, district_name.trim(), req.ip || null, req.headers['user-agent'] || null]
                );
            } catch (_) {}
        }
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'District already exists under this state' });
        }
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

router.delete('/districts/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [oldRows] = await pool.execute('SELECT district_name FROM part_time_area_districts WHERE id = ?', [req.params.id]);
        await pool.execute('DELETE FROM part_time_area_districts WHERE id = ?', [req.params.id]);
        if (oldRows.length > 0) {
            try {
                await pool.execute(
                    'INSERT INTO settings_audit_logs (admin_id, action, field_name, old_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
                    [req.user.id || null, 'Delete Working Area District', 'district_name', oldRows[0].district_name, req.ip || null, req.headers['user-agent'] || null]
                );
            } catch (_) {}
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// â”€â”€â”€ WORKING AREA EDIT (add name edit support for admin UI) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.put('/areas/:id/name', verifyToken, isAdmin, async (req, res) => {
    const { eligible_area_name, status } = req.body;
    if (!eligible_area_name?.trim()) {
        return res.status(400).json({ success: false, message: 'eligible_area_name is required' });
    }
    try {
        await pool.execute(
            'UPDATE part_time_eligible_areas SET eligible_area_name = ?, status = ? WHERE id = ?',
            [eligible_area_name.trim(), status ?? 1, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// Legacy backward compatibility (Stub)
router.get('/all', async (req, res) => {
    try {
        const [cats] = await pool.execute('SELECT * FROM part_time_categories WHERE status = 1');
        const [roles] = await pool.execute('SELECT * FROM part_time_roles WHERE status = 1');
        const [areas] = await pool.execute('SELECT * FROM part_time_eligible_areas WHERE status = 1');
        res.json({ success: true, categories: cats, roles, areas });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

module.exports = router;
