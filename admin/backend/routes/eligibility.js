'use strict';

const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// ── Audit helper ──────────────────────────────────────────────────────────────
async function audit(conn, { adminId, action, entityType, entityId, oldValue, newValue, ip }) {
    try {
        await conn.execute(
            `INSERT INTO eligibility_audit_log
             (admin_id, action, entity_type, entity_id, old_value, new_value, ip_address)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                adminId || null,
                action,
                entityType,
                entityId || null,
                oldValue  ? JSON.stringify(oldValue)  : null,
                newValue  ? JSON.stringify(newValue)  : null,
                ip        || null,
            ]
        );
    } catch (_) { /* audit failures must never block the main flow */ }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEPARTMENTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/eligibility/departments  (public — students need this)
router.get('/departments', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, name, is_active FROM departments WHERE is_active = 1 ORDER BY name ASC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/eligibility/departments/all  (admin — includes inactive)
router.get('/departments/all', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, name, is_active, created_at FROM departments ORDER BY name ASC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/eligibility/departments
router.post('/departments', verifyToken, isAdmin, async (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Department name is required' });
    try {
        const [result] = await pool.execute(
            `INSERT INTO departments (name) VALUES (?)`, [name.trim()]
        );
        await audit(pool, {
            adminId: req.user.id, action: 'CREATE', entityType: 'department',
            entityId: result.insertId, newValue: { name: name.trim() }, ip: req.ip
        });
        res.json({ success: true, message: 'Department added', id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Department already exists' });
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/eligibility/departments/:id
router.put('/departments/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, is_active } = req.body;
    try {
        const [[old]] = await pool.execute(`SELECT name, is_active FROM departments WHERE id = ?`, [id]);
        if (!old) return res.status(404).json({ success: false, message: 'Department not found' });

        const newName      = name      !== undefined ? name.trim()      : old.name;
        const newIsActive  = is_active !== undefined ? Number(is_active) : old.is_active;

        await pool.execute(
            `UPDATE departments SET name = ?, is_active = ? WHERE id = ?`,
            [newName, newIsActive, id]
        );
        await audit(pool, {
            adminId: req.user.id, action: 'UPDATE', entityType: 'department',
            entityId: Number(id), oldValue: old, newValue: { name: newName, is_active: newIsActive }, ip: req.ip
        });
        res.json({ success: true, message: 'Department updated' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Department name already exists' });
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/eligibility/departments/:id
router.delete('/departments/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [[old]] = await pool.execute(`SELECT name FROM departments WHERE id = ?`, [id]);
        if (!old) return res.status(404).json({ success: false, message: 'Department not found' });
        await pool.execute(`DELETE FROM departments WHERE id = ?`, [id]);
        await audit(pool, {
            adminId: req.user.id, action: 'DELETE', entityType: 'department',
            entityId: Number(id), oldValue: old, ip: req.ip
        });
        res.json({ success: true, message: 'Department deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRAMS OFFERED
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/eligibility/programs?department_id=  (public)
router.get('/programs', async (req, res) => {
    const { department_id } = req.query;
    try {
        let query = `SELECT p.id, p.department_id, p.name, p.is_active,
                            d.name AS department_name
                     FROM programs_offered p
                     JOIN departments d ON d.id = p.department_id
                     WHERE p.is_active = 1`;
        const params = [];
        if (department_id) {
            query += ' AND p.department_id = ?';
            params.push(department_id);
        }
        query += ' ORDER BY p.name ASC';
        const [rows] = await pool.execute(query, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/eligibility/programs/all  (admin — includes inactive)
router.get('/programs/all', verifyToken, isAdmin, async (req, res) => {
    const { department_id } = req.query;
    try {
        let query = `SELECT p.id, p.department_id, p.name, p.is_active,
                            d.name AS department_name
                     FROM programs_offered p
                     JOIN departments d ON d.id = p.department_id`;
        const params = [];
        if (department_id) {
            query += ' WHERE p.department_id = ?';
            params.push(department_id);
        }
        query += ' ORDER BY d.name ASC, p.name ASC';
        const [rows] = await pool.execute(query, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/eligibility/programs
router.post('/programs', verifyToken, isAdmin, async (req, res) => {
    const { department_id, name } = req.body;
    if (!department_id || !name?.trim())
        return res.status(400).json({ success: false, message: 'department_id and name are required' });
    try {
        const [result] = await pool.execute(
            `INSERT INTO programs_offered (department_id, name) VALUES (?, ?)`,
            [department_id, name.trim()]
        );
        await audit(pool, {
            adminId: req.user.id, action: 'CREATE', entityType: 'program',
            entityId: result.insertId, newValue: { department_id, name: name.trim() }, ip: req.ip
        });
        res.json({ success: true, message: 'Programme added', id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Programme already exists for this department' });
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/eligibility/programs/:id
router.put('/programs/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, is_active } = req.body;
    try {
        const [[old]] = await pool.execute(
            `SELECT department_id, name, is_active FROM programs_offered WHERE id = ?`, [id]
        );
        if (!old) return res.status(404).json({ success: false, message: 'Programme not found' });

        const newName     = name      !== undefined ? name.trim()       : old.name;
        const newIsActive = is_active !== undefined ? Number(is_active)  : old.is_active;

        await pool.execute(
            `UPDATE programs_offered SET name = ?, is_active = ? WHERE id = ?`,
            [newName, newIsActive, id]
        );
        await audit(pool, {
            adminId: req.user.id, action: 'UPDATE', entityType: 'program',
            entityId: Number(id), oldValue: old, newValue: { name: newName, is_active: newIsActive }, ip: req.ip
        });
        res.json({ success: true, message: 'Programme updated' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Programme name already exists for this department' });
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/eligibility/programs/:id
router.delete('/programs/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [[old]] = await pool.execute(`SELECT name FROM programs_offered WHERE id = ?`, [id]);
        if (!old) return res.status(404).json({ success: false, message: 'Programme not found' });
        await pool.execute(`DELETE FROM programs_offered WHERE id = ?`, [id]);
        await audit(pool, {
            adminId: req.user.id, action: 'DELETE', entityType: 'program',
            entityId: Number(id), oldValue: old, ip: req.ip
        });
        res.json({ success: true, message: 'Programme deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PG ELIGIBILITY
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/eligibility/programs/:id/pg  (public)
router.get('/programs/:id/pg', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, course_name FROM program_pg_eligibility WHERE program_id = ? ORDER BY course_name ASC`,
            [req.params.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/eligibility/programs/:id/pg
router.post('/programs/:id/pg', verifyToken, isAdmin, async (req, res) => {
    const programId = req.params.id;
    const { course_name } = req.body;
    if (!course_name?.trim()) return res.status(400).json({ success: false, message: 'course_name is required' });
    try {
        const [result] = await pool.execute(
            `INSERT INTO program_pg_eligibility (program_id, course_name) VALUES (?, ?)`,
            [programId, course_name.trim()]
        );
        await audit(pool, {
            adminId: req.user.id, action: 'CREATE', entityType: 'pg_eligibility',
            entityId: result.insertId, newValue: { program_id: programId, course_name: course_name.trim() }, ip: req.ip
        });
        res.json({ success: true, message: 'PG eligibility added', id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Course already mapped to this programme' });
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/eligibility/programs/:id/pg/:courseId
router.delete('/programs/:id/pg/:courseId', verifyToken, isAdmin, async (req, res) => {
    const { id: programId, courseId } = req.params;
    try {
        const [[old]] = await pool.execute(
            `SELECT course_name FROM program_pg_eligibility WHERE id = ? AND program_id = ?`,
            [courseId, programId]
        );
        if (!old) return res.status(404).json({ success: false, message: 'Mapping not found' });
        await pool.execute(`DELETE FROM program_pg_eligibility WHERE id = ?`, [courseId]);
        await audit(pool, {
            adminId: req.user.id, action: 'DELETE', entityType: 'pg_eligibility',
            entityId: Number(courseId), oldValue: old, ip: req.ip
        });
        res.json({ success: true, message: 'PG eligibility removed' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// M.PHIL ELIGIBILITY
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/eligibility/programs/:id/mphil  (public)
router.get('/programs/:id/mphil', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, course_name FROM program_mphil_eligibility WHERE program_id = ? ORDER BY course_name ASC`,
            [req.params.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/eligibility/programs/:id/mphil
router.post('/programs/:id/mphil', verifyToken, isAdmin, async (req, res) => {
    const programId = req.params.id;
    const { course_name } = req.body;
    if (!course_name?.trim()) return res.status(400).json({ success: false, message: 'course_name is required' });
    try {
        const [result] = await pool.execute(
            `INSERT INTO program_mphil_eligibility (program_id, course_name) VALUES (?, ?)`,
            [programId, course_name.trim()]
        );
        await audit(pool, {
            adminId: req.user.id, action: 'CREATE', entityType: 'mphil_eligibility',
            entityId: result.insertId, newValue: { program_id: programId, course_name: course_name.trim() }, ip: req.ip
        });
        res.json({ success: true, message: 'M.Phil eligibility added', id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Course already mapped to this programme' });
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/eligibility/programs/:id/mphil/:courseId
router.delete('/programs/:id/mphil/:courseId', verifyToken, isAdmin, async (req, res) => {
    const { id: programId, courseId } = req.params;
    try {
        const [[old]] = await pool.execute(
            `SELECT course_name FROM program_mphil_eligibility WHERE id = ? AND program_id = ?`,
            [courseId, programId]
        );
        if (!old) return res.status(404).json({ success: false, message: 'Mapping not found' });
        await pool.execute(`DELETE FROM program_mphil_eligibility WHERE id = ?`, [courseId]);
        await audit(pool, {
            adminId: req.user.id, action: 'DELETE', entityType: 'mphil_eligibility',
            entityId: Number(courseId), oldValue: old, ip: req.ip
        });
        res.json({ success: true, message: 'M.Phil eligibility removed' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATED ELIGIBILITY
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/eligibility/programs/:id/integrated  (public)
router.get('/programs/:id/integrated', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, course_name FROM program_integrated_eligibility WHERE program_id = ? ORDER BY course_name ASC`,
            [req.params.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/eligibility/programs/:id/integrated
router.post('/programs/:id/integrated', verifyToken, isAdmin, async (req, res) => {
    const programId = req.params.id;
    const { course_name } = req.body;
    if (!course_name?.trim()) return res.status(400).json({ success: false, message: 'course_name is required' });
    try {
        const [result] = await pool.execute(
            `INSERT INTO program_integrated_eligibility (program_id, course_name) VALUES (?, ?)`,
            [programId, course_name.trim()]
        );
        await audit(pool, {
            adminId: req.user.id, action: 'CREATE', entityType: 'integrated_eligibility',
            entityId: result.insertId, newValue: { program_id: programId, course_name: course_name.trim() }, ip: req.ip
        });
        res.json({ success: true, message: 'Integrated course eligibility added', id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Course already mapped to this programme' });
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/eligibility/programs/:id/integrated/:courseId
router.delete('/programs/:id/integrated/:courseId', verifyToken, isAdmin, async (req, res) => {
    const { id: programId, courseId } = req.params;
    try {
        const [[old]] = await pool.execute(
            `SELECT course_name FROM program_integrated_eligibility WHERE id = ? AND program_id = ?`,
            [courseId, programId]
        );
        if (!old) return res.status(404).json({ success: false, message: 'Mapping not found' });
        await pool.execute(`DELETE FROM program_integrated_eligibility WHERE id = ?`, [courseId]);
        await audit(pool, {
            adminId: req.user.id, action: 'DELETE', entityType: 'integrated_eligibility',
            entityId: Number(courseId), oldValue: old, ip: req.ip
        });
        res.json({ success: true, message: 'Integrated eligibility removed' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED HINTS  (public — called by student form on programme change)
// GET /api/eligibility/programs/:id/hints
// Returns { pg: [...], mphil: [...], integrated: [...] }
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/programs/:id/hints', async (req, res) => {
    const programId = req.params.id;
    try {
        const [[prog]] = await pool.execute(
            `SELECT p.id, p.name, p.department_id, d.name AS department_name
             FROM programs_offered p JOIN departments d ON d.id = p.department_id
             WHERE p.id = ? LIMIT 1`,
            [programId]
        );
        if (!prog) return res.status(404).json({ success: false, message: 'Programme not found' });

        const [pg]         = await pool.execute(
            `SELECT id, course_name FROM program_pg_eligibility         WHERE program_id = ? ORDER BY course_name ASC`, [programId]
        );
        const [mphil]      = await pool.execute(
            `SELECT id, course_name FROM program_mphil_eligibility      WHERE program_id = ? ORDER BY course_name ASC`, [programId]
        );
        const [integrated] = await pool.execute(
            `SELECT id, course_name FROM program_integrated_eligibility WHERE program_id = ? ORDER BY course_name ASC`, [programId]
        );

        res.json({
            success: true,
            data: {
                program:    prog,
                pg:         pg.map(r => r.course_name),
                mphil:      mphil.map(r => r.course_name),
                integrated: integrated.map(r => r.course_name),
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOG  (admin only)
// GET /api/eligibility/audit?limit=50&offset=0
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/audit', verifyToken, isAdmin, async (req, res) => {
    const limit  = Math.min(parseInt(req.query.limit  || '50'),  200);
    const offset = parseInt(req.query.offset || '0');
    try {
        const [rows] = await pool.execute(
            `SELECT * FROM eligibility_audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
