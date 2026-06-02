const pool = require('../../../admin/backend/config/db');

const SELECT_JOINED = `
    SELECT
        s.*,
        d.max_capacity AS designation_max_capacity,
        d.name  AS designation_name,
        dept.name AS department_name,
        inst.name        AS serving_institute_name,
        inst.college_code AS serving_institute_code,
        dist.name AS district_name
    FROM supervisors s
    LEFT JOIN master_designations        d    ON s.designation_id         = d.id
    LEFT JOIN master_departments          dept ON s.department_id            = dept.id
    LEFT JOIN master_institutes           inst ON s.serving_institute_id     = inst.id
    LEFT JOIN master_districts            dist ON s.district_id              = dist.id
`;

function enrichCapacity(row) {
    if (!row) return row;
    if (row.designation_id && row.designation_max_capacity !== undefined && row.designation_max_capacity !== null) {
        row.max_candidates = row.designation_max_capacity;
        row.current_vacancy = Math.max(0, row.max_candidates - (row.current_scholars_count || 0));
        row.max_full_time = row.max_candidates;
        row.max_part_time = Math.floor(row.max_candidates / 2);
    }
    return row;
}

async function findAll({ status, search, page = 1, limit = 20, institute_id, department_id, designation_id }) {
    const conditions = [];
    const vals = [];

    if (status)        { conditions.push('s.status = ?');               vals.push(status); }
    if (search) {
        conditions.push('(s.name LIKE ? OR s.email LIKE ? OR s.mobile LIKE ? OR s.supervisor_no LIKE ?)');
        const like = `%${search}%`;
        vals.push(like, like, like, like);
    }
    if (institute_id)   { conditions.push('s.serving_institute_id = ?'); vals.push(parseInt(institute_id)); }
    if (department_id)  { conditions.push('s.department_id = ?');        vals.push(parseInt(department_id)); }
    if (designation_id) { conditions.push('s.designation_id = ?');       vals.push(parseInt(designation_id)); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const [[{ total }]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM supervisors s ${where}`, vals
    );
    const [rows] = await pool.execute(
        `${SELECT_JOINED} ${where} ORDER BY s.name ASC LIMIT ${limit} OFFSET ${offset}`,
        vals
    );
    return { rows: rows.map(enrichCapacity), total, page, limit };
}

async function getFilterOptions() {
    const [institutes] = await pool.execute(
        `SELECT id, college_code, name
         FROM   master_institutes
         WHERE  is_active = 1
         ORDER  BY college_code ASC`
    );
    const [departments] = await pool.execute(
        `SELECT DISTINCT d.id, d.name
         FROM   master_departments d
         INNER  JOIN supervisors s ON s.department_id = d.id
         ORDER  BY d.name ASC`
    );
    const [designations] = await pool.execute(
        `SELECT id, name
         FROM   master_designations
         WHERE  is_active = 1
         ORDER  BY name ASC`
    );
    return { institutes, departments, designations };
}

async function findById(id) {
    const [[row]] = await pool.execute(`${SELECT_JOINED} WHERE s.id = ?`, [id]);
    return enrichCapacity(row);
}

async function getDisciplines(supervisorId) {
    const [rows] = await pool.execute(
        `SELECT sd.*, d.name AS discipline_name, rc.name AS centre_name
         FROM supervisor_disciplines sd
         LEFT JOIN master_disciplines d  ON sd.discipline_id = d.id
         LEFT JOIN research_centres   rc ON sd.centre_id     = rc.id
         WHERE sd.supervisor_id = ?
         ORDER BY sd.type ASC, sd.sort_order ASC`,
        [supervisorId]
    );
    return rows;
}

async function create(data) {
    const cols = Object.keys(data);
    const placeholders = cols.map(() => '?').join(', ');
    const vals = cols.map(c => data[c]);
    const [result] = await pool.execute(
        `INSERT INTO supervisors (${cols.join(', ')}) VALUES (${placeholders})`,
        vals
    );
    return result.insertId;
}

async function update(id, data) {
    const sets = Object.keys(data).map(c => `${c} = ?`).join(', ');
    const vals = [...Object.values(data), id];
    await pool.execute(`UPDATE supervisors SET ${sets} WHERE id = ?`, vals);
}

async function upsertDisciplines(supervisorId, disciplines, connection) {
    const conn = connection || pool;
    await conn.execute('DELETE FROM supervisor_disciplines WHERE supervisor_id = ?', [supervisorId]);
    for (let i = 0; i < disciplines.length; i++) {
        const { type, discipline_id, centre_id, recognition_date } = disciplines[i];
        await conn.execute(
            `INSERT INTO supervisor_disciplines (supervisor_id, type, discipline_id, centre_id, recognition_date, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [supervisorId, type || 'Primary', discipline_id || null, centre_id || null, recognition_date || null, i]
        );
    }
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
    await pool.execute(`UPDATE supervisors SET ${sets.join(', ')} WHERE id = ?`, vals);
}

async function remove(id) {
    const [result] = await pool.execute('DELETE FROM supervisors WHERE id = ?', [id]);
    return result.affectedRows;
}

async function removeAll() {
    const [result] = await pool.query('DELETE FROM supervisors');
    return result.affectedRows;
}

async function isEmailTaken(email, excludeId = null) {
    const q = excludeId
        ? 'SELECT id FROM supervisors WHERE email = ? AND id != ?'
        : 'SELECT id FROM supervisors WHERE email = ?';
    const params = excludeId ? [email, excludeId] : [email];
    const [[row]] = await pool.execute(q, params);
    return !!row;
}

module.exports = { findAll, findById, getDisciplines, create, update, upsertDisciplines, updateStatus, remove, removeAll, isEmailTaken, getFilterOptions };
