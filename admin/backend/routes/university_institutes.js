'use strict';
/**
 * University Institute Master — CRUD + Excel Import/Export
 * Hierarchy: University → Institute → Research Center → Supervisor
 * Mounted at: /api/university-institutes  (admin/backend/server.js)
 */
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const ExcelJS  = require('exceljs');
const pool     = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { postUploadCheckMemory } = require('../../../shared/security/fileValidator');
const { safeError } = require('../../../shared/security/safeError');

// ── File Upload (memory storage — Excel only) ───────────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 10 * 1024 * 1024 },
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

function normalizeMobile(v) {
    if (!v) return '';
    const str  = v.toString().trim();
    const parts = str.split(/[,;\/\s]+/);
    for (const p of parts) {
        const digits = p.replace(/\D/g, '');
        if (digits.length >= 8) return digits;
    }
    return str.replace(/\D/g, '');
}

// ── Audit Logger ─────────────────────────────────────────────────────────────
async function audit(conn, action, instId, adminId, ip, oldVal, newVal, extra) {
    try {
        await conn.execute(
            `INSERT INTO institute_master_audit_log
             (action, institute_id, admin_id, ip_address, old_value, new_value, extra_info)
             VALUES (?,?,?,?,?,?,?)`,
            [
                action,
                instId  || null,
                adminId || null,
                ip      || null,
                oldVal  ? JSON.stringify(oldVal) : null,
                newVal  ? JSON.stringify(newVal) : null,
                extra   ? JSON.stringify(extra)  : null,
            ]
        );
    } catch (e) {
        console.error('institute_master audit error:', e.message);
    }
}

function attachSerial(rows, page, limit) {
    const offset = (page - 1) * limit;
    return rows.map((r, i) => ({ ...r, serial_no: offset + i + 1 }));
}

// ============================================================================
// GET /api/university-institutes  — paginated list
// ============================================================================
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page)  || 1);
        const limit  = Math.min(200, parseInt(req.query.limit) || 20);
        const offset = (page - 1) * limit;
        const search = (req.query.search || '').trim();
        const status = req.query.status || '';
        const type   = req.query.institute_type || '';
        const sort   = ['id','institute_name','institute_code','district','state','created_at'].includes(req.query.sort)
                         ? req.query.sort : 'id';
        const order  = req.query.order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        const conds  = [];
        const params = [];
        if (search) {
            conds.push(`(i.institute_name LIKE ? OR i.institute_code LIKE ? OR i.district LIKE ? OR i.email LIKE ?)`);
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }
        if (status === 'Active')   conds.push("i.status = 'Active'");
        if (status === 'Inactive') conds.push("i.status = 'Inactive'");
        if (type) { conds.push('i.institute_type = ?'); params.push(type); }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

        const [[{ total }]] = await pool.execute(
            `SELECT COUNT(*) AS total FROM institutes i ${where}`, params
        );
        const [rows] = await pool.query(
            `SELECT i.* FROM institutes i ${where} ORDER BY i.${sort} ${order} LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json({
            success: true,
            data: attachSerial(rows, page, limit),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        });
    } catch (e) {
        console.error('GET /university-institutes', e);
        res.status(500).json({ success: false, message: safeError(e) });
    }
});

// ============================================================================
// GET /api/university-institutes/dropdown — active institutes for dropdowns
// ============================================================================
router.get('/dropdown', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, institute_name AS name, institute_code AS code, institute_type AS type
             FROM   institutes
             WHERE  status = 'Active'
             ORDER  BY institute_name ASC`
        );
        res.json({ success: true, data: rows });
    } catch (e) {
        res.status(500).json({ success: false, message: safeError(e) });
    }
});

