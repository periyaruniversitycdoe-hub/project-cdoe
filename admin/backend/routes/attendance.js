const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { getActiveSessionId }   = require('../services/sessionCache');
const ExcelJS  = require('exceljs');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const Engine   = require('../services/EntranceWorkflowEngine');

const uploadDir = path.join(__dirname, '../../../uploads/attendance');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const sanitizeFilename = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');

const xlsStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => cb(null, `att_${Date.now()}_${sanitizeFilename(file.originalname)}`)
});
const xlsUpload = multer({
  storage: xlsStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) return cb(null, true);
    cb(new Error('Only .xlsx and .xls files are allowed'));
  }
});

async function resolveSession(session_id) {
  if (!session_id || session_id === 'active') return getActiveSessionId();
  if (session_id === 'all') return null;
  return parseInt(session_id, 10) || null;
}

const AttendanceXlsGenerationEngine = require('../services/AttendanceXlsGenerationEngine');

// ─── GET /api/attendance/template?session_id=&venue_id=&department= ────────────────
router.get('/template', verifyToken, isAdmin, async (req, res) => {
  try {
    const { session_id, venue_id, department } = req.query;
    const sid = await resolveSession(session_id);
    await AttendanceXlsGenerationEngine.generateDynamicAttendanceXls(sid, department, venue_id, res);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/attendance/upload ──────────────────────────────────────────────
router.post('/upload', verifyToken, isAdmin, xlsUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  const adminEmail = req.user?.email || 'admin';
  const { session_id, venue_id } = req.body;
  const filePath = req.file.path;

  try {
    const sid = await resolveSession(session_id);
    const result = await AttendanceXlsGenerationEngine.processAttendanceImport(filePath, sid, venue_id, adminEmail);
    res.json({ success: true, message: result.message, errors: result.errors });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/upload-logs', verifyToken, isAdmin, async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT aul.*, v.hall_name 
       FROM attendance_upload_logs aul
       LEFT JOIN venues v ON aul.venue_id = v.id
       ORDER BY aul.created_at DESC LIMIT 50`
    );
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/venue-status', verifyToken, isAdmin, async (req, res) => {
  try {
    const { session_id } = req.query;
    const sid = await resolveSession(session_id);

    // All Venues that have candidates with hall tickets
    const params = [];
    let where = "a.status = 'Approved' AND ht.hall_ticket_number IS NOT NULL";
    if (sid) { where += ' AND ht.session_id = ?'; params.push(sid); }

    const [allVenues] = await pool.execute(
      `SELECT ht.venue_id, v.hall_name, COUNT(*) AS total_candidates
       FROM applications a
       JOIN hall_tickets ht ON ht.application_id = a.application_id
       JOIN venues v ON ht.venue_id = v.id
       WHERE ${where}
       GROUP BY ht.venue_id, v.hall_name
       ORDER BY v.hall_name`,
      params
    );

    const [uploadedRows] = await pool.execute(
      `SELECT aul.venue_id, MAX(aul.processed_at) AS last_uploaded_at, SUM(aul.success_rows) AS rows_updated
       FROM attendance_upload_logs aul
       WHERE aul.status = 'Completed' AND aul.venue_id IS NOT NULL ${sid ? 'AND aul.session_id = ?' : ''}
       GROUP BY aul.venue_id`,
      sid ? [sid] : []
    );

    const upMap = {};
    uploadedRows.forEach(r => { upMap[r.venue_id] = r; });

    const uploaded = [];
    const pending = [];

    allVenues.forEach(v => {
      const meta = upMap[v.venue_id];
      if (meta) {
        uploaded.push({ venue_id: v.venue_id, hall_name: v.hall_name, total_candidates: v.total_candidates, last_uploaded_at: meta.last_uploaded_at, rows_updated: meta.rows_updated });
      } else {
        pending.push({ venue_id: v.venue_id, hall_name: v.hall_name, total_candidates: v.total_candidates });
      }
    });

    res.json({ success: true, data: { uploaded, pending } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
