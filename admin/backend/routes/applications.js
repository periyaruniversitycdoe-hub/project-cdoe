
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { getActiveSessionId } = require('../services/sessionCache');
const bcrypt = require('bcrypt');
const ExcelJS = require('exceljs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateCETPHDApplicationId } = require('../../../student/backend/services/applicationIdEngine');

// ─── Multer for admin application saves ──────────────────────────────────────
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const sanitizeFilename = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
const sanitizeId = (id) => String(id || 'admin').replace(/[^a-zA-Z0-9_-]/g, '_');

const adminStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${sanitizeId(req.body.application_id)}_${Date.now()}_${sanitizeFilename(file.originalname)}`)
});
const adminUpload = multer({ storage: adminStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// ─── Allowed columns for application saves ────────────────────────────────────
const APP_ALLOWED_COLUMNS = new Set([
  'user_id','applicant_name','applicant_initial','applicant_name_tamil',
  'exam_center_1','exam_center_2','subject','subject_2','category','working_district',
  'dob','nationality','is_nri','religion','gender','community','parent_name',
  'address_1','address_2','address_3','district','state','pincode',
  'mobile_code','mobile','email','phone',
  'id_type','id_number',
  'is_physically_challenged','pc_percentage','pc_type',
  'qualified_exams',
  'status',
  'part_time_category','part_time_designation','part_time_area',
  'perm_same_as_comm','perm_address_1','perm_address_2','perm_address_3',
  'perm_state','perm_district','perm_city','perm_pincode',
  'has_sslc', 'has_hsc', 'has_ug', 'has_pg', 'has_diploma', 'has_mphil', 'has_integrated'
]);

const SAVE_COLUMNS = {
  school: ['level','institution_name','board_id','other_board_name','passing_month','passing_year','percentage','marksheet_path'],
  higher: ['level','degree_id','degree_name','specialization_id','institution_name','university_name','university_type_id','passing_month','passing_year','score_type','score_value','marksheet_path','consolidated_marksheet_path','registration_number','upload_mode'],
  exp:    ['designation','organization_name','employment_type_id','from_month','from_year','to_month','to_year','total_years','total_months'],
};

const { recomputeFinalResult } = require('../services/eligibilityEngine');

// ─── Helpers ─────────────────────────────────────────────────

async function computeQualification(connection, appId, entrance_mark, attendance_status) {
  // Exempted students skip entrance — always Direct Qualified
  const [[appRow]] = await connection.execute(
    'SELECT entrance_exam_status FROM applications WHERE id = ?', [appId]
  );
  if (appRow?.entrance_exam_status === 'Exempted') return 'Direct Qualified';

  if (attendance_status === 'Absent') return 'Absent';
  if (entrance_mark === null || entrance_mark === undefined) return 'Pending';

  const [[criteria]] = await connection.execute(
    'SELECT passing_mark FROM entrance_settings WHERE id = 1'
  );
  const passingMark = criteria ? parseFloat(criteria.passing_mark) : 50;
  return parseFloat(entrance_mark) >= passingMark ? 'Qualified' : 'Failed';
}

// ─── Stats ────────────────────────────────────────────────────

/**
 * GET /api/applications/stats?session_id=
 */
router.get('/stats', verifyToken, isAdmin, async (req, res) => {
  try {
    const { session_id } = req.query;

    // Resolve session: 'all' → no filter, 'active'/absent → active session, numeric → that session
    let activeSessionId = null;
    if (!session_id || session_id === 'active') {
      activeSessionId = await getActiveSessionId();
    } else if (session_id !== 'all') {
      activeSessionId = parseInt(session_id, 10) || null;
    }

    const sessionFilter = activeSessionId ? ' AND COALESCE(a.session_id, u.session_id) = ?' : '';
    const sessionParam  = activeSessionId ? [activeSessionId] : [];

    const [[counts]] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN a.status = 'Submitted' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN a.status = 'Under Review' THEN 1 ELSE 0 END) as review,
        SUM(CASE WHEN a.status = 'Approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN a.status = 'Rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN a.status = 'Draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN a.payment_status = 'Unpaid' THEN 1 ELSE 0 END) as payPending,
        SUM(CASE WHEN a.payment_status = 'Paid' THEN 1 ELSE 0 END) as payReceived,
        SUM(CASE WHEN a.qualification_status = 'Direct Qualified' THEN 1 ELSE 0 END) as directQ,
        SUM(CASE WHEN a.qualification_status = 'Qualified' THEN 1 ELSE 0 END) as qualified,
        SUM(CASE WHEN a.admission_approved = 1 THEN 1 ELSE 0 END) as admitted,
        SUM(CASE WHEN a.attendance_status = 'Present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN a.attendance_status = 'Absent' THEN 1 ELSE 0 END) as absent
      FROM applications a 
      JOIN users u ON a.user_id = u.id 
      WHERE 1=1 ${sessionFilter}
    `, sessionParam);

    const [[userRow]] = await pool.execute("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    const totalUsers = userRow.count;

    const total = counts.total || 0;
    const submitted = counts.submitted || 0;
    const review = counts.review || 0;
    const approved = counts.approved || 0;
    const rejected = counts.rejected || 0;
    const draft = counts.draft || 0;
    const payPending = counts.payPending || 0;
    const payReceived = counts.payReceived || 0;
    const directQ = counts.directQ || 0;
    const qualified = counts.qualified || 0;
    const admitted = counts.admitted || 0;
    const present = counts.present || 0;
    const absent = counts.absent || 0;

    const monthlySessionClause = activeSessionId ? 'AND COALESCE(a.session_id, u.session_id) = ?' : '';
    const [monthly] = await pool.execute(`
      SELECT DATE_FORMAT(a.created_at, '%b %Y') as month, COUNT(*) as count
      FROM applications a JOIN users u ON a.user_id = u.id
      WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) ${monthlySessionClause}
      GROUP BY DATE_FORMAT(a.created_at, '%b %Y'), DATE_FORMAT(a.created_at, '%Y-%m')
      ORDER BY MIN(a.created_at) ASC
    `, activeSessionId ? [activeSessionId] : []);

    const recentSessionClause = activeSessionId ? 'AND COALESCE(a.session_id, u.session_id) = ?' : '';
    const [recent] = await pool.execute(`
      SELECT a.id, a.application_id, a.subject, a.status, a.created_at, u.full_name, u.email
      FROM applications a JOIN users u ON a.user_id = u.id
      WHERE 1=1 ${recentSessionClause}
      ORDER BY a.created_at DESC LIMIT 5
    `, activeSessionId ? [activeSessionId] : []);

    const [paymentAlerts] = await pool.execute(`
      SELECT * FROM payment_notifications
      WHERE status = 'Pending Verification'
      ORDER BY created_at DESC LIMIT 5
    `);
    const [[{ pendingVerifications }]] = await pool.execute(`
      SELECT COUNT(*) as pendingVerifications FROM payment_notifications WHERE status = 'Pending Verification'
    `);

    res.json({
      success: true,
      data: {
        total, submitted, review, approved, rejected, draft,
        payPending, payReceived, directQualified: directQ, qualified,
        admitted, totalUsers, present, absent, monthly, recent,
        paymentAlerts, pendingVerifications,
        activeSessionId
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/applications/entrance-settings/config
 */
router.get('/entrance-settings/config', verifyToken, isAdmin, async (_req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM entrance_settings WHERE id = 1');
    res.json({ success: true, data: rows[0] || { passing_mark: 50, total_mark: 100 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/applications/entrance-settings/config
 */
router.put('/entrance-settings/config', verifyToken, isAdmin, async (req, res) => {
  const { passing_mark, total_mark } = req.body;
  try {
    await pool.execute(
      'UPDATE entrance_settings SET passing_mark = ?, total_mark = ? WHERE id = 1',
      [passing_mark, total_mark]
    );
    res.json({ success: true, message: 'Entrance criteria updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Export Excel ─────────────────────────────────────────────

/**
 * GET /api/applications/export/excel
 * report_type: applications | payment | attendance | entrance | interview
 */
router.get('/export/excel', verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      search, status, session_id, year, month, course, department, result_status, payment_status,
      attendance_status, qualification_status, admission_approved,
      report_type = 'applications', ignore_filters
    } = req.query;

    // ── 1. Resolve session ────────────────────────────────────
    let resolvedSessionId = null;
    let sessionLabel      = 'All Sessions';
    const sid = session_id;

    if (year || month) {
      if (sid && sid !== 'all' && sid !== 'active') {
        resolvedSessionId = sid;
        const [[sess]] = await pool.execute(
          'SELECT month, year FROM sessions WHERE id = ? LIMIT 1', [resolvedSessionId]
        );
        if (sess) sessionLabel = `${sess.month} ${sess.year}`;
      } else {
        sessionLabel = `Filtered (${year || ''} ${month || ''})`;
      }
    } else {
      if (!sid || sid === 'active') {
        const [[active]] = await pool.execute(
          'SELECT id, month, year FROM sessions WHERE is_active = 1 LIMIT 1'
        );
        if (active) {
          resolvedSessionId = active.id;
          sessionLabel      = `${active.month} ${active.year} (Active)`;
        }
      } else if (sid !== 'all') {
        resolvedSessionId = sid;
        const [[sess]] = await pool.execute(
          'SELECT month, year FROM sessions WHERE id = ? LIMIT 1', [resolvedSessionId]
        );
        if (sess) sessionLabel = `${sess.month} ${sess.year}`;
      }
    }

    // ── 2. University settings ────────────────────────────────
    let uniNameEn = 'Periyar University';
    let uniNameTa = '';
    let uniSub    = 'Salem - 636 011, Tamil Nadu, India';
    try {
      const [[us]] = await pool.execute(
        'SELECT university_name_english, university_name_tamil, subtitle FROM university_settings LIMIT 1'
      );
      if (us) {
        uniNameEn = us.university_name_english || uniNameEn;
        uniNameTa = us.university_name_tamil   || '';
        uniSub    = us.subtitle                || uniSub;
      }
    } catch (_) {}

    // Get pass mark used
    const [[passSettings]] = await pool.execute('SELECT passing_mark FROM entrance_settings WHERE id = 1');
    const passMarkUsed = passSettings ? parseFloat(passSettings.passing_mark) : 50;

    // Get published status
    const [[pubSettings]] = await pool.execute('SELECT entrance_result_publish FROM settings LIMIT 1');
    const publishedStatus = pubSettings && pubSettings.entrance_result_publish ? 'Published' : 'Not Published';

    // ── 3. Build SQL query ────────────────────────────────────
    const conditions = [];
    const params     = [];
    const isIgnore   = ignore_filters === 'true';

    if (!isIgnore) {
      if (resolvedSessionId) { conditions.push('COALESCE(a.session_id, u.session_id) = ?'); params.push(resolvedSessionId); }
      if (search) {
        conditions.push('(u.full_name LIKE ? OR a.application_id LIKE ? OR u.email LIKE ? OR a.subject LIKE ?)');
        const w = `%${search}%`;
        params.push(w, w, w, w);
      }
      if (status && status !== 'All')   { conditions.push('a.status = ?');               params.push(status); }
      if (payment_status)               { conditions.push('a.payment_status = ?');        params.push(payment_status); }
      if (attendance_status)            { conditions.push('a.attendance_status = ?');     params.push(attendance_status); }
      if (qualification_status)         { conditions.push('a.qualification_status = ?');  params.push(qualification_status); }
      if (year)                         { conditions.push('s.year = ?');                 params.push(parseInt(year, 10)); }
      if (month)                        { conditions.push('s.month = ?');                params.push(month); }
      if (department)                   { conditions.push('a.subject = ?');               params.push(department); }
      if (course) {
        if (course === 'Integrated Course') {
          conditions.push("a.has_integrated = 1");
        } else if (course === 'M.Phil') {
          conditions.push("(a.has_mphil = 1 OR a.program_offered_name LIKE 'M.Phil.%')");
        } else if (course === 'Part-Time Ph.D') {
          conditions.push("a.category = 'Part Time' AND a.has_integrated = 0 AND a.has_mphil = 0 AND (a.program_offered_name IS NULL OR a.program_offered_name NOT LIKE 'M.Phil.%')");
        } else if (course === 'Full-Time Ph.D') {
          conditions.push("a.category = 'Full Time' AND a.has_integrated = 0 AND a.has_mphil = 0 AND (a.program_offered_name IS NULL OR a.program_offered_name NOT LIKE 'M.Phil.%')");
        } else if (course === 'Ph.D') {
          conditions.push("a.has_integrated = 0 AND a.has_mphil = 0 AND (a.program_offered_name IS NULL OR a.program_offered_name NOT LIKE 'M.Phil.%') AND (a.category IS NULL OR (a.category != 'Part Time' AND a.category != 'Full Time'))");
        }
      }
      if (admission_approved !== undefined && admission_approved !== '') {
        conditions.push('a.admission_approved = ?');
        params.push(parseInt(admission_approved, 10));
      }
      if (result_status && result_status !== 'All') {
        if (result_status === 'Pass') {
          conditions.push("a.attendance_status = 'Present' AND a.entrance_mark >= ?");
          params.push(passMarkUsed);
        } else if (result_status === 'Fail') {
          conditions.push("a.attendance_status = 'Present' AND a.entrance_mark < ?");
          params.push(passMarkUsed);
        } else if (result_status === 'Absent') {
          conditions.push("a.attendance_status = 'Absent'");
        } else if (result_status === 'Pending') {
          conditions.push("(a.attendance_status IS NULL OR (a.attendance_status = 'Present' AND a.entrance_mark IS NULL))");
        } else if (result_status === 'Qualified') {
          conditions.push("a.qualification_status = 'Qualified'");
        } else if (result_status === 'Not Qualified') {
          conditions.push("a.qualification_status = 'Failed'");
        } else if (result_status === 'Direct Qualified') {
          conditions.push("a.qualification_status = 'Direct Qualified'");
        }
      }
    }

    // Enterprise downstream dependency lock
    if (req.query.source === 'entrance_marks') {
      conditions.push("(a.attendance_status IS NOT NULL OR a.entrance_exam_status = 'Exempted')");
    }
    if (req.query.source === 'attendance') {
      conditions.push("EXISTS (SELECT 1 FROM hall_tickets ht WHERE ht.application_id = a.application_id)");
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : 'WHERE 1=1';

    let query = `
      SELECT a.id, a.application_id, u.full_name, u.email, a.mobile,
             a.subject, a.status, a.payment_status, a.attendance_status,
             a.entrance_mark, a.qualification_status,
             a.admission_approved, a.remarks,
             s.year AS session_year, s.month AS session_month,
             CONCAT(s.month, ' ', s.year) AS session_name,
             a.created_at,
             (CASE
               WHEN a.has_integrated = 1 THEN 'Integrated Course'
               WHEN (a.has_mphil = 1 OR a.program_offered_name LIKE 'M.Phil.%') THEN 'M.Phil'
               WHEN a.category = 'Part Time' THEN 'Part-Time Ph.D'
               WHEN a.category = 'Full Time' THEN 'Full-Time Ph.D'
               ELSE 'Ph.D'
             END) AS applied_course,
             (CASE
               WHEN a.attendance_status = 'Absent' THEN 'ABSENT'
               WHEN a.entrance_mark IS NULL THEN 'PENDING'
               WHEN a.entrance_mark >= ? THEN 'PASS'
               ELSE 'FAIL'
             END) AS result_status
      FROM applications a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN sessions s ON s.id = COALESCE(a.session_id, u.session_id)
      ${whereClause}
      ORDER BY a.created_at DESC
    `;
    const finalParams = [passMarkUsed, ...params];
    const [rows] = await pool.execute(query, finalParams);

    // ── 4. Column definitions per report type ─────────────────
    const REPORT_CONFIGS = {
      applications: {
        title:       'Ph.D. Admission — Application Report',
        sheetName:   'Applications',
        filename:    'application_report',
        columns: [
          { header: 'S.No',                   key: 'sno',                  width: 6  },
          { header: 'Application ID',          key: 'application_id',       width: 18 },
          { header: 'Applicant Name',          key: 'full_name',            width: 26 },
          { header: 'Email',                   key: 'email',                width: 30 },
          { header: 'Mobile',                  key: 'mobile',               width: 14 },
          { header: 'Subject / Department',    key: 'subject',              width: 24 },
          { header: 'Session',                 key: 'session_name',         width: 18 },
          { header: 'Application Status',      key: 'status',               width: 16 },
          { header: 'Payment Status',          key: 'payment_status',       width: 16 },
          { header: 'Attendance',              key: 'attendance_status',    width: 14 },
          { header: 'Entrance Mark',           key: 'entrance_mark',        width: 14 },
          { header: 'Qualification Status',    key: 'qualification_status', width: 20 },
          { header: 'Admission',               key: 'admission_approved',   width: 14 },
          { header: 'Applied Date',            key: 'created_at',           width: 18 },
        ],
        mapRow: (r, i) => ({
          sno:                  i + 1,
          application_id:       r.application_id,
          full_name:            r.full_name,
          email:                r.email,
          mobile:               r.mobile || '—',
          subject:              r.subject || '—',
          session_name:         r.session_name || '—',
          status:               r.status || 'Draft',
          payment_status:       r.payment_status || 'Unpaid',
          attendance_status:    r.attendance_status || 'Not Set',
          entrance_mark:        r.entrance_mark != null ? r.entrance_mark : '—',
          interview_mark:       r.interview_mark != null ? r.interview_mark : '—',
          qualification_status: r.qualification_status || 'Pending',
          admission_approved:   r.admission_approved ? 'Approved' : (r.admission_approved === 0 ? 'Rejected' : 'Pending'),
          created_at:           r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—',
        }),
      },
      payment: {
        title:       'Ph.D. Admission — Payment Report',
        sheetName:   'Payment Report',
        filename:    'payment_report',
        columns: [
          { header: 'S.No',                key: 'sno',             width: 6  },
          { header: 'Application ID',       key: 'application_id', width: 18 },
          { header: 'Applicant Name',       key: 'full_name',      width: 26 },
          { header: 'Email',                key: 'email',          width: 30 },
          { header: 'Mobile',               key: 'mobile',         width: 14 },
          { header: 'Subject / Department', key: 'subject',        width: 24 },
          { header: 'Session',              key: 'session_name',   width: 18 },
          { header: 'Application Status',   key: 'status',         width: 16 },
          { header: 'Payment Status',       key: 'payment_status', width: 16 },
          { header: 'Applied Date',         key: 'created_at',     width: 18 },
        ],
        mapRow: (r, i) => ({
          sno:            i + 1,
          application_id: r.application_id,
          full_name:      r.full_name,
          email:          r.email,
          mobile:         r.mobile || '—',
          subject:        r.subject || '—',
          session_name:   r.session_name || '—',
          status:         r.status || 'Draft',
          payment_status: r.payment_status || 'Unpaid',
          created_at:     r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—',
        }),
      },
      attendance: {
        title:       'Ph.D. Admission — Attendance Report',
        sheetName:   'Attendance Report',
        filename:    'attendance_report',
        columns: [
          { header: 'S.No',                key: 'sno',               width: 6  },
          { header: 'Application ID',       key: 'application_id',   width: 18 },
          { header: 'Applicant Name',       key: 'full_name',        width: 26 },
          { header: 'Email',                key: 'email',            width: 30 },
          { header: 'Mobile',               key: 'mobile',           width: 14 },
          { header: 'Subject / Department', key: 'subject',          width: 24 },
          { header: 'Session',              key: 'session_name',     width: 18 },
          { header: 'Attendance Status',    key: 'attendance_status',width: 18 },
        ],
        mapRow: (r, i) => ({
          sno:              i + 1,
          application_id:   r.application_id,
          full_name:        r.full_name,
          email:            r.email,
          mobile:           r.mobile || '—',
          subject:          r.subject || '—',
          session_name:     r.session_name || '—',
          attendance_status:r.attendance_status || 'Not Set',
        }),
      },
      entrance: {
        title:       'Ph.D. Admission — Entrance Mark Report',
        sheetName:   'Entrance Marks',
        filename:    'entrance_mark_report',
        columns: [
          { header: 'Session Year',         key: 'session_year',         width: 14 },
          { header: 'Session Month',        key: 'session_month',        width: 14 },
          { header: 'Application ID',       key: 'application_id',       width: 18 },
          { header: 'Applicant Name',       key: 'full_name',            width: 26 },
          { header: 'Email',                key: 'email',                width: 30 },
          { header: 'Department',           key: 'subject',              width: 24 },
          { header: 'Applied Course',       key: 'applied_course',       width: 22 },
          { header: 'Attendance Status',    key: 'attendance_status',    width: 18 },
          { header: 'Entrance Mark',        key: 'entrance_mark',        width: 14 },
          { header: 'Pass Mark Used',       key: 'pass_mark_used',       width: 16 },
          { header: 'Result Status',        key: 'result_status',        width: 16 },
          { header: 'Qualification Status', key: 'qualification_status', width: 22 },
          { header: 'Published Status',     key: 'published_status',     width: 18 },
          { header: 'Generated Date',       key: 'generated_date',       width: 18 },
        ],
        mapRow: (r) => ({
          session_year:         r.session_year || '—',
          session_month:        r.session_month || '—',
          application_id:       r.application_id,
          full_name:            r.full_name,
          email:                r.email,
          subject:              r.subject || '—',
          applied_course:       r.applied_course || '—',
          attendance_status:    r.attendance_status || 'Not Set',
          entrance_mark:        r.entrance_mark != null ? r.entrance_mark : '—',
          pass_mark_used:       passMarkUsed,
          result_status:        r.result_status || 'PENDING',
          qualification_status: r.qualification_status || 'Pending',
          published_status:     publishedStatus,
          generated_date:       new Date().toLocaleDateString('en-IN'),
        }),
      },
      interview: {
        title:       'Ph.D. Admission — Interview Mark Report',
        sheetName:   'Interview Marks',
        filename:    'interview_mark_report',
        columns: [
          { header: 'S.No',                key: 'sno',                  width: 6  },
          { header: 'Application ID',       key: 'application_id',       width: 18 },
          { header: 'Applicant Name',       key: 'full_name',            width: 26 },
          { header: 'Email',                key: 'email',                width: 30 },
          { header: 'Mobile',               key: 'mobile',               width: 14 },
          { header: 'Subject / Department', key: 'subject',              width: 24 },
          { header: 'Session',              key: 'session_name',         width: 18 },
          { header: 'Qualification Status', key: 'qualification_status', width: 20 },
          { header: 'Interview Mark',       key: 'interview_mark',       width: 14 },
        ],
        mapRow: (r, i) => ({
          sno:                  i + 1,
          application_id:       r.application_id,
          full_name:            r.full_name,
          email:                r.email,
          mobile:               r.mobile || '—',
          subject:              r.subject || '—',
          session_name:         r.session_name || '—',
          qualification_status: r.qualification_status || 'Pending',
          interview_mark:       r.interview_mark != null ? r.interview_mark : '—',
        }),
      },
    };

    const config   = REPORT_CONFIGS[report_type] || REPORT_CONFIGS.applications;
    const C        = config.columns.length; // column count

    // ── 5. Build workbook ─────────────────────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Periyar University ERP';
    workbook.created = new Date();

    const ws = workbook.addWorksheet(config.sheetName, {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
      views:     [{ state: 'frozen', ySplit: 6 }],
    });

    // Column widths & key mapping (no header: — we add title rows manually)
    ws.columns = config.columns.map(col => ({ key: col.key, width: col.width }));

    const TEAL   = 'FF32C5D2';
    const DARK   = 'FF2C3E50';
    const LTBLUE = 'FFF0FBFC';
    const BORDER = 'FFD0E8EB';

    const styleCell = (cell, opts) => Object.assign(cell, opts);

    // ── Row 1: University name ────────────────────────────────
    ws.addRow([uniNameEn]);
    ws.mergeCells(1, 1, 1, C);
    ws.getRow(1).height = 30;
    styleCell(ws.getRow(1).getCell(1), {
      font:      { bold: true, size: 16, color: { argb: 'FFFFFFFF' } },
      fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });

    // ── Row 2: Subtitle / Tamil name ─────────────────────────
    ws.addRow([uniNameTa ? `${uniNameTa}  |  ${uniSub}` : uniSub]);
    ws.mergeCells(2, 1, 2, C);
    ws.getRow(2).height = 20;
    styleCell(ws.getRow(2).getCell(1), {
      font:      { size: 11, color: { argb: 'FFFFFFFF' } },
      fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });

    // ── Row 3: Report title ───────────────────────────────────
    ws.addRow([config.title]);
    ws.mergeCells(3, 1, 3, C);
    ws.getRow(3).height = 22;
    styleCell(ws.getRow(3).getCell(1), {
      font:      { bold: true, size: 13, color: { argb: DARK } },
      fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF8F9' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border:    { bottom: { style: 'medium', color: { argb: TEAL } } },
    });

    // ── Row 4: Metadata ───────────────────────────────────────
    const genDate = new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });
    ws.addRow([`Session: ${sessionLabel}     Generated: ${genDate}     Total Records: ${rows.length}`]);
    ws.mergeCells(4, 1, 4, C);
    ws.getRow(4).height = 16;
    styleCell(ws.getRow(4).getCell(1), {
      font:      { italic: true, size: 10, color: { argb: 'FF555555' } },
      fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });

    // ── Row 5: Spacer ─────────────────────────────────────────
    ws.addRow([]);
    ws.getRow(5).height = 6;

    // ── Row 6: Column headers ─────────────────────────────────
    ws.addRow(config.columns.map(col => col.header));
    ws.getRow(6).height = 22;
    ws.getRow(6).eachCell({ includeEmpty: true }, (cell) => {
      cell.font      = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border    = {
        top:    { style: 'medium', color: { argb: TEAL } },
        bottom: { style: 'medium', color: { argb: TEAL } },
        left:   { style: 'thin',   color: { argb: TEAL } },
        right:  { style: 'thin',   color: { argb: TEAL } },
      };
    });

    // ── Rows 7+: Data ─────────────────────────────────────────
    rows.forEach((r, i) => {
      const dr = ws.addRow(config.mapRow(r, i));
      dr.height  = 18;
      const bg   = i % 2 === 0 ? LTBLUE : 'FFFFFFFF';
      dr.eachCell({ includeEmpty: true }, (cell, cn) => {
        const key = config.columns[cn - 1]?.key;
        const isNum = key === 'sno' || key === 'entrance_mark' || key === 'interview_mark';
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.font      = { size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: isNum ? 'center' : 'left' };
        cell.border    = {
          top:    { style: 'thin', color: { argb: BORDER } },
          bottom: { style: 'thin', color: { argb: BORDER } },
          left:   { style: 'thin', color: { argb: BORDER } },
          right:  { style: 'thin', color: { argb: BORDER } },
        };
      });
    });

    // ── Summary block ─────────────────────────────────────────
    ws.addRow([]);

    const addSummary = (label, count) => {
      const half = Math.floor(C / 2);
      const sr = ws.addRow([]);
      sr.height = 16;
      ws.mergeCells(sr.number, 1, sr.number, half);
      ws.mergeCells(sr.number, half + 1, sr.number, C);
      sr.getCell(1).value         = label;
      sr.getCell(half + 1).value  = count;
      sr.getCell(1).font          = { bold: true, size: 10 };
      sr.getCell(half + 1).font   = { size: 10 };
      sr.getCell(1).alignment     = { horizontal: 'right' };
      sr.getCell(half + 1).alignment = { horizontal: 'left' };
    };

    addSummary('Total Applications:', rows.length);
    if (['payment', 'applications'].includes(report_type)) {
      addSummary('Paid:',   rows.filter(r => r.payment_status === 'Paid').length);
      addSummary('Unpaid:', rows.filter(r => r.payment_status !== 'Paid' && r.payment_status !== 'Failed').length);
    }
    if (['attendance', 'entrance', 'applications'].includes(report_type)) {
      addSummary('Present:', rows.filter(r => r.attendance_status === 'Present').length);
      addSummary('Absent:',  rows.filter(r => r.attendance_status === 'Absent').length);
    }
    if (['entrance', 'interview', 'applications'].includes(report_type)) {
      addSummary('Qualified:', rows.filter(r => ['Qualified','Direct Qualified'].includes(r.qualification_status)).length);
      addSummary('Failed:',    rows.filter(r => r.qualification_status === 'Failed').length);
    }

    // Auto-filter on header row (row 6)
    ws.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: C } };

    // ── 6. Send ───────────────────────────────────────────────
    const filename = `${config.filename}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err.message);
    if (!res.headersSent) res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Filters ──────────────────────────────────────────────────

/**
 * GET /api/applications/filters
 * Retrieves distinct years, months, and courses dynamically based on cascade logic.
 */
router.get('/filters', verifyToken, isAdmin, async (req, res) => {
  try {
    const { year, month, department, source } = req.query;
    const isEntrance = source === 'entrance_marks';

    // 1. Dynamic Years (Show only years that actually exist in the database)
    const yearCond = isEntrance ? "AND (a.attendance_status IS NOT NULL OR a.entrance_exam_status = 'Exempted')" : "";
    const [yearRows] = await pool.execute(`
      SELECT DISTINCT s.year 
      FROM applications a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN sessions s ON s.id = COALESCE(a.session_id, u.session_id)
      WHERE s.year IS NOT NULL ${yearCond}
      ORDER BY s.year DESC
    `);
    const years = yearRows.map(r => r.year);

    // 2. Dynamic Months (Show only months that exist in database, filtered by year if provided)
    const monthConds = ['s.month IS NOT NULL'];
    const monthParams = [];
    if (year) {
      monthConds.push('s.year = ?');
      monthParams.push(parseInt(year, 10));
    }
    if (isEntrance) {
      monthConds.push("(a.attendance_status IS NOT NULL OR a.entrance_exam_status = 'Exempted')");
    }
    const [monthRows] = await pool.execute(`
      SELECT DISTINCT s.month 
      FROM applications a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN sessions s ON s.id = COALESCE(a.session_id, u.session_id)
      WHERE ${monthConds.join(' AND ')}
      ORDER BY FIELD(s.month, 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December')
    `, monthParams);
    const months = monthRows.map(r => r.month);

    // 3. Dynamic Departments (Show only existing departments, filtered by year and month if provided)
    const deptConds = ["a.subject IS NOT NULL AND a.subject != ''"];
    const deptParams = [];
    if (year) {
      deptConds.push('s.year = ?');
      deptParams.push(parseInt(year, 10));
    }
    if (month) {
      deptConds.push('s.month = ?');
      deptParams.push(month);
    }
    if (isEntrance) {
      deptConds.push("(a.attendance_status IS NOT NULL OR a.entrance_exam_status = 'Exempted')");
    }
    const [deptRows] = await pool.execute(`
      SELECT DISTINCT a.subject AS department
      FROM applications a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN sessions s ON s.id = COALESCE(a.session_id, u.session_id)
      WHERE ${deptConds.join(' AND ')}
      ORDER BY a.subject ASC
    `, deptParams);
    const departments = deptRows.map(r => r.department);

    // 4. Dynamic Courses (Show only courses that actually exist, filtered by year, month, and department if provided)
    const courseConds = ['1=1'];
    const courseParams = [];
    if (year) {
      courseConds.push('s.year = ?');
      courseParams.push(parseInt(year, 10));
    }
    if (month) {
      courseConds.push('s.month = ?');
      courseParams.push(month);
    }
    if (department) {
      courseConds.push('a.subject = ?');
      courseParams.push(department);
    }
    if (isEntrance) {
      courseConds.push("(a.attendance_status IS NOT NULL OR a.entrance_exam_status = 'Exempted')");
    }
    const [courseRows] = await pool.execute(`
      SELECT DISTINCT CASE
        WHEN a.has_integrated = 1 THEN 'Integrated Course'
        WHEN (a.has_mphil = 1 OR a.program_offered_name LIKE 'M.Phil.%') THEN 'M.Phil'
        WHEN a.category = 'Part Time' THEN 'Part-Time Ph.D'
        WHEN a.category = 'Full Time' THEN 'Full-Time Ph.D'
        ELSE 'Ph.D'
      END AS applied_course
      FROM applications a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN sessions s ON s.id = COALESCE(a.session_id, u.session_id)
      WHERE ${courseConds.join(' AND ')}
    `, courseParams);
    const courses = courseRows.map(r => r.applied_course).filter(Boolean);

    res.json({
      success: true,
      data: { years, months, departments, courses }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── List ─────────────────────────────────────────────────────

/**
 * GET /api/applications
 * Full filter: search, status, session_id, payment, attendance, qualification, admission
 * Default: active session
 */
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      search, status, session_id, year, month, course, department, result_status, session_type_id,
      payment_status, qualification_status, attendance_status,
      admission_approved, sort_by, sort_dir,
      final_result_status, entrance_exam_status,
      page: pageParam, limit: limitParam
    } = req.query;

    // ── Resolve session (cached) ──────────────────────────────────
    let resolvedSessionId = session_id;
    if (year || month) {
      if (!resolvedSessionId || resolvedSessionId === 'active') {
        resolvedSessionId = null;
      }
    } else {
      if (!resolvedSessionId || resolvedSessionId === 'active') {
        resolvedSessionId = await getActiveSessionId();
      }
    }
    if (resolvedSessionId === 'all') {
      resolvedSessionId = null;
    }

    // ── Build WHERE conditions array ──────────────────────────────
    const conditions = [];
    const params     = [];

    if (resolvedSessionId) { conditions.push('COALESCE(a.session_id, u.session_id) = ?'); params.push(resolvedSessionId); }
    if (search) {
      conditions.push('(u.full_name LIKE ? OR a.application_id LIKE ? OR u.email LIKE ? OR a.subject LIKE ?)');
      const w = `%${search}%`;
      params.push(w, w, w, w);
    }
    if (status && status !== 'All') { conditions.push('a.status = ?');               params.push(status); }
    if (year)                       { conditions.push('s.year = ?');                  params.push(parseInt(year, 10)); }
    if (month)                      { conditions.push('s.month = ?');                 params.push(month); }
    if (department)                 { conditions.push('a.subject = ?');               params.push(department); }
    if (course) {
      if (course === 'Integrated Course') {
        conditions.push("a.has_integrated = 1");
      } else if (course === 'M.Phil') {
        conditions.push("(a.has_mphil = 1 OR a.program_offered_name LIKE 'M.Phil.%')");
      } else if (course === 'Part-Time Ph.D') {
        conditions.push("a.category = 'Part Time' AND a.has_integrated = 0 AND a.has_mphil = 0 AND (a.program_offered_name IS NULL OR a.program_offered_name NOT LIKE 'M.Phil.%')");
      } else if (course === 'Full-Time Ph.D') {
        conditions.push("a.category = 'Full Time' AND a.has_integrated = 0 AND a.has_mphil = 0 AND (a.program_offered_name IS NULL OR a.program_offered_name NOT LIKE 'M.Phil.%')");
      } else if (course === 'Ph.D') {
        conditions.push("a.has_integrated = 0 AND a.has_mphil = 0 AND (a.program_offered_name IS NULL OR a.program_offered_name NOT LIKE 'M.Phil.%') AND (a.category IS NULL OR (a.category != 'Part Time' AND a.category != 'Full Time'))");
      }
    }
    if (session_type_id)            { conditions.push('s.session_type_id = ?');       params.push(session_type_id); }
    if (payment_status)             { conditions.push('a.payment_status = ?');        params.push(payment_status); }
    if (qualification_status)       { conditions.push('a.qualification_status = ?');  params.push(qualification_status); }
    if (attendance_status)          { conditions.push('a.attendance_status = ?');     params.push(attendance_status); }
    if (admission_approved !== undefined && admission_approved !== '') {
      conditions.push('a.admission_approved = ?');
      params.push(parseInt(admission_approved, 10));
    }
    if (final_result_status)  { conditions.push('a.final_result_status = ?');  params.push(final_result_status); }
    if (entrance_exam_status) { conditions.push('a.entrance_exam_status = ?'); params.push(entrance_exam_status); }

    // Result Status dynamic condition mapping
    if (result_status && result_status !== 'All') {
      if (result_status === 'Pass') {
        conditions.push("a.attendance_status = 'Present' AND a.entrance_mark >= (SELECT passing_mark FROM entrance_settings WHERE id = 1)");
      } else if (result_status === 'Fail') {
        conditions.push("a.attendance_status = 'Present' AND a.entrance_mark < (SELECT passing_mark FROM entrance_settings WHERE id = 1)");
      } else if (result_status === 'Absent') {
        conditions.push("a.attendance_status = 'Absent'");
      } else if (result_status === 'Pending') {
        conditions.push("(a.attendance_status IS NULL OR (a.attendance_status = 'Present' AND a.entrance_mark IS NULL))");
      } else if (result_status === 'Qualified') {
        conditions.push("a.qualification_status = 'Qualified'");
      } else if (result_status === 'Not Qualified') {
        conditions.push("a.qualification_status = 'Failed'");
      } else if (result_status === 'Direct Qualified') {
        conditions.push("a.qualification_status = 'Direct Qualified'");
      }
    }

    // Enterprise downstream dependency lock
    if (req.query.source === 'entrance_marks') {
      conditions.push("(a.attendance_status IS NOT NULL OR a.entrance_exam_status = 'Exempted')");
    }
    if (req.query.source === 'attendance') {
      conditions.push("EXISTS (SELECT 1 FROM hall_tickets ht WHERE ht.application_id = a.application_id)");
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : 'WHERE 1=1';

    // ── Sorting ───────────────────────────────────────────────────
    const allowedSorts = [
      'created_at','entrance_mark',
      'attendance_status','payment_status','qualification_status',
      'admission_approved','full_name'
    ];
    const sortCol = allowedSorts.includes(sort_by)
      ? (sort_by === 'full_name' ? 'u.full_name' : `a.${sort_by}`)
      : 'a.created_at';
    const sortDirection = sort_dir === 'asc' ? 'ASC' : 'DESC';

    const baseJoin = `
      FROM applications a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN sessions s ON s.id = COALESCE(a.session_id, u.session_id)
      ${whereClause}`;

    const selectCols = `a.*, u.full_name, u.email,
      (SELECT full_name FROM users WHERE id = a.rejected_by LIMIT 1) AS rejected_by_name,
      s.year AS session_year, s.month AS session_month,
      CONCAT(s.month, ' ', s.year) AS session_name,
      (CASE
        WHEN a.has_integrated = 1 THEN 'Integrated Course'
        WHEN (a.has_mphil = 1 OR a.program_offered_name LIKE 'M.Phil.%') THEN 'M.Phil'
        WHEN a.category = 'Part Time' THEN 'Part-Time Ph.D'
        WHEN a.category = 'Full Time' THEN 'Full-Time Ph.D'
        ELSE 'Ph.D'
      END) AS applied_course,
      (CASE
        WHEN a.attendance_status = 'Absent' THEN 'ABSENT'
        WHEN a.entrance_mark IS NULL THEN 'PENDING'
        WHEN a.entrance_mark >= (SELECT passing_mark FROM entrance_settings WHERE id = 1) THEN 'PASS'
        ELSE 'FAIL'
      END) AS result_status`;

    // ── Dynamic overall counts for summary cards ───────────────────
    const summaryQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN (a.attendance_status = 'Present' AND a.entrance_mark >= (SELECT passing_mark FROM entrance_settings WHERE id = 1)) THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN (a.attendance_status = 'Present' AND a.entrance_mark < (SELECT passing_mark FROM entrance_settings WHERE id = 1)) THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN a.attendance_status = 'Absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN (a.attendance_status = 'Present' AND a.entrance_mark IS NULL) OR a.attendance_status IS NULL THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN a.qualification_status = 'Qualified' THEN 1 ELSE 0 END) as qualified,
        SUM(CASE WHEN a.qualification_status = 'Direct Qualified' THEN 1 ELSE 0 END) as direct_qualified
      ${baseJoin}
    `;
    const [[summary]] = await pool.execute(summaryQuery, params);

    // ── Pagination (opt-in — backward compatible when page absent) ─
    const page  = parseInt(pageParam,  10);
    const limit = parseInt(limitParam, 10);

    if (limitParam === 'all') {
      const [rows] = await pool.execute(
        `SELECT ${selectCols} ${baseJoin} ORDER BY ${sortCol} ${sortDirection}`, params
      );
      return res.json({
        success: true, data: rows,
        total: rows.length, page: 1, limit: 'all', totalPages: 1,
        summary,
        activeSessionId: resolvedSessionId
      });
    }

    if (page > 0 && limit > 0) {
      const offset = (page - 1) * limit;
      const [[{ count: total }]] = await pool.execute(
        `SELECT COUNT(*) as count ${baseJoin}`, params
      );
      const [rows] = await pool.execute(
        `SELECT ${selectCols} ${baseJoin} ORDER BY ${sortCol} ${sortDirection} LIMIT ${limit} OFFSET ${offset}`,
        params
      );
      return res.json({
        success: true, data: rows,
        total, page, limit, totalPages: Math.ceil(total / limit),
        summary,
        activeSessionId: resolvedSessionId
      });
    }

    // No pagination — return full result set (existing behaviour preserved)
    const [rows] = await pool.execute(
      `SELECT ${selectCols} ${baseJoin} ORDER BY ${sortCol} ${sortDirection}`, params
    );
    res.json({ success: true, data: rows, total: rows.length, summary, activeSessionId: resolvedSessionId });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Single application ───────────────────────────────────────

/**
 * GET /api/applications/:id
 */
router.get('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT a.*, u.full_name, u.email,
             CONCAT(s.month, ' ', s.year) AS session_name,
             au.full_name AS rejected_by_name
      FROM applications a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN sessions s ON a.session_id = s.id
      LEFT JOIN users au ON au.id = a.rejected_by
      WHERE a.id = ?
    `, [req.params.id]);

    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Application not found' });
    const application = rows[0];
    const appId = application.application_id;

    const [school]     = await pool.execute('SELECT * FROM school_education WHERE application_id = ?', [appId]);
    const [higher]     = await pool.execute('SELECT * FROM higher_education WHERE application_id = ?', [appId]);
    const [experience] = await pool.execute('SELECT * FROM experience_details WHERE application_id = ?', [appId]);
    const [documents]  = await pool.execute('SELECT * FROM application_documents WHERE application_id = ? OR user_id = ?', [appId, application.user_id]);

    application.school_education  = school;
    application.higher_education  = higher.filter(h => h.level === 'UG' || h.level === 'PG');
    application.diploma           = higher.find(h => h.level === 'Diploma') || null;
    application.mphil             = higher.find(h => h.level === 'M.Phil') || null;
    application.integrated        = higher.find(h => h.level === 'Integrated') || null;
    application.experience_details = experience;

    res.json({ success: true, data: application, documents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Create ───────────────────────────────────────────────────

/**
 * POST /api/applications/add
 */
router.post('/add', verifyToken, isAdmin, async (req, res) => {
  const { full_name, email, password } = req.body;
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Link to active session (must be resolved before ID generation)
    const [[activeSession]] = await connection.execute(
      'SELECT id FROM sessions WHERE is_active = 1 LIMIT 1'
    );
    const sessionId = activeSession ? activeSession.id : null;

    if (!sessionId) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'No active session found. Please activate a session before creating applications.' });
    }

    // Generate official CETPHD Application ID (same engine used by student portal)
    let applicationId;
    try {
      applicationId = await generateCETPHDApplicationId(pool, sessionId);
    } catch (idErr) {
      await connection.rollback();
      return res.status(500).json({ success: false, message: 'Failed to generate Application ID: ' + idErr.message });
    }

    const [userResult] = await connection.execute(
      'INSERT INTO users (application_id, full_name, email, password, session_id) VALUES (?, ?, ?, ?, ?)',
      [applicationId, full_name, email, hashedPassword, sessionId]
    );
    const userId = userResult.insertId;

    await connection.execute(
      'INSERT INTO applications (application_id, user_id, session_id, status, application_submitted, application_id_generated_at) VALUES (?, ?, ?, "Submitted", 1, NOW())',
      [applicationId, userId, sessionId]
    );

    await connection.commit();
    res.json({ success: true, message: 'Application created', applicationId });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
});

// ─── Admin Save (replaces student-side /save for admin-created apps) ──────────
/**
 * POST /api/applications/save-admin
 * Accepts the same multipart form as the student /save endpoint but uses admin auth.
 */
router.post('/save-admin', verifyToken, isAdmin, adminUpload.any(), async (req, res) => {
  try {
    const raw = { ...req.body };
    const files = req.files || [];
    const appId = raw.application_id;
    if (!appId) return res.status(400).json({ success: false, message: 'Missing application_id' });

    if (raw.qualified_exams && typeof raw.qualified_exams !== 'string') {
      raw.qualified_exams = JSON.stringify(raw.qualified_exams);
    }

    // 1. Main application fields
    const data = {};
    for (const [k, v] of Object.entries(raw)) {
      if (APP_ALLOWED_COLUMNS.has(k) && v !== undefined) {
        let val = (v === '' || v === 'null' || v === 'undefined') ? null : v;
        if (val === 'true') val = 1;
        if (val === 'false') val = 0;
        data[k] = val;
      }
    }

    const [existing] = await pool.execute('SELECT id FROM applications WHERE application_id = ?', [appId]);
    if (existing.length > 0) {
      if (Object.keys(data).length > 0) {
        const sets = Object.keys(data).map(k => {
          if (k === 'qualified_exams') return `\`${k}\` = CAST(? AS JSON)`;
          return `\`${k}\` = ?`;
        }).join(', ');
        await pool.execute(`UPDATE applications SET ${sets} WHERE application_id = ?`, [...Object.values(data), appId]);
      }
    } else {
      const cols = ['application_id', ...Object.keys(data)];
      const vals = [appId, ...Object.values(data)];
      const placeholders = cols.map(c => {
        if (c === 'qualified_exams') return 'CAST(? AS JSON)';
        return '?';
      }).join(', ');
      await pool.execute(
        `INSERT INTO applications (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`,
        vals
      );
    }

    // Synchronize parent user's full name with applicant_name + applicant_initial
    if (data.applicant_name !== undefined) {
      const initial = data.applicant_initial || '';
      const fullNameConcatenated = `${data.applicant_name}${initial ? ' ' + initial : ''}`.trim().toUpperCase();
      const [appRow] = await pool.execute('SELECT user_id FROM applications WHERE application_id = ?', [appId]);
      if (appRow.length > 0) {
        await pool.execute('UPDATE users SET full_name = ? WHERE id = ?', [fullNameConcatenated, appRow[0].user_id]);
      }
    }

    // 2. School education
    if (raw.school_education) {
      const schoolData = typeof raw.school_education === 'string' ? JSON.parse(raw.school_education) : raw.school_education;
      for (const item of schoolData) {
        const { id, ...rawFields } = item;
        const fields = {};
        SAVE_COLUMNS.school.forEach(c => {
          if (rawFields[c] !== undefined) fields[c] = (rawFields[c] === '' || rawFields[c] === 'null' || rawFields[c] === 'undefined') ? null : rawFields[c];
        });
        let existingId = id;
        if (!existingId && fields.level) {
          const [ex] = await pool.execute('SELECT id FROM school_education WHERE application_id = ? AND level = ?', [appId, fields.level]);
          if (ex.length > 0) existingId = ex[0].id;
        }
        if (existingId) {
          const sets = Object.keys(fields).map(k => `\`${k}\` = ?`).join(', ');
          if (sets) await pool.execute(`UPDATE school_education SET ${sets} WHERE id = ?`, [...Object.values(fields), existingId]);
        } else {
          const cols = ['application_id', ...Object.keys(fields)];
          const vals = [appId, ...Object.values(fields)];
          await pool.execute(`INSERT INTO school_education (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
        }
      }
    }

    // 3. Higher education
    if (raw.higher_education) {
      const higherData = typeof raw.higher_education === 'string' ? JSON.parse(raw.higher_education) : raw.higher_education;
      for (const item of higherData) {
        const { id, ...rawFields } = item;
        const fields = {};
        SAVE_COLUMNS.higher.forEach(c => {
          if (rawFields[c] !== undefined) fields[c] = (rawFields[c] === '' || rawFields[c] === 'null' || rawFields[c] === 'undefined') ? null : rawFields[c];
        });
        let existingId = id;
        if (!existingId && fields.level) {
          const [ex] = await pool.execute('SELECT id FROM higher_education WHERE application_id = ? AND level = ?', [appId, fields.level]);
          if (ex.length > 0) existingId = ex[0].id;
        }
        if (existingId) {
          const sets = Object.keys(fields).map(k => `\`${k}\` = ?`).join(', ');
          if (sets) await pool.execute(`UPDATE higher_education SET ${sets} WHERE id = ?`, [...Object.values(fields), existingId]);
        } else {
          const cols = ['application_id', ...Object.keys(fields)];
          const vals = [appId, ...Object.values(fields)];
          await pool.execute(`INSERT INTO higher_education (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
        }
      }
    }

    // 4. Diploma (stored as a single higher_education row with level = 'Diploma')
    if (raw.diploma) {
      const diploma = typeof raw.diploma === 'string' ? JSON.parse(raw.diploma) : raw.diploma;
      const fields = {};
      SAVE_COLUMNS.higher.forEach(c => {
        if (diploma[c] !== undefined) fields[c] = (diploma[c] === '' || diploma[c] === 'null') ? null : diploma[c];
      });
      if (!fields.level) fields.level = 'Diploma';
      const [ex] = await pool.execute('SELECT id FROM higher_education WHERE application_id = ? AND level = "Diploma"', [appId]);
      if (ex.length > 0) {
        const sets = Object.keys(fields).map(k => `\`${k}\` = ?`).join(', ');
        if (sets) await pool.execute(`UPDATE higher_education SET ${sets} WHERE id = ?`, [...Object.values(fields), ex[0].id]);
      } else {
        const cols = ['application_id', ...Object.keys(fields)];
        const vals = [appId, ...Object.values(fields)];
        await pool.execute(`INSERT INTO higher_education (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
      }
    }

    // 5. M.Phil
    if (raw.mphil) {
      const mphil = typeof raw.mphil === 'string' ? JSON.parse(raw.mphil) : raw.mphil;
      const fields = {};
      SAVE_COLUMNS.higher.forEach(c => {
        if (mphil[c] !== undefined) fields[c] = (mphil[c] === '' || mphil[c] === 'null') ? null : mphil[c];
      });
      if (!fields.level) fields.level = 'M.Phil';
      const [ex] = await pool.execute('SELECT id FROM higher_education WHERE application_id = ? AND level = "M.Phil"', [appId]);
      if (ex.length > 0) {
        const sets = Object.keys(fields).map(k => `\`${k}\` = ?`).join(', ');
        if (sets) await pool.execute(`UPDATE higher_education SET ${sets} WHERE id = ?`, [...Object.values(fields), ex[0].id]);
      } else {
        const cols = ['application_id', ...Object.keys(fields)];
        const vals = [appId, ...Object.values(fields)];
        await pool.execute(`INSERT INTO higher_education (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
      }
    }

    // 5.1 Integrated Course (stored as a single higher_education row with level = 'Integrated')
    if (raw.integrated) {
      const integrated = typeof raw.integrated === 'string' ? JSON.parse(raw.integrated) : raw.integrated;
      const fields = {};
      SAVE_COLUMNS.higher.forEach(c => {
        if (integrated[c] !== undefined) fields[c] = (integrated[c] === '' || integrated[c] === 'null') ? null : integrated[c];
      });
      if (!fields.level) fields.level = 'Integrated';
      const [ex] = await pool.execute('SELECT id FROM higher_education WHERE application_id = ? AND level = "Integrated"', [appId]);
      if (ex.length > 0) {
        const sets = Object.keys(fields).map(k => `\`${k}\` = ?`).join(', ');
        if (sets) await pool.execute(`UPDATE higher_education SET ${sets} WHERE id = ?`, [...Object.values(fields), ex[0].id]);
      } else {
        const cols = ['application_id', ...Object.keys(fields)];
        const vals = [appId, ...Object.values(fields)];
        await pool.execute(`INSERT INTO higher_education (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
      }
    }

    // 6. Experience details
    if (raw.experience_details) {
      const expData = typeof raw.experience_details === 'string' ? JSON.parse(raw.experience_details) : raw.experience_details;
      for (const item of expData) {
        const { id, ...rawFields } = item;
        const fields = {};
        SAVE_COLUMNS.exp.forEach(c => {
          if (rawFields[c] !== undefined) fields[c] = (rawFields[c] === '' || rawFields[c] === 'null') ? null : rawFields[c];
        });
        if (id) {
          const sets = Object.keys(fields).map(k => `\`${k}\` = ?`).join(', ');
          if (sets) await pool.execute(`UPDATE experience_details SET ${sets} WHERE id = ? AND application_id = ?`, [...Object.values(fields), id, appId]);
        } else {
          const cols = ['application_id', ...Object.keys(fields)];
          const vals = [appId, ...Object.values(fields)];
          await pool.execute(`INSERT INTO experience_details (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
        }
      }
    }

    // 7. File uploads
    for (const file of files) {
      const filePath = file.path.replace(/\\/g, '/');
      await pool.execute('DELETE FROM application_documents WHERE application_id = ? AND document_type = ?', [appId, file.fieldname]);
      await pool.execute('INSERT INTO application_documents (application_id, document_type, file_path) VALUES (?, ?, ?)', [appId, file.fieldname, filePath]);
      if (file.fieldname === 'sslc_marksheet') await pool.execute('UPDATE school_education SET marksheet_path = ? WHERE application_id = ? AND level = "SSLC"', [filePath, appId]);
      if (file.fieldname === 'hsc_marksheet')  await pool.execute('UPDATE school_education SET marksheet_path = ? WHERE application_id = ? AND level = "HSC"',  [filePath, appId]);
      if (file.fieldname === 'ug_marksheet' || file.fieldname === 'ug_consolidated' || file.fieldname.startsWith('ug_sem_'))   await pool.execute('UPDATE higher_education SET marksheet_path = ? WHERE application_id = ? AND level = "UG"',   [filePath, appId]);
      if (file.fieldname === 'pg_marksheet' || file.fieldname === 'pg_consolidated' || file.fieldname.startsWith('pg_sem_'))   await pool.execute('UPDATE higher_education SET marksheet_path = ? WHERE application_id = ? AND level = "PG"',   [filePath, appId]);
      if (file.fieldname === 'diploma_marksheet' || file.fieldname === 'diploma_consolidated' || file.fieldname.startsWith('diploma_sem_')) await pool.execute('UPDATE higher_education SET marksheet_path = ? WHERE application_id = ? AND level = "Diploma"', [filePath, appId]);
      if (file.fieldname === 'mphil_marksheet' || file.fieldname === 'mphil_consolidated' || file.fieldname.startsWith('mphil_sem_')) await pool.execute('UPDATE higher_education SET marksheet_path = ? WHERE application_id = ? AND level = "M.Phil"', [filePath, appId]);
      if (file.fieldname === 'integrated_marksheet' || file.fieldname === 'integrated_consolidated' || file.fieldname.startsWith('integrated_sem_')) await pool.execute('UPDATE higher_education SET marksheet_path = ? WHERE application_id = ? AND level = "Integrated"', [filePath, appId]);
    }

    res.json({ success: true, message: 'Application saved successfully' });
  } catch (err) {
    console.error('Admin save error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Update ───────────────────────────────────────────────────

/**
 * PUT /api/applications/:id
 */
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  const exclude = ['id', 'application_id', 'user_id', 'created_at', 'updated_at', 'full_name', 'email'];
  const data = req.body;
  const fields = Object.keys(data).filter(k => !exclude.includes(k));

  if (fields.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });

  try {
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => data[f]);
    await pool.execute(
      `UPDATE applications SET ${setClause}, updated_at = NOW() WHERE id = ?`,
      [...values, req.params.id]
    );

    if (data.full_name || data.email) {
      const [appRow] = await pool.execute('SELECT user_id FROM applications WHERE id = ?', [req.params.id]);
      if (appRow.length > 0) {
        if (data.full_name) await pool.execute('UPDATE users SET full_name = ? WHERE id = ?', [data.full_name, appRow[0].user_id]);
        if (data.email)     await pool.execute('UPDATE users SET email = ? WHERE id = ?',     [data.email, appRow[0].user_id]);
      }
    }
    res.json({ success: true, message: 'Application updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/applications/:id/status
 */
router.put('/:id/status', verifyToken, isAdmin, async (req, res) => {
  const { status, rejection_category, rejection_reason, notify_email = true, notify_dashboard = true } = req.body;
  const valid = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected'];
  if (!valid.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });

  // Rejection requires a reason
  if (status === 'Rejected' && !rejection_reason?.trim()) {
    return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Build UPDATE based on status
    let updateSql, updateParams;
    if (status === 'Approved') {
      updateSql    = 'UPDATE applications SET status = ?, approval_date = ?, updated_at = NOW() WHERE id = ?';
      updateParams = [status, new Date(), req.params.id];
    } else if (status === 'Rejected') {
      updateSql    = `UPDATE applications SET status = ?, rejection_category = ?, rejection_reason = ?,
                      rejected_by = ?, rejection_datetime = NOW(), updated_at = NOW() WHERE id = ?`;
      updateParams = [status, rejection_category || null, rejection_reason.trim(), req.user.id, req.params.id];
    } else {
      updateSql    = 'UPDATE applications SET status = ?, updated_at = NOW() WHERE id = ?';
      updateParams = [status, req.params.id];
    }
    await connection.execute(updateSql, updateParams);

    // Fetch full application row for notifications
    const [[appRow]] = await connection.execute(
      `SELECT a.user_id, a.application_id, a.id AS db_id, a.status AS prev_status,
              u.email, u.full_name
       FROM applications a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.id = ?`, [req.params.id]
    );

    let emailSent = 0, notifSent = 0;

    if (appRow) {
      const { notifyUser } = require('../services/notifyUser');
      const { enqueueEmail } = require('../../../shared/utils/notification');

      if (status === 'Rejected') {
        // ── Rich rejection notification ───────────────────────────────
        if (notify_dashboard) {
          await notifyUser(connection, appRow.user_id,
            'Application Rejected',
            `Your application has been rejected. ${rejection_category ? `Category: ${rejection_category}. ` : ''}Reason: ${rejection_reason.trim()}`,
            'danger'
          );
          notifSent = 1;
        }

        if (notify_email && appRow.email) {
          const emailHtml = `
            <div style="font-family:sans-serif;padding:24px;color:#1e293b;max-width:600px">
              <div style="background:#ef4444;padding:16px 20px;border-radius:10px 10px 0 0">
                <h2 style="color:#fff;margin:0;font-size:18px">Application Rejection Notification</h2>
              </div>
              <div style="border:1px solid #fca5a5;border-top:none;border-radius:0 0 10px 10px;padding:24px">
                <p>Dear <strong>${appRow.full_name || 'Applicant'}</strong>,</p>
                <p>We regret to inform you that your application has been reviewed and could not be approved at this stage.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0">
                  <tr style="background:#fef2f2"><td style="padding:10px 14px;font-weight:600;width:40%;border:1px solid #fca5a5">Application ID</td><td style="padding:10px 14px;border:1px solid #fca5a5">${appRow.application_id}</td></tr>
                  ${rejection_category ? `<tr><td style="padding:10px 14px;font-weight:600;border:1px solid #fca5a5">Reason Category</td><td style="padding:10px 14px;border:1px solid #fca5a5">${rejection_category}</td></tr>` : ''}
                  <tr style="background:#fef2f2"><td style="padding:10px 14px;font-weight:600;border:1px solid #fca5a5">Detailed Reason</td><td style="padding:10px 14px;border:1px solid #fca5a5">${rejection_reason.trim()}</td></tr>
                </table>
                <p style="color:#64748b;font-size:13px">For further clarification, please contact the university admissions office.</p>
                <p style="color:#64748b;font-size:13px">Regards,<br><strong>Periyar University – PhD Admissions Cell</strong></p>
              </div>
            </div>`;
          await enqueueEmail(pool, {
            to_email: appRow.email,
            subject:  'Application Rejection Notification',
            title:    'Application Rejection Notification',
            message:  `Your application (${appRow.application_id}) has been rejected. Reason: ${rejection_reason.trim()}`,
            bodyHtml: emailHtml,
            user_id:  appRow.user_id,
            target_type: 'student',
            type: 'error',
          });
          emailSent = 1;
        }

        // Update sent flags
        await connection.execute(
          'UPDATE applications SET rejection_email_sent = ?, rejection_notification_sent = ? WHERE id = ?',
          [emailSent, notifSent, req.params.id]
        );

        // Write audit log
        try {
          let adminName = 'Admin';
          const [[adm]] = await connection.execute('SELECT full_name FROM users WHERE id = ? LIMIT 1', [req.user.id]).catch(() => [[null]]);
          if (adm?.full_name) adminName = adm.full_name;
          await connection.execute(
            `INSERT INTO application_rejection_log
             (application_db_id, application_id, rejection_category, rejection_reason,
              rejected_by, rejected_by_name, previous_status, email_sent, notification_sent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.params.id, appRow.application_id, rejection_category || null, rejection_reason.trim(),
             req.user.id, adminName, appRow.prev_status, emailSent, notifSent]
          );
        } catch (_) { /* audit failure must not block */ }

      } else {
        // Non-rejection status notifications (existing logic preserved)
        const STATUS_NOTIF = {
          'Approved':     { title: 'Application Approved ✓',    message: 'Your PhD admission application has been approved. Please proceed with the application fee payment.', type: 'success' },
          'Under Review': { title: 'Application Under Review',  message: 'Your application is currently being reviewed by the admissions committee.', type: 'info' },
          'Submitted':    { title: 'Application Received',      message: 'Your application has been received and is awaiting review.', type: 'info' },
        };
        const notif = STATUS_NOTIF[status];
        if (notif) await notifyUser(connection, appRow.user_id, notif.title, notif.message, notif.type);

        if (status === 'Approved') {
          const { evaluateDirectPass } = require('./qualification-rules');
          await evaluateDirectPass(connection, appRow.application_id);
        }
      }
    }

    const finalResult = await recomputeFinalResult(connection, req.params.id);
    await connection.commit();
    res.json({ success: true, message: `Application status updated to ${status}`, final_result: finalResult });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/applications/:id/rejection  — fetch stored rejection details (admin)
 */
router.get('/:id/rejection', verifyToken, isAdmin, async (req, res) => {
  try {
    const [[row]] = await pool.execute(
      `SELECT a.status, a.rejection_category, a.rejection_reason, a.rejection_datetime,
              a.rejection_email_sent, a.rejection_notification_sent,
              au.full_name AS rejected_by_name
       FROM applications a
       LEFT JOIN users au ON au.id = a.rejected_by
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ success: false, message: 'Application not found' });
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/applications/:id/attendance
 * Mark attendance status (Present / Absent)
 */
router.put('/:id/attendance', verifyToken, isAdmin, async (req, res) => {
  const { attendance_status } = req.body;
  if (!['Present', 'Absent'].includes(attendance_status)) {
    return res.status(400).json({ success: false, message: 'Invalid attendance_status' });
  }
  const connection = await pool.getConnection();
  try {
    const [[appRow]] = await connection.execute(
      'SELECT entrance_mark, entrance_exam_status FROM applications WHERE id = ?', [req.params.id]
    );
    if (appRow?.entrance_exam_status === 'Exempted') {
      return res.status(400).json({ success: false, message: 'Exempted students do not have entrance exam attendance' });
    }
    const qualificationStatus = await computeQualification(
      connection, req.params.id, appRow.entrance_mark, attendance_status
    );
    await connection.execute(
      'UPDATE applications SET attendance_status = ?, qualification_status = ?, updated_at = NOW() WHERE id = ?',
      [attendance_status, qualificationStatus, req.params.id]
    );
    const finalResult = await recomputeFinalResult(connection, req.params.id);
    res.json({ success: true, message: 'Attendance updated', qualification_status: qualificationStatus, final_result_status: finalResult });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
});

/**
 * PUT /api/applications/:id/entrance-mark
 */
router.put('/:id/entrance-mark', verifyToken, isAdmin, async (req, res) => {
  const { entrance_mark, remarks } = req.body;
  if (entrance_mark === undefined || entrance_mark === null) {
    return res.status(400).json({ success: false, message: 'entrance_mark is required' });
  }
  const connection = await pool.getConnection();
  try {
    const [[appRow]] = await connection.execute(
      'SELECT attendance_status, entrance_exam_status FROM applications WHERE id = ?', [req.params.id]
    );
    if (appRow?.entrance_exam_status === 'Exempted') {
      return res.status(400).json({ success: false, message: 'Exempted students do not take the entrance exam' });
    }
    // Save mark first so recomputeFinalResult can use it
    await connection.execute(
      'UPDATE applications SET entrance_mark = ?, remarks = ?, updated_at = NOW() WHERE id = ?',
      [entrance_mark, remarks || null, req.params.id]
    );

    const automationResult = await recomputeFinalResult(connection, req.params.id);
    res.json({ 
      success: true, 
      message: 'Entrance mark saved and results recomputed automatically', 
      qualification_status: automationResult.qualification_status, 
      final_result_status: automationResult.final_result_status 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
});

/**
 * PUT /api/applications/:id/interview-mark (DEPRECATED)
 * Interview marks are no longer required for PhD admissions.
 */
router.put('/:id/interview-mark', verifyToken, isAdmin, async (req, res) => {
  res.status(410).json({ success: false, message: 'Interview workflow has been removed. Use entrance marks only.' });
});

/**
 * PUT /api/applications/:id/admission
 */
router.put('/:id/admission', verifyToken, isAdmin, async (req, res) => {
  const { approved, remarks } = req.body;
  try {
    await pool.execute(
      `UPDATE applications
       SET admission_approved = ?, admission_approved_at = ?, remarks = ?, updated_at = NOW()
       WHERE id = ?`,
      [approved ? 1 : 0, approved ? new Date() : null, remarks || null, req.params.id]
    );
    res.json({ success: true, message: approved ? 'Admission approved' : 'Admission rejected' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/applications/:id/counselling-approval (DEPRECATED)
 * Counselling approval is now handled automatically by FinalEligibilityEngine.
 */
router.put('/:id/counselling-approval', verifyToken, isAdmin, async (req, res) => {
  res.status(410).json({ 
    success: false, 
    message: 'Manual counselling approval is deprecated. The system now automatically approves PASS/Direct-Qualified students.' 
  });
});

/**
 * PUT /api/applications/:id/payment-status
 */
router.put('/:id/payment-status', verifyToken, isAdmin, async (req, res) => {
  const { payment_status, payment_reference } = req.body;
  const valid = ['Unpaid', 'Pending', 'Processing', 'Success', 'Paid', 'Failed', 'Verified', 'Approved', 'Rejected'];
  if (!valid.includes(payment_status)) return res.status(400).json({ success: false, message: 'Invalid payment_status' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE applications
       SET payment_status = ?, payment_reference = ?, payment_date = ?, updated_at = NOW()
       WHERE id = ?`,
      [payment_status, payment_reference || null, ['Paid', 'Approved'].includes(payment_status) ? new Date() : null, req.params.id]
    );

    const [[appRow]] = await connection.execute(
      'SELECT user_id, application_id FROM applications WHERE id = ?', [req.params.id]
    );

    let wasPaidRevoked = false;
    
    // Enterprise downstream dependency check
    if (['Failed', 'Unpaid', 'Rejected'].includes(payment_status) && appRow) {
      const DependencyEngine = require('../services/EntranceFlowDependencyEngine');
      await DependencyEngine.onPaymentRevoked(appRow.application_id, connection);
      wasPaidRevoked = true;
    }

    if (['Paid', 'Approved'].includes(payment_status) && appRow) {
      // Insert into payments ledger
      await connection.execute(
        `INSERT INTO payments (application_id, gateway, transaction_id, payment_status, payment_mode, paid_at, recorded_by)
         VALUES (?, 'Manual', ?, 'Success', 'Manual', NOW(), ?)
         ON DUPLICATE KEY UPDATE payment_status = 'Success'`,
        [appRow.application_id, payment_reference || null, req.user?.email || 'admin']
      );

      // Evaluate direct pass
      const { evaluateDirectPass } = require('./qualification-rules');
      await evaluateDirectPass(connection, appRow.application_id);

      // Notify student
      const { notifyUser } = require('../services/notifyUser');
      await notifyUser(connection, appRow.user_id,
        'Payment Confirmed ✓',
        'Your application fee payment has been recorded successfully. Your application is now being processed.',
        'payment'
      );
    } else if (payment_status === 'Failed' && appRow) {
      const { notifyUser } = require('../services/notifyUser');
      await notifyUser(connection, appRow.user_id,
        'Payment Failed',
        'Your payment could not be processed. Please try again or contact the admissions office.',
        'danger'
      );
    }

    await connection.commit();
    res.json({ success: true, message: 'Payment status updated' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
});

// ─── Delete ───────────────────────────────────────────────────

/**
 * DELETE /api/applications/:id
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT application_id, user_id FROM applications WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });

    const { application_id, user_id } = rows[0];
    await pool.execute('DELETE FROM application_documents WHERE application_id = ?', [application_id]);
    await pool.execute('DELETE FROM school_education WHERE application_id = ?', [application_id]);
    await pool.execute('DELETE FROM higher_education WHERE application_id = ?', [application_id]);
    await pool.execute('DELETE FROM experience_details WHERE application_id = ?', [application_id]);
    await pool.execute('DELETE FROM applications WHERE id = ?', [req.params.id]);
    await pool.execute('DELETE FROM users WHERE id = ? AND role = "student"', [user_id]);

    res.json({ success: true, message: 'Application deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