// ============================================================================
// GET /api/university-institutes/types — distinct institute types in use
// ============================================================================
router.get('/types', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT DISTINCT institute_type FROM institutes ORDER BY institute_type ASC`
        );
        res.json({ success: true, data: rows.map(r => r.institute_type) });
    } catch (e) {
        res.status(500).json({ success: false, message: safeError(e) });
    }
});

// ============================================================================
// GET /api/university-institutes/template — Excel import template
// ============================================================================
router.get('/template', verifyToken, isAdmin, async (req, res) => {
    try {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Periyar University ERP';
        const ws = wb.addWorksheet('Institute Import Template');

        ws.columns = [
            { header: 'Institute Name *',  key: 'institute_name',  width: 40 },
            { header: 'Institute Type *',  key: 'institute_type',  width: 25 },
            { header: 'Institute Code *',  key: 'institute_code',  width: 20 },
            { header: 'Address Line 1',    key: 'address_line_1',  width: 35 },
            { header: 'Address Line 2',    key: 'address_line_2',  width: 35 },
            { header: 'Address Line 3',    key: 'address_line_3',  width: 35 },
            { header: 'District',          key: 'district',        width: 20 },
            { header: 'State',             key: 'state',           width: 20 },
            { header: 'Pincode',           key: 'pincode',         width: 12 },
            { header: 'Mobile No',         key: 'mobile_no',       width: 18 },
            { header: 'Phone No',          key: 'phone_no',        width: 18 },
            { header: 'E-mail',            key: 'email',           width: 35 },
            { header: 'Website',           key: 'website',         width: 35 },
            { header: 'Remarks',           key: 'remarks',         width: 40 },
        ];

        ws.getRow(1).eachCell(cell => {
            cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a5f' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border    = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
        });
        ws.getRow(1).height = 28;

        ws.addRow({
            institute_name: 'Institute of Engineering',
            institute_type: 'University Department',
            institute_code: 'IE001',
            address_line_1: '12, University Road',
            address_line_2: 'Near Main Gate',
            address_line_3: '',
            district:       'Salem',
            state:          'Tamil Nadu',
            pincode:        '636001',
            mobile_no:      '9487058006',
            phone_no:       '04282235001',
            email:          'ie@periyaruniversity.ac.in',
            website:        'https://periyaruniversity.ac.in',
            remarks:        'Main engineering institute',
        });
        ws.getRow(2).eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFe8f4fd' } };
        });

        ws.addRow([]);
        ws.addRow(['Note: * = required. Institute Code must be unique.']);
        ws.mergeCells(`A4:N4`);
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
        res.status(500).json({ success: false, message: safeError(e) });
    }
});

// ============================================================================
// GET /api/university-institutes/export
// ============================================================================
router.get('/export', verifyToken, isAdmin, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const search = (req.query.search || '').trim();
        const status = req.query.status || '';
        const type   = req.query.institute_type || '';
        const conds  = [];
        const params = [];
        if (search) {
            conds.push(`(institute_name LIKE ? OR institute_code LIKE ? OR district LIKE ?)`);
            const s = `%${search}%`;
            params.push(s, s, s);
        }
        if (status === 'Active')   conds.push("status = 'Active'");
        if (status === 'Inactive') conds.push("status = 'Inactive'");
        if (type) { conds.push('institute_type = ?'); params.push(type); }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

        const [rows] = await conn.execute(
            `SELECT * FROM institutes ${where} ORDER BY id ASC`, params
        );

        const wb = new ExcelJS.Workbook();
        wb.creator = 'Periyar University ERP';
        const ws = wb.addWorksheet('Institutes');

        ws.columns = [
            { header: 'S.No',           key: 'sno',            width: 8  },
            { header: 'Institute Code', key: 'institute_code', width: 20 },
            { header: 'Institute Name', key: 'institute_name', width: 45 },
            { header: 'Type',           key: 'institute_type', width: 25 },
            { header: 'District',       key: 'district',       width: 20 },
            { header: 'State',          key: 'state',          width: 20 },
            { header: 'Mobile No',      key: 'mobile_no',      width: 18 },
            { header: 'Phone No',       key: 'phone_no',       width: 18 },
            { header: 'E-mail',         key: 'email',          width: 38 },
            { header: 'Website',        key: 'website',        width: 38 },
            { header: 'Status',         key: 'status',         width: 12 },
        ];

        ws.getRow(1).eachCell(cell => {
            cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a5f' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        ws.getRow(1).height = 26;

        rows.forEach((row, i) => {
            const r = ws.addRow({
                sno:            i + 1,
                institute_code: row.institute_code || '',
                institute_name: row.institute_name,
                institute_type: row.institute_type || '',
                district:       row.district        || '',
                state:          row.state           || '',
                mobile_no:      row.mobile_no       || '',
                phone_no:       row.phone_no        || '',
                email:          row.email           || '',
                website:        row.website         || '',
                status:         row.status,
            });
            if (i % 2 === 0) {
                r.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf0f4f8' } };
                });
            }
        });

        await audit(conn, 'EXPORT', null, req.user?.id, req.ip, null,
            { count: rows.length }, { filter: { search, status, type } });

        res.setHeader('Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition',
            `attachment; filename="institutes_${Date.now()}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (e) {
        console.error('export error', e);
        res.status(500).json({ success: false, message: safeError(e) });
    } finally {
        conn.release();
    }
});

