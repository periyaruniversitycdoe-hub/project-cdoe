const express = require('express');
const router = express.Router();
const pool = require('../../../admin/backend/config/db');
const { verifyToken, isAdmin } = require('../../../admin/backend/middleware/auth');
const { enqueueEmail } = require('../../../shared/utils/notification');

// ── helpers ─────────────────────────────────────────────────────────────────

async function logAction({ supervisor_id, action, previous_status, new_status, performed_by, reason_category, custom_reason, remarks, allow_resubmission }) {
    try {
        let adminName = 'Admin';
        if (performed_by) {
            const [[admin]] = await pool.execute('SELECT name FROM admin_users WHERE id = ? LIMIT 1', [performed_by]).catch(() => [[null]]);
            if (admin?.name) adminName = admin.name;
        }
        await pool.execute(
            `INSERT INTO supervisor_tracking_audit_log
             (supervisor_id, action, previous_status, new_status, performed_by, performed_by_name, reason_category, custom_reason, remarks, allow_resubmission)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [supervisor_id, action, previous_status || null, new_status || null, performed_by || null, adminName, reason_category || null, custom_reason || null, remarks || null, allow_resubmission !== false ? 1 : 0]
        );
    } catch (e) {
        console.error('Supervisor tracking audit log error:', e.message);
    }
}

async function sendStatusEmail(supervisor, status, reason, remarks) {
    if (!supervisor?.email) return;
    try {
        const [[user]] = await pool.execute('SELECT id FROM supervisor_users WHERE email = ? LIMIT 1', [supervisor.email]).catch(() => [[null]]);
        let subject, title, message;
        if (status === 'Approved') {
            subject = 'Supervisor Application Approved';
            title = 'Congratulations! Application Approved';
            message = `Your PhD Supervisor application has been <b>Approved</b>. You may now log in to your portal and proceed with your profile.`;
        } else if (status === 'Rejected') {
            subject = 'Supervisor Application Rejected';
            title = 'Application Update';
            message = `Your PhD Supervisor application has been <b>Rejected</b>.${reason ? `<br><br><b>Reason:</b> ${reason}` : ''}${remarks ? `<br><b>Remarks:</b> ${remarks}` : ''}`;
        } else if (status === 'Suspended') {
            subject = 'Supervisor Account Suspended';
            title = 'Account Suspended';
            message = `Your PhD Supervisor account has been <b>Suspended</b>.${reason ? `<br><br><b>Reason:</b> ${reason}` : ''} Please contact the university administration.`;
        } else if (status === 'Active' || status === 'Approved') {
            subject = 'Supervisor Account Reactivated';
            title = 'Account Reactivated';
            message = `Your PhD Supervisor account has been <b>Reactivated</b>. You may now log in to your portal.`;
        }
        if (subject) {
            await enqueueEmail(pool, {
                to_email: supervisor.email, subject, title, message,
                user_id: user?.id || null, target_type: 'supervisor',
                type: status === 'Approved' ? 'success' : (status === 'Rejected' || status === 'Suspended' ? 'error' : 'info')
            });
        }
    } catch (e) {
        console.error('Supervisor status email error:', e.message);
    }
}

// ── static sub-routes (must be before /:id param routes) ───────────────────

// GET /api/supervisor-tracking/filter-options
router.get('/filter-options', verifyToken, isAdmin, async (req, res) => {
    try {
        const [institutes] = await pool.execute('SELECT id, college_code, name FROM master_institutes WHERE is_active = 1 ORDER BY college_code ASC');
        const [universityInstitutes] = await pool.execute('SELECT id, institute_code, institute_name AS name FROM institutes WHERE status = \'Active\' ORDER BY institute_name ASC');
        const [departments] = await pool.execute('SELECT DISTINCT d.id, d.name FROM departments d INNER JOIN supervisors s ON s.department_id = d.id ORDER BY d.name ASC');
        const [designations] = await pool.execute('SELECT id, name FROM master_designations WHERE is_active = 1 ORDER BY name ASC');
        res.json({ success: true, data: { institutes, universityInstitutes, departments, designations } });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── list with filters + counters ────────────────────────────────────────────

// GET /api/supervisor-tracking/counters
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
            FROM supervisors
        `);
        res.json({ success: true, data: rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// GET /api/supervisor-tracking  — paginated list with filters
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const { status, search, institute_id, university_institute_id, department_id, designation_id, date_from, date_to, page = 1, limit = 20 } = req.query;
        const conditions = [];
        const vals = [];

        if (status) { conditions.push('s.status = ?'); vals.push(status); }
        if (search) {
            conditions.push('(s.name LIKE ? OR s.email LIKE ? OR s.mobile LIKE ? OR s.supervisor_no LIKE ? OR s.id LIKE ?)');
            const like = `%${search}%`;
            vals.push(like, like, like, like, like);
        }
        if (institute_id) { conditions.push('s.serving_institute_id = ?'); vals.push(parseInt(institute_id)); }
        if (university_institute_id) { conditions.push('s.university_institute_id = ?'); vals.push(parseInt(university_institute_id)); }
        if (department_id) { conditions.push('s.department_id = ?'); vals.push(parseInt(department_id)); }
        if (designation_id) { conditions.push('s.designation_id = ?'); vals.push(parseInt(designation_id)); }
        if (date_from) { conditions.push('DATE(s.created_at) >= ?'); vals.push(date_from); }
        if (date_to) { conditions.push('DATE(s.created_at) <= ?'); vals.push(date_to); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM supervisors s ${where}`, vals);
        const [rows] = await pool.execute(`
            SELECT s.id, s.supervisor_no, s.name, s.email, s.mobile, s.status,
                   s.rejection_reason, s.approved_by, s.approved_at, s.created_at, s.remarks,
                   d.name AS designation_name, dept.name AS department_name,
                   inst.name AS institute_name, inst.college_code AS institute_code,
                   ui.institute_name AS university_institute_name, ui.institute_code AS university_institute_code,
                   rc.name AS research_center_name, rc.centre_ref_no AS research_center_ref_no
            FROM supervisors s
            LEFT JOIN master_designations d    ON s.designation_id          = d.id
            LEFT JOIN departments dept  ON s.department_id            = dept.id
            LEFT JOIN master_institutes inst   ON s.serving_institute_id     = inst.id
            LEFT JOIN institutes          ui   ON s.university_institute_id  = ui.id
            LEFT JOIN research_centres    rc   ON s.research_center_id       = rc.id
            ${where}
            ORDER BY s.created_at DESC
            LIMIT ${parseInt(limit)} OFFSET ${offset}
        `, vals);

        res.json({ success: true, data: { rows, total, page: parseInt(page), limit: parseInt(limit) } });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// GET /api/supervisor-tracking/:id
router.get('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[row]] = await pool.execute(`
            SELECT s.*,
                   d.name AS designation_name,
                   dept.name AS department_name,
                   inst.name AS institute_name, inst.college_code AS institute_code,
                   dist.name AS district_name,
                   ui.institute_name AS university_institute_name, ui.institute_code AS university_institute_code,
                   rc.name AS research_center_name, rc.centre_ref_no AS research_center_ref_no
            FROM supervisors s
            LEFT JOIN master_designations d    ON s.designation_id          = d.id
            LEFT JOIN departments dept  ON s.department_id            = dept.id
            LEFT JOIN master_institutes inst   ON s.serving_institute_id     = inst.id
            LEFT JOIN master_districts dist    ON s.district_id              = dist.id
            LEFT JOIN institutes          ui   ON s.university_institute_id  = ui.id
            LEFT JOIN research_centres    rc   ON s.research_center_id       = rc.id
            WHERE s.id = ?
        `, [req.params.id]);
        if (!row) return res.status(404).json({ success: false, message: 'Supervisor not found' });

        const [disciplines] = await pool.execute(`
            SELECT sd.*, md.name AS discipline_name, rc.name AS centre_name
            FROM supervisor_disciplines sd
            LEFT JOIN master_disciplines md ON sd.discipline_id = md.id
            LEFT JOIN research_centres rc   ON sd.centre_id = rc.id
            WHERE sd.supervisor_id = ?
            ORDER BY sd.type ASC, sd.sort_order ASC
        `, [req.params.id]);

        res.json({ success: true, data: { ...row, disciplines } });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// GET /api/supervisor-tracking/:id/history
router.get('/:id/history', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT * FROM supervisor_tracking_audit_log
            WHERE supervisor_id = ?
            ORDER BY created_at DESC
        `, [req.params.id]);
        res.json({ success: true, data: rows });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── action endpoints ─────────────────────────────────────────────────────────

// PATCH /api/supervisor-tracking/:id/approve
router.patch('/:id/approve', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[sv]] = await pool.execute('SELECT id, email, status, name FROM supervisors WHERE id = ?', [req.params.id]);
        if (!sv) return res.status(404).json({ success: false, message: 'Supervisor not found' });

        const prev = sv.status;
        await pool.execute(
            'UPDATE supervisors SET status = ?, approved_by = ?, approved_at = NOW(), rejection_reason = NULL WHERE id = ?',
            ['Approved', req.user.id, req.params.id]
        );
        await logAction({ supervisor_id: sv.id, action: 'Approved', previous_status: prev, new_status: 'Approved', performed_by: req.user.id });
        await sendStatusEmail(sv, 'Approved');

        const [[updated]] = await pool.execute('SELECT id, name, status, email, approved_at FROM supervisors WHERE id = ?', [req.params.id]);
        res.json({ success: true, data: updated });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// PATCH /api/supervisor-tracking/:id/reject
router.patch('/:id/reject', verifyToken, isAdmin, async (req, res) => {
    try {
        const { reason_category, custom_reason, remarks, allow_resubmission } = req.body;
        if (!reason_category && !custom_reason) {
            return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
        }
        const fullReason = [reason_category, custom_reason].filter(Boolean).join(' — ');

        const [[sv]] = await pool.execute('SELECT id, email, status, name FROM supervisors WHERE id = ?', [req.params.id]);
        if (!sv) return res.status(404).json({ success: false, message: 'Supervisor not found' });

        const prev = sv.status;
        await pool.execute(
            'UPDATE supervisors SET status = ?, rejection_reason = ?, approved_by = ?, approved_at = NOW() WHERE id = ?',
            ['Rejected', fullReason, req.user.id, req.params.id]
        );
        await logAction({ supervisor_id: sv.id, action: 'Rejected', previous_status: prev, new_status: 'Rejected', performed_by: req.user.id, reason_category, custom_reason, remarks, allow_resubmission });
        await sendStatusEmail(sv, 'Rejected', fullReason, remarks);

        const [[updated]] = await pool.execute('SELECT id, name, status, email, rejection_reason, approved_at FROM supervisors WHERE id = ?', [req.params.id]);
        res.json({ success: true, data: updated });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// PATCH /api/supervisor-tracking/:id/suspend
router.patch('/:id/suspend', verifyToken, isAdmin, async (req, res) => {
    try {
        const { reason_category, custom_reason, remarks } = req.body;
        const fullReason = [reason_category, custom_reason].filter(Boolean).join(' — ') || null;

        const [[sv]] = await pool.execute('SELECT id, email, status, name FROM supervisors WHERE id = ?', [req.params.id]);
        if (!sv) return res.status(404).json({ success: false, message: 'Supervisor not found' });

        const prev = sv.status;
        await pool.execute(
            'UPDATE supervisors SET status = ?, rejection_reason = ? WHERE id = ?',
            ['Suspended', fullReason, req.params.id]
        );
        await logAction({ supervisor_id: sv.id, action: 'Suspended', previous_status: prev, new_status: 'Suspended', performed_by: req.user.id, reason_category, custom_reason, remarks });
        await sendStatusEmail(sv, 'Suspended', fullReason, remarks);

        const [[updated]] = await pool.execute('SELECT id, name, status, email FROM supervisors WHERE id = ?', [req.params.id]);
        res.json({ success: true, data: updated });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// PATCH /api/supervisor-tracking/:id/reactivate
router.patch('/:id/reactivate', verifyToken, isAdmin, async (req, res) => {
    try {
        const { remarks } = req.body;
        const [[sv]] = await pool.execute('SELECT id, email, status, name FROM supervisors WHERE id = ?', [req.params.id]);
        if (!sv) return res.status(404).json({ success: false, message: 'Supervisor not found' });

        const prev = sv.status;
        await pool.execute(
            'UPDATE supervisors SET status = ?, rejection_reason = NULL WHERE id = ?',
            ['Approved', req.params.id]
        );
        await logAction({ supervisor_id: sv.id, action: 'Reactivated', previous_status: prev, new_status: 'Approved', performed_by: req.user.id, remarks });

        const [[updated]] = await pool.execute('SELECT id, name, status, email FROM supervisors WHERE id = ?', [req.params.id]);
        res.json({ success: true, data: updated });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
