'use strict';

const express       = require('express');
const router        = express.Router();
const pool          = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { safeError } = require('../../../shared/security/safeError');

// All routes require a logged-in supervisor user.
// Supervisor users can only see applications assigned to them.

function getSupervisorId(req) {
    return req.user?.supervisor_id || null;
}

// ── GET /api/permission-applications ─────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
    const supervisorId = getSupervisorId(req);
    if (!supervisorId) return res.status(403).json({ success: false, message: 'Supervisor ID not found in token' });

    try {
        const { workflow_status, search } = req.query;

        let query = `
            SELECT ca.id, ca.user_id, ca.submitted_at, ca.workflow_status,
                   ca.forwarded_supervisor_at, ca.final_decision,
                   ca.academic_mark, ca.interview_mark, ca.final_score,
                   a.entrance_mark,
                   u.full_name, u.application_id AS app_no, u.email AS user_email,
                   a.category, a.community, a.gender, a.mobile, a.email,
                   a.subject, a.district,
                   rc.center_name AS allocated_center_name,
                   rs.supervisor_name AS allocated_supervisor_name,
                   pce.recommendation AS center_recommendation,
                   (pce.academic_record + pce.research_aptitude + pce.subject_relevance
                    + pce.research_proposal + pce.interview_performance) AS center_total,
                   pse.recommendation AS supervisor_recommendation,
                   pse.interview_mark AS sup_eval_interview_mark
            FROM counselling_applications ca
            JOIN users u ON ca.user_id = u.id
            LEFT JOIN applications a ON a.user_id = ca.user_id
            LEFT JOIN research_centers rc ON ca.allotted_center_id = rc.id
            LEFT JOIN research_supervisors rs ON ca.allotted_supervisor_id = rs.id
            LEFT JOIN permission_center_evaluations pce ON pce.counselling_application_id = ca.id
            LEFT JOIN permission_supervisor_evaluations pse ON pse.counselling_application_id = ca.id
            WHERE ca.status = 'Submitted'
              AND ca.allotted_supervisor_id = ?
              AND ca.workflow_status IN ('Forwarded_Supervisor','Supervisor_Interview_Completed',
                                         'Supervisor_Evaluated','Final_Score_Calculated',
                                         'Admin_Review','Approved','Waitlisted','Rejected')
        `;
        const params = [supervisorId];

        if (workflow_status) { query += ' AND ca.workflow_status = ?'; params.push(workflow_status); }
        if (search) {
            const w = `%${search}%`;
            query += ' AND (u.full_name LIKE ? OR u.application_id LIKE ?)';
            params.push(w, w);
        }

        query += ' ORDER BY ca.forwarded_supervisor_at DESC';
        const [rows] = await pool.execute(query, params);
        res.json({ success: true, data: rows, total: rows.length });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── GET /api/permission-applications/:id ─────────────────────────────────────
router.get('/:id', verifyToken, async (req, res) => {
    const supervisorId = getSupervisorId(req);
    if (!supervisorId) return res.status(403).json({ success: false, message: 'Supervisor ID not found in token' });

    try {
        const [[ca]] = await pool.execute(`
            SELECT ca.id, ca.user_id, ca.submitted_at, ca.workflow_status,
                   ca.allotted_center_id, ca.allotted_supervisor_id,
                   ca.forwarded_supervisor_at, ca.final_decision,
                   ca.academic_mark, ca.interview_mark, ca.final_score,
                   u.full_name, u.application_id AS app_no, u.email AS user_email,
                   a.applicant_name, a.dob, a.gender, a.nationality, a.religion,
                   a.community, a.category, a.mobile, a.email,
                   a.district, a.state, a.pincode,
                   a.address_1, a.address_2, a.address_3,
                   a.subject, a.working_district,
                   a.parent_name, a.is_physically_challenged, a.pc_percentage, a.pc_type,
                   a.part_time_category, a.part_time_designation,
                   a.entrance_mark,
                   rc.center_name AS allocated_center_name,
                   rs.supervisor_name AS allocated_supervisor_name,
                   pce.recommendation AS center_recommendation,
                   (pce.academic_record + pce.research_aptitude + pce.subject_relevance
                    + pce.research_proposal + pce.interview_performance) AS center_total,
                   pce.remarks AS center_remarks,
                   pse.id AS sup_eval_id, pse.recommendation AS supervisor_recommendation,
                   pse.interview_mark AS sup_eval_interview_mark,
                   pse.interview_remarks AS sup_eval_remarks
            FROM counselling_applications ca
            JOIN users u ON ca.user_id = u.id
            LEFT JOIN applications a ON a.user_id = ca.user_id
            LEFT JOIN research_centers rc ON ca.allotted_center_id = rc.id
            LEFT JOIN research_supervisors rs ON ca.allotted_supervisor_id = rs.id
            LEFT JOIN permission_center_evaluations pce ON pce.counselling_application_id = ca.id
            LEFT JOIN permission_supervisor_evaluations pse ON pse.counselling_application_id = ca.id
            WHERE ca.id = ? AND ca.status = 'Submitted' AND ca.allotted_supervisor_id = ?
        `, [req.params.id, supervisorId]);

        if (!ca) return res.status(404).json({ success: false, message: 'Application not found or not assigned to you' });

        const [school] = await pool.execute('SELECT * FROM school_education WHERE user_id = ?', [ca.user_id]);
        const [higher] = await pool.execute('SELECT * FROM higher_education WHERE user_id = ?', [ca.user_id]);
        const [quals]  = await pool.execute('SELECT * FROM student_qualifications WHERE user_id = ?', [ca.user_id]);
        const [docs]   = await pool.execute('SELECT * FROM application_documents WHERE user_id = ?', [ca.user_id]);
        const [prefs]  = await pool.execute(`
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
// New format: interview_mark (0–30) + recommendation + interview_remarks.
// Final score = academic_mark + (entrance_mark + interview_mark) × 50 / 100
router.post('/:id/evaluate', verifyToken, async (req, res) => {
    const supervisorId = getSupervisorId(req);
    if (!supervisorId) return res.status(403).json({ success: false, message: 'Supervisor ID not found' });

    const { interview_mark, recommendation, interview_remarks } = req.body;

    const validRec = ['Recommended', 'Waitlisted', 'Rejected'];
    if (!validRec.includes(recommendation)) {
        return res.status(400).json({ success: false, message: 'recommendation must be Recommended, Waitlisted, or Rejected' });
    }
    const im = parseFloat(interview_mark);
    if (isNaN(im) || im < 0 || im > 30) {
        return res.status(400).json({ success: false, message: 'interview_mark must be 0–30' });
    }

    const evaluatorName = req.user?.name || req.user?.email || 'Supervisor';
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[ca]] = await conn.execute(
            `SELECT ca.workflow_status, ca.allotted_supervisor_id, ca.academic_mark,
                    a.entrance_mark
             FROM counselling_applications ca
             LEFT JOIN applications a ON a.user_id = ca.user_id
             WHERE ca.id = ? AND ca.status = 'Submitted'`,
            [req.params.id]
        );
        if (!ca || ca.allotted_supervisor_id !== supervisorId) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Application not found or not assigned to you' });
        }

        const academicMark = parseFloat(ca.academic_mark) || 0;
        const entranceMark = parseFloat(ca.entrance_mark) || 0;
        const finalScore   = academicMark + (entranceMark + im) * 50 / 100;

        // Upsert evaluation record
        await conn.execute(
            `INSERT INTO permission_supervisor_evaluations
             (counselling_application_id, supervisor_id, evaluated_by,
              interview_mark, interview_remarks, recommendation)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               evaluated_by      = VALUES(evaluated_by),
               interview_mark    = VALUES(interview_mark),
               interview_remarks = VALUES(interview_remarks),
               recommendation    = VALUES(recommendation),
               updated_at        = NOW()`,
            [req.params.id, supervisorId, evaluatorName,
             im, interview_remarks || null, recommendation]
        );

        // Update application with new marks, final score, and status
        await conn.execute(
            `UPDATE counselling_applications
             SET interview_mark = ?, final_score = ?,
                 workflow_status = 'Supervisor_Interview_Completed', updated_at = NOW()
             WHERE id = ?`,
            [im, finalScore, req.params.id]
        );

        await conn.execute(
            `INSERT INTO permission_workflow_history
             (counselling_application_id, action, performed_by, role, from_status, to_status, remarks)
             VALUES (?, 'SUPERVISOR_INTERVIEW_COMPLETED', ?, 'supervisor', ?, 'Supervisor_Interview_Completed', ?)`,
            [req.params.id, evaluatorName, ca.workflow_status,
             `Interview Mark: ${im} | Final Score: ${finalScore.toFixed(2)} | ${recommendation}`]
        );

        await conn.execute(
            `INSERT INTO permission_notifications
             (counselling_application_id, recipient_type, recipient_id, message)
             VALUES (?, 'admin', 0, ?)`,
            [req.params.id, `Supervisor interview completed — ${recommendation} | Final Score: ${finalScore.toFixed(2)}`]
        ).catch(() => {});

        await conn.commit();
        res.json({
            success: true,
            message: 'Interview evaluation submitted.',
            final_score: parseFloat(finalScore.toFixed(2)),
        });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: safeError(err) });
    } finally { conn.release(); }
});

// ── POST /api/permission-applications/:id/return-to-admin ────────────────────
router.post('/:id/return-to-admin', verifyToken, async (req, res) => {
    const supervisorId = getSupervisorId(req);
    if (!supervisorId) return res.status(403).json({ success: false, message: 'Supervisor ID not found' });

    const evaluatorName = req.user?.name || req.user?.email || 'Supervisor';
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[ca]] = await conn.execute(
            'SELECT workflow_status, allotted_supervisor_id FROM counselling_applications WHERE id = ?',
            [req.params.id]
        );
        if (!ca || ca.allotted_supervisor_id !== supervisorId) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Not found or not assigned to you' });
        }

        await conn.execute(
            `UPDATE counselling_applications SET workflow_status = 'Center_Evaluated', updated_at = NOW() WHERE id = ?`,
            [req.params.id]
        );
        await conn.execute(
            `INSERT INTO permission_workflow_history
             (counselling_application_id, action, performed_by, role, from_status, to_status, remarks)
             VALUES (?, 'RETURNED_TO_ADMIN', ?, 'supervisor', ?, 'Center_Evaluated', ?)`,
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
