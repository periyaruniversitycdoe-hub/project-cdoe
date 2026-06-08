
const express = require('express');
const { safeError } = require('../../../shared/security/safeError');
const router  = express.Router();
const pool    = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { getActiveSessionId }   = require('../services/sessionCache');

// â”€â”€â”€ Helper: resolve session â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function resolveSession(session_id) {
  if (!session_id || session_id === 'active') return getActiveSessionId();
  if (session_id === 'all') return null;
  return parseInt(session_id, 10) || null;
}

// â”€â”€â”€ Helper: build date range condition â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function dateRange(column, from_date, to_date) {
  const parts = [];
  const params = [];
  if (from_date) { parts.push(`${column} >= ?`); params.push(from_date + ' 00:00:00'); }
  if (to_date)   { parts.push(`${column} <= ?`); params.push(to_date   + ' 23:59:59'); }
  return { sql: parts.join(' AND '), params };
}

// â”€â”€â”€ GET /api/results/analytics  â€” date-filtered dashboard analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * Query params:
 *   session_id  â€” 'active' | 'all' | <numeric>
 *   from_date   â€” YYYY-MM-DD
 *   to_date     â€” YYYY-MM-DD
 *   period      â€” 'today' | 'yesterday' | 'month' | 'custom'
 */
