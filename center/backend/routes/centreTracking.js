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
        const [centreTypes] = await pool.execute('SELECT id, name FROM master_centre_types WHERE is_active = 1 ORDER BY name ASC');
        res.json({ success: true, data: { institutes, centreTypes } });
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
        const { status, search, institute_id, centre_type_id, date_from, date_to, page = 1, limit = 20 } = req.query;
        const conditions = [];
        const vals = [];

        if (status) { conditions.push('rc.status = ?'); vals.push(status); }
        if (search) {
            conditions.push('(rc.name LIKE ? OR rc.centre_ref_no LIKE ? OR rc.email LIKE ? OR rc.id LIKE ?)');
            const like = `%${search}%`;
            vals.push(like, like, like, like);
        }
        if (institute_id) { conditions.push('rc.institute_id = ?'); vals.push(parseInt(institute_id)); }
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
                   inst.name AS institute_name, inst.college_code AS institute_code
            FROM research_centres rc
            LEFT JOIN master_centre_types ct ON rc.centre_type_id = ct.id
            LEFT JOIN master_institutes inst  ON rc.institute_id = inst.id
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
                   rcat.name AS category_name,
                   inst.name AS institute_name, inst.college_code AS institute_code,
                   dist.name AS district_name
            FROM research_centres rc
            LEFT JOIN master_centre_types        ct   ON rc.centre_type_id = ct.id
            LEFT JOIN master_research_subjects   rs   ON rc.subject_id = rs.id
            LEFT JOIN master_research_categories rcat ON rc.category_id = rcat.id
            LEFT JOIN master_institutes          inst ON rc.institute_id = inst.id
            LEFT JOIN master_districts           dist ON rc.district_id = dist.id
            WHERE rc.id = ?
        `, [req.params.id]);
        if (!row) return res.status(404).json({ success: false, message: 'Research centre not found' });
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

// PATCH /api/centre-tracking/:id/approve
router.patch('/:id/approve', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[rc]] = await pool.execute('SELECT id, email, status, name FROM research_centres WHERE id = ?', [req.params.id]);
        if (!rc) return res.status(404).json({ success: false, message: 'Research centre not found' });

        const prev = rc.status;
        await pool.execute(
            'UPDATE research_centres SET status = ?, approved_by = ?, approved_at = NOW(), rejection_reason = NULL WHERE id = ?',
            ['Approved', req.user.id, req.params.id]
        );
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
