const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// GET all per-file-type upload settings (public — student frontend also reads this)
router.get('/file-settings', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM file_upload_settings ORDER BY file_type ASC'
        );
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// UPDATE a single file-type setting
router.put('/file-settings/:id', verifyToken, isAdmin, async (req, res) => {
    const { 
        max_size, 
        size_unit, 
        allowed_extensions, 
        is_active, 
        is_integrated_course, 
        consolidated_enabled, 
        semester_wise_enabled, 
        max_semesters, 
        allowed_semester_doc_types, 
        per_file_size_limit, 
        total_size_limit 
    } = req.body;

    if (max_size === undefined || !size_unit || !allowed_extensions) {
        return res.status(400).json({ success: false, message: 'max_size, size_unit and allowed_extensions are required' });
    }

    try {
        await pool.execute(
            `UPDATE file_upload_settings 
             SET max_size = ?, size_unit = ?, allowed_extensions = ?, is_active = ?,
                 is_integrated_course = ?, consolidated_enabled = ?, semester_wise_enabled = ?, 
                 max_semesters = ?, allowed_semester_doc_types = ?, per_file_size_limit = ?, 
                 total_size_limit = ?
             WHERE id = ?`,
            [
                parseInt(max_size, 10), 
                size_unit, 
                allowed_extensions.trim(),
                is_active !== undefined ? (is_active ? 1 : 0) : 1,
                is_integrated_course !== undefined ? (is_integrated_course ? 1 : 0) : 0,
                consolidated_enabled !== undefined ? (consolidated_enabled ? 1 : 0) : 1, 
                semester_wise_enabled !== undefined ? (semester_wise_enabled ? 1 : 0) : 1, 
                parseInt(max_semesters, 10) !== undefined ? parseInt(max_semesters, 10) : 10,
                allowed_semester_doc_types ? allowed_semester_doc_types.trim() : 'jpg,jpeg,png,pdf',
                parseInt(per_file_size_limit, 10) !== undefined ? parseInt(per_file_size_limit, 10) : 500, 
                parseInt(total_size_limit, 10) !== undefined ? parseInt(total_size_limit, 10) : 5000,
                req.params.id
            ]
        );
        res.json({ success: true, message: 'Upload setting updated' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Legacy global settings (kept for backward compatibility)
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM upload_settings LIMIT 1');
        res.json({ success: true, data: rows[0] || {} });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/update', verifyToken, isAdmin, async (req, res) => {
    const { allowed_types, max_size_mb, upload_path } = req.body;
    try {
        const [rows] = await pool.execute('SELECT id FROM upload_settings LIMIT 1');
        if (rows.length === 0) {
            await pool.execute(
                'INSERT INTO upload_settings (allowed_types, max_size_mb, upload_path) VALUES (?, ?, ?)',
                [allowed_types, max_size_mb, upload_path]
            );
        } else {
            await pool.execute(
                'UPDATE upload_settings SET allowed_types = ?, max_size_mb = ?, upload_path = ? WHERE id = ?',
                [allowed_types, max_size_mb, upload_path, rows[0].id]
            );
        }
        res.json({ success: true, message: 'Upload settings updated' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