router.get('/analytics', verifyToken, isAdmin, async (req, res) => {
  try {
    const { session_id, from_date, to_date, period } = req.query;
    const sid = await resolveSession(session_id);

    // Resolve date range from shorthand periods
    let fd = from_date, td = to_date;
    const today = new Date();
    const fmt = d => d.toISOString().slice(0, 10);
    if (period === 'today') {
      fd = td = fmt(today);
    } else if (period === 'yesterday') {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      fd = td = fmt(y);
    } else if (period === 'month') {
      fd = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
      td = fmt(today);
    }

    const sessionCond  = sid ? 'AND COALESCE(a.session_id, u.session_id) = ?' : '';
    const sessionParam = sid ? [sid] : [];

    // Registration date filter
    const regRange = dateRange('a.created_at', fd, td);
    let regSql = '1=1';
    let regParams = [];
    if (fd) { regSql += ' AND a.created_at >= ?'; regParams.push(fd + ' 00:00:00'); }
    if (td) { regSql += ' AND a.created_at <= ?'; regParams.push(td + ' 23:59:59'); }

    // Payment date filter
    const payRange = dateRange('a.payment_date', fd, td);
    let paySql = '1=1';
    let payParams = [];
    if (fd) { paySql += ' AND a.payment_date >= ?'; payParams.push(fd + ' 00:00:00'); }
    if (td) { paySql += ' AND a.payment_date <= ?'; payParams.push(td + ' 23:59:59'); }

    // Hall ticket downloaded filter
    const htRange  = dateRange('ht.student_downloaded_at', fd, td);

    const query = `
      SELECT 
        SUM(CASE WHEN ${regSql} THEN 1 ELSE 0 END) as totalRegistrations,
        SUM(CASE WHEN a.status = 'Approved' AND ${regSql} THEN 1 ELSE 0 END) as totalApproved,
        SUM(CASE WHEN a.payment_status = 'Paid' AND ${paySql} THEN 1 ELSE 0 END) as totalPaid,
        SUM(CASE WHEN a.payment_status = 'Unpaid' AND ${paySql} THEN 1 ELSE 0 END) as pendingPayment,
        SUM(CASE WHEN a.direct_pass_status = 'DirectPass' AND ${regSql} THEN 1 ELSE 0 END) as directPassCount,
        SUM(CASE WHEN a.attendance_status = 'Present' THEN 1 ELSE 0 END) as totalPresent,
        SUM(CASE WHEN a.attendance_status = 'Absent' THEN 1 ELSE 0 END) as totalAbsent,
        SUM(CASE WHEN a.final_result_status = 'PASS' THEN 1 ELSE 0 END) as totalPassed,
        SUM(CASE WHEN a.final_result_status = 'FAIL' THEN 1 ELSE 0 END) as totalFailed,
        SUM(CASE WHEN (a.direct_pass_status = 'DirectPass' OR a.final_result_status = 'PASS') THEN 1 ELSE 0 END) as counsellingEligible
      FROM applications a
      JOIN users u ON a.user_id = u.id
      WHERE 1=1 ${sessionCond}
    `;

    const params = [];
    params.push(...regParams);
    params.push(...regParams);
    params.push(...payParams);
    params.push(...payParams);
    params.push(...regParams);
    if (sid) {
      params.push(sid);
    }

    const [[analyticsRow]] = await pool.execute(query, params);

    const totalRegistrations = analyticsRow.totalRegistrations || 0;
    const totalApproved = analyticsRow.totalApproved || 0;
    const totalPaid = analyticsRow.totalPaid || 0;
    const pendingPayment = analyticsRow.pendingPayment || 0;
    const directPassCount = analyticsRow.directPassCount || 0;
    const totalPresent = analyticsRow.totalPresent || 0;
    const totalAbsent = analyticsRow.totalAbsent || 0;
    const totalPassed = analyticsRow.totalPassed || 0;
    const totalFailed = analyticsRow.totalFailed || 0;
    const counsellingEligible = analyticsRow.counsellingEligible || 0;

    // Hall tickets downloaded count (requires JOIN)
    const htSid = sid ? 'AND ht.session_id = ?' : '';
    const htSidParam = sid ? [sid] : [];
    const htDateCond = htRange.sql ? `AND ${htRange.sql}` : '';
    const [[htRow]] = await pool.execute(
      `SELECT COUNT(*) as c FROM hall_tickets ht WHERE ht.student_downloaded_at IS NOT NULL ${htSid} ${htDateCond}`,
      [...htSidParam, ...htRange.params]
    );
    const hallTicketsDownloaded = htRow.c;

    // Month-wise registrations (last 6 months)
    const [monthly] = await pool.execute(`
      SELECT DATE_FORMAT(a.created_at, '%b %Y') AS month,
             COUNT(*) AS registrations,
             SUM(a.payment_status = 'Paid') AS paid,
             SUM(a.status = 'Approved') AS approved
      FROM applications a JOIN users u ON a.user_id = u.id
      WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) ${sessionCond}
      GROUP BY DATE_FORMAT(a.created_at, '%b %Y'), DATE_FORMAT(a.created_at, '%Y-%m')
      ORDER BY MIN(a.created_at) ASC
    `, sessionParam);

    res.json({
      success: true,
      data: {
        totalRegistrations,
        totalApproved,
        totalPaid,
        pendingPayment,
        directPassCount,
        hallTicketsDownloaded,
        totalPresent,
        totalAbsent,
        totalPassed,
        totalFailed,
        counsellingEligible,
        monthly,
        filters: { session_id, from_date: fd, to_date: td, period },
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

// â”€â”€â”€ POST /api/results/publish â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * Publish entrance results for a session.
 * Sets result_published_at on all approved present applications and
 * logs the action in result_publish_logs.
 */
router.post('/publish', verifyToken, isAdmin, async (req, res) => {
  const { session_id, result_type = 'Entrance', notes } = req.body;
  const adminEmail = req.user?.email || 'admin';

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const sid = await resolveSession(session_id);
    const sessionCond  = sid ? 'AND COALESCE(a.session_id, u.session_id) = ?' : '';
    const sessionParam = sid ? [sid] : [];

    // Mark sessions.entrance_result_published = 1
    if (sid) {
      await connection.execute(
        `UPDATE sessions
         SET entrance_result_published = 1,
             result_published_at = NOW(),
             result_published_by = ?
         WHERE id = ?`,
        [adminEmail, sid]
      );
    }

    // Stamp result_published_at on ONLY processed applications in this session
    await connection.execute(
      `UPDATE applications a
       JOIN users u ON a.user_id = u.id
       SET a.result_published_at = NOW()
       WHERE a.result_published_at IS NULL 
         AND a.qualification_status != 'Pending' ${sessionCond}`,
      sessionParam
    );

    // Count affected rows
    const [[{ cnt }]] = await connection.execute(
      `SELECT COUNT(*) AS cnt FROM applications a JOIN users u ON a.user_id = u.id
       WHERE a.result_published_at IS NOT NULL ${sessionCond}`,
      sessionParam
    );

    // Audit log
    await connection.execute(
      `INSERT INTO result_publish_logs (session_id, result_type, published_by, total_published, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [sid || null, result_type, adminEmail, cnt, notes || null]
    );

    // Bulk notify all affected students
    const [affectedUsers] = await connection.execute(
      `SELECT DISTINCT a.user_id, a.final_result_status, a.direct_pass_status
       FROM applications a JOIN users u ON a.user_id = u.id
       WHERE a.result_published_at IS NOT NULL ${sessionCond}`,
      sessionParam
    );
    if (affectedUsers.length > 0) {
      const { notifyBulk } = require('../services/notifyUser');
      // Group: direct pass users get a different message
      const directPassIds = affectedUsers.filter(r => r.direct_pass_status === 'DirectPass').map(r => r.user_id);
      const passIds  = affectedUsers.filter(r => r.direct_pass_status !== 'DirectPass' && r.final_result_status === 'PASS').map(r => r.user_id);
      const failIds  = affectedUsers.filter(r => r.direct_pass_status !== 'DirectPass' && r.final_result_status === 'FAIL').map(r => r.user_id);
      const otherIds = affectedUsers.filter(r => r.direct_pass_status !== 'DirectPass' && !['PASS','FAIL'].includes(r.final_result_status)).map(r => r.user_id);

      if (passIds.length)       await notifyBulk(connection, passIds,       'Entrance Result: PASS âœ“',  'Congratulations! You have passed the entrance examination. Login to access the counselling form.', 'success');
      if (failIds.length)       await notifyBulk(connection, failIds,       'Entrance Result: FAIL',    'Your entrance examination results are now available. Login to view your marks and attendance.', 'danger');
      if (directPassIds.length) await notifyBulk(connection, directPassIds, 'Results Published',        'Your Direct Pass status is confirmed. You are eligible to access the counselling form directly.', 'success');
      if (otherIds.length)      await notifyBulk(connection, otherIds,      'Entrance Results Published','Your entrance examination results are now available. Login to view your marks and attendance.', 'result');
    }

    await connection.commit();
    res.json({ success: true, message: `Results published for ${cnt} application(s)`, total: cnt });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ success: false, message: safeError(err) });
  } finally {
    connection.release();
  }
});

// â”€â”€â”€ POST /api/results/unpublish â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/unpublish', verifyToken, isAdmin, async (req, res) => {
  const { session_id } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const sid = await resolveSession(session_id);
    const sessionCond  = sid ? 'AND COALESCE(a.session_id, u.session_id) = ?' : '';
    const sessionParam = sid ? [sid] : [];

    if (sid) {
      await connection.execute(
        'UPDATE sessions SET entrance_result_published = 0, result_published_at = NULL WHERE id = ?', [sid]
      );
    }

    await connection.execute(
      `UPDATE applications a JOIN users u ON a.user_id = u.id
       SET a.result_published_at = NULL WHERE 1=1 ${sessionCond}`,
      sessionParam
    );

    await connection.commit();
    res.json({ success: true, message: 'Results unpublished' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ success: false, message: safeError(err) });
  } finally {
    connection.release();
  }
});

// â”€â”€â”€ GET /api/results/publish-status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/publish-status', verifyToken, isAdmin, async (req, res) => {
  try {
    const { session_id } = req.query;
    const sid = await resolveSession(session_id);
    if (!sid) return res.json({ success: true, data: { published: false } });

    const [[sess]] = await pool.execute(
      'SELECT entrance_result_published, result_published_at, result_published_by FROM sessions WHERE id = ?', [sid]
    );
    res.json({ success: true, data: sess || { published: false } });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

// â”€â”€â”€ GET /api/results/publish-logs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/publish-logs', verifyToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT rpl.*, CONCAT(s.month, ' ', s.year) AS session_name
       FROM result_publish_logs rpl
       LEFT JOIN sessions s ON rpl.session_id = s.id
       ORDER BY rpl.published_at DESC LIMIT 50`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

// â”€â”€â”€ GET /api/results/list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Published results list for a session (what students see on their dashboard)
router.get('/list', verifyToken, isAdmin, async (req, res) => {
  try {
    const { session_id, from_date, to_date, search } = req.query;
    const sid = await resolveSession(session_id);

    const conditions = ['a.result_published_at IS NOT NULL'];
    const params = [];

    if (sid) { conditions.push('COALESCE(a.session_id, u.session_id) = ?'); params.push(sid); }
    if (search) {
      conditions.push('(u.full_name LIKE ? OR a.application_id LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    const dr = dateRange('a.result_published_at', from_date, to_date);
    if (dr.sql) { conditions.push(dr.sql); params.push(...dr.params); }

    const [rows] = await pool.execute(
      `SELECT a.application_id, u.full_name, a.subject, a.entrance_mark,
              a.attendance_status, a.qualification_status, a.final_result_status,
              a.direct_pass_status, a.result_published_at,
              CONCAT(s.month, ' ', s.year) AS session_name
       FROM applications a
       JOIN users u ON a.user_id = u.id
       LEFT JOIN sessions s ON s.id = COALESCE(a.session_id, u.session_id)
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.result_published_at DESC`,
      params
    );
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

module.exports = router;
