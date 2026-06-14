const pool = require('../../../admin/backend/config/db');

// ── Self-healing: ensure research_centre_departments mapping table exists ─────
(async () => {
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS research_centre_departments (
                id                 INT NOT NULL AUTO_INCREMENT,
                research_centre_id INT NOT NULL,
                department_id      INT NOT NULL,
                created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_centre_dept (research_centre_id, department_id),
                CONSTRAINT fk_rcd_centre FOREIGN KEY (research_centre_id) REFERENCES research_centres(id) ON DELETE CASCADE,
                CONSTRAINT fk_rcd_dept   FOREIGN KEY (department_id)      REFERENCES departments(id)      ON DELETE CASCADE
            )
        `);
    } catch (e) {
        console.error('research_centre_departments table check:', e.message);
    }
})();

// Registration form fields are the primary source of truth.
// Joined fields from master_institutes are surfaced as fallbacks only
// (for legacy rows that pre-date the architectural rebuild).
const SELECT_JOINED = `
    SELECT
        rc.*,
        -- Institute details: prefer direct rc columns (entered via registration form);
        -- fall back to joined master_institutes for legacy rows.
        COALESCE(rc.college_code,     inst.college_code,  rc.abbreviation) AS institute_code,
        COALESCE(rc.college_name,     inst.name)                           AS institute_name,
        COALESCE(rc.principal_name,   inst.principal_name)                 AS institute_principal,
        COALESCE(rc.principal_mobile, inst.principal_mobile)               AS institute_principal_mobile,
        COALESCE(rc.hod_email,        inst.college_email)                  AS institute_email,
        COALESCE(rc.college_phone,    inst.college_phone)                  AS institute_phone,
        inst.is_active AS institute_active,
        -- Lookup display names
        ct.name   AS centre_type_name,
        rs.name   AS subject_name,
        rcat.name AS category_name,
        dist.name AS district_name,
        dept.name AS department_name
    FROM research_centres rc
    LEFT JOIN master_centre_types        ct   ON rc.centre_type_id = ct.id
    LEFT JOIN master_research_subjects   rs   ON rc.subject_id     = rs.id
    LEFT JOIN master_research_categories rcat ON rc.category_id    = rcat.id
    LEFT JOIN master_institutes          inst ON rc.institute_id   = inst.id
    LEFT JOIN master_districts           dist ON rc.district_id    = dist.id
    LEFT JOIN departments                dept ON rc.department_id  = dept.id
`;

async function findAll({ status, search, page = 1, limit = 20 }) {
    const conditions = [];
    const vals = [];

    if (status) {
        conditions.push('rc.status = ?');
        vals.push(status);
    }
    if (search) {
        conditions.push('(rc.name LIKE ? OR rc.centre_ref_no LIKE ? OR rc.email LIKE ?)');
        const like = `%${search}%`;
        vals.push(like, like, like);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const [[{ total }]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM research_centres rc ${where}`, vals
    );
    const [rows] = await pool.execute(
        `${SELECT_JOINED} ${where} ORDER BY rc.name ASC LIMIT ${limit} OFFSET ${offset}`,
        vals
    );
    return { rows, total, page, limit };
}

async function getDepartments(centreId) {
    const [rows] = await pool.execute(
        `SELECT d.id, d.name
         FROM research_centre_departments rcd
         JOIN departments d ON rcd.department_id = d.id
         WHERE rcd.research_centre_id = ?
         ORDER BY d.name ASC`,
        [centreId]
    );
    return rows;
}

async function setDepartments(centreId, deptIds) {
    await pool.execute(
        'DELETE FROM research_centre_departments WHERE research_centre_id = ?',
        [centreId]
    );
    if (deptIds && deptIds.length > 0) {
        const values = deptIds.map(id => [centreId, id]);
        await pool.query(
            'INSERT IGNORE INTO research_centre_departments (research_centre_id, department_id) VALUES ?',
            [values]
        );
    }
}

async function findById(id) {
    const [[row]] = await pool.execute(`${SELECT_JOINED} WHERE rc.id = ?`, [id]);
    if (!row) return null;
    row.mapped_departments    = await getDepartments(id);
    row.mapped_department_ids = row.mapped_departments.map(d => d.id);
    return row;
}

async function findAllActive() {
    const [rows] = await pool.execute(
        `SELECT id, name FROM research_centres WHERE status = 'Approved' ORDER BY name ASC`
    );
    return rows;
}

async function create(data) {
    const cols = Object.keys(data);
    const placeholders = cols.map(() => '?').join(', ');
    const vals = cols.map(c => data[c]);
    const [result] = await pool.execute(
        `INSERT INTO research_centres (${cols.join(', ')}) VALUES (${placeholders})`,
        vals
    );
    return result.insertId;
}

async function update(id, data) {
    const sets = Object.keys(data).map(c => `${c} = ?`).join(', ');
    const vals = [...Object.values(data), id];
    await pool.execute(`UPDATE research_centres SET ${sets} WHERE id = ?`, vals);
}

async function updateStatus(id, { status, rejection_reason, approved_by }) {
    const sets = ['status = ?'];
    const vals = [status];

    if (rejection_reason !== undefined) { sets.push('rejection_reason = ?'); vals.push(rejection_reason); }
    if (approved_by !== undefined) { 
        sets.push('approved_by = ?'); vals.push(approved_by); 
        sets.push('approved_at = NOW()');
    }

    vals.push(id);
    await pool.execute(`UPDATE research_centres SET ${sets.join(', ')} WHERE id = ?`, vals);
}

async function remove(id) {
    const [result] = await pool.execute('DELETE FROM research_centres WHERE id = ?', [id]);
    return result.affectedRows;
}

async function isRefNoTaken(centre_ref_no, excludeId = null) {
    if (!centre_ref_no) return false;
    const q = excludeId
        ? 'SELECT id FROM research_centres WHERE centre_ref_no = ? AND id != ?'
        : 'SELECT id FROM research_centres WHERE centre_ref_no = ?';
    const params = excludeId ? [centre_ref_no, excludeId] : [centre_ref_no];
    const [[row]] = await pool.execute(q, params);
    return !!row;
}

module.exports = { findAll, findById, findAllActive, create, update, updateStatus, remove, isRefNoTaken, getDepartments, setDepartments };
