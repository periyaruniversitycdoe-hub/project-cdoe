'use strict';

const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { safeError } = require('../../../shared/security/safeError');

// ── Self-healing table creation ───────────────────────────────────────────────
(async () => {
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS faculty_master (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                faculty_name VARCHAR(255) NOT NULL,
                status       ENUM('active','inactive') NOT NULL DEFAULT 'active',
                created_by   VARCHAR(255) DEFAULT NULL,
                updated_by   VARCHAR(255) DEFAULT NULL,
                created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_faculty_name (faculty_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS discipline_master (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                faculty_id      INT NOT NULL,
                discipline_name VARCHAR(255) NOT NULL,
                status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
                created_by      VARCHAR(255) DEFAULT NULL,
                updated_by      VARCHAR(255) DEFAULT NULL,
                created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_disc_fac_name (faculty_id, discipline_name),
                CONSTRAINT fk_disc_faculty FOREIGN KEY (faculty_id) REFERENCES faculty_master(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS specialization_master (
                id                   INT AUTO_INCREMENT PRIMARY KEY,
                discipline_id        INT NOT NULL,
                specialization_name  VARCHAR(255) NOT NULL,
                status               ENUM('active','inactive') NOT NULL DEFAULT 'active',
                created_by           VARCHAR(255) DEFAULT NULL,
                updated_by           VARCHAR(255)  DEFAULT NULL,
                created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_spec_disc_name (discipline_id, specialization_name),
                CONSTRAINT fk_spec_discipline FOREIGN KEY (discipline_id) REFERENCES discipline_master(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS academic_hierarchy_audit (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                action       VARCHAR(50) NOT NULL,
                table_name   VARCHAR(50) NOT NULL,
                entity_id    INT DEFAULT NULL,
                old_value    LONGTEXT DEFAULT NULL,
                new_value    LONGTEXT DEFAULT NULL,
                performed_by VARCHAR(255) DEFAULT NULL,
                ip_address   VARCHAR(45) DEFAULT NULL,
                created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_aha_table (table_name),
                INDEX idx_aha_entity (entity_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('✅ Academic Hierarchy tables verified (faculty_master, discipline_master, specialization_master).');
    } catch (err) {
        console.error('[academic-hierarchy] Schema error:', err.message);
    }
})();

// ── Audit helper ──────────────────────────────────────────────────────────────
async function audit(action, tableName, entityId, oldVal, newVal, req) {
    try {
        const who = req?.user?.email || req?.user?.username || 'admin';
        const ip  = req?.ip || req?.headers?.['x-forwarded-for'] || null;
        await pool.execute(
            `INSERT INTO academic_hierarchy_audit (action, table_name, entity_id, old_value, new_value, performed_by, ip_address)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [action, tableName, entityId || null,
             oldVal ? JSON.stringify(oldVal) : null,
             newVal ? JSON.stringify(newVal) : null,
             who, ip]
        );
    } catch (_) {}
}

const actor = (req) => req?.user?.email || req?.user?.username || 'admin';

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC endpoints (used by student form — no auth required)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/academic-hierarchy/public/faculties
router.get('/public/faculties', async (_req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, faculty_name AS name FROM faculty_master WHERE status = 'active' ORDER BY faculty_name ASC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// GET /api/academic-hierarchy/public/disciplines?faculty_id=
router.get('/public/disciplines', async (req, res) => {
    try {
        const { faculty_id } = req.query;
        let query = `SELECT dm.id, dm.discipline_name AS name, dm.faculty_id FROM discipline_master dm WHERE dm.status = 'active'`;
        const params = [];
        if (faculty_id) { query += ` AND dm.faculty_id = ?`; params.push(faculty_id); }
        query += ` ORDER BY dm.discipline_name ASC`;
        const [rows] = await pool.execute(query, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// GET /api/academic-hierarchy/public/specializations?discipline_id=
router.get('/public/specializations', async (req, res) => {
    try {
        const { discipline_id } = req.query;
        let query = `SELECT sm.id, sm.specialization_name AS name, sm.discipline_id FROM specialization_master sm WHERE sm.status = 'active'`;
        const params = [];
        if (discipline_id) { query += ` AND sm.discipline_id = ?`; params.push(discipline_id); }
        query += ` ORDER BY sm.specialization_name ASC`;
        const [rows] = await pool.execute(query, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// GET /api/academic-hierarchy/public/all — load everything in one call (student form)
router.get('/public/all', async (_req, res) => {
    try {
        const [[faculties], [disciplines], [specializations]] = await Promise.all([
            pool.execute(`SELECT id, faculty_name AS name FROM faculty_master WHERE status = 'active' ORDER BY faculty_name ASC`),
            pool.execute(`SELECT id, discipline_name AS name, faculty_id FROM discipline_master WHERE status = 'active' ORDER BY discipline_name ASC`),
            pool.execute(`SELECT id, specialization_name AS name, discipline_id FROM specialization_master WHERE status = 'active' ORDER BY specialization_name ASC`),
        ]);
        res.json({ success: true, data: { faculties, disciplines, specializations } });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN FACULTY CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/academic-hierarchy/faculties
router.get('/faculties', verifyToken, isAdmin, async (_req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT f.*, COUNT(d.id) AS discipline_count
            FROM faculty_master f
            LEFT JOIN discipline_master d ON d.faculty_id = f.id
            GROUP BY f.id
            ORDER BY f.faculty_name ASC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// POST /api/academic-hierarchy/faculties
router.post('/faculties', verifyToken, isAdmin, async (req, res) => {
    const { faculty_name } = req.body;
    if (!faculty_name?.trim()) return res.status(400).json({ success: false, message: 'Faculty name is required' });
    try {
        const [result] = await pool.execute(
            `INSERT INTO faculty_master (faculty_name, created_by) VALUES (?, ?)`,
            [faculty_name.trim(), actor(req)]
        );
        await audit('create', 'faculty_master', result.insertId, null, { faculty_name: faculty_name.trim() }, req);
        res.status(201).json({ success: true, message: 'Faculty created', id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Faculty name already exists' });
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// PUT /api/academic-hierarchy/faculties/:id
router.put('/faculties/:id', verifyToken, isAdmin, async (req, res) => {
    const { faculty_name } = req.body;
    if (!faculty_name?.trim()) return res.status(400).json({ success: false, message: 'Faculty name is required' });
    try {
        const [[old]] = await pool.execute('SELECT * FROM faculty_master WHERE id = ?', [req.params.id]);
        if (!old) return res.status(404).json({ success: false, message: 'Faculty not found' });
        await pool.execute(
            `UPDATE faculty_master SET faculty_name = ?, updated_by = ? WHERE id = ?`,
            [faculty_name.trim(), actor(req), req.params.id]
        );
        await audit('update', 'faculty_master', req.params.id, old, { faculty_name: faculty_name.trim() }, req);
        res.json({ success: true, message: 'Faculty updated' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Faculty name already exists' });
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// PATCH /api/academic-hierarchy/faculties/:id/toggle
router.patch('/faculties/:id/toggle', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[row]] = await pool.execute('SELECT * FROM faculty_master WHERE id = ?', [req.params.id]);
        if (!row) return res.status(404).json({ success: false, message: 'Faculty not found' });
        const next = row.status === 'active' ? 'inactive' : 'active';
        await pool.execute('UPDATE faculty_master SET status = ?, updated_by = ? WHERE id = ?', [next, actor(req), req.params.id]);
        await audit('toggle', 'faculty_master', req.params.id, { status: row.status }, { status: next }, req);
        res.json({ success: true, message: `Faculty ${next}`, status: next });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// DELETE /api/academic-hierarchy/faculties/:id
router.delete('/faculties/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[row]] = await pool.execute('SELECT * FROM faculty_master WHERE id = ?', [req.params.id]);
        if (!row) return res.status(404).json({ success: false, message: 'Faculty not found' });
        const [[{ cnt }]] = await pool.execute('SELECT COUNT(*) AS cnt FROM discipline_master WHERE faculty_id = ?', [req.params.id]);
        if (cnt > 0) return res.status(409).json({ success: false, message: `Cannot delete: ${cnt} discipline(s) are linked to this faculty` });
        await pool.execute('DELETE FROM faculty_master WHERE id = ?', [req.params.id]);
        await audit('delete', 'faculty_master', req.params.id, row, null, req);
        res.json({ success: true, message: 'Faculty deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN DISCIPLINE CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/academic-hierarchy/disciplines?faculty_id=
router.get('/disciplines', verifyToken, isAdmin, async (req, res) => {
    try {
        const { faculty_id } = req.query;
        const params = [];
        let where = '';
        if (faculty_id) { where = 'WHERE d.faculty_id = ?'; params.push(faculty_id); }
        const [rows] = await pool.execute(`
            SELECT d.*, f.faculty_name,
                   COUNT(s.id) AS specialization_count
            FROM discipline_master d
            JOIN faculty_master f ON f.id = d.faculty_id
            LEFT JOIN specialization_master s ON s.discipline_id = d.id
            ${where}
            GROUP BY d.id
            ORDER BY f.faculty_name ASC, d.discipline_name ASC
        `, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// POST /api/academic-hierarchy/disciplines
router.post('/disciplines', verifyToken, isAdmin, async (req, res) => {
    const { faculty_id, discipline_name } = req.body;
    if (!faculty_id) return res.status(400).json({ success: false, message: 'Faculty is required' });
    if (!discipline_name?.trim()) return res.status(400).json({ success: false, message: 'Discipline name is required' });
    try {
        const [[fac]] = await pool.execute('SELECT id FROM faculty_master WHERE id = ?', [faculty_id]);
        if (!fac) return res.status(404).json({ success: false, message: 'Faculty not found' });
        const [result] = await pool.execute(
            `INSERT INTO discipline_master (faculty_id, discipline_name, created_by) VALUES (?, ?, ?)`,
            [faculty_id, discipline_name.trim(), actor(req)]
        );
        await audit('create', 'discipline_master', result.insertId, null, { faculty_id, discipline_name: discipline_name.trim() }, req);
        res.status(201).json({ success: true, message: 'Discipline created', id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Discipline already exists under this faculty' });
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// PUT /api/academic-hierarchy/disciplines/:id
router.put('/disciplines/:id', verifyToken, isAdmin, async (req, res) => {
    const { faculty_id, discipline_name } = req.body;
    if (!faculty_id) return res.status(400).json({ success: false, message: 'Faculty is required' });
    if (!discipline_name?.trim()) return res.status(400).json({ success: false, message: 'Discipline name is required' });
    try {
        const [[old]] = await pool.execute('SELECT * FROM discipline_master WHERE id = ?', [req.params.id]);
        if (!old) return res.status(404).json({ success: false, message: 'Discipline not found' });
        await pool.execute(
            `UPDATE discipline_master SET faculty_id = ?, discipline_name = ?, updated_by = ? WHERE id = ?`,
            [faculty_id, discipline_name.trim(), actor(req), req.params.id]
        );
        await audit('update', 'discipline_master', req.params.id, old, { faculty_id, discipline_name: discipline_name.trim() }, req);
        res.json({ success: true, message: 'Discipline updated' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Discipline already exists under this faculty' });
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// PATCH /api/academic-hierarchy/disciplines/:id/toggle
router.patch('/disciplines/:id/toggle', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[row]] = await pool.execute('SELECT * FROM discipline_master WHERE id = ?', [req.params.id]);
        if (!row) return res.status(404).json({ success: false, message: 'Discipline not found' });
        const next = row.status === 'active' ? 'inactive' : 'active';
        await pool.execute('UPDATE discipline_master SET status = ?, updated_by = ? WHERE id = ?', [next, actor(req), req.params.id]);
        await audit('toggle', 'discipline_master', req.params.id, { status: row.status }, { status: next }, req);
        res.json({ success: true, message: `Discipline ${next}`, status: next });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// DELETE /api/academic-hierarchy/disciplines/:id
router.delete('/disciplines/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[row]] = await pool.execute('SELECT * FROM discipline_master WHERE id = ?', [req.params.id]);
        if (!row) return res.status(404).json({ success: false, message: 'Discipline not found' });
        const [[{ cnt }]] = await pool.execute('SELECT COUNT(*) AS cnt FROM specialization_master WHERE discipline_id = ?', [req.params.id]);
        if (cnt > 0) return res.status(409).json({ success: false, message: `Cannot delete: ${cnt} specialization(s) are linked to this discipline` });
        await pool.execute('DELETE FROM discipline_master WHERE id = ?', [req.params.id]);
        await audit('delete', 'discipline_master', req.params.id, row, null, req);
        res.json({ success: true, message: 'Discipline deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN SPECIALIZATION CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/academic-hierarchy/specializations?discipline_id=&faculty_id=
router.get('/specializations', verifyToken, isAdmin, async (req, res) => {
    try {
        const { discipline_id, faculty_id } = req.query;
        const params = [];
        const conds  = [];
        if (discipline_id) { conds.push('s.discipline_id = ?'); params.push(discipline_id); }
        if (faculty_id)    { conds.push('d.faculty_id = ?');    params.push(faculty_id); }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const [rows] = await pool.execute(`
            SELECT s.*, d.discipline_name, f.faculty_name
            FROM specialization_master s
            JOIN discipline_master d ON d.id = s.discipline_id
            JOIN faculty_master f    ON f.id = d.faculty_id
            ${where}
            ORDER BY f.faculty_name ASC, d.discipline_name ASC, s.specialization_name ASC
        `, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// POST /api/academic-hierarchy/specializations
router.post('/specializations', verifyToken, isAdmin, async (req, res) => {
    const { discipline_id, specialization_name } = req.body;
    if (!discipline_id) return res.status(400).json({ success: false, message: 'Discipline is required' });
    if (!specialization_name?.trim()) return res.status(400).json({ success: false, message: 'Specialization name is required' });
    try {
        const [[disc]] = await pool.execute('SELECT id FROM discipline_master WHERE id = ?', [discipline_id]);
        if (!disc) return res.status(404).json({ success: false, message: 'Discipline not found' });
        const [result] = await pool.execute(
            `INSERT INTO specialization_master (discipline_id, specialization_name, created_by) VALUES (?, ?, ?)`,
            [discipline_id, specialization_name.trim(), actor(req)]
        );
        await audit('create', 'specialization_master', result.insertId, null, { discipline_id, specialization_name: specialization_name.trim() }, req);
        res.status(201).json({ success: true, message: 'Specialization created', id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Specialization already exists under this discipline' });
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// PUT /api/academic-hierarchy/specializations/:id
router.put('/specializations/:id', verifyToken, isAdmin, async (req, res) => {
    const { discipline_id, specialization_name } = req.body;
    if (!discipline_id) return res.status(400).json({ success: false, message: 'Discipline is required' });
    if (!specialization_name?.trim()) return res.status(400).json({ success: false, message: 'Specialization name is required' });
    try {
        const [[old]] = await pool.execute('SELECT * FROM specialization_master WHERE id = ?', [req.params.id]);
        if (!old) return res.status(404).json({ success: false, message: 'Specialization not found' });
        await pool.execute(
            `UPDATE specialization_master SET discipline_id = ?, specialization_name = ?, updated_by = ? WHERE id = ?`,
            [discipline_id, specialization_name.trim(), actor(req), req.params.id]
        );
        await audit('update', 'specialization_master', req.params.id, old, { discipline_id, specialization_name: specialization_name.trim() }, req);
        res.json({ success: true, message: 'Specialization updated' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Specialization already exists under this discipline' });
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// PATCH /api/academic-hierarchy/specializations/:id/toggle
router.patch('/specializations/:id/toggle', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[row]] = await pool.execute('SELECT * FROM specialization_master WHERE id = ?', [req.params.id]);
        if (!row) return res.status(404).json({ success: false, message: 'Specialization not found' });
        const next = row.status === 'active' ? 'inactive' : 'active';
        await pool.execute('UPDATE specialization_master SET status = ?, updated_by = ? WHERE id = ?', [next, actor(req), req.params.id]);
        await audit('toggle', 'specialization_master', req.params.id, { status: row.status }, { status: next }, req);
        res.json({ success: true, message: `Specialization ${next}`, status: next });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// DELETE /api/academic-hierarchy/specializations/:id
router.delete('/specializations/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[row]] = await pool.execute('SELECT * FROM specialization_master WHERE id = ?', [req.params.id]);
        if (!row) return res.status(404).json({ success: false, message: 'Specialization not found' });
        await pool.execute('DELETE FROM specialization_master WHERE id = ?', [req.params.id]);
        await audit('delete', 'specialization_master', req.params.id, row, null, req);
        res.json({ success: true, message: 'Specialization deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// GET /api/academic-hierarchy/audit-log
router.get('/audit-log', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT * FROM academic_hierarchy_audit ORDER BY created_at DESC LIMIT 200`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

module.exports = router;
