
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

const tables = {
    exam_centers: { table: 'dropdown_exam_centers', nameCol: 'name' },
    subjects: { table: 'dropdown_subjects', nameCol: 'name' },
    categories: { table: 'dropdown_categories', nameCol: 'name' },
    districts: { table: 'dropdown_districts', nameCol: 'name' },
    genders: { table: 'dropdown_genders', nameCol: 'name' },
    id_types: { table: 'dropdown_id_types', nameCol: 'name' },
    score_types: { table: 'dropdown_score_types', nameCol: 'name' },
    mark_statement_types: { table: 'dropdown_mark_statement_types', nameCol: 'name' },
    education_boards: { table: 'education_boards', nameCol: 'board_name' },
    degree_types: { table: 'degree_types', nameCol: 'degree_name' },
    university_types: { table: 'university_types', nameCol: 'type_name' },
    specializations: { table: 'specializations', nameCol: 'spec_name' },
    employment_types: { table: 'employment_types', nameCol: 'type_name' },
    mphil_courses: { table: 'mphil_courses_master', nameCol: 'course_name' }
};

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

// GET all values for a type
router.get('/:type', async (req, res) => {
    const { type } = req.params;

    // Direct support for center/registration portal dropdowns returning raw arrays
    if (type === 'master_institutes') {
        try {
            const [rows] = await pool.execute(`
                SELECT id, college_code, name AS college_name, abbreviation
                FROM master_institutes
                WHERE is_active = 1
                  AND college_code IS NOT NULL
                  AND college_code != ''
                ORDER BY college_code ASC
            `);
            return res.json(rows);
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    }

    if (type === 'master_districts' || type === 'master_centre_types') {
        try {
            const [rows] = await pool.execute(`
                SELECT id, name
                FROM ${type}
                WHERE is_active = 1
                ORDER BY name ASC
            `);
            return res.json(rows);
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    }

    if (type === 'communities') {
        try {
            const [rows] = await pool.execute(`
                SELECT id, community_name AS name
                FROM community_fees
                WHERE status = 'active'
                ORDER BY community_name ASC
            `);
            return res.json({ success: true, data: rows });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    const config = tables[type];
    if (!config) return res.status(400).json({ success: false, message: 'Invalid dropdown type' });

    try {
        const [rows] = await pool.execute(`SELECT id, ${config.nameCol} as name FROM ${config.table} ORDER BY ${config.nameCol} ASC`);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ADD a value
router.post('/:type', verifyToken, isAdmin, async (req, res) => {
    const { type } = req.params;
    const { name } = req.body;
    const config = tables[type];
    if (!config) return res.status(400).json({ success: false, message: 'Invalid dropdown type' });
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });

    try {
        const [result] = await pool.execute(`INSERT INTO ${config.table} (${config.nameCol}) VALUES (?)`, [name.trim()]);
        if (type === 'mphil_courses') {
            await audit(pool, {
                adminId: req.user.id, action: 'CREATE', entityType: 'mphil_course',
                entityId: result.insertId, newValue: { course_name: name.trim() }, ip: req.ip
            });
        }
        res.json({ success: true, message: 'Item added successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// EDIT a value
router.put('/:type/:id', verifyToken, isAdmin, async (req, res) => {
    const { type, id } = req.params;
    const { name } = req.body;
    const config = tables[type];
    if (!config) return res.status(400).json({ success: false, message: 'Invalid dropdown type' });
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });

    try {
        let oldValue = null;
        if (type === 'mphil_courses') {
            const [[old]] = await pool.execute(`SELECT ${config.nameCol} as name FROM ${config.table} WHERE id = ?`, [id]);
            if (old) oldValue = { course_name: old.name };
        }

        await pool.execute(`UPDATE ${config.table} SET ${config.nameCol} = ? WHERE id = ?`, [name.trim(), id]);

        if (type === 'mphil_courses') {
            await audit(pool, {
                adminId: req.user.id, action: 'UPDATE', entityType: 'mphil_course',
                entityId: Number(id), oldValue, newValue: { course_name: name.trim() }, ip: req.ip
            });
        }
        res.json({ success: true, message: 'Item updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE a value
router.delete('/:type/:id', verifyToken, isAdmin, async (req, res) => {
    const { type, id } = req.params;
    const config = tables[type];
    if (!config) return res.status(400).json({ success: false, message: 'Invalid dropdown type' });

    try {
        let oldValue = null;
        if (type === 'mphil_courses') {
            const [[old]] = await pool.execute(`SELECT ${config.nameCol} as name FROM ${config.table} WHERE id = ?`, [id]);
            if (old) oldValue = { course_name: old.name };
        }

        await pool.execute(`DELETE FROM ${config.table} WHERE id = ?`, [id]);

        if (type === 'mphil_courses') {
            await audit(pool, {
                adminId: req.user.id, action: 'DELETE', entityType: 'mphil_course',
                entityId: Number(id), oldValue, ip: req.ip
            });
        }
        res.json({ success: true, message: 'Item deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
