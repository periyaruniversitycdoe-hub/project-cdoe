'use strict';

const express       = require('express');
const router        = express.Router();
const pool          = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { safeError } = require('../../../shared/security/safeError');

// All routes require a logged-in center user.
// Center users can only see applications assigned to their center.

function getCenterId(req) {
    return req.user?.center_id || null;
}

// ── GET /api/permission-applications ─────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
    const centerId = getCenterId(req);
    if (!centerId) return res.status(403).json({ success: false, message: 'Center ID not found in token' });

    try {
        const { workflow_status, search } = req.query;

        let query = `
            SELECT ca.id, ca.user_id, ca.submitted_at, ca.workflow_status,
                   ca.forwarded_center_at, ca.final_decision,
                   u.full_name, u.application_id AS app_no, u.email AS user_email,
                   a.category, a.community, a.gender, a.mobile, a.email,
                   a.subject, a.district,
                   rc.center_name AS allocated_center_name,
                   rs.supervisor_name AS allocated_supervisor_name,
                   pce.recommendation AS center_recommendation,
                   (pce.academic_record + pce.research_aptitude + pce.subject_relevance
                    + pce.research_proposal + pce.interview_performance) AS center_total
            FROM counselling_applications ca
            JOIN users u ON ca.user_id = u.id
            LEFT JOIN applications a ON a.user_id = ca.user_id
            LEFT JOIN permission_allocations pa ON pa.counselling_application_id = ca.id
            LEFT JOIN research_centers rc ON ca.allotted_center_id = rc.id
            LEFT JOIN research_supervisors rs ON ca.allotted_supervisor_id = rs.id
            LEFT JOIN permission_center_evaluations pce ON pce.counselling_application_id = ca.id
            WHERE ca.status = 'Submitted'
              AND ca.allotted_center_id = ?
              AND ca.workflow_status IN ('Forwarded_Center','Center_Evaluated',
                                         'Forwarded_Supervisor','Supervisor_Evaluated',
                                         'Approved','Waitlisted','Rejected')
        `;
        const params = [centerId];

        if (workflow_status) { query += ' AND ca.workflow_status = ?'; params.push(workflow_status); }
        if (search) {
            const w = `%${search}%`;
            query += ' AND (u.full_name LIKE ? OR u.application_id LIKE ?)';
            params.push(w, w);
        }

        query += ' ORDER BY ca.forwarded_center_at DESC';
        const [rows] = await pool.execute(query, params);
        res.json({ success: true, data: rows, total: rows.length });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── GET /api/permission-applications/:id ─────────────────────────────────────
router.get('/:id', verifyToken, async (req, res) => {
    const centerId = getCenterId(req);
    if (!centerId) return res.status(403).json({ success: false, message: 'Center ID not found in token' });

    try {
        const [[ca]] = await pool.execute(`
            SELECT ca.id, ca.user_id, ca.submitted_at, ca.workflow_status,
                   ca.allotted_center_id, ca.allotted_supervisor_id,
                   ca.forwarded_center_at, ca.final_decision,
                   u.full_name, u.application_id AS app_no, u.email AS user_email,
                   a.applicant_name, a.dob, a.gender, a.nationality, a.religion,
                   a.community, a.category, a.mobile, a.email,
                   a.district, a.state, a.pincode,
                   a.address_1, a.address_2, a.address_3,
                   a.subject, a.working_district,
                   a.parent_name, a.is_physically_challenged, a.pc_percentage, a.pc_type,
                   a.part_time_category, a.part_time_designation,
                   rc.center_name AS allocated_center_name,
                   rs.supervisor_name AS allocated_supervisor_name,
                   pce.id AS eval_id, pce.recommendation AS center_recommendation,
                   pce.academic_record, pce.research_aptitude, pce.subject_relevance,
                   pce.research_proposal, pce.interview_performance,
                   pce.remarks AS eval_remarks
            FROM counselling_applications ca
            JOIN users u ON ca.user_id = u.id
            LEFT JOIN applications a ON a.user_id = ca.user_id
            LEFT JOIN research_centers rc ON ca.allotted_center_id = rc.id
            LEFT JOIN research_supervisors rs ON ca.allotted_supervisor_id = rs.id
            LEFT JOIN permission_center_evaluations pce ON pce.counselling_application_id = ca.id
            WHERE ca.id = ? AND ca.status = 'Submitted' AND ca.allotted_center_id = ?
        `, [req.params.id, centerId]);

        if (!ca) return res.status(404).json({ success: false, message: 'Application not found or not assigned to your center' });

        // Education
        const [school] = await pool.execute('SELECT * FROM school_education WHERE user_id = ?', [ca.user_id]);
        const [higher] = await pool.execute('SELECT * FROM higher_education WHERE user_id = ?', [ca.user_id]);
        const [quals]  = await pool.execute('SELECT * FROM student_qualifications WHERE user_id = ?', [ca.user_id]);
        const [docs]   = await pool.execute('SELECT * FROM application_documents WHERE user_id = ?', [ca.user_id]);

        // Preferences
        const [prefs] = await pool.execute(`
            SELECT crc.preference_order, rc.center_name, rs.supervisor_name, rs.designation
            FROM counselling_research_choices crc
            JOIN research_centers rc ON crc.research_center_id = rc.id
            JOIN research_supervisors rs ON crc.supervisor_id = rs.id
            WHERE crc.counselling_application_id = ? ORDER BY crc.preference_order
        `, [req.params.id]);

        ca.school_education = school;
        ca.higher_education = higher;
        ca.qualifications   = quals;
        ca.documents        = docs;
        ca.preferences      = prefs;

        res.json({ success: true, data: ca });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── POST /api/permission-applications/:id/evaluate ───────────────────────────
router.post('/:id/evaluate', verifyToken, async (req, res) => {
    const centerId  = getCenterId(req);
    if (!centerId) return res.status(403).json({ success: false, message: 'Center ID not found' });

    const { academic_record, research_aptitude, subject_relevance,
            research_proposal, interview_performance, recommendation, remarks } = req.body;

    const validRec = ['Recommended', 'Waitlisted', 'Rejected'];
    if (!validRec.includes(recommendation)) {
        return res.status(400).json({ success: false, message: 'recommendation must be Recommended, Waitlisted, or Rejected' });
    }

    const marks = [academic_record, research_aptitude, subject_relevance, research_proposal, interview_performance];
    for (const m of marks) {
        if (m === undefined || m === null || isNaN(m) || m < 0 || m > 20) {
            return res.status(400).json({ success: false, message: 'Each mark must be 0–20' });
        }
    }

    const evaluatorName = req.user?.name || req.user?.email || 'Center';
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[ca]] = await conn.execute(
            'SELECT workflow_status, allotted_center_id FROM counselling_applications WHERE id = ? AND status = ?',
            [req.params.id, 'Submitted']
        );
        if (!ca || ca.allotted_center_id !== centerId) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Application not found or not assigned to your center' });
        }

        await conn.execute(
            `INSERT INTO permission_center_evaluations
             (counselling_application_id, center_id, evaluated_by,
              academic_record, research_aptitude, subject_relevance,
              research_proposal, interview_performance, recommendation, remarks)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               evaluated_by = VALUES(evaluated_by),
               academic_record = VALUES(academic_record),
               research_aptitude = VALUES(research_aptitude),
               subject_relevance = VALUES(subject_relevance),
               research_proposal = VALUES(research_proposal),
               interview_performance = VALUES(interview_performance),
               recommendation = VALUES(recommendation),
               remarks = VALUES(remarks),
               updated_at = NOW()`,
            [req.params.id, centerId, evaluatorName,
             academic_record, research_aptitude, subject_relevance,
             research_proposal, interview_performance, recommendation, remarks || null]
        );

        await conn.execute(
            `UPDATE counselling_applications
             SET workflow_status = 'Center_Evaluated', updated_at = NOW() WHERE id = ?`,
            [req.params.id]
        );

        await conn.execute(
            `INSERT INTO permission_workflow_history
             (counselling_application_id, action, performed_by, role, from_status, to_status, remarks)
             VALUES (?, 'CENTER_EVALUATION_SUBMITTED', ?, 'center', ?, 'Center_Evaluated', ?)`,
            [req.params.id, evaluatorName, ca.workflow_status, remarks || null]
        );

        // Notify admin
        await conn.execute(
            `INSERT INTO permission_notifications
             (counselling_application_id, recipient_type, recipient_id, message)
             VALUES (?, 'admin', 0, ?)`,
            [req.params.id, `Center evaluation submitted — ${recommendation}`]
        ).catch(() => {});

        await conn.commit();
        res.json({ success: true, message: 'Evaluation submitted successfully. Application returned to Admin.' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: safeError(err) });
    } finally { conn.release(); }
});

// ── POST /api/permission-applications/:id/return-to-admin ────────────────────
router.post('/:id/return-to-admin', verifyToken, async (req, res) => {
    const centerId = getCenterId(req);
    if (!centerId) return res.status(403).json({ success: false, message: 'Center ID not found' });

    const evaluatorName = req.user?.name || req.user?.email || 'Center';
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[ca]] = await conn.execute(
            'SELECT workflow_status, allotted_center_id FROM counselling_applications WHERE id = ?',
            [req.params.id]
        );
        if (!ca || ca.allotted_center_id !== centerId) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Not found or not assigned to your center' });
        }

        await conn.execute(
            `UPDATE counselling_applications SET workflow_status = 'Documents_Verified', updated_at = NOW() WHERE id = ?`,
            [req.params.id]
        );
        await conn.execute(
            `INSERT INTO permission_workflow_history
             (counselling_application_id, action, performed_by, role, from_status, to_status, remarks)
             VALUES (?, 'RETURNED_TO_ADMIN', ?, 'center', ?, 'Documents_Verified', ?)`,
            [req.params.id, evaluatorName, ca.workflow_status, req.body.remarks || null]
        );
        await conn.commit();
        res.json({ success: true, message: 'Application returned to Admin' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: safeError(err) });
    } finally { conn.release(); }
});

module.exports = router;
