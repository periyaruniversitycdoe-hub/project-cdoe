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
 */
router.get('/research-centers', async (req, res) => {
  try {
    const onlyActive = req.query.active === '1';
    const where = onlyActive ? 'WHERE is_active = 1' : '';
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
 * GET /api/counselling/research-supervisors?center_id=&active=1
 */
router.get('/research-supervisors', async (req, res) => {
  try {
    const { center_id, active } = req.query;
    let query = `
      SELECT rs.*, rc.center_name
      FROM research_supervisors rs
      JOIN research_centers rc ON rs.research_center_id = rc.id
      WHERE 1=1
    `;
    const params = [];
    if (center_id) { query += ' AND rs.research_center_id = ?'; params.push(center_id); }
    if (active === '1') { query += ' AND rs.is_active = 1'; }
    query += ' ORDER BY rs.supervisor_name';
    const [rows] = await pool.execute(query, params);
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
        if (center_id)     { subWhere += ' AND research_center_id = ?'; params.push(parseInt(center_id, 10)); }
        if (supervisor_id) { subWhere += ' AND supervisor_id = ?';       params.push(parseInt(supervisor_id, 10)); }
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
        SELECT crc.*, rc.center_name, rs.supervisor_name, rs.designation
        FROM counselling_research_choices crc
        JOIN research_centers rc ON crc.research_center_id = rc.id
        JOIN research_supervisors rs ON crc.supervisor_id = rs.id
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
               rc.center_name, rs.supervisor_name
        FROM counselling_research_choices crc
        JOIN research_centers rc ON crc.research_center_id = rc.id
        JOIN research_supervisors rs ON crc.supervisor_id = rs.id
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

module.exports = router;
