const express = require('express');
const router = express.Router();
const pool = require('../../../admin/backend/config/db');
const { verifyToken, isAdmin } = require('../../../admin/backend/middleware/auth');
const { enqueueEmail } = require('../../../shared/utils/notification');

// ── helpers ─────────────────────────────────────────────────────────────────

async function logAction({ centre_id, action, previous_status, new_status, performed_by, reason_category, custom_reason, remarks, allow_resubmission }) {
    try {
        let adminName = 'Admin';
        if (performed_by) {
            const [[admin]] = await pool.execute('SELECT name FROM admin_users WHERE id = ? LIMIT 1', [performed_by]).catch(() => [[null]]);
            if (admin?.name) adminName = admin.name;
        }
        await pool.execute(
            `INSERT INTO centre_tracking_audit_log
             (centre_id, action, previous_status, new_status, performed_by, performed_by_name, reason_category, custom_reason, remarks, allow_resubmission)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [centre_id, action, previous_status || null, new_status || null, performed_by || null, adminName, reason_category || null, custom_reason || null, remarks || null, allow_resubmission !== false ? 1 : 0]
        );
    } catch (e) {
        console.error('Centre tracking audit log error:', e.message);
    }
}

async function sendStatusEmail(centre, status, reason, remarks) {
    if (!centre?.email) return;
    try {
        const [[user]] = await pool.execute('SELECT id FROM center_users WHERE email = ? LIMIT 1', [centre.email]).catch(() => [[null]]);
        let subject, title, message;
        if (status === 'Approved') {
            subject = 'Research Centre Application Approved';
            title = 'Congratulations! Application Approved';
            message = `Your Research Centre application has been <b>Approved</b>. You may now log in to your portal and proceed.`;
        } else if (status === 'Rejected') {
            subject = 'Research Centre Application Rejected';
            title = 'Application Update';
            message = `Your Research Centre application has been <b>Rejected</b>.${reason ? `<br><br><b>Reason:</b> ${reason}` : ''}${remarks ? `<br><b>Remarks:</b> ${remarks}` : ''}`;
        } else if (status === 'Suspended') {
            subject = 'Research Centre Account Suspended';
            title = 'Account Suspended';
            message = `Your Research Centre account has been <b>Suspended</b>.${reason ? `<br><br><b>Reason:</b> ${reason}` : ''} Please contact the university administration.`;
        }
        if (subject) {
            await enqueueEmail(pool, {
                to_email: centre.email, subject, title, message,
                user_id: user?.id || null, target_type: 'center',
                type: status === 'Approved' ? 'success' : (status === 'Rejected' || status === 'Suspended' ? 'error' : 'info')
            });
        }
    } catch (e) {
        console.error('Centre status email error:', e.message);
    }
}

// ── static sub-routes (must be before /:id param routes) ───────────────────

// GET /api/centre-tracking/filter-options
router.get('/filter-options', verifyToken, isAdmin, async (req, res) => {
    try {
        const [institutes] = await pool.execute('SELECT id, college_code, name FROM master_institutes WHERE is_active = 1 ORDER BY college_code ASC');
        const [universityInstitutes] = await pool.execute('SELECT id, institute_code, institute_name AS name FROM institutes WHERE status = \'Active\' ORDER BY institute_name ASC');
        const [centreTypes] = await pool.execute('SELECT id, name FROM master_centre_types WHERE is_active = 1 ORDER BY name ASC');
        res.json({ success: true, data: { institutes, universityInstitutes, centreTypes } });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── counters ────────────────────────────────────────────────────────────────

// GET /api/centre-tracking/counters
router.get('/counters', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT
                COUNT(*) AS total,
                SUM(status = 'Pending')   AS pending,
                SUM(status = 'Approved')  AS approved,
                SUM(status = 'Rejected')  AS rejected,
                SUM(status = 'Suspended') AS suspended,
                SUM(status = 'Inactive')  AS inactive,
                SUM(status = 'Draft')     AS draft
            FROM research_centres
        `);
        res.json({ success: true, data: rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// GET /api/centre-tracking  — paginated list with filters
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const { status, search, institute_id, university_institute_id, centre_type_id, date_from, date_to, page = 1, limit = 20 } = req.query;
        const conditions = [];
        const vals = [];

        if (status) { conditions.push('rc.status = ?'); vals.push(status); }
        if (search) {
            conditions.push('(rc.name LIKE ? OR rc.centre_ref_no LIKE ? OR rc.email LIKE ? OR rc.id LIKE ?)');
            const like = `%${search}%`;
            vals.push(like, like, like, like);
        }
        if (institute_id) { conditions.push('rc.institute_id = ?'); vals.push(parseInt(institute_id)); }
        if (university_institute_id) { conditions.push('rc.university_institute_id = ?'); vals.push(parseInt(university_institute_id)); }
        if (centre_type_id) { conditions.push('rc.centre_type_id = ?'); vals.push(parseInt(centre_type_id)); }
        if (date_from) { conditions.push('DATE(rc.created_at) >= ?'); vals.push(date_from); }
        if (date_to) { conditions.push('DATE(rc.created_at) <= ?'); vals.push(date_to); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM research_centres rc ${where}`, vals);
        const [rows] = await pool.execute(`
            SELECT rc.id, rc.centre_ref_no, rc.name AS centre_name, rc.email, rc.status,
                   rc.rejection_reason, rc.approved_by, rc.approved_at, rc.created_at, rc.remark,
                   ct.name AS centre_type_name,
                   inst.name AS institute_name, inst.college_code AS institute_code,
                   ui.institute_name AS university_institute_name, ui.institute_code AS university_institute_code
            FROM research_centres rc
            LEFT JOIN master_centre_types ct   ON rc.centre_type_id          = ct.id
            LEFT JOIN master_institutes   inst  ON rc.institute_id             = inst.id
            LEFT JOIN institutes          ui    ON rc.university_institute_id  = ui.id
            ${where}
            ORDER BY rc.created_at DESC
            LIMIT ${parseInt(limit)} OFFSET ${offset}
        `, vals);

        res.json({ success: true, data: { rows, total, page: parseInt(page), limit: parseInt(limit) } });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// GET /api/centre-tracking/:id
router.get('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[row]] = await pool.execute(`
            SELECT rc.*,
                   ct.name AS centre_type_name,
                   rs.name AS subject_name,
                   ui.institute_name AS university_institute_name, ui.institute_code AS university_institute_code,
                   rcat.name AS category_name,
                   inst.name AS institute_name, inst.college_code AS institute_code,
                   dist.name AS district_name
            FROM research_centres rc
            LEFT JOIN master_centre_types        ct   ON rc.centre_type_id = ct.id
            LEFT JOIN master_research_subjects   rs   ON rc.subject_id = rs.id
            LEFT JOIN master_research_categories rcat ON rc.category_id = rcat.id
            LEFT JOIN master_institutes          inst ON rc.institute_id            = inst.id
            LEFT JOIN institutes                 ui   ON rc.university_institute_id = ui.id
            LEFT JOIN master_districts           dist ON rc.district_id             = dist.id
            WHERE rc.id = ?
        `, [req.params.id]);
        if (!row) return res.status(404).json({ success: false, message: 'Research centre not found' });
        const [depts] = await pool.execute(
            `SELECT d.id, d.name
             FROM research_centre_departments rcd
             JOIN departments d ON rcd.department_id = d.id
             WHERE rcd.research_centre_id = ?
             ORDER BY d.name ASC`,
            [req.params.id]
        );
        row.mapped_departments    = depts;
        row.mapped_department_ids = depts.map(d => d.id);
        res.json({ success: true, data: row });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// GET /api/centre-tracking/:id/history
router.get('/:id/history', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT * FROM centre_tracking_audit_log
            WHERE centre_id = ?
            ORDER BY created_at DESC
        `, [req.params.id]);
        res.json({ success: true, data: rows });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── action endpoints ─────────────────────────────────────────────────────────

// ── Institute Master sync ─────────────────────────────────────────────────────
// Called on every approval. UPSERTs master_institutes using the registration
// form data as the single source of truth.  Uses college_code as the natural
// key so the same college is never duplicated across multiple approvals.
async function syncInstituteMaster(rc) {
    try {
        if (!rc.college_code && !rc.college_name) return null;

        const code  = (rc.college_code  || '').trim().toUpperCase() || null;
        const name  = (rc.college_name  || rc.name || '').trim()    || null;
        if (!name) return null;

        // Try to find an existing institute row by college_code first, then by name
        let existId = null;
        if (code) {
            const [[byCode]] = await pool.execute(
                'SELECT id FROM master_institutes WHERE college_code = ? LIMIT 1', [code]
            );
            if (byCode) existId = byCode.id;
        }
        if (!existId) {
            const [[byName]] = await pool.execute(
                'SELECT id FROM master_institutes WHERE LOWER(TRIM(name)) = LOWER(?) LIMIT 1', [name]
            );
            if (byName) existId = byName.id;
        }

        if (existId) {
            // Update existing row — registration data wins
            await pool.execute(
                `UPDATE master_institutes SET
                    name = ?, college_code = ?, abbreviation = ?,
                    college_name = ?, principal_name = ?, principal_mobile = ?,
                    college_email = ?, college_phone = ?,
                    source_centre_id = ?, is_active = 1
                 WHERE id = ?`,
                [
                    name, code, code,
                    name,
                    rc.principal_name   || null,
                    rc.principal_mobile || null,
                    rc.hod_email        || null,
                    rc.college_phone    || null,
                    rc.id,
                    existId,
                ]
            );
            // Keep research_centres.institute_id in sync
            await pool.execute(
                'UPDATE research_centres SET institute_id = ? WHERE id = ?',
                [existId, rc.id]
            );
            return existId;
        } else {
            // Insert new institute row from registration data
            const [result] = await pool.execute(
                `INSERT INTO master_institutes
                    (name, college_code, abbreviation, college_name,
                     principal_name, principal_mobile, college_email, college_phone,
                     source_centre_id, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [
                    name, code, code, name,
                    rc.principal_name   || null,
                    rc.principal_mobile || null,
                    rc.hod_email        || null,
                    rc.college_phone    || null,
                    rc.id,
                ]
            );
            await pool.execute(
                'UPDATE research_centres SET institute_id = ? WHERE id = ?',
                [result.insertId, rc.id]
            );
            return result.insertId;
        }
    } catch (e) {
        console.error('Institute Master sync error:', e.message);
        return null;
    }
}

// PATCH /api/centre-tracking/:id/approve
router.patch('/:id/approve', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[rc]] = await pool.execute(
            `SELECT id, email, status, name,
                    college_code, college_name, principal_name, principal_mobile,
                    hod_email, college_phone
             FROM research_centres WHERE id = ?`,
            [req.params.id]
        );
        if (!rc) return res.status(404).json({ success: false, message: 'Research centre not found' });

        const prev = rc.status;
        await pool.execute(
            'UPDATE research_centres SET status = ?, approved_by = ?, approved_at = NOW(), rejection_reason = NULL WHERE id = ?',
            ['Approved', req.user.id, req.params.id]
        );

        // Auto-sync Institute Master from registration data (single source of truth)
        await syncInstituteMaster(rc);

        await logAction({ centre_id: rc.id, action: 'Approved', previous_status: prev, new_status: 'Approved', performed_by: req.user.id });
        await sendStatusEmail(rc, 'Approved');

        const [[updated]] = await pool.execute('SELECT id, name, status, email, approved_at FROM research_centres WHERE id = ?', [req.params.id]);
        res.json({ success: true, data: updated });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// PATCH /api/centre-tracking/:id/reject
router.patch('/:id/reject', verifyToken, isAdmin, async (req, res) => {
    try {
        const { reason_category, custom_reason, remarks, allow_resubmission } = req.body;
        if (!reason_category && !custom_reason) {
            return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
        }
        const fullReason = [reason_category, custom_reason].filter(Boolean).join(' — ');

        const [[rc]] = await pool.execute('SELECT id, email, status, name FROM research_centres WHERE id = ?', [req.params.id]);
        if (!rc) return res.status(404).json({ success: false, message: 'Research centre not found' });

        const prev = rc.status;
        await pool.execute(
            'UPDATE research_centres SET status = ?, rejection_reason = ?, approved_by = ?, approved_at = NOW() WHERE id = ?',
            ['Rejected', fullReason, req.user.id, req.params.id]
        );
        await logAction({ centre_id: rc.id, action: 'Rejected', previous_status: prev, new_status: 'Rejected', performed_by: req.user.id, reason_category, custom_reason, remarks, allow_resubmission });
        await sendStatusEmail(rc, 'Rejected', fullReason, remarks);

        const [[updated]] = await pool.execute('SELECT id, name, status, email, rejection_reason, approved_at FROM research_centres WHERE id = ?', [req.params.id]);
        res.json({ success: true, data: updated });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// PATCH /api/centre-tracking/:id/suspend
router.patch('/:id/suspend', verifyToken, isAdmin, async (req, res) => {
    try {
        const { reason_category, custom_reason, remarks } = req.body;
        const fullReason = [reason_category, custom_reason].filter(Boolean).join(' — ') || null;

        const [[rc]] = await pool.execute('SELECT id, email, status, name FROM research_centres WHERE id = ?', [req.params.id]);
        if (!rc) return res.status(404).json({ success: false, message: 'Research centre not found' });

        const prev = rc.status;
        await pool.execute(
            'UPDATE research_centres SET status = ?, rejection_reason = ? WHERE id = ?',
            ['Suspended', fullReason, req.params.id]
        );
        await logAction({ centre_id: rc.id, action: 'Suspended', previous_status: prev, new_status: 'Suspended', performed_by: req.user.id, reason_category, custom_reason, remarks });
        await sendStatusEmail(rc, 'Suspended', fullReason, remarks);

        const [[updated]] = await pool.execute('SELECT id, name, status, email FROM research_centres WHERE id = ?', [req.params.id]);
        res.json({ success: true, data: updated });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// PATCH /api/centre-tracking/:id/reactivate
router.patch('/:id/reactivate', verifyToken, isAdmin, async (req, res) => {
    try {
        const { remarks } = req.body;
        const [[rc]] = await pool.execute('SELECT id, email, status, name FROM research_centres WHERE id = ?', [req.params.id]);
        if (!rc) return res.status(404).json({ success: false, message: 'Research centre not found' });

        const prev = rc.status;
        await pool.execute(
            'UPDATE research_centres SET status = ?, rejection_reason = NULL WHERE id = ?',
            ['Approved', req.params.id]
        );
        await logAction({ centre_id: rc.id, action: 'Reactivated', previous_status: prev, new_status: 'Approved', performed_by: req.user.id, remarks });

        const [[updated]] = await pool.execute('SELECT id, name, status, email FROM research_centres WHERE id = ?', [req.params.id]);
        res.json({ success: true, data: updated });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
