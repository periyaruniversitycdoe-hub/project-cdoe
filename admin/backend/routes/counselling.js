const { safeError } = require('../../../shared/security/safeError');

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const ExcelJS = require('exceljs');
const { getActiveSessionId } = require('../services/sessionCache');

// â”€â”€â”€ Counselling Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * GET /api/counselling/settings
 */
router.get('/settings', verifyToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT cs.*, CONCAT(s.month, ' ', s.year) AS session_name
      FROM counselling_settings cs
      JOIN sessions s ON cs.session_id = s.id
      ORDER BY cs.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

/**
 * GET /api/counselling/settings/active
 * Returns settings for the currently active session
 */
router.get('/settings/active', async (_req, res) => {
  try {
    const activeSessionId = await getActiveSessionId();
    if (!activeSessionId) return res.status(404).json({ success: false, message: 'No active session' });
    const activeSession = { id: activeSessionId };

    const [[settings]] = await pool.execute(
      'SELECT * FROM counselling_settings WHERE session_id = ? AND is_active = 1 LIMIT 1',
      [activeSession.id]
    );
    if (!settings) return res.status(404).json({ success: false, message: 'No counselling settings for active session' });

    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

/**
 * POST /api/counselling/settings
 */
router.post('/settings', verifyToken, isAdmin, async (req, res) => {
  const { session_id, start_date, end_date, max_research_choices, is_active } = req.body;
  if (!session_id || !start_date || !end_date) {
    return res.status(400).json({ success: false, message: 'session_id, start_date, end_date are required' });
  }
  try {
    const [result] = await pool.execute(
      `INSERT INTO counselling_settings (session_id, start_date, end_date, max_research_choices, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [session_id, start_date, end_date, max_research_choices || 3, is_active ? 1 : 0]
    );
    res.status(201).json({ success: true, message: 'Counselling settings created', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

/**
 * PUT /api/counselling/settings/:id
 */
router.put('/settings/:id', verifyToken, isAdmin, async (req, res) => {
  const { session_id, start_date, end_date, max_research_choices, is_active } = req.body;
  try {
    await pool.execute(
      `UPDATE counselling_settings
       SET session_id = ?, start_date = ?, end_date = ?, max_research_choices = ?, is_active = ?, updated_at = NOW()
       WHERE id = ?`,
      [session_id, start_date, end_date, max_research_choices || 3, is_active ? 1 : 0, req.params.id]
    );
    res.json({ success: true, message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

/**
 * DELETE /api/counselling/settings/:id
 */
router.delete('/settings/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM counselling_settings WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Settings deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

// â”€â”€â”€ Research Centers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * GET /api/counselling/research-centers
 * Optional: ?active=1  ?department=<name>
 * When department is provided, returns only centers that have at least one
 * active supervisor mapped to that department.
 */
router.get('/research-centers', async (req, res) => {
  try {
    const { active, department } = req.query;

    if (department) {
      const [rows] = await pool.execute(`
        SELECT DISTINCT rc.*
        FROM research_centers rc
        JOIN research_supervisors rs ON rs.research_center_id = rc.id
        WHERE rc.is_active = 1 AND rs.is_active = 1
          AND LOWER(TRIM(rs.department)) = LOWER(TRIM(?))
        ORDER BY rc.center_name
      `, [department]);
      return res.json({ success: true, data: rows });
    }

    const where = active === '1' ? 'WHERE is_active = 1' : '';
    const [rows] = await pool.execute(`SELECT * FROM research_centers ${where} ORDER BY center_name`);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

/**
 * POST /api/counselling/research-centers
 */
router.post('/research-centers', verifyToken, isAdmin, async (req, res) => {
  const { center_name } = req.body;
  if (!center_name) return res.status(400).json({ success: false, message: 'center_name required' });
  try {
    const [result] = await pool.execute(
      'INSERT INTO research_centers (center_name) VALUES (?)', [center_name]
    );
    res.status(201).json({ success: true, message: 'Center created', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

/**
 * PUT /api/counselling/research-centers/:id
 */
router.put('/research-centers/:id', verifyToken, isAdmin, async (req, res) => {
  const { center_name, is_active } = req.body;
  try {
    await pool.execute(
      'UPDATE research_centers SET center_name = ?, is_active = ? WHERE id = ?',
      [center_name, is_active ? 1 : 0, req.params.id]
    );
    res.json({ success: true, message: 'Center updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

/**
 * DELETE /api/counselling/research-centers/:id
 */
router.delete('/research-centers/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM research_centers WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Center deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

// â”€â”€â”€ Research Supervisors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * GET /api/counselling/research-supervisors?center_id=&active=1&department=<name>
 * When department is provided, filters supervisors by department (case-insensitive).
 */
router.get('/research-supervisors', async (req, res) => {
  try {
    const { center_id, active, department } = req.query;
    let baseQuery = `
      SELECT rs.*, rc.center_name
      FROM research_supervisors rs
      JOIN research_centers rc ON rs.research_center_id = rc.id
      WHERE 1=1
    `;
    const params = [];
    if (center_id)   { baseQuery += ' AND rs.research_center_id = ?'; params.push(center_id); }
    if (department)  { baseQuery += ' AND LOWER(TRIM(rs.department)) = LOWER(TRIM(?))'; params.push(department); }
    baseQuery += ' ORDER BY rs.supervisor_name';

    let rows;
    if (active === '1') {
      try {
        [rows] = await pool.execute(baseQuery.replace('WHERE 1=1', 'WHERE 1=1 AND rs.is_active = 1'), params);
      } catch (_) {
        [rows] = await pool.execute(baseQuery, params);
      }
    } else {
      [rows] = await pool.execute(baseQuery, params);
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

/**
 * POST /api/counselling/research-supervisors
 */
router.post('/research-supervisors', verifyToken, isAdmin, async (req, res) => {
  const { research_center_id, supervisor_name, designation, department } = req.body;
  if (!research_center_id || !supervisor_name) {
    return res.status(400).json({ success: false, message: 'research_center_id and supervisor_name required' });
  }
  try {
    const [result] = await pool.execute(
      `INSERT INTO research_supervisors (research_center_id, supervisor_name, designation, department)
       VALUES (?, ?, ?, ?)`,
      [research_center_id, supervisor_name, designation || null, department || null]
    );
    res.status(201).json({ success: true, message: 'Supervisor created', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

/**
 * PUT /api/counselling/research-supervisors/:id
 */
router.put('/research-supervisors/:id', verifyToken, isAdmin, async (req, res) => {
  const { research_center_id, supervisor_name, designation, department, is_active } = req.body;
  try {
    await pool.execute(
      `UPDATE research_supervisors
       SET research_center_id = ?, supervisor_name = ?, designation = ?, department = ?, is_active = ?
       WHERE id = ?`,
      [research_center_id, supervisor_name, designation || null, department || null, is_active ? 1 : 0, req.params.id]
    );
    res.json({ success: true, message: 'Supervisor updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

/**
 * DELETE /api/counselling/research-supervisors/:id
 */
router.delete('/research-supervisors/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM research_supervisors WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Supervisor deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

// â”€â”€â”€ Counselling Applications (Admin View) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * GET /api/counselling/applications?session_id=&status=&center_id=&supervisor_id=
 */
router.get('/applications', verifyToken, isAdmin, async (req, res) => {
  try {
    const { session_id, status, center_id, supervisor_id, search } = req.query;

    let resolvedSessionId = session_id;
    if (!resolvedSessionId || resolvedSessionId === 'active') {
      resolvedSessionId = await getActiveSessionId();
    } else if (resolvedSessionId === 'all') {
      resolvedSessionId = null;
    }

    let query = `
      SELECT ca.*, u.full_name, u.email, u.application_id AS user_app_id,
             CONCAT(s.month, ' ', s.year) AS session_name
      FROM counselling_applications ca
      JOIN users u ON ca.user_id = u.id
      LEFT JOIN sessions s ON ca.session_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (resolvedSessionId) { query += ' AND ca.session_id = ?'; params.push(resolvedSessionId); }
    if (status)            { query += ' AND ca.status = ?';     params.push(status); }
    if (search) {
      query += ' AND (u.full_name LIKE ? OR u.application_id LIKE ?)';
      const w = `%${search}%`;
      params.push(w, w);
    }

    if (center_id || supervisor_id) {
        let subWhere = 'WHERE 1=1';
        if (center_id)     { subWhere += ' AND (centre_id = ? OR research_center_id = ?)'; params.push(parseInt(center_id, 10)); params.push(parseInt(center_id, 10)); }
        if (supervisor_id) { subWhere += ' AND (master_supervisor_id = ? OR supervisor_id = ?)'; params.push(parseInt(supervisor_id, 10)); params.push(parseInt(supervisor_id, 10)); }
        query += ` AND ca.id IN (SELECT DISTINCT counselling_application_id FROM counselling_research_choices ${subWhere})`;
    }

    query += ' ORDER BY ca.created_at DESC';

    const [rows] = await pool.execute(query, params);

    // Attach choices for each application
    const appIds = rows.map(r => r.id);
    let choices = [];
    if (appIds.length > 0) {
      const placeholders = appIds.map(() => '?').join(',');
      const [choiceRows] = await pool.execute(`
        SELECT crc.*,
               COALESCE(rc2.college_name, rc2.name, rc1.center_name) AS center_name,
               COALESCE(sup.name, rs.supervisor_name) AS supervisor_name,
               COALESCE(d.name, rs.designation) AS designation
        FROM counselling_research_choices crc
        LEFT JOIN research_centres rc2 ON crc.centre_id = rc2.id
        LEFT JOIN research_centers rc1 ON crc.research_center_id = rc1.id
        LEFT JOIN supervisors sup ON crc.master_supervisor_id = sup.id
        LEFT JOIN master_designations d ON sup.designation_id = d.id
        LEFT JOIN research_supervisors rs ON crc.supervisor_id = rs.id
        WHERE crc.counselling_application_id IN (${placeholders})
        ORDER BY crc.counselling_application_id, crc.preference_order
      `, appIds);
      choices = choiceRows;
    }

    const choiceMap = {};
    choices.forEach(c => {
      if (!choiceMap[c.counselling_application_id]) choiceMap[c.counselling_application_id] = [];
      choiceMap[c.counselling_application_id].push(c);
    });

    const result = rows.map(r => ({ ...r, choices: choiceMap[r.id] || [] }));
    res.json({ success: true, data: result, total: result.length });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

/**
 * GET /api/counselling/applications/export/excel
 */
router.get('/applications/export/excel', verifyToken, isAdmin, async (req, res) => {
  try {
    const { session_id } = req.query;
    let resolvedSessionId = session_id;
    if (!resolvedSessionId || resolvedSessionId === 'active') {
      resolvedSessionId = await getActiveSessionId();
    } else if (resolvedSessionId === 'all') {
      resolvedSessionId = null;
    }

    let query = `
      SELECT ca.*, u.full_name, u.email, u.application_id AS user_app_id,
             CONCAT(s.month, ' ', s.year) AS session_name
      FROM counselling_applications ca
      JOIN users u ON ca.user_id = u.id
      LEFT JOIN sessions s ON ca.session_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (resolvedSessionId) { query += ' AND ca.session_id = ?'; params.push(resolvedSessionId); }
    query += ' ORDER BY ca.created_at DESC';

    const [rows] = await pool.execute(query, params);
    const appIds = rows.map(r => r.id);
    let choices = [];
    if (appIds.length > 0) {
      const placeholders = appIds.map(() => '?').join(',');
      const [choiceRows] = await pool.execute(`
        SELECT crc.counselling_application_id, crc.preference_order,
               COALESCE(rc2.college_name, rc2.name, rc1.center_name) AS center_name,
               COALESCE(sup.name, rs.supervisor_name) AS supervisor_name
        FROM counselling_research_choices crc
        LEFT JOIN research_centres rc2 ON crc.centre_id = rc2.id
        LEFT JOIN research_centers rc1 ON crc.research_center_id = rc1.id
        LEFT JOIN supervisors sup ON crc.master_supervisor_id = sup.id
        LEFT JOIN research_supervisors rs ON crc.supervisor_id = rs.id
        WHERE crc.counselling_application_id IN (${placeholders})
        ORDER BY crc.counselling_application_id, crc.preference_order
      `, appIds);
      choices = choiceRows;
    }

    const choiceMap = {};
    choices.forEach(c => {
      if (!choiceMap[c.counselling_application_id]) choiceMap[c.counselling_application_id] = [];
      choiceMap[c.counselling_application_id].push(c);
    });

    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Counselling Applications');

    worksheet.columns = [
      { header: 'Application ID',   key: 'user_app_id',   width: 18 },
      { header: 'Applicant Name',   key: 'full_name',      width: 25 },
      { header: 'Email',            key: 'email',          width: 30 },
      { header: 'Session',          key: 'session_name',   width: 20 },
      { header: 'Status',           key: 'status',         width: 12 },
      { header: 'Submitted At',     key: 'submitted_at',   width: 20 },
      { header: 'Preference 1',     key: 'pref1',          width: 35 },
      { header: 'Preference 2',     key: 'pref2',          width: 35 },
      { header: 'Preference 3',     key: 'pref3',          width: 35 },
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };

    rows.forEach(r => {
      const rc = choiceMap[r.id] || [];
      const prefStr = (idx) => rc[idx] ? `${rc[idx].center_name} â€” ${rc[idx].supervisor_name}` : 'â€”';
      worksheet.addRow({
        user_app_id:  r.user_app_id,
        full_name:    r.full_name,
        email:        r.email,
        session_name: r.session_name || 'â€”',
        status:       r.status,
        submitted_at: r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-IN') : 'â€”',
        pref1:        prefStr(0),
        pref2:        prefStr(1),
        pref3:        prefStr(2),
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="counselling_${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

// â”€â”€â”€ Allotment Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * PUT /api/counselling/allot/:id
 * Allot or reject a counselling application
 */
router.put('/allot/:id', verifyToken, isAdmin, async (req, res) => {
  const { allotment_status, allotted_center_id, allotted_supervisor_id, allotment_remarks } = req.body;
  const validStatuses = ['Pending', 'Allotted', 'Not Allotted'];
  if (!validStatuses.includes(allotment_status)) {
    return res.status(400).json({ success: false, message: 'allotment_status must be Pending, Allotted, or Not Allotted' });
  }
  if (allotment_status === 'Allotted' && (!allotted_center_id || !allotted_supervisor_id)) {
    return res.status(400).json({ success: false, message: 'allotted_center_id and allotted_supervisor_id are required when Allotting' });
  }
  try {
    const allottedAt = allotment_status === 'Allotted' ? new Date() : null;
    await pool.execute(
      `UPDATE counselling_applications
       SET allotment_status = ?, allotted_center_id = ?, allotted_supervisor_id = ?,
           allotment_remarks = ?, allotted_at = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        allotment_status,
        allotment_status === 'Allotted' ? (allotted_center_id || null) : null,
        allotment_status === 'Allotted' ? (allotted_supervisor_id || null) : null,
        allotment_remarks || null,
        allottedAt,
        req.params.id
      ]
    );
    res.json({ success: true, message: `Allotment status set to ${allotment_status}` });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

/**
 * GET /api/counselling/allotments?session_id=
 * List all counselling applications with allotment info
 */
router.get('/allotments', verifyToken, isAdmin, async (req, res) => {
  try {
    const { session_id, allotment_status } = req.query;
    let resolvedSessionId = session_id;
    if (!resolvedSessionId || resolvedSessionId === 'active') {
      resolvedSessionId = await getActiveSessionId();
    } else if (resolvedSessionId === 'all') {
      resolvedSessionId = null;
    }

    let query = `
      SELECT ca.id, ca.user_id, ca.session_id, ca.status, ca.submitted_at,
             ca.allotment_status, ca.allotted_center_id, ca.allotted_supervisor_id,
             ca.allotment_remarks, ca.allotted_at,
             u.full_name, u.email, u.application_id AS user_app_id,
             rc.center_name AS allotted_center_name,
             rs.supervisor_name AS allotted_supervisor_name,
             rs.designation AS allotted_supervisor_designation,
             CONCAT(s.month, ' ', s.year) AS session_name
      FROM counselling_applications ca
      JOIN users u ON ca.user_id = u.id
      LEFT JOIN research_centers rc ON ca.allotted_center_id = rc.id
      LEFT JOIN research_supervisors rs ON ca.allotted_supervisor_id = rs.id
      LEFT JOIN sessions s ON ca.session_id = s.id
      WHERE ca.status = 'Submitted'
    `;
    const params = [];
    if (resolvedSessionId) { query += ' AND ca.session_id = ?'; params.push(resolvedSessionId); }
    if (allotment_status)  { query += ' AND ca.allotment_status = ?'; params.push(allotment_status); }
    query += ' ORDER BY ca.submitted_at ASC';

    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

/**
 * GET /api/counselling/joining-letter/:id
 * Full data for a joining letter print page
 */
router.get('/joining-letter/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const [[ca]] = await pool.execute(`
      SELECT ca.*, u.full_name, u.email, u.application_id AS user_app_id,
             a.subject, a.dob, a.community, a.category, a.mobile,
             rc.center_name AS allotted_center_name,
             rs.supervisor_name AS allotted_supervisor_name,
             rs.designation AS allotted_supervisor_designation,
             CONCAT(s.month, ' ', s.year) AS session_name
      FROM counselling_applications ca
      JOIN users u ON ca.user_id = u.id
      JOIN applications a ON a.user_id = ca.user_id
      LEFT JOIN research_centers rc ON ca.allotted_center_id = rc.id
      LEFT JOIN research_supervisors rs ON ca.allotted_supervisor_id = rs.id
      LEFT JOIN sessions s ON ca.session_id = s.id
      WHERE ca.id = ? AND ca.allotment_status = 'Allotted'
    `, [req.params.id]);

    if (!ca) return res.status(404).json({ success: false, message: 'Joining letter not found or not yet allotted' });

    const [[settings]] = await pool.execute('SELECT * FROM university_settings LIMIT 1');
    res.json({ success: true, data: ca, settings: settings || {} });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

// ─── Admin-Created Counselling Applications ────────────────────────────────────

/**
 * GET /api/counselling/admin-applications/validate/:appNumber
 * Validates an application number and returns student info for the admin modal.
 */
router.get('/admin-applications/validate/:appNumber', verifyToken, isAdmin, async (req, res) => {
  const { appNumber } = req.params;
  if (!appNumber || appNumber.trim().length < 3) {
    return res.status(400).json({ success: false, message: 'Application number is required' });
  }
  const appNum = appNumber.trim().toUpperCase();
  try {
    // 1. Look up student by application_id in users table
    const [[user]] = await pool.execute(
      `SELECT u.id, u.full_name, u.email, u.application_id, u.session_id
       FROM users u WHERE UPPER(TRIM(u.application_id)) = ?`,
      [appNum]
    );
    if (!user) {
      return res.status(404).json({ success: false, message: `No student found with application number ${appNum}` });
    }

    // 2. Fetch application details (subject/department, community, category, admission status)
    const [[app]] = await pool.execute(
      `SELECT a.subject, a.community, a.category, a.dob, a.mobile,
              a.admission_approved, a.qualification_status, a.payment_status
       FROM applications a WHERE a.user_id = ?`,
      [user.id]
    );
    if (!app) {
      return res.status(404).json({ success: false, message: 'Student application details not found' });
    }

    // 3. Eligibility check: must be admission-approved or qualified
    const isEligible = app.admission_approved === 1 ||
      ['Qualified', 'Direct Qualified'].includes(app.qualification_status);
    if (!isEligible) {
      return res.status(422).json({
        success: false,
        message: `Student is not eligible for counselling. Qualification status: ${app.qualification_status || 'Pending'}`
      });
    }

    // 4. Confirm active counselling session exists
    const activeSessionId = await getActiveSessionId();
    if (!activeSessionId) {
      return res.status(422).json({ success: false, message: 'No active admission session found' });
    }
    const [[settings]] = await pool.execute(
      'SELECT * FROM counselling_settings WHERE session_id = ? AND is_active = 1 LIMIT 1',
      [activeSessionId]
    );
    if (!settings) {
      return res.status(422).json({ success: false, message: 'Counselling is not open for the active session' });
    }

    // 5. Check if counselling application already exists for this user + session
    const [[existing]] = await pool.execute(
      'SELECT id, status FROM counselling_applications WHERE user_id = ? AND session_id = ?',
      [user.id, activeSessionId]
    );
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A counselling application already exists for this student (ID: ${existing.id}, Status: ${existing.status})`
      });
    }

    res.json({
      success: true,
      data: {
        user_id:              user.id,
        application_number:   user.application_id,
        full_name:            user.full_name,
        email:                user.email,
        department:           app.subject || '',
        community:            app.community || '',
        category:             app.category || '',
        dob:                  app.dob,
        admission_approved:   app.admission_approved,
        qualification_status: app.qualification_status,
        session_id:           activeSessionId,
        max_choices:          settings.max_research_choices,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

/**
 * GET /api/counselling/admin-applications
 * List all admin-created counselling applications.
 */
router.get('/admin-applications', verifyToken, isAdmin, async (req, res) => {
  try {
    const { session_id, status, search } = req.query;
    let resolvedSessionId = session_id;
    if (!resolvedSessionId || resolvedSessionId === 'active') {
      resolvedSessionId = await getActiveSessionId();
    } else if (resolvedSessionId === 'all') {
      resolvedSessionId = null;
    }

    let query = `
      SELECT ca.id, ca.user_id, ca.session_id, ca.status, ca.submitted_at,
             ca.student_application_id, ca.department_filter, ca.admin_notes,
             ca.created_by_admin, ca.created_at, ca.updated_at,
             ca.cancelled_at,
             u.full_name, u.email, u.application_id AS user_app_id,
             CONCAT(s.month, ' ', s.year) AS session_name
      FROM counselling_applications ca
      JOIN users u ON ca.user_id = u.id
      LEFT JOIN sessions s ON ca.session_id = s.id
      WHERE ca.created_by_admin = 1
    `;
    const params = [];
    if (resolvedSessionId) { query += ' AND ca.session_id = ?'; params.push(resolvedSessionId); }
    if (status)            { query += ' AND ca.status = ?';     params.push(status); }
    if (search) {
      query += ' AND (u.full_name LIKE ? OR u.application_id LIKE ? OR ca.student_application_id LIKE ?)';
      const w = `%${search}%`;
      params.push(w, w, w);
    }
    query += ' ORDER BY ca.created_at DESC';

    const [rows] = await pool.execute(query, params);

    if (rows.length === 0) return res.json({ success: true, data: [], total: 0 });

    // Attach choices
    const appIds = rows.map(r => r.id);
    const placeholders = appIds.map(() => '?').join(',');
    const [choiceRows] = await pool.execute(`
      SELECT crc.*,
             COALESCE(rc2.college_name, rc2.name, rc1.center_name) AS center_name,
             COALESCE(sup.name, rs.supervisor_name) AS supervisor_name,
             COALESCE(d.name, rs.designation) AS designation
      FROM counselling_research_choices crc
      LEFT JOIN research_centres rc2 ON crc.centre_id = rc2.id
      LEFT JOIN research_centers rc1 ON crc.research_center_id = rc1.id
      LEFT JOIN supervisors sup ON crc.master_supervisor_id = sup.id
      LEFT JOIN master_designations d ON sup.designation_id = d.id
      LEFT JOIN research_supervisors rs ON crc.supervisor_id = rs.id
      WHERE crc.counselling_application_id IN (${placeholders})
      ORDER BY crc.counselling_application_id, crc.preference_order
    `, appIds);

    const choiceMap = {};
    choiceRows.forEach(c => {
      if (!choiceMap[c.counselling_application_id]) choiceMap[c.counselling_application_id] = [];
      choiceMap[c.counselling_application_id].push(c);
    });

    const result = rows.map(r => ({ ...r, choices: choiceMap[r.id] || [] }));
    res.json({ success: true, data: result, total: result.length });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

/**
 * POST /api/counselling/admin-applications
 * Create a counselling application on behalf of a student.
 * Body: { user_id, session_id, application_number, department, preferences: [{center_id, supervisor_id}] }
 */
router.post('/admin-applications', verifyToken, isAdmin, async (req, res) => {
  const { user_id, session_id, application_number, department, preferences, admin_notes } = req.body;

  if (!user_id || !session_id) {
    return res.status(400).json({ success: false, message: 'user_id and session_id are required' });
  }
  if (!Array.isArray(preferences) || preferences.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one preference is required' });
  }

  // Validate: no duplicate centers or supervisors
  const centerIds   = preferences.map(p => String(p.center_id));
  const supervisorIds = preferences.map(p => String(p.supervisor_id));
  if (new Set(centerIds).size !== centerIds.length) {
    return res.status(400).json({ success: false, message: 'Duplicate research centre selections are not allowed' });
  }
  if (new Set(supervisorIds).size !== supervisorIds.length) {
    return res.status(400).json({ success: false, message: 'Duplicate supervisor selections are not allowed' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Guard: no existing application for this user+session
    const [[existing]] = await conn.execute(
      'SELECT id FROM counselling_applications WHERE user_id = ? AND session_id = ?',
      [user_id, session_id]
    );
    if (existing) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'A counselling application already exists for this student in the active session' });
    }

    // Create counselling application (status Submitted — admin is finalising it)
    const [result] = await conn.execute(`
      INSERT INTO counselling_applications
        (user_id, session_id, status, submitted_at, created_by_admin,
         student_application_id, department_filter, admin_notes)
      VALUES (?, ?, 'Submitted', NOW(), 1, ?, ?, ?)
    `, [user_id, session_id, application_number || null, department || null, admin_notes || null]);

    const counsellingAppId = result.insertId;

    // Insert preferences
    for (let i = 0; i < preferences.length; i++) {
      const { center_id, supervisor_id } = preferences[i];
      if (!center_id || !supervisor_id) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: `Preference ${i + 1}: centre and supervisor are required` });
      }
      await conn.execute(`
        INSERT INTO counselling_research_choices
          (counselling_application_id, research_center_id, supervisor_id, preference_order)
        VALUES (?, ?, ?, ?)
      `, [counsellingAppId, center_id, supervisor_id, i + 1]);
    }

    // Audit log
    await conn.execute(`
      INSERT INTO counselling_admin_logs
        (counselling_application_id, application_number, action, admin_id, admin_email, new_value)
      VALUES (?, ?, 'Created', ?, ?, ?)
    `, [
      counsellingAppId,
      application_number || null,
      req.user?.id || null,
      req.user?.email || null,
      JSON.stringify({ user_id, session_id, department, preferences })
    ]);

    await conn.commit();
    res.status(201).json({ success: true, message: 'Counselling application created successfully', id: counsellingAppId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: safeError(err) });
  } finally {
    conn.release();
  }
});

/**
 * PUT /api/counselling/admin-applications/:id
 * Update preferences on an admin-created counselling application.
 */
router.put('/admin-applications/:id', verifyToken, isAdmin, async (req, res) => {
  const { preferences, admin_notes } = req.body;
  const appId = parseInt(req.params.id, 10);

  if (!Array.isArray(preferences) || preferences.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one preference is required' });
  }

  const centerIds    = preferences.map(p => String(p.center_id));
  const supervisorIds = preferences.map(p => String(p.supervisor_id));
  if (new Set(centerIds).size !== centerIds.length) {
    return res.status(400).json({ success: false, message: 'Duplicate research centre selections are not allowed' });
  }
  if (new Set(supervisorIds).size !== supervisorIds.length) {
    return res.status(400).json({ success: false, message: 'Duplicate supervisor selections are not allowed' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Fetch current state for audit log and ownership check
    const [[ca]] = await conn.execute(
      'SELECT * FROM counselling_applications WHERE id = ? AND created_by_admin = 1',
      [appId]
    );
    if (!ca) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Admin-created counselling application not found' });
    }
    if (ca.status === 'Cancelled') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Cannot update a cancelled application' });
    }

    // Capture old preferences for audit
    const [oldChoices] = await conn.execute(
      'SELECT * FROM counselling_research_choices WHERE counselling_application_id = ? ORDER BY preference_order',
      [appId]
    );

    // Replace preferences
    await conn.execute('DELETE FROM counselling_research_choices WHERE counselling_application_id = ?', [appId]);
    for (let i = 0; i < preferences.length; i++) {
      const { center_id, supervisor_id } = preferences[i];
      if (!center_id || !supervisor_id) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: `Preference ${i + 1}: centre and supervisor are required` });
      }
      await conn.execute(`
        INSERT INTO counselling_research_choices
          (counselling_application_id, research_center_id, supervisor_id, preference_order)
        VALUES (?, ?, ?, ?)
      `, [appId, center_id, supervisor_id, i + 1]);
    }

    // Update admin_notes & timestamp
    await conn.execute(
      'UPDATE counselling_applications SET admin_notes = ?, updated_at = NOW() WHERE id = ?',
      [admin_notes || null, appId]
    );

    // Audit log
    await conn.execute(`
      INSERT INTO counselling_admin_logs
        (counselling_application_id, application_number, action, admin_id, admin_email, old_value, new_value)
      VALUES (?, ?, 'Updated', ?, ?, ?, ?)
    `, [
      appId,
      ca.student_application_id,
      req.user?.id || null,
      req.user?.email || null,
      JSON.stringify({ preferences: oldChoices }),
      JSON.stringify({ preferences })
    ]);

    await conn.commit();
    res.json({ success: true, message: 'Application updated successfully' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: safeError(err) });
  } finally {
    conn.release();
  }
});

/**
 * DELETE /api/counselling/admin-applications/:id
 * Cancel an admin-created counselling application (soft delete).
 */
router.delete('/admin-applications/:id', verifyToken, isAdmin, async (req, res) => {
  const appId = parseInt(req.params.id, 10);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[ca]] = await conn.execute(
      'SELECT * FROM counselling_applications WHERE id = ? AND created_by_admin = 1',
      [appId]
    );
    if (!ca) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Admin-created counselling application not found' });
    }
    if (ca.status === 'Cancelled') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Application is already cancelled' });
    }

    await conn.execute(
      `UPDATE counselling_applications
       SET status = 'Cancelled', cancelled_at = NOW(), cancelled_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [req.user?.id || null, appId]
    );

    await conn.execute(`
      INSERT INTO counselling_admin_logs
        (counselling_application_id, application_number, action, admin_id, admin_email, old_value)
      VALUES (?, ?, 'Cancelled', ?, ?, ?)
    `, [
      appId,
      ca.student_application_id,
      req.user?.id || null,
      req.user?.email || null,
      JSON.stringify({ previous_status: ca.status })
    ]);

    await conn.commit();
    res.json({ success: true, message: 'Application cancelled successfully' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: safeError(err) });
  } finally {
    conn.release();
  }
});

module.exports = router;
