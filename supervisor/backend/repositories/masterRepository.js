const pool = require('../../../admin/backend/config/db');

const MASTER_TABLES = {
    designations:         { table: 'master_designations',         hasAbbrev: false },
    special_designations: { table: 'master_special_designations', hasAbbrev: false },
    departments:          { table: 'master_departments',          hasAbbrev: false },
    institutes:           { table: 'master_institutes',           hasAbbrev: true  },
    districts:            { table: 'master_districts',            hasAbbrev: false },
    centre_types:         { table: 'master_centre_types',         hasAbbrev: false },
    research_subjects:    { table: 'master_research_subjects',    hasAbbrev: false },
    research_categories:  { table: 'master_research_categories',  hasAbbrev: false },
    disciplines:          { table: 'master_disciplines',          hasAbbrev: false },
};

function getConfig(type) {
    const cfg = MASTER_TABLES[type];
    if (!cfg) throw Object.assign(new Error(`Invalid master type: ${type}`), { status: 400 });
    return cfg;
}

async function findAll(type, activeOnly = false) {
    const { table } = getConfig(type);
    const where = activeOnly ? 'WHERE is_active = 1' : '';
    const [rows] = await pool.execute(
        `SELECT * FROM ${table} ${where} ORDER BY name ASC`
    );
    return rows;
}

async function findById(type, id) {
    const { table } = getConfig(type);
    const [[row]] = await pool.execute(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    return row || null;
}

async function create(type, { name, abbreviation, max_capacity }) {
    const { table, hasAbbrev } = getConfig(type);
    if (type === 'designations') {
        const [result] = await pool.execute(
            `INSERT INTO ${table} (name, max_capacity) VALUES (?, ?)`,
            [name, max_capacity || 0]
        );
        return result.insertId;
    }
    if (hasAbbrev) {
        const [result] = await pool.execute(
            `INSERT INTO ${table} (name, abbreviation) VALUES (?, ?)`,
            [name, abbreviation || null]
        );
        return result.insertId;
    }
    const [result] = await pool.execute(
        `INSERT INTO ${table} (name) VALUES (?)`, [name]
    );
    return result.insertId;
}

async function update(type, id, { name, abbreviation, max_capacity, is_active }) {
    const { table, hasAbbrev } = getConfig(type);
    const sets = ['name = ?', 'is_active = ?'];
    const vals = [name, is_active ?? 1];
    if (type === 'designations') {
        sets.push('max_capacity = ?');
        vals.push(max_capacity || 0);
    } else if (hasAbbrev) {
        sets.push('abbreviation = ?');
        vals.push(abbreviation || null);
    }
    vals.push(id);
    await pool.execute(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`, vals);
}

async function toggleActive(type, id, is_active) {
    const { table } = getConfig(type);
    await pool.execute(`UPDATE ${table} SET is_active = ? WHERE id = ?`, [is_active, id]);
}

async function remove(type, id) {
    const { table } = getConfig(type);
    const [result] = await pool.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
    return result.affectedRows;
}

async function logDesignationAudit(designationId, designationName, action, fieldChanged, oldValue, newValue, adminUser) {
    await pool.execute(
        `INSERT INTO supervisor_designation_audit_logs 
         (designation_id, designation_name, action, field_changed, old_value, new_value, admin_user)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            designationId,
            designationName,
            action,
            fieldChanged,
            oldValue !== null && oldValue !== undefined ? String(oldValue) : null,
            newValue !== null && newValue !== undefined ? String(newValue) : null,
            adminUser || 'admin'
        ]
    );
}

module.exports = { findAll, findById, create, update, toggleActive, remove, logDesignationAudit, MASTER_TABLES };
