const pool = require('../../../admin/backend/config/db');

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
        dist.name AS district_name
    FROM research_centres rc
    LEFT JOIN master_centre_types        ct   ON rc.centre_type_id = ct.id
    LEFT JOIN master_research_subjects   rs   ON rc.subject_id     = rs.id
    LEFT JOIN master_research_categories rcat ON rc.category_id    = rcat.id
    LEFT JOIN master_institutes          inst ON rc.institute_id   = inst.id
    LEFT JOIN master_districts           dist ON rc.district_id    = dist.id
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

async function findById(id) {
    const [[row]] = await pool.execute(`${SELECT_JOINED} WHERE rc.id = ?`, [id]);
    return row || null;
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

module.exports = { findAll, findById, findAllActive, create, update, updateStatus, remove, isRefNoTaken };
