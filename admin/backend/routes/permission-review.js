'use strict';

const express        = require('express');
const router         = express.Router();
const pool           = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { safeError }  = require('../../../shared/security/safeError');
const ExcelJS        = require('exceljs');

// ── Helper: log a workflow event ──────────────────────────────────────────────
async function logHistory(conn, appId, action, performedBy, role, fromStatus, toStatus, remarks = null) {
    await conn.execute(
        `INSERT INTO permission_workflow_history
         (counselling_application_id, action, performed_by, role, from_status, to_status, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [appId, action, performedBy, role, fromStatus || null, toStatus || null, remarks || null]
    );
}

// ── Helper: push a notification ───────────────────────────────────────────────
async function notify(conn, appId, recipientType, recipientId, message) {
    await conn.execute(
        `INSERT INTO permission_notifications
         (counselling_application_id, recipient_type, recipient_id, message)
         VALUES (?, ?, ?, ?)`,
        [appId, recipientType, recipientId, message]
    ).catch(() => {});
}

// ── Base query — enriched application row ─────────────────────────────────────
const BASE_QUERY = `
    SELECT
        ca.id, ca.user_id, ca.session_id, ca.status, ca.submitted_at,
        ca.allotment_status, ca.allotted_center_id, ca.allotted_supervisor_id,
        ca.allotment_remarks, ca.allotted_at,
        ca.workflow_status, ca.forwarded_center_at, ca.forwarded_supervisor_at,
        ca.final_decision, ca.final_decision_at, ca.final_remarks,
        ca.admin_verified_by, ca.admin_verified_at,
        ca.academic_mark, ca.interview_mark, ca.final_score,
        u.full_name, u.email AS user_email, u.application_id AS app_no,
        a.applicant_name, a.applicant_initial, a.applicant_name_tamil,
        a.dob, a.gender, a.nationality, a.religion, a.community, a.category,
        a.mobile, a.email, a.address_1, a.address_2, a.address_3,
        a.district, a.state, a.pincode,
        a.subject, a.working_district,
        a.is_physically_challenged, a.pc_percentage, a.pc_type,
        a.parent_name,
        a.part_time_category, a.part_time_designation, a.part_time_area,
        a.id_type, a.id_number,
        a.perm_address_1, a.perm_address_2, a.perm_address_3,
        a.perm_district, a.perm_state, a.perm_pincode,
        a.entrance_mark,
        CONCAT(s.month, ' ', s.year) AS session_name,
        rc_allot.center_name AS allotted_center_name,
        rs_allot.supervisor_name AS allotted_supervisor_name,
        rs_allot.designation AS allotted_supervisor_designation,
        pa.allocated_center_id, pa.allocated_supervisor_id,
        pa.center_allocation_date, pa.supervisor_allocation_date,
        pa.center_remarks AS pa_center_remarks, pa.supervisor_remarks AS pa_sup_remarks,
        rc_pa.center_name AS pa_center_name,
        rs_pa.supervisor_name AS pa_supervisor_name,
        pce.recommendation AS center_recommendation,
        pce.academic_record, pce.research_aptitude AS center_research_aptitude,
        pce.subject_relevance, pce.research_proposal, pce.interview_performance,
        (pce.academic_record + pce.research_aptitude + pce.subject_relevance
         + pce.research_proposal + pce.interview_performance) AS center_total,
        pse.recommendation AS supervisor_recommendation,
        pse.subject_knowledge, pse.research_aptitude AS sup_research_aptitude,
        pse.research_feasibility, pse.interview AS sup_interview,
        (pse.subject_knowledge + pse.research_aptitude + pse.research_feasibility
         + pse.interview) AS supervisor_total
    FROM counselling_applications ca
    JOIN users u ON ca.user_id = u.id
    LEFT JOIN applications a ON a.user_id = ca.user_id
    LEFT JOIN sessions s ON ca.session_id = s.id
    LEFT JOIN research_centers   rc_allot ON ca.allotted_center_id    = rc_allot.id
    LEFT JOIN research_supervisors rs_allot ON ca.allotted_supervisor_id = rs_allot.id
    LEFT JOIN permission_allocations pa ON pa.counselling_application_id = ca.id
    LEFT JOIN research_centers   rc_pa ON pa.allocated_center_id     = rc_pa.id
    LEFT JOIN research_supervisors rs_pa ON pa.allocated_supervisor_id = rs_pa.id
    LEFT JOIN permission_center_evaluations pce ON pce.counselling_application_id = ca.id
    LEFT JOIN permission_supervisor_evaluations pse ON pse.counselling_application_id = ca.id
    WHERE ca.status = 'Submitted'
`;

// ── GET /api/permission-review/applications ───────────────────────────────────
router.get('/applications', verifyToken, isAdmin, async (req, res) => {
    try {
        const {
            session_id, workflow_status, center_id, supervisor_id,
            community, gender, district, category,
            search, page = 1, limit: pageLimit = 50,
        } = req.query;

        let query  = BASE_QUERY;
        const params = [];

        if (session_id && session_id !== 'all' && session_id !== 'active') {
            query += ' AND ca.session_id = ?'; params.push(session_id);
        }
        if (workflow_status) {
            query += ' AND ca.workflow_status = ?'; params.push(workflow_status);
        }
        if (community) { query += ' AND a.community = ?'; params.push(community); }
        if (gender)    { query += ' AND a.gender = ?';    params.push(gender); }
        if (district)  { query += ' AND a.district = ?';  params.push(district); }
        if (category)  { query += ' AND a.category = ?';  params.push(category); }

        if (center_id) {
            query += ` AND (pa.allocated_center_id = ? OR ca.allotted_center_id = ?)`;
            params.push(center_id, center_id);
        }
        if (supervisor_id) {
            query += ` AND (pa.allocated_supervisor_id = ? OR ca.allotted_supervisor_id = ?)`;
            params.push(supervisor_id, supervisor_id);
        }

        if (search) {
            const w = `%${search}%`;
            query += ` AND (u.full_name LIKE ? OR u.application_id LIKE ?
                            OR u.email LIKE ? OR a.mobile LIKE ?)`;
            params.push(w, w, w, w);
        }

        query += ' ORDER BY ca.submitted_at DESC';

        const offset = (parseInt(page) - 1) * parseInt(pageLimit);
        query += ` LIMIT ${parseInt(pageLimit)} OFFSET ${offset}`;

        const [rows] = await pool.execute(query, params);

        // Attach preferences (new separate tables + legacy combined table)
        if (rows.length > 0) {
            const ids = rows.map(r => r.id);
            const ph  = ids.map(() => '?').join(',');

            const [centerPrefs] = await pool.execute(`
                SELECT ccp.counselling_application_id, ccp.preference_order,
                       rc.id AS center_id, rc.center_name
                FROM counselling_center_preferences ccp
                JOIN research_centers rc ON ccp.research_center_id = rc.id
                WHERE ccp.counselling_application_id IN (${ph})
                ORDER BY ccp.counselling_application_id, ccp.preference_order
            `, ids);

            const [supPrefs] = await pool.execute(`
                SELECT csp.counselling_application_id, csp.preference_order,
                       rs.id AS supervisor_id, rs.supervisor_name, rs.designation, rs.department,
                       rc.center_name AS supervisor_center_name, rc.id AS supervisor_center_id
                FROM counselling_supervisor_preferences csp
                JOIN research_supervisors rs ON csp.supervisor_id = rs.id
                LEFT JOIN research_centers rc ON rs.research_center_id = rc.id
                WHERE csp.counselling_application_id IN (${ph})
                ORDER BY csp.counselling_application_id, csp.preference_order
            `, ids);

            // Legacy combined choices (for older submissions)
            const [choices] = await pool.execute(`
                SELECT crc.counselling_application_id, crc.preference_order,
                       rc.id AS center_id, rc.center_name,
                       rs.id AS supervisor_id, rs.supervisor_name, rs.designation
                FROM counselling_research_choices crc
                JOIN research_centers rc     ON crc.research_center_id = rc.id
                JOIN research_supervisors rs ON crc.supervisor_id      = rs.id
                WHERE crc.counselling_application_id IN (${ph})
                ORDER BY crc.counselling_application_id, crc.preference_order
            `, ids);

            const cpMap = {}, spMap = {}, legacyMap = {};
            centerPrefs.forEach(c => {
                if (!cpMap[c.counselling_application_id]) cpMap[c.counselling_application_id] = [];
                cpMap[c.counselling_application_id].push(c);
            });
            supPrefs.forEach(s => {
                if (!spMap[s.counselling_application_id]) spMap[s.counselling_application_id] = [];
                spMap[s.counselling_application_id].push(s);
            });
            choices.forEach(c => {
                if (!legacyMap[c.counselling_application_id]) legacyMap[c.counselling_application_id] = [];
                legacyMap[c.counselling_application_id].push(c);
            });

            rows.forEach(r => {
                r.center_preferences    = cpMap[r.id]     || [];
                r.supervisor_preferences = spMap[r.id]    || [];
                r.preferences            = legacyMap[r.id] || [];
            });
        }

        res.json({ success: true, data: rows, total: rows.length });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── GET /api/permission-review/applications/:id ───────────────────────────────
router.get('/applications/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[row]] = await pool.execute(BASE_QUERY + ' AND ca.id = ?', [req.params.id]);
        if (!row) return res.status(404).json({ success: false, message: 'Application not found' });

        // Preferences — new separate tables
        const [centerPrefs] = await pool.execute(`
            SELECT ccp.preference_order, rc.id AS center_id, rc.center_name
            FROM counselling_center_preferences ccp
            JOIN research_centers rc ON ccp.research_center_id = rc.id
            WHERE ccp.counselling_application_id = ?
            ORDER BY ccp.preference_order
        `, [req.params.id]);

        const [supPrefs] = await pool.execute(`
            SELECT csp.preference_order, rs.id AS supervisor_id, rs.supervisor_name,
                   rs.designation, rs.department,
                   rc.id AS supervisor_center_id, rc.center_name AS supervisor_center_name
            FROM counselling_supervisor_preferences csp
            JOIN research_supervisors rs ON csp.supervisor_id = rs.id
            LEFT JOIN research_centers rc ON rs.research_center_id = rc.id
            WHERE csp.counselling_application_id = ?
            ORDER BY csp.preference_order
        `, [req.params.id]);

        // Legacy combined choices
        const [choices] = await pool.execute(`
            SELECT crc.preference_order, rc.id AS center_id, rc.center_name,
                   rs.id AS supervisor_id, rs.supervisor_name, rs.designation, rs.department
            FROM counselling_research_choices crc
            JOIN research_centers rc    ON crc.research_center_id = rc.id
            JOIN research_supervisors rs ON crc.supervisor_id      = rs.id
            WHERE crc.counselling_application_id = ?
            ORDER BY crc.preference_order
        `, [req.params.id]);

        row.center_preferences    = centerPrefs;
        row.supervisor_preferences = supPrefs;
        row.preferences            = choices;

        // Education records
        const [school] = await pool.execute(
            'SELECT se.*, eb.board_name FROM school_education se LEFT JOIN education_boards eb ON se.board_id = eb.id WHERE se.user_id = ?', [row.user_id]);
        const [higher] = await pool.execute(
            'SELECT * FROM higher_education WHERE user_id = ?', [row.user_id]);
        const [exp] = await pool.execute(
            'SELECT ed.*, et.type_name AS employment_type FROM experience_details ed LEFT JOIN employment_types et ON ed.employment_type_id = et.id WHERE ed.user_id = ?', [row.user_id]);
        const [docs] = await pool.execute(
            'SELECT * FROM application_documents WHERE user_id = ?', [row.user_id]);
        const [quals] = await pool.execute(
            'SELECT * FROM student_qualifications WHERE user_id = ?', [row.user_id]);

        row.school_education  = school;
        row.higher_education  = higher;
        row.experience        = exp;
        row.documents         = docs;
        row.qualifications    = quals;

        // Workflow history
        const [history] = await pool.execute(
            `SELECT * FROM permission_workflow_history
             WHERE counselling_application_id = ? ORDER BY created_at ASC`,
            [req.params.id]
        );
        row.workflow_history = history;

        // Center & supervisor evaluations (full)
        const [[centerEval]] = await pool.execute(
            'SELECT * FROM permission_center_evaluations WHERE counselling_application_id = ?',
            [req.params.id]
        );
        const [[supEval]] = await pool.execute(
            'SELECT * FROM permission_supervisor_evaluations WHERE counselling_application_id = ?',
            [req.params.id]
        );
        row.center_evaluation     = centerEval || null;
        row.supervisor_evaluation = supEval || null;

        res.json({ success: true, data: row });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── POST /api/permission-review/applications/:id/verify-documents ─────────────
router.post('/applications/:id/verify-documents', verifyToken, isAdmin, async (req, res) => {
    const { remarks } = req.body;
    const adminName = req.user?.name || req.user?.email || 'Admin';
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[ca]] = await conn.execute(
            'SELECT workflow_status FROM counselling_applications WHERE id = ?', [req.params.id]
        );
        if (!ca) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Not found' }); }

        await conn.execute(
            `UPDATE counselling_applications
             SET workflow_status = 'Documents_Verified', admin_verified_by = ?, admin_verified_at = NOW(), updated_at = NOW()
             WHERE id = ?`,
            [adminName, req.params.id]
        );
        await logHistory(conn, req.params.id, 'DOCUMENTS_VERIFIED', adminName, 'admin',
            ca.workflow_status, 'Documents_Verified', remarks);
        await conn.commit();
        res.json({ success: true, message: 'Documents marked as verified' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: safeError(err) });
    } finally { conn.release(); }
});

// ── POST /api/permission-review/applications/:id/allocate-center ──────────────
router.post('/applications/:id/allocate-center', verifyToken, isAdmin, async (req, res) => {
    const { center_id, allocation_date, remarks } = req.body;
    if (!center_id) return res.status(400).json({ success: false, message: 'center_id is required' });
    const adminName = req.user?.name || req.user?.email || 'Admin';
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[ca]] = await conn.execute(
            'SELECT workflow_status FROM counselling_applications WHERE id = ?', [req.params.id]
        );
        if (!ca) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Not found' }); }

        await conn.execute(
            `INSERT INTO permission_allocations
             (counselling_application_id, allocated_center_id, center_allocation_date, center_remarks, allocated_by)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               allocated_center_id = VALUES(allocated_center_id),
               center_allocation_date = VALUES(center_allocation_date),
               center_remarks = VALUES(center_remarks),
               allocated_by = VALUES(allocated_by),
               updated_at = NOW()`,
            [req.params.id, center_id, allocation_date || null, remarks || null, adminName]
        );
        await conn.execute(
            `UPDATE counselling_applications
             SET workflow_status = 'Center_Allocated', allotted_center_id = ?, updated_at = NOW()
             WHERE id = ?`,
            [center_id, req.params.id]
        );
        await logHistory(conn, req.params.id, 'CENTER_ALLOCATED', adminName, 'admin',
            ca.workflow_status, 'Center_Allocated', remarks);
        await conn.commit();
        res.json({ success: true, message: 'Research Center allocated successfully' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: safeError(err) });
    } finally { conn.release(); }
});

// ── POST /api/permission-review/applications/:id/allocate-supervisor ──────────
router.post('/applications/:id/allocate-supervisor', verifyToken, isAdmin, async (req, res) => {
    const { supervisor_id, allocation_date, remarks } = req.body;
    if (!supervisor_id) return res.status(400).json({ success: false, message: 'supervisor_id is required' });
    const adminName = req.user?.name || req.user?.email || 'Admin';
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[ca]] = await conn.execute(
            'SELECT workflow_status FROM counselling_applications WHERE id = ?', [req.params.id]
        );
        if (!ca) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Not found' }); }

        await conn.execute(
            `INSERT INTO permission_allocations
             (counselling_application_id, allocated_supervisor_id, supervisor_allocation_date, supervisor_remarks, allocated_by)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               allocated_supervisor_id = VALUES(allocated_supervisor_id),
               supervisor_allocation_date = VALUES(supervisor_allocation_date),
               supervisor_remarks = VALUES(supervisor_remarks),
               allocated_by = VALUES(allocated_by),
               updated_at = NOW()`,
            [req.params.id, supervisor_id, allocation_date || null, remarks || null, adminName]
        );
        await conn.execute(
            `UPDATE counselling_applications
             SET workflow_status = 'Supervisor_Allocated', allotted_supervisor_id = ?, updated_at = NOW()
             WHERE id = ?`,
            [supervisor_id, req.params.id]
        );
        await logHistory(conn, req.params.id, 'SUPERVISOR_ALLOCATED', adminName, 'admin',
            ca.workflow_status, 'Supervisor_Allocated', remarks);
        await conn.commit();
        res.json({ success: true, message: 'Supervisor allocated successfully' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: safeError(err) });
    } finally { conn.release(); }
});

// ── POST /api/permission-review/applications/:id/allocate ─────────────────────
// Single allocation: admin picks ONE supervisor; center is auto-derived from supervisor.
router.post('/applications/:id/allocate', verifyToken, isAdmin, async (req, res) => {
    const { supervisor_id, allocation_date, remarks, academic_mark } = req.body;
    if (!supervisor_id) return res.status(400).json({ success: false, message: 'supervisor_id is required' });
    const adminName = req.user?.name || req.user?.email || 'Admin';
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[ca]] = await conn.execute(
            'SELECT workflow_status FROM counselling_applications WHERE id = ?', [req.params.id]
        );
        if (!ca) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Not found' }); }

        // Auto-identify Research Center from supervisor record
        const [[sup]] = await conn.execute(
            `SELECT rs.research_center_id, rs.supervisor_name, rs.department, rs.designation,
                    rc.center_name
             FROM research_supervisors rs
             LEFT JOIN research_centers rc ON rs.research_center_id = rc.id
             WHERE rs.id = ? AND rs.is_active = 1`,
            [supervisor_id]
        );
        if (!sup) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Supervisor not found or inactive' }); }
        if (!sup.research_center_id) { await conn.rollback(); return res.status(400).json({ success: false, message: 'Selected supervisor has no mapped Research Center' }); }

        const centerId = sup.research_center_id;
        const today = allocation_date || new Date().toISOString().split('T')[0];

        // Upsert permission_allocations (single row per application)
        await conn.execute(
            `INSERT INTO permission_allocations
             (counselling_application_id, allocated_center_id, allocated_supervisor_id,
              center_allocation_date, supervisor_allocation_date,
              center_remarks, supervisor_remarks, allocated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               allocated_center_id        = VALUES(allocated_center_id),
               allocated_supervisor_id    = VALUES(allocated_supervisor_id),
               center_allocation_date     = VALUES(center_allocation_date),
               supervisor_allocation_date = VALUES(supervisor_allocation_date),
               center_remarks             = VALUES(center_remarks),
               supervisor_remarks         = VALUES(supervisor_remarks),
               allocated_by               = VALUES(allocated_by),
               updated_at                 = NOW()`,
            [req.params.id, centerId, parseInt(supervisor_id),
             today, today, remarks || null, remarks || null, adminName]
        );

        // Build SET clause (academic_mark is optional)
        const sets = [
            'workflow_status = ?', 'allotted_center_id = ?',
            'allotted_supervisor_id = ?', 'updated_at = NOW()'
        ];
        const vals = ['Allocated', centerId, parseInt(supervisor_id)];
        if (academic_mark !== undefined && academic_mark !== null && academic_mark !== '') {
            sets.push('academic_mark = ?');
            vals.push(parseFloat(academic_mark));
        }
        vals.push(req.params.id);
        await conn.execute(`UPDATE counselling_applications SET ${sets.join(', ')} WHERE id = ?`, vals);

        await logHistory(conn, req.params.id, 'ALLOCATED', adminName, 'admin',
            ca.workflow_status, 'Allocated',
            `Supervisor: ${sup.supervisor_name} | Center: ${sup.center_name || centerId}${remarks ? ' | ' + remarks : ''}`);

        await conn.commit();
        res.json({
            success: true, message: 'Supervisor and Research Center allocated successfully',
            center_id: centerId, supervisor_id: parseInt(supervisor_id),
            center_name: sup.center_name,
        });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: safeError(err) });
    } finally { conn.release(); }
});

// ── POST /api/permission-review/applications/:id/forward-center ───────────────
router.post('/applications/:id/forward-center', verifyToken, isAdmin, async (req, res) => {
    const adminName = req.user?.name || req.user?.email || 'Admin';
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[ca]] = await conn.execute(
            'SELECT workflow_status, allotted_center_id FROM counselling_applications WHERE id = ?',
            [req.params.id]
        );
        if (!ca) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Not found' }); }
        if (!ca.allotted_center_id) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'Allocate a Research Center before forwarding' });
        }

        await conn.execute(
            `UPDATE counselling_applications
             SET workflow_status = 'Forwarded_Center', forwarded_center_at = NOW(), updated_at = NOW()
             WHERE id = ?`,
            [req.params.id]
        );
        await logHistory(conn, req.params.id, 'FORWARDED_TO_CENTER', adminName, 'admin',
            ca.workflow_status, 'Forwarded_Center', req.body.remarks || null);

        // Notify the center
        await notify(conn, req.params.id, 'center', ca.allotted_center_id,
            `A new permission application has been forwarded to your center for evaluation.`);

        await conn.commit();
        res.json({ success: true, message: 'Application forwarded to Research Center' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: safeError(err) });
    } finally { conn.release(); }
});

// ── POST /api/permission-review/applications/:id/forward-supervisor ───────────
router.post('/applications/:id/forward-supervisor', verifyToken, isAdmin, async (req, res) => {
    const adminName = req.user?.name || req.user?.email || 'Admin';
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[ca]] = await conn.execute(
            'SELECT workflow_status, allotted_supervisor_id FROM counselling_applications WHERE id = ?',
            [req.params.id]
        );
        if (!ca) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Not found' }); }
        if (!ca.allotted_supervisor_id) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'Allocate a Supervisor before forwarding' });
        }

        await conn.execute(
            `UPDATE counselling_applications
             SET workflow_status = 'Forwarded_Supervisor', forwarded_supervisor_at = NOW(), updated_at = NOW()
             WHERE id = ?`,
            [req.params.id]
        );
        await logHistory(conn, req.params.id, 'FORWARDED_TO_SUPERVISOR', adminName, 'admin',
            ca.workflow_status, 'Forwarded_Supervisor', req.body.remarks || null);

        await notify(conn, req.params.id, 'supervisor', ca.allotted_supervisor_id,
            `A permission application has been forwarded to you for evaluation.`);

        await conn.commit();
        res.json({ success: true, message: 'Application forwarded to Supervisor' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: safeError(err) });
    } finally { conn.release(); }
});

// ── POST /api/permission-review/applications/:id/final-decision ───────────────
router.post('/applications/:id/final-decision', verifyToken, isAdmin, async (req, res) => {
    const { decision, remarks } = req.body;
    const validDecisions = ['Approved', 'Waitlisted', 'Rejected'];
    if (!validDecisions.includes(decision)) {
        return res.status(400).json({ success: false, message: 'decision must be Approved, Waitlisted, or Rejected' });
    }
    const adminName = req.user?.name || req.user?.email || 'Admin';
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[ca]] = await conn.execute(
            'SELECT workflow_status FROM counselling_applications WHERE id = ?', [req.params.id]
        );
        if (!ca) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Not found' }); }

        const newStatus = decision; // 'Approved' | 'Waitlisted' | 'Rejected'
        await conn.execute(
            `UPDATE counselling_applications
             SET workflow_status = ?, final_decision = ?, final_decision_at = NOW(),
                 final_remarks = ?, allotment_status = ?, updated_at = NOW()
             WHERE id = ?`,
            [newStatus, decision, remarks || null,
             decision === 'Approved' ? 'Allotted' : 'Not Allotted',
             req.params.id]
        );
        await logHistory(conn, req.params.id, `FINAL_${decision.toUpperCase()}`, adminName, 'admin',
            ca.workflow_status, newStatus, remarks);

        await conn.commit();
        res.json({ success: true, message: `Application ${decision}` });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: safeError(err) });
    } finally { conn.release(); }
});

// ── GET /api/permission-review/applications/:id/history ───────────────────────
router.get('/applications/:id/history', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT * FROM permission_workflow_history
             WHERE counselling_application_id = ? ORDER BY created_at ASC`,
            [req.params.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── GET /api/permission-review/stats ─────────────────────────────────────────
router.get('/stats', verifyToken, isAdmin, async (req, res) => {
    try {
        const { session_id } = req.query;
        let where = `WHERE ca.status = 'Submitted'`;
        const params = [];
        if (session_id && session_id !== 'all' && session_id !== 'active') {
            where += ' AND ca.session_id = ?'; params.push(session_id);
        }

        const [counts] = await pool.execute(`
            SELECT
                COUNT(*) AS total,
                SUM(ca.workflow_status = 'Submitted')                    AS pending_review,
                SUM(ca.workflow_status = 'Documents_Verified')           AS docs_verified,
                SUM(ca.workflow_status IN ('Allocated','Center_Allocated','Supervisor_Allocated')) AS allocated,
                SUM(ca.workflow_status = 'Forwarded_Center')             AS forwarded_center,
                SUM(ca.workflow_status IN ('Center_Review_Completed','Center_Evaluated')) AS center_review_completed,
                SUM(ca.workflow_status = 'Forwarded_Supervisor')         AS forwarded_supervisor,
                SUM(ca.workflow_status IN ('Supervisor_Interview_Completed','Supervisor_Evaluated')) AS supervisor_interview_completed,
                SUM(ca.workflow_status = 'Final_Score_Calculated')       AS final_score_calculated,
                SUM(ca.workflow_status = 'Admin_Review')                 AS admin_review,
                SUM(ca.workflow_status = 'Approved')                     AS approved,
                SUM(ca.workflow_status = 'Waitlisted')                   AS waitlisted,
                SUM(ca.workflow_status = 'Rejected')                     AS rejected
            FROM counselling_applications ca
            ${where}
        `, params);

        res.json({ success: true, data: counts[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── GET /api/permission-review/export/excel ───────────────────────────────────
router.get('/export/excel', verifyToken, isAdmin, async (req, res) => {
    try {
        const { session_id, workflow_status } = req.query;
        let query  = BASE_QUERY;
        const params = [];

        if (session_id && session_id !== 'all' && session_id !== 'active') {
            query += ' AND ca.session_id = ?'; params.push(session_id);
        }
        if (workflow_status) { query += ' AND ca.workflow_status = ?'; params.push(workflow_status); }
        query += ' ORDER BY ca.submitted_at DESC';

        const [rows] = await pool.execute(query, params);

        const wb  = new ExcelJS.Workbook();
        const ws  = wb.addWorksheet('Permission Review');

        ws.columns = [
            { header: 'App No',           key: 'app_no',            width: 18 },
            { header: 'Candidate Name',   key: 'full_name',         width: 28 },
            { header: 'Category',         key: 'category',          width: 14 },
            { header: 'Community',        key: 'community',         width: 14 },
            { header: 'Gender',           key: 'gender',            width: 10 },
            { header: 'Mobile',           key: 'mobile',            width: 14 },
            { header: 'Email',            key: 'email',             width: 30 },
            { header: 'District',         key: 'district',          width: 16 },
            { header: 'Subject',          key: 'subject',           width: 20 },
            { header: 'Workflow Status',  key: 'workflow_status',   width: 22 },
            { header: 'Allocated Center', key: 'pa_center_name',    width: 28 },
            { header: 'Allocated Super.', key: 'pa_supervisor_name',width: 28 },
            { header: 'Session',          key: 'session_name',      width: 16 },
            { header: 'Submitted At',     key: 'submitted_at',      width: 20 },
            { header: 'Final Decision',   key: 'final_decision',    width: 14 },
        ];

        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };

        rows.forEach(r => {
            ws.addRow({
                app_no:             r.app_no || '—',
                full_name:          r.full_name,
                category:           r.category || '—',
                community:          r.community || '—',
                gender:             r.gender || '—',
                mobile:             r.mobile || '—',
                email:              r.email || r.user_email,
                district:           r.district || '—',
                subject:            r.subject || '—',
                workflow_status:    r.workflow_status,
                pa_center_name:     r.pa_center_name || r.allotted_center_name || '—',
                pa_supervisor_name: r.pa_supervisor_name || r.allotted_supervisor_name || '—',
                session_name:       r.session_name || '—',
                submitted_at:       r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-IN') : '—',
                final_decision:     r.final_decision || '—',
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="permission_review_${Date.now()}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── GET /api/permission-review/notifications ──────────────────────────────────
router.get('/notifications', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT pn.*, ca.id AS counselling_id, u.full_name, u.application_id AS app_no
             FROM permission_notifications pn
             JOIN counselling_applications ca ON pn.counselling_application_id = ca.id
             JOIN users u ON ca.user_id = u.id
             WHERE pn.recipient_type = 'admin'
             ORDER BY pn.created_at DESC LIMIT 50`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

module.exports = router;
