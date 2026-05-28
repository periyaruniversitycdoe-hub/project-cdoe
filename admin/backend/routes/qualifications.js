/**
 * Qualification Types — Admin CRUD
 * Manages dynamic qualification options (NET, SET, JRF, SLET, GATE, M.Phil, Other…)
 * is_exemption = 1 → student bypasses entrance exam and goes direct to interview
 */

const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// ─── GET /api/qualifications — list all (public read for student form) ────────
router.get('/', async (req, res) => {
    try {
        const activeOnly = req.query.active === '1';
        const where      = activeOnly ? 'WHERE is_active = 1' : '';
        const [rows] = await pool.execute(
            `SELECT id, qualification_name, is_exemption, is_active, display_order,
                    created_at, updated_at
             FROM qualification_types
             ${where}
             ORDER BY display_order ASC, qualification_name ASC`
        );
        // Count how many students use each qualification (for admin info)
        if (!activeOnly) {
            const [usage] = await pool.execute(
                `SELECT qualification_id, COUNT(*) AS student_count
                 FROM student_qualifications WHERE status = 'Active'
                 GROUP BY qualification_id`
            );
            const usageMap = {};
            usage.forEach(u => { usageMap[u.qualification_id] = u.student_count; });
            rows.forEach(r => { r.student_count = usageMap[r.id] || 0; });
        }
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('GET qualifications error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── POST /api/qualifications — create new qualification type ─────────────────
router.post('/', verifyToken, isAdmin, async (req, res) => {
    const { qualification_name, is_exemption, is_active, display_order } = req.body;

    if (!qualification_name || !qualification_name.trim()) {
        return res.status(400).json({ success: false, message: 'Qualification name is required' });
    }

    try {
        const [result] = await pool.execute(
            `INSERT INTO qualification_types
                (qualification_name, is_exemption, is_active, display_order)
             VALUES (?, ?, ?, ?)`,
            [
                qualification_name.trim(),
                is_exemption  ? 1 : 0,
                is_active !== false && is_active !== 0 ? 1 : 0,
                parseInt(display_order) || 0
            ]
        );
        res.status(201).json({
            success: true,
            id: result.insertId,
            message: 'Qualification type created successfully'
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: `Qualification "${qualification_name}" already exists`
            });
        }
        console.error('POST qualification error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── PUT /api/qualifications/:id — full update ────────────────────────────────
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { qualification_name, is_exemption, is_active, display_order } = req.body;

    if (!qualification_name || !qualification_name.trim()) {
        return res.status(400).json({ success: false, message: 'Qualification name is required' });
    }

    try {
        const [result] = await pool.execute(
            `UPDATE qualification_types
             SET qualification_name = ?, is_exemption = ?, is_active = ?,
                 display_order = ?, updated_at = NOW()
             WHERE id = ?`,
            [
                qualification_name.trim(),
                is_exemption ? 1 : 0,
                is_active    ? 1 : 0,
                parseInt(display_order) || 0,
                id
            ]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Qualification not found' });
        }

        // If changed to exemption, recompute entrance_exam_status for affected students
        if (is_exemption) {
            await pool.execute(
                `UPDATE applications a
                 INNER JOIN student_qualifications sq ON sq.application_id = a.application_id
                 SET a.entrance_exam_status = 'Exempted'
                 WHERE sq.qualification_id = ? AND sq.status = 'Active'
                   AND a.entrance_exam_status = 'Required'`,
                [id]
            );
        }

        res.json({ success: true, message: 'Qualification type updated successfully' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Name already exists' });
        }
        console.error('PUT qualification error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── PUT /api/qualifications/:id/toggle — toggle active/inactive ──────────────
router.put('/:id/toggle', verifyToken, isAdmin, async (req, res) => {
    try {
        const [result] = await pool.execute(
            'UPDATE qualification_types SET is_active = NOT is_active, updated_at = NOW() WHERE id = ?',
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Qualification not found' });
        }
        res.json({ success: true, message: 'Status toggled successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── DELETE /api/qualifications/:id — safe delete ────────────────────────────
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        // Block deletion if any student has actively selected this qualification
        const [[usage]] = await pool.execute(
            "SELECT COUNT(*) AS cnt FROM student_qualifications WHERE qualification_id = ? AND status = 'Active'",
            [req.params.id]
        );
        if (usage.cnt > 0) {
            return res.status(409).json({
                success: false,
                message: `Cannot delete: ${usage.cnt} student(s) have selected this qualification. Disable it instead.`
            });
        }

        const [result] = await pool.execute(
            'DELETE FROM qualification_types WHERE id = ?',
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Qualification not found' });
        }
        res.json({ success: true, message: 'Qualification deleted successfully' });
    } catch (err) {
        console.error('DELETE qualification error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── GET /api/qualifications/stats — usage stats per qualification ────────────
router.get('/stats', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT qt.id, qt.qualification_name, qt.is_exemption, qt.is_active,
                    COUNT(sq.id) AS total_students,
                    SUM(CASE WHEN sq.certificate_path IS NOT NULL THEN 1 ELSE 0 END) AS with_certificate
             FROM qualification_types qt
             LEFT JOIN student_qualifications sq
               ON sq.qualification_id = qt.id AND sq.status = 'Active'
             GROUP BY qt.id
             ORDER BY qt.display_order ASC, qt.qualification_name ASC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
