
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// ─── Direct-Pass Engine ───────────────────────────────────────────────────────
// Checks whether an application qualifies for direct pass under any active rule.
// Called after payment confirmation and after admin approval.
async function evaluateDirectPass(connection, applicationId) {
  const [[app]] = await connection.execute(
    `SELECT a.application_id, a.qualified_exams, a.subject, a.payment_status,
            a.status, a.direct_pass_status
     FROM applications a WHERE a.application_id = ?`,
    [applicationId]
  );
  if (!app) return false;

  // Already a direct pass — nothing to do
  if (app.direct_pass_status === 'DirectPass') return true;

  // Payment must be completed
  if (app.payment_status !== 'Paid') return false;

  // Application must be at least Submitted (not Draft)
  if (app.status === 'Draft') return false;

  // Parse qualified exams
  let qualExams = [];
  try {
    qualExams = app.qualified_exams ? JSON.parse(app.qualified_exams) : [];
  } catch (_) {}

  if (qualExams.length === 0) return false;

  // Fetch active rules
  const [rules] = await connection.execute(
    `SELECT * FROM qualification_rules WHERE is_active = 1 AND direct_pass_enabled = 1
     AND (valid_from IS NULL OR valid_from <= CURDATE())
     AND (valid_to   IS NULL OR valid_to   >= CURDATE())`
  );

  for (const rule of rules) {
    const qualMatch = qualExams.includes(rule.qualification_type);
    if (!qualMatch) continue;

    // Check department restriction
    if (rule.department) {
      const allowedDepts = rule.department.split(',').map(d => d.trim().toLowerCase());
      const appDept = (app.subject || '').toLowerCase();
      if (!allowedDepts.includes(appDept)) continue;
    }

    // All conditions met — mark direct pass
    await connection.execute(
      `UPDATE applications
       SET direct_pass_status = 'DirectPass',
           qualification_status = 'Direct Qualified',
           final_result_status = 'PASS',
           updated_at = NOW()
       WHERE application_id = ?`,
      [applicationId]
    );

    // Notify the student
    try {
      const { notifyUser } = require('../services/notifyUser');
      const [[appUser]] = await connection.execute(
        'SELECT user_id FROM applications WHERE application_id = ?', [applicationId]
      );
      if (appUser) {
        await notifyUser(connection, appUser.user_id,
          'Direct Pass Granted ✓',
          `Congratulations! You qualify for Direct Pass based on your ${rule.qualification_type} qualification. You may access the counselling form directly after approval — no entrance exam required.`,
          'direct_pass'
        );
      }
    } catch (_) {}

    return true;
  }

  return false;
}

// evaluateDirectPass exported below after router is defined

// ─── GET all rules ─────────────────────────────────────────────────────────────
router.get('/', verifyToken, isAdmin, async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM qualification_rules ORDER BY is_active DESC, created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── CREATE rule ───────────────────────────────────────────────────────────────
router.post('/', verifyToken, isAdmin, async (req, res) => {
  const {
    rule_name, qualification_type, department,
    direct_pass_enabled, requires_payment,
    valid_from, valid_to, notes
  } = req.body;

  if (!rule_name || !qualification_type) {
    return res.status(400).json({ success: false, message: 'rule_name and qualification_type are required' });
  }

  try {
    const adminEmail = req.user?.email || 'admin';
    const [result] = await pool.execute(
      `INSERT INTO qualification_rules
         (rule_name, qualification_type, department, direct_pass_enabled,
          requires_payment, valid_from, valid_to, notes, created_by, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        rule_name, qualification_type,
        department || null,
        direct_pass_enabled !== undefined ? (direct_pass_enabled ? 1 : 0) : 1,
        requires_payment !== undefined ? (requires_payment ? 1 : 0) : 1,
        valid_from || null, valid_to || null,
        notes || null, adminEmail
      ]
    );
    res.json({ success: true, message: 'Rule created', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── UPDATE rule ───────────────────────────────────────────────────────────────
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  const {
    rule_name, qualification_type, department,
    direct_pass_enabled, requires_payment,
    valid_from, valid_to, notes, is_active
  } = req.body;

  try {
    await pool.execute(
      `UPDATE qualification_rules
       SET rule_name           = ?,
           qualification_type  = ?,
           department          = ?,
           direct_pass_enabled = ?,
           requires_payment    = ?,
           valid_from          = ?,
           valid_to            = ?,
           notes               = ?,
           is_active           = ?,
           updated_at          = NOW()
       WHERE id = ?`,
      [
        rule_name, qualification_type,
        department || null,
        direct_pass_enabled ? 1 : 0,
        requires_payment ? 1 : 0,
        valid_from || null, valid_to || null,
        notes || null,
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        req.params.id
      ]
    );
    res.json({ success: true, message: 'Rule updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE rule ───────────────────────────────────────────────────────────────
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM qualification_rules WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Rule deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/qualification-rules/evaluate/:applicationId ────────────────────
// Manually trigger direct-pass evaluation for one application
router.post('/evaluate/:applicationId', verifyToken, isAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const matched = await evaluateDirectPass(connection, req.params.applicationId);
    res.json({ success: true, directPass: matched, message: matched ? 'Direct pass granted' : 'No matching rule found' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
});

// ─── POST /api/qualification-rules/evaluate-session ──────────────────────────
// Bulk-evaluate all paid applications in a session
router.post('/evaluate-session', verifyToken, isAdmin, async (req, res) => {
  const { session_id } = req.body;
  const connection = await pool.getConnection();
  try {
    const whereSession = session_id && session_id !== 'all'
      ? 'AND COALESCE(a.session_id, u.session_id) = ?'
      : '';
    const params = whereSession ? [session_id] : [];

    const [apps] = await connection.execute(
      `SELECT a.application_id
       FROM applications a JOIN users u ON a.user_id = u.id
       WHERE a.payment_status = 'Paid'
         AND a.direct_pass_status = 'None'
         AND a.status != 'Draft'
         ${whereSession}`,
      params
    );

    let granted = 0;
    for (const app of apps) {
      const matched = await evaluateDirectPass(connection, app.application_id);
      if (matched) granted++;
    }

    res.json({ success: true, evaluated: apps.length, directPassGranted: granted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
module.exports.evaluateDirectPass = evaluateDirectPass;
