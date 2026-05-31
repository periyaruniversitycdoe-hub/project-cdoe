'use strict';
/**
 * Institute Master — Enterprise CRUD + Excel Import/Export + Smart Duplicate Engine
 * Mounted at: /api/institutes  (admin/backend/server.js)
 */
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const ExcelJS  = require('exceljs');
const pool     = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// ── File Upload (memory storage — Excel parse only) ──────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 10 * 1024 * 1024 },  // 10 MB
    fileFilter: (_req, file, cb) => {
        const ext = file.originalname.split('.').pop().toLowerCase();
        if (['xlsx', 'xls'].includes(ext)) cb(null, true);
        else cb(new Error('Only .xlsx and .xls files are allowed'));
    },
});

// ── Normalizers ──────────────────────────────────────────────────────────────
const normalizeCode  = v => (v || '').toString().trim().toUpperCase();
const normalizeEmail = v => (v || '').toString().trim().toLowerCase();
const normalizeName  = v => (v || '').toString().trim();
const cellStr        = v => (v === null || v === undefined ? '' : v.toString().trim());

// Extract first phone-length digit sequence — handles "9876543210, 9123456789" or
// "9786345875 4272-270545" style cells (multiple numbers in one field)
function normalizeMobile(v) {
    if (!v) return '';
    const str = v.toString().trim();
    // Split on comma, semicolon, slash, or whitespace runs
    const parts = str.split(/[,;\/\s]+/);
    for (const p of parts) {
        const digits = p.replace(/\D/g, '');
        if (digits.length >= 8) return digits;  // first phone-length segment wins
    }
    return str.replace(/\D/g, '');  // last resort: full string stripped
}


// ── Audit Logger ──────────────────────────────────────────────────────────────
async function audit (conn, action, institId, adminId, ip, oldVal, newVal, extra) {
    try {
        await conn.execute(
            `INSERT INTO institute_audit_log
             (action, institute_id, admin_id, ip_address, old_value, new_value, extra_info)
             VALUES (?,?,?,?,?,?,?)`,
            [
                action,
                institId  || null,
                adminId   || null,
                ip        || null,
                oldVal    ? JSON.stringify(oldVal) : null,
                newVal    ? JSON.stringify(newVal) : null,
                extra     ? JSON.stringify(extra)  : null,
            ]
        );
    } catch (e) {
        console.error('institute audit log error:', e.message);
    }
}

// ── SELECT helper ─────────────────────────────────────────────────────────────
// Returns rows with serial_no injected as pagination-aware counter
function attachSerial (rows, page, limit) {
    const offset = (page - 1) * limit;
    return rows.map((r, i) => ({ ...r, serial_no: offset + i + 1 }));
}

// ============================================================================
// GET /api/institutes
// List with pagination, search, status filter
// ============================================================================
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page)  || 1);
        const limit  = Math.min(200, parseInt(req.query.limit) || 20);
        const offset = (page - 1) * limit;
        const search = (req.query.search || '').trim();
        const status = req.query.status || '';
        const sort   = ['id','name','college_code','principal_name','created_at'].includes(req.query.sort)
                         ? req.query.sort : 'id';
        const order  = req.query.order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        const conds  = [];
        const params = [];
        if (search) {
            conds.push(`(mi.name LIKE ? OR mi.college_code LIKE ? OR mi.principal_name LIKE ? OR mi.college_email LIKE ?)`);
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }
        if (status === 'active')   conds.push('mi.is_active = 1');
        if (status === 'inactive') conds.push('mi.is_active = 0');
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

        const [[{ total }]] = await pool.execute(
            `SELECT COUNT(*) AS total FROM master_institutes mi ${where}`, params
        );
        const [rows] = await pool.query(
            `SELECT mi.* FROM master_institutes mi ${where} ORDER BY mi.${sort} ${order} LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json({
            success: true,
            data: attachSerial(rows, page, limit),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        });
    } catch (e) {
        console.error('GET /institutes', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================================
// GET /api/institutes/dropdown  — public, active only, for supervisor form
// ============================================================================
router.get('/dropdown', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, name, college_code
             FROM   master_institutes
             WHERE  is_active = 1
             ORDER  BY name ASC`
        );
        res.json({ success: true, data: rows });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================================