// ============================================================================
// POST /api/university-institutes — create
// ============================================================================
router.post('/', verifyToken, isAdmin, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const {
            institute_name, institute_type, institute_code,
            address_line_1, address_line_2, address_line_3,
            district, state, pincode, mobile_no, phone_no,
            email, website, remarks, status,
        } = req.body;

        const normCode  = normalizeCode(institute_code);
        const normName  = normalizeName(institute_name);
        const normType  = normalizeName(institute_type);
        const normEmail = normalizeEmail(email);

        if (!normName) return res.status(400).json({ success: false, message: 'Institute Name is required' });
        if (!normType) return res.status(400).json({ success: false, message: 'Institute Type is required' });
        if (!normCode) return res.status(400).json({ success: false, message: 'Institute Code is required' });
        if (normEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail))
            return res.status(400).json({ success: false, message: 'Invalid email format' });

        const [[dupCode]] = await conn.execute(
            'SELECT id FROM institutes WHERE institute_code = ?', [normCode]);
        if (dupCode) return res.status(409).json({ success: false, message: `Institute Code "${normCode}" already exists` });

        const [[dupName]] = await conn.execute(
            'SELECT id FROM institutes WHERE LOWER(TRIM(institute_name)) = LOWER(?)', [normName]);
        if (dupName) return res.status(409).json({ success: false, message: 'Institute Name already exists' });

        const normStatus = ['Active','Inactive'].includes(status) ? status : 'Active';
        const [result] = await conn.execute(
            `INSERT INTO institutes
             (institute_name, institute_type, institute_code,
              address_line_1, address_line_2, address_line_3,
              district, state, pincode, mobile_no, phone_no,
              email, website, remarks, status, created_by)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [normName, normType, normCode,
             normalizeName(address_line_1) || null,
             normalizeName(address_line_2) || null,
             normalizeName(address_line_3) || null,
             normalizeName(district) || null,
             normalizeName(state)    || null,
             (pincode    || '').trim() || null,
             normalizeMobile(mobile_no) || null,
             (phone_no   || '').trim() || null,
             normEmail  || null,
             (website   || '').trim() || null,
             (remarks   || '').trim() || null,
             normStatus, req.user?.id || null]
        );

        const [[newRow]] = await conn.execute('SELECT * FROM institutes WHERE id = ?', [result.insertId]);
        await audit(conn, 'CREATE', result.insertId, req.user?.id, req.ip, null, newRow, null);

        res.json({ success: true, data: newRow });
    } catch (e) {
        console.error('POST /university-institutes', e);
        res.status(500).json({ success: false, message: safeError(e) });
    } finally {
        conn.release();
    }
});

// ============================================================================
// GET /api/university-institutes/:id
// ============================================================================
router.get('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[row]] = await pool.execute('SELECT * FROM institutes WHERE id = ?', [req.params.id]);
        if (!row) return res.status(404).json({ success: false, message: 'Institute not found' });
        res.json({ success: true, data: row });
    } catch (e) {
        res.status(500).json({ success: false, message: safeError(e) });
    }
});

// ============================================================================
// PUT /api/university-institutes/:id
// ============================================================================
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id } = req.params;
        const [[existing]] = await conn.execute('SELECT * FROM institutes WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ success: false, message: 'Institute not found' });

        const {
            institute_name, institute_type, institute_code,
            address_line_1, address_line_2, address_line_3,
            district, state, pincode, mobile_no, phone_no,
            email, website, remarks, status,
        } = req.body;

        const normCode  = normalizeCode(institute_code);
        const normName  = normalizeName(institute_name);
        const normType  = normalizeName(institute_type);
        const normEmail = normalizeEmail(email);

        if (!normName) return res.status(400).json({ success: false, message: 'Institute Name is required' });
        if (!normType) return res.status(400).json({ success: false, message: 'Institute Type is required' });
        if (!normCode) return res.status(400).json({ success: false, message: 'Institute Code is required' });
        if (normEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail))
            return res.status(400).json({ success: false, message: 'Invalid email format' });

        const [[dupCode]] = await conn.execute(
            'SELECT id FROM institutes WHERE institute_code = ? AND id != ?', [normCode, id]);
        if (dupCode) return res.status(409).json({ success: false, message: `Institute Code "${normCode}" already exists` });

        const [[dupName]] = await conn.execute(
            'SELECT id FROM institutes WHERE LOWER(TRIM(institute_name)) = LOWER(?) AND id != ?', [normName, id]);
        if (dupName) return res.status(409).json({ success: false, message: 'Institute Name already exists' });

        const normStatus = ['Active','Inactive'].includes(status) ? status : existing.status;
        await conn.execute(
            `UPDATE institutes SET
             institute_name=?, institute_type=?, institute_code=?,
             address_line_1=?, address_line_2=?, address_line_3=?,
             district=?, state=?, pincode=?, mobile_no=?, phone_no=?,
             email=?, website=?, remarks=?, status=?, updated_by=?
             WHERE id=?`,
            [normName, normType, normCode,
             normalizeName(address_line_1) || null,
             normalizeName(address_line_2) || null,
             normalizeName(address_line_3) || null,
             normalizeName(district) || null,
             normalizeName(state)    || null,
             (pincode   || '').trim() || null,
             normalizeMobile(mobile_no) || null,
             (phone_no  || '').trim() || null,
             normEmail  || null,
             (website   || '').trim() || null,
             (remarks   || '').trim() || null,
             normStatus, req.user?.id || null, id]
        );

        const [[updated]] = await conn.execute('SELECT * FROM institutes WHERE id = ?', [id]);
        await audit(conn, 'UPDATE', id, req.user?.id, req.ip, existing, updated, null);

        res.json({ success: true, data: updated });
    } catch (e) {
        console.error('PUT /university-institutes/:id', e);
        res.status(500).json({ success: false, message: safeError(e) });
    } finally {
        conn.release();
    }
});

// ============================================================================
// PATCH /api/university-institutes/:id/toggle — toggle Active/Inactive
// ============================================================================
router.patch('/:id/toggle', verifyToken, isAdmin, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id } = req.params;
        const [[existing]] = await conn.execute('SELECT * FROM institutes WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ success: false, message: 'Institute not found' });

        const newStatus = req.body.status !== undefined
            ? req.body.status
            : (existing.status === 'Active' ? 'Inactive' : 'Active');
        const validStatus = ['Active','Inactive'].includes(newStatus) ? newStatus : 'Active';

        // Block deactivation if research centers depend on it
        if (validStatus === 'Inactive') {
            const [[{ cnt }]] = await conn.execute(
                'SELECT COUNT(*) AS cnt FROM research_centres WHERE university_institute_id = ?', [id]);
            if (cnt > 0) {
                return res.status(409).json({
                    success: false,
                    message: `Cannot deactivate: ${cnt} research centre(s) linked to this institute. Remove links first.`,
                });
            }
        }

        await conn.execute(
            'UPDATE institutes SET status=?, updated_by=? WHERE id=?',
            [validStatus, req.user?.id || null, id]
        );
        const [[updated]] = await conn.execute('SELECT * FROM institutes WHERE id = ?', [id]);
        await audit(conn, validStatus === 'Active' ? 'ENABLE' : 'DISABLE', id,
            req.user?.id, req.ip, { status: existing.status }, { status: validStatus }, null);

        res.json({ success: true, data: updated });
    } catch (e) {
        res.status(500).json({ success: false, message: safeError(e) });
    } finally {
        conn.release();
    }
});

// ============================================================================
// DELETE /api/university-institutes/:id
// ============================================================================
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id } = req.params;
        const [[existing]] = await conn.execute('SELECT * FROM institutes WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ success: false, message: 'Institute not found' });

        // Guard: block delete if research centres are linked
        const [[{ cnt }]] = await conn.execute(
            'SELECT COUNT(*) AS cnt FROM research_centres WHERE university_institute_id = ?', [id]);
        if (cnt > 0) {
            return res.status(409).json({
                success: false,
                message: `Cannot delete: ${cnt} research centre(s) assigned to this institute. Deactivate it instead.`,
            });
        }

        await conn.execute('DELETE FROM institutes WHERE id = ?', [id]);
        await audit(conn, 'DELETE', id, req.user?.id, req.ip, existing, null, null);

        res.json({ success: true, message: 'Institute deleted successfully' });
    } catch (e) {
        console.error('DELETE /university-institutes/:id', e);
        res.status(500).json({ success: false, message: safeError(e) });
    } finally {
        conn.release();
    }
});

// ============================================================================
// POST /api/university-institutes/import/preview
// Smart column detection + row classification
// ============================================================================
router.post('/import/preview', verifyToken, isAdmin,
    upload.single('file'), postUploadCheckMemory(['.csv']), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    try {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(req.file.buffer);
        const ws = wb.worksheets[0];
        if (!ws) return res.status(400).json({ success: false, message: 'Excel file has no worksheets' });

        const cleanHeaderKey = raw =>
            (raw || '').toString().toLowerCase()
                .replace(/[:\*\.\(\)\[\]#!?]/g, '')
                .replace(/\s+/g, '_')
                .replace(/_+/g, '_')
                .trim();

        const HEADER_ALIASES = {
            'institute_name':     'institute_name',
            'name_of_the_institute': 'institute_name',
            'institute':          'institute_name',
            'name':               'institute_name',
            'institute_type':     'institute_type',
            'type':               'institute_type',
            'institute_code':     'institute_code',
            'code':               'institute_code',
            'address_line_1':     'address_line_1',
            'address_1':          'address_line_1',
            'address':            'address_line_1',
            'address_line_2':     'address_line_2',
            'address_2':          'address_line_2',
            'address_line_3':     'address_line_3',
            'address_3':          'address_line_3',
            'district':           'district',
            'state':              'state',
            'pincode':            'pincode',
            'pin':                'pincode',
            'mobile_no':          'mobile_no',
            'mobile':             'mobile_no',
            'phone_no':           'phone_no',
            'phone':              'phone_no',
            'phone_number':       'phone_no',
            'email':              'email',
            'e_mail':             'email',
            'email_id':           'email',
            'website':            'website',
            'website_url':        'website',
            'remarks':            'remarks',
            'remark':             'remarks',
        };

        const SERIAL_KEYS = new Set(['s_no','sno','serial_no','serial','sl_no','no']);
        const ALL_DB_FIELDS = [
            'institute_name','institute_type','institute_code',
            'address_line_1','address_line_2','address_line_3',
            'district','state','pincode','mobile_no','phone_no','email','website','remarks'
        ];

        let manualMap = {};
        try { manualMap = JSON.parse(req.body.column_map || '{}'); } catch { manualMap = {}; }

        let headerRowIdx   = 1;
        let fieldCols      = {};
        let hasSerialCol   = false;
        let allExcelHeaders = [];

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

            if (matched >= 2) {
                headerRowIdx    = si;
                fieldCols       = tempCols;
                hasSerialCol    = hasSerial;
                allExcelHeaders = rowHdrs;
                break;
            }
        }

        for (const [excelKey, dbField] of Object.entries(manualMap)) {
            if (!ALL_DB_FIELDS.includes(dbField)) continue;
            const hdr = allExcelHeaders.find(h => h.key === excelKey || h.raw === excelKey);
            if (hdr) fieldCols[dbField] = hdr.col;
        }

        const unmappedHeaders = allExcelHeaders.filter(
            h => !HEADER_ALIASES[h.key] && !SERIAL_KEYS.has(h.key)
        );
        const missingRequired = ['institute_name','institute_type','institute_code'].filter(f => !fieldCols[f]);

        const base = hasSerialCol ? 1 : 0;
        const C = {
            institute_name:  fieldCols['institute_name']  ?? (base + 1),
            institute_type:  fieldCols['institute_type']  ?? (base + 2),
            institute_code:  fieldCols['institute_code']  ?? (base + 3),
            address_line_1:  fieldCols['address_line_1']  ?? (base + 4),
            address_line_2:  fieldCols['address_line_2']  ?? (base + 5),
            address_line_3:  fieldCols['address_line_3']  ?? (base + 6),
            district:        fieldCols['district']         ?? (base + 7),
            state:           fieldCols['state']            ?? (base + 8),
            pincode:         fieldCols['pincode']          ?? (base + 9),
            mobile_no:       fieldCols['mobile_no']        ?? (base + 10),
            phone_no:        fieldCols['phone_no']         ?? (base + 11),
            email:           fieldCols['email']            ?? (base + 12),
            website:         fieldCols['website']          ?? (base + 13),
            remarks:         fieldCols['remarks']          ?? (base + 14),
        };

        const [existing] = await pool.execute('SELECT * FROM institutes');
        const byCode = new Map(existing.map(r => [normalizeCode(r.institute_code), r]));
        const byName = new Map(existing.map(r => [r.institute_name.trim().toLowerCase(), r]));

        const preview   = { new: [], duplicate: [], modified: [] };
        const seenCodes = new Set();
        let   ignoredCount = 0;

        ws.eachRow((row, rowIdx) => {
            if (rowIdx <= headerRowIdx) return;

            const cv   = ci => cellStr(row.getCell(ci).value);
            const code = normalizeCode(cv(C.institute_code));
            const name = normalizeName(cv(C.institute_name));

            if (!code && !name) { ignoredCount++; return; }

            const rowData = {
                row_number:    rowIdx,
                institute_code: code,
                institute_name: name,
                institute_type: cv(C.institute_type).trim(),
                address_line_1: cv(C.address_line_1).trim(),
                address_line_2: cv(C.address_line_2).trim(),
                address_line_3: cv(C.address_line_3).trim(),
                district:       cv(C.district).trim(),
                state:          cv(C.state).trim(),
                pincode:        cv(C.pincode).trim(),
                mobile_no:      normalizeMobile(cv(C.mobile_no)),
                phone_no:       cv(C.phone_no).trim(),
                email:          normalizeEmail(cv(C.email)),
                website:        cv(C.website).trim(),
                remarks:        cv(C.remarks).trim(),
            };

            if (code) {
                if (seenCodes.has(code)) {
                    preview.duplicate.push({ ...rowData, duplicate_reason: 'Duplicate Institute Code in this file' });
                    return;
                }
                seenCodes.add(code);
            }

            const existByCode = code ? byCode.get(code) : null;
            const existByName = name ? byName.get(name.trim().toLowerCase()) : null;
            const matchedExisting = existByCode || existByName;

            if (matchedExisting) {
                const e = matchedExisting;
                const changes = [];
                if (code && e.institute_code !== code)
                    changes.push({ field: 'institute_code', old_value: e.institute_code, new_value: code });
                if (name && e.institute_name.trim().toLowerCase() !== name.toLowerCase())
                    changes.push({ field: 'institute_name', old_value: e.institute_name, new_value: name });
                if (rowData.institute_type && e.institute_type !== rowData.institute_type)
                    changes.push({ field: 'institute_type', old_value: e.institute_type, new_value: rowData.institute_type });

                if (changes.length)
                    preview.modified.push({ ...rowData, existing_id: e.id, changes, action: 'skip' });
                else
                    preview.duplicate.push({ ...rowData, existing_id: e.id, duplicate_reason: 'Exact duplicate (no changes)' });
                return;
            }

            preview.new.push(rowData);
        });

        const conn = await pool.getConnection();
        await audit(conn, 'IMPORT_PREVIEW', null, req.user?.id, req.ip, null, null, {
            filename: req.file.originalname,
            header_row: headerRowIdx,
            new: preview.new.length, modified: preview.modified.length,
            duplicate: preview.duplicate.length, ignored: ignoredCount,
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
            },
            detected_info: {
                header_row:       headerRowIdx,
                auto_mapped:      fieldCols,
                excel_headers:    allExcelHeaders,
                unmapped_headers: unmappedHeaders,
                missing_required: missingRequired,
            },
        });
    } catch (e) {
        console.error('import/preview error', e);
        res.status(500).json({ success: false, message: safeError(e) });
    }
});

// ============================================================================
// POST /api/university-institutes/import/confirm
// ============================================================================
router.post('/import/confirm', verifyToken, isAdmin, async (req, res) => {
    const { new_rows = [], modified_rows = [], filename = '' } = req.body;
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    const results = { inserted: 0, updated: 0, skipped: 0, ignored: 0, warnings: [] };

    try {
        for (const row of new_rows) {
            const normCode = normalizeCode(row.institute_code) || null;
            try {
                if (normCode) {
                    const [[dup]] = await conn.execute(
                        'SELECT id FROM institutes WHERE institute_code = ?', [normCode]);
                    if (dup) { results.skipped++; continue; }
                }
                await conn.execute(
                    `INSERT INTO institutes
                     (institute_name, institute_type, institute_code,
                      address_line_1, address_line_2, address_line_3,
                      district, state, pincode, mobile_no, phone_no,
                      email, website, remarks, status, created_by)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Active',?)`,
                    [row.institute_name || null, row.institute_type || null, normCode,
                     row.address_line_1 || null, row.address_line_2 || null, row.address_line_3 || null,
                     row.district || null, row.state || null, row.pincode || null,
                     row.mobile_no || null, row.phone_no || null,
                     row.email || null, row.website || null, row.remarks || null,
                     req.user?.id || null]
                );
                results.inserted++;
            } catch (e) {
                if (e.code === 'ER_DUP_ENTRY') {
                    results.skipped++;
                } else {
                    results.warnings.push({ row: normCode || `row ${row.row_number || '?'}`, note: 'Row could not be saved — skipped' });
                    results.skipped++;
                }
            }
        }

        for (const row of modified_rows) {
            if (row.action === 'ignore') { results.ignored++; continue; }
            if (row.action !== 'update') { results.skipped++; continue; }
            try {
                const [[exist]] = await conn.execute(
                    'SELECT * FROM institutes WHERE id = ?', [row.existing_id]);
                if (!exist) { results.skipped++; continue; }

                await conn.execute(
                    `UPDATE institutes SET
                     institute_name=?, institute_type=?, institute_code=?,
                     address_line_1=?, address_line_2=?, address_line_3=?,
                     district=?, state=?, pincode=?, mobile_no=?, phone_no=?,
                     email=?, website=?, remarks=?, updated_by=?
                     WHERE id=?`,
                    [row.institute_name || null, row.institute_type || null,
                     normalizeCode(row.institute_code) || null,
                     row.address_line_1 || null, row.address_line_2 || null, row.address_line_3 || null,
                     row.district || null, row.state || null, row.pincode || null,
                     row.mobile_no || null, row.phone_no || null,
                     row.email || null, row.website || null, row.remarks || null,
                     req.user?.id || null, row.existing_id]
                );
                await audit(conn, 'IMPORT_UPDATE', row.existing_id, req.user?.id, req.ip,
                    exist, row, { filename });
                results.updated++;
            } catch (e) {
                results.warnings.push({ row: row.institute_code || '?', note: 'Update could not be applied — skipped' });
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
        res.status(500).json({ success: false, message: safeError(e) });
    } finally {
        conn.release();
    }
});

module.exports = router;
