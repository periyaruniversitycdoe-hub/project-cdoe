const svc = require('../services/centreService');

const wrap = fn => async (req, res) => {
    try { res.json({ success: true, data: await fn(req, res) }); }
    catch (e) { res.status(e.status || 500).json({ success: false, message: e.message }); }
};

const list = wrap(req => svc.list({
    status: req.query.status,
    search: req.query.search,
    page:   parseInt(req.query.page)  || 1,
    limit:  parseInt(req.query.limit) || 20,
}));

const get  = wrap(req => svc.get(req.params.id));

const create = wrap(req => svc.create(req.body, req.files));
const update = wrap(req => svc.update(req.params.id, req.body, req.files));

const updateStatus = wrap(req => svc.updateStatus(req.params.id, { 
    ...req.body, 
    approved_by: req.user.id 
}));

const remove = wrap(async req => {
    await svc.remove(req.params.id);
    return null;
});

const toggleInstituteActive = wrap(async req => {
    const pool = require('../config/db');
    const [[rc]] = await pool.execute(
        'SELECT id, institute_id, college_code, college_name, principal_name, principal_mobile, hod_email, college_phone FROM research_centres WHERE id = ?',
        [req.params.id]
    );
    if (!rc) throw Object.assign(new Error('Research centre not found'), { status: 404 });

    let instituteId = rc.institute_id;

    if (!instituteId) {
        // Try to find existing institute by college_code
        const [[existing]] = await pool.execute(
            'SELECT id FROM master_institutes WHERE college_code = ? LIMIT 1',
            [rc.college_code || '']
        );
        if (existing) {
            instituteId = existing.id;
        } else {
            // Create a new master_institutes record
            const [ins] = await pool.execute(
                `INSERT INTO master_institutes (college_code, name, principal_name, principal_mobile, college_email, college_phone, is_active, source_centre_id)
                 VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
                [rc.college_code || '', rc.college_name || '', rc.principal_name || '', rc.principal_mobile || '', rc.hod_email || '', rc.college_phone || '', rc.id]
            );
            instituteId = ins.insertId;
        }
        // Link the institute to this research centre
        await pool.execute('UPDATE research_centres SET institute_id = ? WHERE id = ?', [instituteId, rc.id]);
    }

    // Toggle is_active
    await pool.execute('UPDATE master_institutes SET is_active = NOT is_active WHERE id = ?', [instituteId]);
    const [[inst]] = await pool.execute('SELECT is_active FROM master_institutes WHERE id = ?', [instituteId]);
    return { institute_id: instituteId, is_active: !!inst.is_active };
});

// Returns approved centres filtered by university_institute_id (no auth required — used in supervisor form)
const listByInstitute = wrap(async req => {
    const pool = require('../config/db');
    const instituteId = parseInt(req.params.institute_id);
    if (!instituteId) return [];
    const [rows] = await pool.execute(
        `SELECT id, name, centre_ref_no, centre_type_id, district_id
         FROM   research_centres
         WHERE  university_institute_id = ? AND status = 'Approved'
         ORDER  BY name ASC`,
        [instituteId]
    );
    return rows;
});

module.exports = { list, get, create, update, updateStatus, remove, toggleInstituteActive, listByInstitute };