// GET /api/institutes/template  — downloadable Excel template
// ============================================================================
router.get('/template', verifyToken, isAdmin, async (req, res) => {
    try {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Periyar University ERP';
        const ws = wb.addWorksheet('Institute Import Template');

        ws.columns = [
            { header: 'College Code *',       key: 'college_code',     width: 16 },
            { header: 'College Name *',        key: 'college_name',     width: 42 },
            { header: 'Principal Name',        key: 'principal_name',   width: 30 },
            { header: 'Principal Mobile',      key: 'principal_mobile', width: 20 },
            { header: 'College Email',         key: 'college_email',    width: 35 },
            { header: 'College Phone Number',  key: 'college_phone',    width: 25 },
        ];

        // Header style
        ws.getRow(1).eachCell(cell => {
            cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a5f' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border    = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
        });
        ws.getRow(1).height = 28;

        // Sample row
        ws.addRow({
            college_code:     '101',
            college_name:     'Arignar Anna Govt. Arts College',
            principal_name:   'Dr. Sample Principal',
            principal_mobile: '9487058006',
            college_email:    'principal@example.ac.in',
            college_phone:    '04282235001',
        });
        ws.getRow(2).eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFe8f4fd' } };
        });

        // Note row
        ws.addRow([]);
        ws.addRow([
            'Note: * = required.  College Code must be unique.  Mobile: 10-15 digits.  Email: valid format.',
        ]);
        ws.mergeCells('A4:F4');
        ws.getCell('A4').font      = { italic: true, color: { argb: 'FFCC5500' }, size: 10 };
        ws.getCell('A4').alignment = { wrapText: true };

        res.setHeader('Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition',
            'attachment; filename="institute_import_template.xlsx"');
        await wb.xlsx.write(res);
        res.end();
    } catch (e) {
        console.error('template error', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================================
// GET /api/institutes/export
// ============================================================================
router.get('/export', verifyToken, isAdmin, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const search = (req.query.search || '').trim();
        const status = req.query.status || '';
        const conds  = [];
        const params = [];
        if (search) {
            conds.push(`(name LIKE ? OR college_code LIKE ? OR principal_name LIKE ?)`);
            const s = `%${search}%`;
            params.push(s, s, s);
        }
        if (status === 'active')   conds.push('is_active = 1');
        if (status === 'inactive') conds.push('is_active = 0');
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

        const [rows] = await conn.execute(
            `SELECT * FROM master_institutes ${where} ORDER BY id ASC`, params
        );

        const wb = new ExcelJS.Workbook();
        wb.creator = 'Periyar University ERP';
        const ws = wb.addWorksheet('Institutes');

        ws.columns = [
            { header: 'S.No',                 key: 'sno',              width: 8  },
            { header: 'College Code',         key: 'college_code',     width: 15 },
            { header: 'College Name',         key: 'name',             width: 45 },
            { header: 'Principal Name',       key: 'principal_name',   width: 30 },
            { header: 'Principal Mobile',     key: 'principal_mobile', width: 20 },
            { header: 'College Email',        key: 'college_email',    width: 38 },
            { header: 'College Phone Number', key: 'college_phone',    width: 25 },
            { header: 'Status',               key: 'status',           width: 12 },
        ];

        ws.getRow(1).eachCell(cell => {
            cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a5f' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        ws.getRow(1).height = 26;

        rows.forEach((row, i) => {
            const r = ws.addRow({
                sno:              i + 1,
                college_code:     row.college_code || row.abbreviation || '',
                name:             row.name,
                principal_name:   row.principal_name   || '',
                principal_mobile: row.principal_mobile || '',
                college_email:    row.college_email    || '',
                college_phone:    row.college_phone    || '',
                status:           row.is_active ? 'Active' : 'Inactive',
            });
            if (i % 2 === 0) {
                r.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf0f4f8' } };
                });
            }
        });

        await audit(conn, 'EXPORT', null, req.user?.id, req.ip, null,
            { count: rows.length }, { filter: { search, status } });

        res.setHeader('Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition',
            `attachment; filename="institutes_${Date.now()}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (e) {
        console.error('export error', e);
        res.status(500).json({ success: false, message: e.message });
    } finally {
        conn.release();
    }
});

// ============================================================================
// POST /api/institutes  — create single institute
// ============================================================================
router.post('/', verifyToken, isAdmin, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const {
            college_name, college_code, principal_name,
            principal_mobile, college_email, college_phone,
        } = req.body;

        const normCode   = normalizeCode(college_code);
        const normEmail  = normalizeEmail(college_email);
        const normMobile = normalizeMobile(principal_mobile);
        const normName   = normalizeName(college_name);

        if (!normName)  return res.status(400).json({ success: false, message: 'College Name is required' });
        if (!normCode)  return res.status(400).json({ success: false, message: 'College Code is required' });
        if (normEmail  && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail))
            return res.status(400).json({ success: false, message: 'Invalid email format' });
        if (normMobile && (normMobile.length < 10 || normMobile.length > 15))
            return res.status(400).json({ success: false, message: 'Principal Mobile must be 10–15 digits' });

        // Duplicate checks
        const [[dupCode]] = await conn.execute(
            'SELECT id FROM master_institutes WHERE college_code = ?', [normCode]);
        if (dupCode) return res.status(409).json({ success: false, message: `College Code "${normCode}" already exists` });

        const [[dupName]] = await conn.execute(
            'SELECT id FROM master_institutes WHERE LOWER(TRIM(name)) = LOWER(?)', [normName]);
        if (dupName) return res.status(409).json({ success: false, message: `College Name already exists` });


        const [result] = await conn.execute(
            `INSERT INTO master_institutes
             (name, college_code, abbreviation, principal_name, principal_mobile,
              college_email, college_phone, is_active, created_by)
             VALUES (?,?,?,?,?,?,?,1,?)`,
            [normName, normCode, normCode,
             normalizeName(principal_name) || null,
             normMobile || null, normEmail || null,
             (college_phone || '').trim() || null,
             req.user?.id || null]
        );

        const [[newRow]] = await conn.execute('SELECT * FROM master_institutes WHERE id = ?', [result.insertId]);
        await audit(conn, 'CREATE', result.insertId, req.user?.id, req.ip, null, newRow, null);

        res.json({ success: true, data: newRow });
    } catch (e) {
        console.error('POST /institutes', e);
        res.status(500).json({ success: false, message: e.message });
    } finally {
        conn.release();
    }
});

// ============================================================================
// PUT /api/institutes/:id
// ============================================================================
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id } = req.params;
        const {
            college_name, college_code, principal_name,
            principal_mobile, college_email, college_phone, is_active,
        } = req.body;

        const [[existing]] = await conn.execute('SELECT * FROM master_institutes WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ success: false, message: 'Institute not found' });

        const normCode   = normalizeCode(college_code);
        const normEmail  = normalizeEmail(college_email);
        const normMobile = normalizeMobile(principal_mobile);
        const normName   = normalizeName(college_name);

        if (!normName) return res.status(400).json({ success: false, message: 'College Name is required' });
        if (!normCode) return res.status(400).json({ success: false, message: 'College Code is required' });
        if (normEmail  && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail))
            return res.status(400).json({ success: false, message: 'Invalid email format' });
        if (normMobile && (normMobile.length < 10 || normMobile.length > 15))
            return res.status(400).json({ success: false, message: 'Principal Mobile must be 10–15 digits' });

        const [[dupCode]] = await conn.execute(
            'SELECT id FROM master_institutes WHERE college_code = ? AND id != ?', [normCode, id]);
        if (dupCode) return res.status(409).json({ success: false, message: `College Code "${normCode}" already exists` });

        const [[dupName]] = await conn.execute(
            'SELECT id FROM master_institutes WHERE LOWER(TRIM(name)) = LOWER(?) AND id != ?', [normName, id]);
        if (dupName) return res.status(409).json({ success: false, message: `College Name already exists` });


        const newActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;
        await conn.execute(
            `UPDATE master_institutes SET
             name=?, college_code=?, abbreviation=?, principal_name=?,
             principal_mobile=?, college_email=?, college_phone=?,
             is_active=?, updated_by=?
             WHERE id=?`,
            [normName, normCode, normCode,
             normalizeName(principal_name) || null,
             normMobile || null, normEmail || null,
             (college_phone || '').trim() || null,
             newActive, req.user?.id || null, id]
        );

        const [[updated]] = await conn.execute('SELECT * FROM master_institutes WHERE id = ?', [id]);
        await audit(conn, 'UPDATE', id, req.user?.id, req.ip, existing, updated, null);

        res.json({ success: true, data: updated });
    } catch (e) {
        console.error('PUT /institutes/:id', e);
        res.status(500).json({ success: false, message: e.message });
    } finally {
        conn.release();
    }
});

// ============================================================================
// PATCH /api/institutes/:id/toggle
// ============================================================================
router.patch('/:id/toggle', verifyToken, isAdmin, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id } = req.params;
        const [[existing]] = await conn.execute('SELECT * FROM master_institutes WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ success: false, message: 'Institute not found' });

        const newActive = req.body.is_active !== undefined
            ? (req.body.is_active ? 1 : 0)
            : (existing.is_active ? 0 : 1);

        await conn.execute(
            'UPDATE master_institutes SET is_active=?, updated_by=? WHERE id=?',
            [newActive, req.user?.id || null, id]
        );

        const [[updated]] = await conn.execute('SELECT * FROM master_institutes WHERE id = ?', [id]);
        await audit(conn, newActive ? 'ENABLE' : 'DISABLE', id, req.user?.id, req.ip,
            { is_active: existing.is_active }, { is_active: newActive }, null);

        res.json({ success: true, data: updated });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    } finally {
        conn.release();
    }
});

// ============================================================================
// DELETE /api/institutes/:id
// ============================================================================
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id } = req.params;
        const [[existing]] = await conn.execute('SELECT * FROM master_institutes WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ success: false, message: 'Institute not found' });

        // Guard: do not delete if supervisors reference this institute
        const [[{ cnt }]] = await conn.execute(
            'SELECT COUNT(*) AS cnt FROM supervisors WHERE serving_institute_id = ?', [id]);
        if (cnt > 0)
            return res.status(409).json({
                success: false,
                message: `Cannot delete: ${cnt} supervisor(s) assigned to this institute. Disable it instead.`,
            });

        await conn.execute('DELETE FROM master_institutes WHERE id = ?', [id]);
        await audit(conn, 'DELETE', id, req.user?.id, req.ip, existing, null, null);

        res.json({ success: true, message: 'Deleted successfully' });
    } catch (e) {
        console.error('DELETE /institutes/:id', e);
        res.status(500).json({ success: false, message: e.message });
    } finally {
        conn.release();
    }
});

// ============================================================================
// POST /api/institutes/import/preview
// Smart table detection + dynamic column mapping + row classification
// ============================================================================
router.post('/import/preview', verifyToken, isAdmin, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    try {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(req.file.buffer);
        const ws = wb.worksheets[0];
        if (!ws) return res.status(400).json({ success: false, message: 'Excel file has no worksheets' });

        // ── Header key normaliser ─────────────────────────────────────────────
        // Strip punctuation, collapse spaces → underscores, lowercase.
        // e.g. "Name of the College *" → "name_of_the_college"
        const cleanHeaderKey = raw =>
            (raw || '').toString().toLowerCase()
                .replace(/[:\*\.\(\)\[\]#!?]/g, '')
                .replace(/\s+/g, '_')
                .replace(/_+/g, '_')
                .trim();

        // ── Known header → canonical DB field aliases ─────────────────────────
        // Covers: Periyar Excel headers, our template headers, PDF export headers.
        const HEADER_ALIASES = {
            // college_code ────────────────────────────────────────────────────
            'college_code':                    'college_code',
            'collegecode':                     'college_code',
            'code':                            'college_code',
            'college_code_':                   'college_code',
            // college_name ────────────────────────────────────────────────────
            'college_name':                    'college_name',
            'name_of_the_college':             'college_name',
            'name_of_college':                 'college_name',
            'name_of_the_college_':            'college_name',
            'college':                         'college_name',
            // principal_name ──────────────────────────────────────────────────
            'principal_name':                  'principal_name',
            'name_of_the_principal':           'principal_name',
            'name_of_principal':               'principal_name',
            'name_of_the_principal_':          'principal_name',
            'principal':                       'principal_name',
            'name_of_the_head_of_institution': 'principal_name',
            // principal_mobile ────────────────────────────────────────────────
            'principal_mobile':                'principal_mobile',
            'phone_number_of_the_principal':   'principal_mobile',
            'phone_number_of_principal':       'principal_mobile',
            'phone_number_of_the_principal_':  'principal_mobile',
            'principal_phone':                 'principal_mobile',
            'principal_phone_number':          'principal_mobile',
            'mobile_of_the_principal':         'principal_mobile',
            'mobile':                          'principal_mobile',
            // college_email ───────────────────────────────────────────────────
            'college_email':                   'college_email',
            'college_mail_id':                 'college_email',
            'college_mail_id_':                'college_email',
            'college_mail':                    'college_email',
            'mail_id':                         'college_email',
            'email_id':                        'college_email',
            'email':                           'college_email',
            // college_phone ───────────────────────────────────────────────────
            'college_phone_number':            'college_phone',
            'college_phone':                   'college_phone',
            'college_phone_number_':           'college_phone',
            'phone_number':                    'college_phone',
        };

        // Serial-column key variants — ignored during data extraction
        const SERIAL_KEYS = new Set([
            's_no', 'sno', 'serial_no', 'serial', 's_no_', 'sl_no', 'sl_no_', 'no',
        ]);

        const ALL_DB_FIELDS = [
            'college_code', 'college_name', 'principal_name',
            'principal_mobile', 'college_email', 'college_phone',
        ];

        // ── Parse optional manual column_map from request body ────────────────
        // Sent as multipart field: column_map = JSON string { "excel_key": "db_field" }
        let manualMap = {};
        try { manualMap = JSON.parse(req.body.column_map || '{}'); } catch { manualMap = {}; }

        // ── Smart header row detection ────────────────────────────────────────
        // Scan up to the first 30 rows (skips Tamil banner text, university logo
        // rows, merged heading rows, etc.).  The first row where ≥ 2 cells match
        // a known alias is treated as the column-header row.
        let headerRowIdx   = 1;          // detected header row index (1-based)
        let fieldCols      = {};         // canonical field → column index
        let hasSerialCol   = false;
        let allExcelHeaders = [];        // { col, raw, key } for every non-empty cell in header row

        const scanLimit = Math.min(ws.rowCount, 30);
        for (let si = 1; si <= scanLimit; si++) {
            const scanRow  = ws.getRow(si);
            const tempCols = {};
            let   matched  = 0;
            let   hasSerial = false;
            const rowHdrs  = [];

            scanRow.eachCell((cell, ci) => {
                const raw = cellStr(cell.value);
                if (!raw) return;
                const key   = cleanHeaderKey(raw);
                rowHdrs.push({ col: ci, raw, key });
                const field = HEADER_ALIASES[key];
                if (field && tempCols[field] === undefined) { tempCols[field] = ci; matched++; }
                if (SERIAL_KEYS.has(key)) hasSerial = true;
            });

            // ≥ 2 recognised headers → this is the column-header row
            if (matched >= 2) {
                headerRowIdx    = si;
                fieldCols       = tempCols;
                hasSerialCol    = hasSerial;
                allExcelHeaders = rowHdrs;
                break;
            }
        }

        // ── Apply manual mapping overrides on top of auto-detected ────────────
        for (const [excelKey, dbField] of Object.entries(manualMap)) {
            if (!ALL_DB_FIELDS.includes(dbField)) continue;
            const hdr = allExcelHeaders.find(h => h.key === excelKey || h.raw === excelKey);
            if (hdr) fieldCols[dbField] = hdr.col;
        }

        // ── Identify unresolved / unmapped Excel headers ──────────────────────
        const unmappedHeaders   = allExcelHeaders.filter(
            h => !HEADER_ALIASES[h.key] && !SERIAL_KEYS.has(h.key)
        );
        const missingRequired   = ['college_code', 'college_name'].filter(f => !fieldCols[f]);

        // ── Fallback column positions (if still undetected) ───────────────────
        const base = hasSerialCol ? 1 : 0;
        const C = {
            college_code:     fieldCols['college_code']     ?? (base + 1),
            college_name:     fieldCols['college_name']     ?? (base + 2),
            principal_name:   fieldCols['principal_name']   ?? (base + 3),
            principal_mobile: fieldCols['principal_mobile'] ?? (base + 4),
            college_email:    fieldCols['college_email']    ?? (base + 5),
            college_phone:    fieldCols['college_phone']    ?? (base + 6),
        };

        // ── If headers completely undetectable: early-return needs_mapping ─────
        if (allExcelHeaders.length === 0) {
            return res.json({
                success:       true,
                needs_mapping: true,
                preview:       null,
                detected_info: {
                    header_row: null, auto_mapped: {}, excel_headers: [],
                    unmapped_headers: [], missing_required: ['college_code', 'college_name'],
                },
                message: 'No column headers detected in the file. Please map columns manually.',
            });
        }

        // ── Load existing institutes for duplicate detection ───────────────────
        const [existing] = await pool.execute('SELECT * FROM master_institutes');
        const byCode   = new Map(existing.map(r => [normalizeCode(r.college_code || r.abbreviation), r]));
        const byName   = new Map(existing.map(r => [r.name.trim().toLowerCase(), r]));
        // email / mobile are NOT used for duplicate detection — only code and name are checked

        const preview      = { new: [], duplicate: [], modified: [] };
        const seenCodes    = new Set();
        let   ignoredCount = 0;

        // ── Iterate data rows (skip everything up to and including headerRowIdx) ─
        ws.eachRow((row, rowIdx) => {
            if (rowIdx <= headerRowIdx) return;   // skip banner rows + header row

            const cv   = ci => cellStr(row.getCell(ci).value);
            const code = normalizeCode(cv(C.college_code));
            const name = normalizeName(cv(C.college_name));

            if (!code && !name) { ignoredCount++; return; }   // blank / footer / total rows

            const email  = normalizeEmail(cv(C.college_email));
            const mobile = normalizeMobile(cv(C.principal_mobile));
            const pname  = normalizeName(cv(C.principal_name));
            const phone  = cv(C.college_phone).trim();

            // ── Soft warnings — non-blocking, shown for information only ──────
            const softWarnings = [];
            if (!code) softWarnings.push('College Code is missing');
            if (!name) softWarnings.push('College Name is missing');

            const rowData = {
                row_number: rowIdx, college_code: code, college_name: name,
                principal_name: pname, principal_mobile: mobile,
                college_email: email, college_phone: phone,
                ...(softWarnings.length ? { warnings: softWarnings } : {}),
            };

            // ── Hard duplicate: same code already seen in THIS FILE ───────────
            // Only tracked when college_code is non-empty
            if (code) {
                if (seenCodes.has(code)) {
                    preview.duplicate.push({ ...rowData, duplicate_reason: 'Duplicate College Code in this file' });
                    return;
                }
                seenCodes.add(code);
            }

            const existByCode = code ? byCode.get(code) : null;
            const existByName = name ? byName.get(name.trim().toLowerCase()) : null;
            const matchedExisting = existByCode || existByName;

            // ── Hard duplicate: same college_code or college_name already in DB ──
            if (matchedExisting) {
                const e = matchedExisting;
                const changes = [];
                if (code && e.college_code !== code)
                    changes.push({ field: 'college_code', old_value: e.college_code || '', new_value: code });
                if (name && e.name.trim().toLowerCase() !== name.toLowerCase())
                    changes.push({ field: 'college_name', old_value: e.name, new_value: name });
                if ((e.principal_name  || '').trim() !== pname)
                    changes.push({ field: 'principal_name', old_value: e.principal_name || '', new_value: pname });
                if (normalizeMobile(e.principal_mobile || '') !== mobile)
                    changes.push({ field: 'principal_mobile', old_value: e.principal_mobile || '', new_value: mobile });
                if (normalizeEmail(e.college_email || '') !== email)
                    changes.push({ field: 'college_email', old_value: e.college_email || '', new_value: email });
                if ((e.college_phone || '').trim() !== phone)
                    changes.push({ field: 'college_phone', old_value: e.college_phone || '', new_value: phone });

                if (changes.length)
                    preview.modified.push({ ...rowData, existing_id: e.id, changes, action: 'skip' });
                else
                    preview.duplicate.push({ ...rowData, existing_id: e.id, duplicate_reason: 'Exact duplicate (no changes)' });
                return;
            }

            preview.new.push(rowData);
        });

        const warningRowCount = preview.new.filter(r => r.warnings?.length).length;

        const conn = await pool.getConnection();
        await audit(conn, 'IMPORT_PREVIEW', null, req.user?.id, req.ip, null, null, {
            filename:   req.file.originalname,
            header_row: headerRowIdx,
            new: preview.new.length, modified: preview.modified.length,
            duplicate: preview.duplicate.length, ignored: ignoredCount,
            warnings:  warningRowCount,
        });
        conn.release();

        res.json({
            success: true,
            preview,
            summary: {
                filename:  req.file.originalname,
                total:     preview.new.length + preview.modified.length + preview.duplicate.length + ignoredCount,
                new:       preview.new.length,
                modified:  preview.modified.length,
                duplicate: preview.duplicate.length,
                ignored:   ignoredCount,
                warnings:  warningRowCount,
            },
            // ── Column-mapping metadata returned to frontend ──────────────────
            detected_info: {
                header_row:       headerRowIdx,
                auto_mapped:      fieldCols,            // { db_field: colIdx }
                excel_headers:    allExcelHeaders,      // [{ col, raw, key }]
                unmapped_headers: unmappedHeaders,      // headers not matched to any DB field
                missing_required: missingRequired,      // required DB fields not detected
            },
        });
    } catch (e) {
        console.error('import/preview error', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================================
// POST /api/institutes/import/confirm
// Body: { new_rows, modified_rows, filename }
// modified_rows[].action = 'update' | 'skip'
// ============================================================================
router.post('/import/confirm', verifyToken, isAdmin, async (req, res) => {
    const { new_rows = [], modified_rows = [], filename = '' } = req.body;
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    // warnings replaces errors — raw SQL messages are never exposed to the UI
    const results = { inserted: 0, updated: 0, skipped: 0, ignored: 0, warnings: [] };

    try {
        // ── Insert new rows ───────────────────────────────────────────────────
        for (const row of new_rows) {
            // Empty college_code → NULL (MySQL UNIQUE index allows multiple NULLs)
            const normCode = normalizeCode(row.college_code) || null;
            try {
                // Pre-check: skip only when a non-null code already exists in DB
                if (normCode) {
                    const [[dup]] = await conn.execute(
                        'SELECT id FROM master_institutes WHERE college_code = ?', [normCode]);
                    if (dup) { results.skipped++; continue; }
                }

                await conn.execute(
                    `INSERT INTO master_institutes
                     (name, college_code, abbreviation, principal_name, principal_mobile,
                      college_email, college_phone, is_active, created_by)
                     VALUES (?,?,?,?,?,?,?,1,?)`,
                    [row.college_name    || null,
                     normCode, normCode,
                     row.principal_name   || null,
                     row.principal_mobile || null,
                     row.college_email    || null,
                     row.college_phone    || null,
                     req.user?.id || null]
                );
                results.inserted++;
            } catch (e) {
                if (e.code === 'ER_DUP_ENTRY') {
                    // Duplicate college_code — silent skip, no warning shown to user
                    results.skipped++;
                } else {
                    // Unexpected DB error — soft warning only
                    const label = normCode || `row ${row.row_number || '?'}`;
                    results.warnings.push({ row: label, note: 'Row could not be saved — skipped automatically' });
                    results.skipped++;
                }
            }
        }

        // ── Handle modified rows ──────────────────────────────────────────────
        for (const row of modified_rows) {
            if (row.action === 'ignore') { results.ignored++; continue; }
            if (row.action !== 'update') { results.skipped++; continue; }
            try {
                const [[exist]] = await conn.execute(
                    'SELECT * FROM master_institutes WHERE id = ?', [row.existing_id]);
                if (!exist) {
                    results.warnings.push({ row: row.college_code || '?', note: 'Record not found — skipped' });
                    results.skipped++;
                    continue;
                }

                await conn.execute(
                    `UPDATE master_institutes SET
                     name=?, college_code=?, abbreviation=?,
                     principal_name=?, principal_mobile=?,
                     college_email=?, college_phone=?, updated_by=?
                     WHERE id=?`,
                    [row.college_name || null,
                     normalizeCode(row.college_code) || null,
                     normalizeCode(row.college_code) || null,
                     row.principal_name   || null,
                     row.principal_mobile || null,
                     row.college_email    || null,
                     row.college_phone    || null,
                     req.user?.id || null,
                     row.existing_id]
                );
                await audit(conn, 'IMPORT_UPDATE', row.existing_id, req.user?.id, req.ip,
                    exist, row, { filename });
                results.updated++;
            } catch (e) {
                const label = row.college_code || `row ${row.row_number || '?'}`;
                results.warnings.push({ row: label, note: 'Update could not be applied — skipped' });
                results.skipped++;
            }
        }

        await conn.commit();
        await audit(conn, 'IMPORT_CONFIRM', null, req.user?.id, req.ip,
            null, results, { filename });

        res.json({ success: true, results });
    } catch (e) {
        await conn.rollback();
        console.error('import/confirm error', e);
        res.status(500).json({ success: false, message: e.message });
    } finally {
        conn.release();
    }
});

module.exports = router;
