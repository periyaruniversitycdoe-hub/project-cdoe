const { safeError } = require('../../../shared/security/safeError');

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

/**
 * GET /api/students
 * Comprehensive student tracking: registration, login activity, application status.
 */
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { session_id, search, year, month, course } = req.query;
    const pageNum  = Math.max(1, parseInt(req.query.page)  || 1);
    const isAll    = req.query.limit === 'all';
    const limitNum = isAll ? null : Math.min(200, parseInt(req.query.limit) || 50);
    const offset   = isAll ? null : (pageNum - 1) * limitNum;

    const conditions = ["u.role = 'student'"];
    const filterParams = [];

    let resolvedSessionId = session_id;
    if (year || month) {
      if (!resolvedSessionId || resolvedSessionId === 'active') {
        resolvedSessionId = null;
      }
    } else {
      if (!resolvedSessionId || resolvedSessionId === 'active') {
        conditions.push('s.is_active = 1');
      }
    }
    if (resolvedSessionId && resolvedSessionId !== 'all') {
      conditions.push('u.session_id = ?');
      filterParams.push(parseInt(resolvedSessionId, 10));
    }

    if (search && search.trim()) {
      conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.application_id LIKE ? OR a.mobile LIKE ?)');
      const like = `%${search.trim()}%`;
      filterParams.push(like, like, like, like);
    }

    if (year) {
      conditions.push('s.year = ?');
      filterParams.push(parseInt(year, 10));
    }
    if (month) {
      conditions.push('s.month = ?');
      filterParams.push(month);
    }
    if (course) {
      if (course === 'Ph.D') {
        conditions.push("(a.program_offered_name LIKE 'Ph.D.%' OR (a.program_offered_name IS NOT NULL AND a.program_offered_name != ''))");
      } else if (course === 'M.Phil') {
        conditions.push("(a.has_mphil = 1 OR a.program_offered_name LIKE 'M.Phil.%')");
      } else if (course === 'Integrated Course') {
        conditions.push("a.has_integrated = 1");
      } else if (course === 'Full Time') {
        conditions.push("a.category = 'Full Time'");
      } else if (course === 'Part Time') {
        conditions.push("a.category = 'Part Time'");
      }
    }

    const whereClause = conditions.join(' AND ');

    const selectQuery = `SELECT
          u.id,
          u.application_id,
          u.full_name,
          u.email,
          u.created_at                                        AS registered_at,
          CONCAT(s.month, ' ', s.year)                        AS session_name,
          sl.first_login_at,
          sl.last_login_at,
          sl.login_count,
          a.mobile,
          a.subject,
          a.status                                            AS app_status,
          a.payment_status,
          a.application_submitted AS final_submitted,
          a.entrance_exam_status,
          a.qualification_status,
          a.entrance_mark,
          a.interview_mark,
          a.interview_status,
          a.admission_approved,
          a.counselling_approval,
          qt_summary.qual_names,
          CASE
            WHEN a.interview_status = 'PASS'
              AND a.counselling_approval = 'Approved'
              AND (a.entrance_exam_status = 'Exempted'
                   OR a.qualification_status IN ('Qualified', 'Direct Qualified'))
            THEN 1 ELSE 0
          END                                                 AS counselling_eligible
       FROM users u
       LEFT JOIN sessions         s  ON s.id  = u.session_id
       LEFT JOIN student_logins   sl ON sl.user_id = u.id
       LEFT JOIN applications     a  ON a.application_id = u.application_id
       LEFT JOIN (
           SELECT sq.application_id,
                  GROUP_CONCAT(qt.qualification_name ORDER BY qt.display_order SEPARATOR ', ') AS qual_names
           FROM   student_qualifications sq
           JOIN   qualification_types    qt ON qt.id = sq.qualification_id
           WHERE  sq.status = 'Active'
           GROUP  BY sq.application_id
       ) qt_summary ON qt_summary.application_id = u.application_id
       WHERE ${whereClause}
       ORDER BY u.created_at DESC`;

    const [rows] = await pool.query(
      isAll ? selectQuery : `${selectQuery} LIMIT ? OFFSET ?`,
      isAll ? filterParams : [...filterParams, limitNum, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM   users u
       LEFT JOIN sessions s ON s.id = u.session_id
       LEFT JOIN applications a ON a.application_id = u.application_id
       WHERE  ${whereClause}`,
      filterParams
    );

    res.json({
      success: true,
      data: rows,
      total,
      totalPages: isAll ? 1 : Math.ceil(total / limitNum),
      page: isAll ? 1 : pageNum,
    });
  } catch (err) {
    console.error('Student tracking error:', err);
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

/**
 * GET /api/students/stats
 * Quick summary counts for the tracking dashboard.
 */
router.get('/stats', verifyToken, isAdmin, async (req, res) => {
  try {
    const [[counts]] = await pool.query(
      `SELECT
          COUNT(*)                                                      AS total,
          SUM(sl.id IS NOT NULL)                                        AS logged_in,
          SUM(a.final_submitted = 1)                                    AS submitted,
          SUM(a.interview_status = 'PASS')                              AS interview_passed,
          SUM(a.interview_status = 'FAIL')                              AS interview_failed,
          SUM(a.counselling_approval = 'Approved')                      AS counselling_approved,
          SUM(a.counselling_approval = 'Rejected')                      AS counselling_rejected
       FROM users u
       LEFT JOIN student_logins sl ON sl.user_id = u.id
       LEFT JOIN applications   a  ON a.application_id = u.application_id
       WHERE u.role = 'student'`
    );
    res.json({ success: true, data: counts });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

module.exports = router;
