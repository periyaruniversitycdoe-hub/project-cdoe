const { safeError } = require('../../../shared/security/safeError');
'use strict';

const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const ExcelJS = require('exceljs');

// â”€â”€ Audit Logging Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function audit(conn, { adminId, action, reportType, filters, ip }) {
    try {
        await conn.execute(
            `INSERT INTO eligibility_audit_log
             (admin_id, action, entity_type, old_value, ip_address)
             VALUES (?, ?, ?, ?, ?)`,
            [
                adminId || null,
                action,
                'reporting',
                JSON.stringify({ report_type: reportType, filters: filters || {} }),
                ip || null,
            ]
        );
    } catch (_) { /* Failures in audit should not break core reports operations */ }
}

// â”€â”€ Unified Filters Builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildFilters(req, tableAlias = 'a') {
    const { session_id, start_date, end_date, department_id, program_offered_id, community, status, payment_status, category, district } = req.query;
    const conditions = [];
    const params = [];

    if (session_id && session_id !== 'all') {
        conditions.push(`${tableAlias}.session_id = ?`);
        params.push(session_id);
    }
    if (start_date) {
        conditions.push(`${tableAlias}.created_at >= ?`);
        params.push(start_date + ' 00:00:00');
    }
    if (end_date) {
        conditions.push(`${tableAlias}.created_at <= ?`);
        params.push(end_date + ' 23:59:59');
    }
    if (department_id && department_id !== 'all') {
        conditions.push(`${tableAlias}.department_id = ?`);
        params.push(department_id);
    }
    if (program_offered_id && program_offered_id !== 'all') {
        conditions.push(`${tableAlias}.program_offered_id = ?`);
        params.push(program_offered_id);
    }
    if (community && community !== 'all') {
        conditions.push(`${tableAlias}.community = ?`);
        params.push(community);
    }
    if (status && status !== 'all') {
        conditions.push(`${tableAlias}.status = ?`);
        params.push(status);
    }
    if (payment_status && payment_status !== 'all') {
        conditions.push(`${tableAlias}.payment_status = ?`);
        params.push(payment_status);
    }
    if (category && category !== 'all') {
        conditions.push(`${tableAlias}.category = ?`);
        params.push(category);
    }
    if (district && district !== 'all') {
        conditions.push(`${tableAlias}.district = ?`);
        params.push(district);
    }

    return {
        whereClause: conditions.length ? ' WHERE ' + conditions.join(' AND ') : '',
        andClause: conditions.length ? ' AND ' + conditions.join(' AND ') : '',
        params
    };
}

// â”€â”€ 1. Analytics Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/analytics', verifyToken, isAdmin, async (req, res) => {
    try {
        const { whereClause, params } = buildFilters(req, 'a');

        // Total Applicants
        const [[{ total_applicants }]] = await pool.execute(
            `SELECT COUNT(*) as total_applicants FROM applications a ${whereClause}`,
            params
        );

        // Payments Collection Sum
        const [[{ total_payments }]] = await pool.execute(
            `SELECT COALESCE(SUM(amount), 0) as total_payments
             FROM payments p
             JOIN applications a ON p.application_id = a.application_id
             ${whereClause || 'WHERE 1=1'} AND p.payment_status = 'Success'`,
            params
        );

        // Pending Verifications
        const [[{ pending_verification }]] = await pool.execute(
            `SELECT COUNT(*) as pending_verification 
             FROM applications a 
             ${whereClause} ${whereClause ? 'AND' : 'WHERE'} a.status IN ('Submitted', 'Under Review')`,
            params
        );

        // Approval Funnel
        const [[funnel]] = await pool.execute(
            `SELECT 
                SUM(case when a.status = 'Draft' then 1 else 0 end) as draft,
                SUM(case when a.status = 'Submitted' then 1 else 0 end) as submitted,
                SUM(case when a.status = 'Under Review' then 1 else 0 end) as under_review,
                SUM(case when a.status = 'Approved' then 1 else 0 end) as approved,
                SUM(case when a.status = 'Rejected' then 1 else 0 end) as rejected
             FROM applications a
             ${whereClause}`,
            params
        );

        // Department-wise Distribution
        const [deptDist] = await pool.execute(
            `SELECT COALESCE(a.subject, 'Unassigned') as department, COUNT(*) as count 
             FROM applications a
             ${whereClause}
             GROUP BY a.subject
             ORDER BY count DESC
             LIMIT 10`,
            params
        );

        // Community-wise Distribution
        const [commDist] = await pool.execute(
            `SELECT COALESCE(a.community, 'Unknown') as community, COUNT(*) as count 
             FROM applications a
             ${whereClause}
             GROUP BY a.community
             ORDER BY count DESC`,
            params
        );

        // Real-Time Trends (monthly registrations)
        const [trends] = await pool.execute(
            `SELECT DATE_FORMAT(a.created_at, '%Y-%m') as date, COUNT(*) as count 
             FROM applications a
             ${whereClause}
             GROUP BY date
             ORDER BY date ASC
             LIMIT 12`,
            params
        );

        res.json({
            success: true,
            data: {
                totalApplicants: total_applicants,
                totalPayments: total_payments,
                pendingVerification: pending_verification,
                funnel: {
                    draft: funnel.draft || 0,
                    submitted: funnel.submitted || 0,
                    under_review: funnel.under_review || 0,
                    approved: funnel.approved || 0,
                    rejected: funnel.rejected || 0
                },
                departmentDistribution: deptDist,
                communityDistribution: commDist,
                trends
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// â”€â”€ 2. Operational Reports Endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET Applications list and summaries
router.get('/applications', verifyToken, isAdmin, async (req, res) => {
    try {
        const { whereClause, params } = buildFilters(req, 'a');
        await audit(pool, { adminId: req.user.id, action: 'VIEW_REPORT', reportType: 'applications', filters: req.query, ip: req.ip });

        const [rows] = await pool.execute(
            `SELECT a.application_id, a.applicant_name, a.subject, a.community, a.status, a.payment_status, a.created_at
             FROM applications a
             ${whereClause}
             ORDER BY a.created_at DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// GET Payments list and dynamic sums
router.get('/payments', verifyToken, isAdmin, async (req, res) => {
    try {
        const { whereClause, params } = buildFilters(req, 'a');
        await audit(pool, { adminId: req.user.id, action: 'VIEW_REPORT', reportType: 'payments', filters: req.query, ip: req.ip });

        const [rows] = await pool.execute(
            `SELECT p.id, p.application_id, a.applicant_name, p.amount, p.gateway, p.transaction_id, p.payment_status, p.paid_at, a.is_physically_challenged, a.community
             FROM payments p
             JOIN applications a ON p.application_id = a.application_id
             ${whereClause}
             ORDER BY p.paid_at DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// GET Hall Tickets list and centre stats
router.get('/hall-tickets', verifyToken, isAdmin, async (req, res) => {
    try {
        const { whereClause, params } = buildFilters(req, 'a');
        await audit(pool, { adminId: req.user.id, action: 'VIEW_REPORT', reportType: 'hall_tickets', filters: req.query, ip: req.ip });

        const [rows] = await pool.execute(
            `SELECT ht.id, ht.application_id, u.full_name as applicant_name, ht.hall_ticket_number, ht.exam_date, ht.exam_time, ht.exam_venue, ht.seat_number, ht.is_sent
             FROM hall_tickets ht
             JOIN applications a ON ht.application_id = a.application_id
             JOIN users u ON a.user_id = u.id
             ${whereClause}
             ORDER BY ht.created_at DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// GET Attendance report list
router.get('/attendance', verifyToken, isAdmin, async (req, res) => {
    try {
        const { whereClause, params } = buildFilters(req, 'a');
        await audit(pool, { adminId: req.user.id, action: 'VIEW_REPORT', reportType: 'attendance', filters: req.query, ip: req.ip });

        const [rows] = await pool.execute(
            `SELECT a.application_id, a.applicant_name, a.subject, a.exam_center_1, a.attendance_status, ht.hall_ticket_number, ht.seat_number
             FROM applications a
             LEFT JOIN hall_tickets ht ON a.application_id = ht.application_id
             ${whereClause ? whereClause + ' AND' : 'WHERE'} a.status = 'Approved'`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// GET Entrance Marks report
router.get('/entrance-marks', verifyToken, isAdmin, async (req, res) => {
    try {
        const { whereClause, params } = buildFilters(req, 'a');
        await audit(pool, { adminId: req.user.id, action: 'VIEW_REPORT', reportType: 'entrance_marks', filters: req.query, ip: req.ip });

        const [rows] = await pool.execute(
            `SELECT a.application_id, a.applicant_name, a.subject, a.community, a.entrance_mark, a.qualification_status, a.entrance_exam_status
             FROM applications a
             ${whereClause ? whereClause + ' AND' : 'WHERE'} a.status = 'Approved'`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// GET Results report
router.get('/results', verifyToken, isAdmin, async (req, res) => {
    try {
        const { whereClause, params } = buildFilters(req, 'a');
        await audit(pool, { adminId: req.user.id, action: 'VIEW_REPORT', reportType: 'results', filters: req.query, ip: req.ip });

        const [rows] = await pool.execute(
            `SELECT a.application_id, a.applicant_name, a.subject, a.community, a.entrance_mark, a.qualification_status, a.final_result_status
             FROM applications a
             ${whereClause ? whereClause + ' AND' : 'WHERE'} a.status = 'Approved'`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// GET Student Tracking funnel delays
router.get('/student-tracking', verifyToken, isAdmin, async (req, res) => {
    try {
        const { whereClause, params } = buildFilters(req, 'a');
        await audit(pool, { adminId: req.user.id, action: 'VIEW_REPORT', reportType: 'student_tracking', filters: req.query, ip: req.ip });

        const [rows] = await pool.execute(
            `SELECT a.application_id, a.applicant_name, a.subject, a.status, a.payment_status, a.final_submitted_at, a.created_at, a.is_locked, a.counselling_approval
             FROM applications a
             ${whereClause}`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// GET Counselling seat allocation logs
router.get('/counselling', verifyToken, isAdmin, async (req, res) => {
    try {
        const { whereClause, params } = buildFilters(req, 'a');
        await audit(pool, { adminId: req.user.id, action: 'VIEW_REPORT', reportType: 'counselling', filters: req.query, ip: req.ip });

        const [rows] = await pool.execute(
            `SELECT c.application_id, a.applicant_name, a.subject, c.counselling_date, c.counselling_time, c.venue, c.status as counselling_status, ca.allotment_status
             FROM counselling c
             JOIN applications a ON c.application_id COLLATE utf8mb4_unicode_ci = a.application_id COLLATE utf8mb4_unicode_ci
             LEFT JOIN counselling_applications ca ON a.user_id = ca.user_id
             ${whereClause}
             ORDER BY c.counselling_date DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// GET Qualification distributions
router.get('/qualifications', verifyToken, isAdmin, async (req, res) => {
    try {
        const { whereClause, params } = buildFilters(req, 'a');
        await audit(pool, { adminId: req.user.id, action: 'VIEW_REPORT', reportType: 'qualifications', filters: req.query, ip: req.ip });

        const [rows] = await pool.execute(
            `SELECT a.application_id, a.applicant_name, a.subject, a.qualified_exams, a.direct_pass_status, a.entrance_exam_status
             FROM applications a
             ${whereClause}`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// GET Audit Logs report
router.get('/audit', verifyToken, isAdmin, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        let where = 'WHERE 1=1';
        const params = [];
        if (start_date) { where += ' AND al.created_at >= ?'; params.push(start_date + ' 00:00:00'); }
        if (end_date) { where += ' AND al.created_at <= ?'; params.push(end_date + ' 23:59:59'); }

        await audit(pool, { adminId: req.user.id, action: 'VIEW_REPORT', reportType: 'audit', filters: req.query, ip: req.ip });

        const [rows] = await pool.execute(
            `SELECT al.id, al.admin_id, u.full_name as admin_name, al.action, al.entity_type, al.old_value, al.ip_address, al.created_at
             FROM eligibility_audit_log al
             LEFT JOIN users u ON al.admin_id = u.id
             ${where}
             ORDER BY al.created_at DESC
             LIMIT 500`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// GET Supervisor Capacity report
router.get('/supervisor-capacity', verifyToken, isAdmin, async (req, res) => {
    try {
        await audit(pool, { adminId: req.user.id, action: 'VIEW_REPORT', reportType: 'supervisor_capacity', filters: req.query, ip: req.ip });

        const [rows] = await pool.execute(
            `SELECT 
                d.name AS designation,
                d.max_capacity AS configured_capacity,
                COALESCE(SUM(s.current_scholars_count), 0) AS current_usage,
                GREATEST(0, d.max_capacity - COALESCE(SUM(s.current_scholars_count), 0)) AS remaining_capacity
             FROM master_designations d
             LEFT JOIN supervisors s ON d.id = s.designation_id AND s.status = 'Approved'
             WHERE d.is_active = 1
             GROUP BY d.id, d.name, d.max_capacity
             ORDER BY d.name ASC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// â”€â”€ 3. Centralized Export Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.post('/export', verifyToken, isAdmin, async (req, res) => {
    const { report_type, format, filters } = req.body;
    if (!report_type || !format) {
        return res.status(400).json({ success: false, message: 'report_type and format are required' });
    }

    try {
        await audit(pool, { 
            adminId: req.user.id, 
            action: `EXPORT_${format.toUpperCase()}`, 
            reportType: report_type, 
            filters, 
            ip: req.ip 
        });

        // Mock req.query to build SQL filters easily
        req.query = filters || {};
        const { whereClause, params } = buildFilters(req, 'a');

        let rows = [];
        let headers = [];
        let sheetName = 'Report';

        if (report_type === 'applications') {
            sheetName = 'Applications Report';
            headers = ['Application ID', 'Applicant Name', 'Department/Subject', 'Community', 'Status', 'Payment Status', 'Created At'];
            [rows] = await pool.execute(
                `SELECT a.application_id, a.applicant_name, a.subject, a.community, a.status, a.payment_status, a.created_at
                 FROM applications a ${whereClause}`, params
            );
        } else if (report_type === 'payments') {
            sheetName = 'Payments Report';
            headers = ['Transaction ID', 'Application ID', 'Applicant Name', 'Amount (INR)', 'Gateway', 'Payment Status', 'Paid At', 'Community', 'Exempted (PC)'];
            [rows] = await pool.execute(
                `SELECT p.transaction_id, p.application_id, a.applicant_name, p.amount, p.gateway, p.payment_status, p.paid_at, a.community, a.is_physically_challenged
                 FROM payments p JOIN applications a ON p.application_id = a.application_id ${whereClause}`, params
            );
        } else if (report_type === 'hall_tickets') {
            sheetName = 'Hall Tickets Report';
            headers = ['Hall Ticket Number', 'Application ID', 'Applicant Name', 'Subject', 'Exam Date', 'Exam Time', 'Seat Number', 'Exam Venue'];
            [rows] = await pool.execute(
                `SELECT ht.hall_ticket_number, ht.application_id, u.full_name as applicant_name, ht.department, ht.exam_date, ht.exam_time, ht.seat_number, ht.exam_venue
                 FROM hall_tickets ht JOIN applications a ON ht.application_id = a.application_id JOIN users u ON a.user_id = u.id ${whereClause}`, params
            );
        } else if (report_type === 'attendance') {
            sheetName = 'Attendance Report';
            headers = ['Application ID', 'Applicant Name', 'Subject', 'Exam Centre Preference', 'Attendance Status', 'Seat Number'];
            [rows] = await pool.execute(
                `SELECT a.application_id, a.applicant_name, a.subject, a.exam_center_1, a.attendance_status, ht.seat_number
                 FROM applications a LEFT JOIN hall_tickets ht ON a.application_id = ht.application_id ${whereClause ? whereClause + ' AND' : 'WHERE'} a.status = 'Approved'`, params
            );
        } else if (report_type === 'entrance_marks') {
            sheetName = 'Entrance Marks Report';
            headers = ['Application ID', 'Applicant Name', 'Subject', 'Community', 'Entrance Mark', 'Qualification Status', 'Entrance Status'];
            [rows] = await pool.execute(
                `SELECT a.application_id, a.applicant_name, a.subject, a.community, a.entrance_mark, a.qualification_status, a.entrance_exam_status
                 FROM applications a ${whereClause ? whereClause + ' AND' : 'WHERE'} a.status = 'Approved'`, params
            );
        } else if (report_type === 'results') {
            sheetName = 'Results Statistics';
            headers = ['Application ID', 'Applicant Name', 'Subject', 'Community', 'Entrance Mark', 'Qualification Status', 'Result Status'];
            [rows] = await pool.execute(
                `SELECT a.application_id, a.applicant_name, a.subject, a.community, a.entrance_mark, a.qualification_status, a.final_result_status
                 FROM applications a ${whereClause ? whereClause + ' AND' : 'WHERE'} a.status = 'Approved'`, params
            );
        } else if (report_type === 'student_tracking') {
            sheetName = 'Student Progress';
            headers = ['Application ID', 'Applicant Name', 'Subject', 'Status', 'Payment Status', 'Registration Date', 'Final Submitted At'];
            [rows] = await pool.execute(
                `SELECT a.application_id, a.applicant_name, a.subject, a.status, a.payment_status, a.created_at, a.final_submitted_at
                 FROM applications a ${whereClause}`, params
            );
        } else if (report_type === 'counselling') {
            sheetName = 'Counselling Log';
            headers = ['Application ID', 'Applicant Name', 'Subject', 'Counselling Date', 'Counselling Time', 'Venue', 'Counselling Status', 'Allotment Status'];
            [rows] = await pool.execute(
                `SELECT c.application_id, a.applicant_name, a.subject, c.counselling_date, c.counselling_time, c.venue, c.status, ca.allotment_status
                 FROM counselling c JOIN applications a ON c.application_id COLLATE utf8mb4_unicode_ci = a.application_id COLLATE utf8mb4_unicode_ci LEFT JOIN counselling_applications ca ON a.user_id = ca.user_id ${whereClause}`, params
            );
        } else if (report_type === 'qualifications') {
            sheetName = 'Qualifications Profile';
            headers = ['Application ID', 'Applicant Name', 'Subject', 'Qualified Exams', 'Exemption Status'];
            [rows] = await pool.execute(
                `SELECT a.application_id, a.applicant_name, a.subject, a.qualified_exams, a.entrance_exam_status
                 FROM applications a ${whereClause}`, params
            );
        } else if (report_type === 'supervisor_capacity') {
            sheetName = 'Supervisor Capacity Report';
            headers = ['Designation', 'Configured Capacity', 'Current Usage', 'Remaining Capacity'];
            [rows] = await pool.execute(
                `SELECT 
                    d.name AS designation,
                    d.max_capacity AS configured_capacity,
                    COALESCE(SUM(s.current_scholars_count), 0) AS current_usage,
                    GREATEST(0, d.max_capacity - COALESCE(SUM(s.current_scholars_count), 0)) AS remaining_capacity
                 FROM master_designations d
                 LEFT JOIN supervisors s ON d.id = s.designation_id AND s.status = 'Approved'
                 WHERE d.is_active = 1
                 GROUP BY d.id, d.name, d.max_capacity
                 ORDER BY d.name ASC`
            );
        } else if (report_type === 'audit') {
            sheetName = 'System Audit Logs';
            headers = ['Log ID', 'Administrator ID', 'Action', 'Entity Type', 'Activity Details', 'Client IP', 'Timestamp'];
            let auditWhere = 'WHERE 1=1';
            const auditParams = [];
            if (filters?.start_date) { auditWhere += ' AND al.created_at >= ?'; auditParams.push(filters.start_date + ' 00:00:00'); }
            if (filters?.end_date) { auditWhere += ' AND al.created_at <= ?'; auditParams.push(filters.end_date + ' 23:59:59'); }

            [rows] = await pool.execute(
                `SELECT al.id, al.admin_id, al.action, al.entity_type, al.old_value, al.ip_address, al.created_at
                 FROM eligibility_audit_log al ${auditWhere} ORDER BY al.created_at DESC LIMIT 1000`, auditParams
            );
        } else {
            return res.status(400).json({ success: false, message: 'Invalid report_type for export' });
        }

        // Export directly based on format
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${report_type}_report_${Date.now()}.csv"`);

            // UTF-8 BOM ensures Excel opens Tamil/Unicode characters correctly
            let csvContent = 'ï»¿' + headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\n';
            rows.forEach(r => {
                const values = Object.values(r).map(val => {
                    if (val === null || val === undefined) return '""';
                    return `"${String(val).replace(/"/g, '""')}"`;
                });
                csvContent += values.join(',') + '\n';
            });
            return res.send(csvContent);
        } else if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet(sheetName);

            // Watermark / Header info block
            sheet.addRow([]);
            const titleRow = sheet.addRow(['PERIYAR UNIVERSITY - Ph.D ERP SYSTEM']);
            titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF008080' } };
            
            const metaRow = sheet.addRow([`Report: ${sheetName} | Generated By: University Administrator | Date: ${new Date().toLocaleString()}`]);
            metaRow.getCell(1).font = { italic: true, size: 10, color: { argb: 'FF555555' } };
            sheet.addRow([]);

            // Headers row styling
            const headerRow = sheet.addRow(headers);
            headerRow.height = 24;
            headerRow.eachCell(cell => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008080' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    bottom: { style: 'medium' },
                    left: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            // Data rows
            rows.forEach((r, idx) => {
                const rowData = Object.values(r).map(val => {
                    if (typeof val === 'object' && val !== null) return JSON.stringify(val);
                    return val;
                });
                const addedRow = sheet.addRow(rowData);
                addedRow.height = 20;

                // Alternate background color (zebra striping)
                const isEven = idx % 2 === 0;
                addedRow.eachCell(cell => {
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                    cell.font = { size: 10 };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                        right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
                    };
                    if (isEven) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7F8' } };
                    }
                });
            });

            // Auto-fit columns width
            sheet.columns.forEach(column => {
                let maxLen = 12;
                column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
                    if (rowNumber > 4) {
                        const len = cell.value ? String(cell.value).length : 0;
                        if (len > maxLen) maxLen = len;
                    }
                });
                column.width = Math.min(maxLen + 4, 35);
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${report_type}_report_${Date.now()}.xlsx"`);
            const buffer = await workbook.xlsx.writeBuffer();
            return res.send(buffer);
        }
    } catch (err) {
        console.error('Export Failure:', err);
        res.status(500).json({ success: false, message: 'Export failed: ' + err.message });
    }
});

module.exports = router;
