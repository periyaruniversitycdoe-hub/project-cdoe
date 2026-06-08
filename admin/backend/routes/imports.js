const { safeError } = require('../../../shared/security/safeError');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { postUploadCheckMemory } = require('../../../shared/security/fileValidator');

// Multer in-memory storage for parsing Excel buffers directly
const storage = multer.memoryStorage();
const ALLOWED_IMPORT_MIMES = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel',                                          // .xls
    'text/csv',
    'application/csv',
    'text/plain', // some browsers send .csv as text/plain
]);
const ALLOWED_IMPORT_EXTS = new Set(['.xlsx', '.xls', '.csv']);
const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = require('path').extname(file.originalname).toLowerCase();
        if (ALLOWED_IMPORT_MIMES.has(file.mimetype) || ALLOWED_IMPORT_EXTS.has(ext)) {
            return cb(null, true);
        }
        cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed for import'));
    }
});

// â”€â”€ Canonical Mappings Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DESTINATIONS = {
    supervisors: {
        table: 'supervisors',
        label: 'Supervisor Master',
        uniqueKeys: ['email', 'mobile', 'supervisor_no'],
        fields: [
            { key: 'supervisor_no', label: 'Enrollment No / Guide No', type: 'string', required: false, aliases: ['enrollment_no', 'supervisor_no', 'guide_no', 'supervisor_no_'] },
            { key: 'name', label: 'Supervisor Name *', type: 'string', required: true, aliases: ['name', 'supervisor_name', 'guide_name', 'name_of_the_supervisor'] },
            { key: 'designation_name', label: 'Designation', type: 'master_lookup', lookupTable: 'master_designations', required: false, aliases: ['designation', 'designation_name'] },
            { key: 'recognition_ref_no', label: 'Reference No / Ref No', type: 'string', required: false, aliases: ['reference_no', 'recognition_ref_no', 'ref_no'] },
            { key: 'department_name', label: 'Department', type: 'master_lookup', lookupTable: 'master_departments', required: false, aliases: ['department', 'department_name', 'dept'] },
            { key: 'area_of_specialization', label: 'Area of Specialization', type: 'string', required: false, aliases: ['area_of_specialization', 'specialization', 'specialisation'] },
            { key: 'gender', label: 'Gender', type: 'enum', options: ['Male', 'Female', 'Other'], required: false, aliases: ['gender', 'sex'] },
            { key: 'serving_institute_name', label: 'Serving Institute / College', type: 'master_lookup', lookupTable: 'master_institutes', required: false, aliases: ['college_name', 'institute_name', 'serving_institute', 'serving_institute_name', 'college'] },
            { key: 'address_1', label: 'Address Line 1', type: 'string', required: false, aliases: ['address_1', 'address_line_1', 'college_address', 'address'] },
            { key: 'address_2', label: 'Address Line 2', type: 'string', required: false, aliases: ['address_2', 'address_line_2'] },
            { key: 'address_3', label: 'Address Line 3', type: 'string', required: false, aliases: ['address_3', 'address_line_3'] },
            { key: 'district_name', label: 'District', type: 'master_lookup', lookupTable: 'master_districts', required: false, aliases: ['district', 'district_name'] },
            { key: 'pincode', label: 'Pincode', type: 'string', required: false, aliases: ['pincode', 'pin_code', 'pin'] },
            { key: 'aadhaar_no', label: 'Aadhaar Number', type: 'string', required: false, aliases: ['aadhaar_no', 'aadhaar', 'aadhaar_number'] },
            { key: 'mobile', label: 'Mobile Number', type: 'string', required: false, aliases: ['mobile', 'mobile_no', 'phone', 'contact_no', 'mobile_number'] },
            { key: 'email', label: 'Email ID', type: 'string', required: false, aliases: ['email', 'email_id', 'e_mail', 'mail_id'] },
            { key: 'dob', label: 'Date of Birth', type: 'date', required: false, aliases: ['dob', 'date_of_birth', 'birth_date'] },
            { key: 'date_of_joining', label: 'Joining Date', type: 'date', required: false, aliases: ['joining_date', 'date_of_joining'] },
            { key: 'date_of_superannuation', label: 'Superannuation Date', type: 'date', required: false, aliases: ['superannuation_date', 'date_of_superannuation'] },
            { key: 'remarks', label: 'Remarks', type: 'string', required: false, aliases: ['remarks', 'remark'] },
        ]
    },
    master_institutes: {
        table: 'master_institutes',
        label: 'Supervisor College / Institute Master',
        uniqueKeys: ['college_code', 'name'],
        fields: [
            { key: 'college_code', label: 'College Code *', type: 'string', required: true, aliases: ['college_code', 'code', 'collegecode', 'abbreviation'] },
            { key: 'college_name', label: 'College Name *', type: 'string', required: true, aliases: ['college_name', 'name', 'name_of_the_college', 'college'] },
            { key: 'principal_name', label: 'Principal Name', type: 'string', required: false, aliases: ['principal_name', 'principal', 'name_of_principal'] },
            { key: 'principal_mobile', label: 'Principal Mobile', type: 'string', required: false, aliases: ['principal_mobile', 'principal_phone', 'mobile'] },
            { key: 'college_email', label: 'College Email', type: 'string', required: false, aliases: ['college_email', 'college_mail', 'email'] },
            { key: 'college_phone', label: 'College Phone Number', type: 'string', required: false, aliases: ['college_phone', 'phone_number', 'phone'] },
        ]
    },
    research_centres: {
        table: 'research_centres',
        label: 'Research Centre Master',
        uniqueKeys: ['centre_ref_no', 'name'],
        fields: [
            { key: 'centre_ref_no', label: 'Centre Ref No *', type: 'string', required: true, aliases: ['centre_ref_no', 'ref_no', 'centre_ref', 'reference_no'] },
            { key: 'name', label: 'Centre Name *', type: 'string', required: true, aliases: ['centre_name', 'name', 'centre', 'research_centre_name'] },
            { key: 'abbreviation', label: 'Abbreviation', type: 'string', required: false, aliases: ['abbreviation', 'abbrev', 'code'] },
            { key: 'address_1', label: 'Address Line 1', type: 'string', required: false, aliases: ['address_1', 'address', 'centre_address'] },
            { key: 'address_2', label: 'Address Line 2', type: 'string', required: false, aliases: ['address_2'] },
            { key: 'address_3', label: 'Address Line 3', type: 'string', required: false, aliases: ['address_3'] },
            { key: 'pincode', label: 'Pincode', type: 'string', required: false, aliases: ['pincode', 'pin'] },
            { key: 'contact_number', label: 'Contact Number', type: 'string', required: false, aliases: ['contact_number', 'phone', 'contact'] },
            { key: 'email', label: 'Email ID', type: 'string', required: false, aliases: ['email', 'email_id', 'centre_email'] },
            { key: 'hod_email', label: 'HOD Email ID', type: 'string', required: false, aliases: ['hod_email', 'hod_mail'] },
            { key: 'remark', label: 'Remarks', type: 'string', required: false, aliases: ['remark', 'remarks'] },
        ]
    }
};

// â”€â”€ Text Normalization Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function cellStr(val) {
    if (val === null || val === undefined) return '';
    if (val instanceof Date) {
        // ExcelJS returns date cells as JS Date objects â€” preserve as ISO date string
        return isNaN(val.getTime()) ? '' : val.toISOString().substring(0, 10);
    }
    if (typeof val === 'object') {
        if (val.richText) return val.richText.map(t => t.text).join('');
        if (val.text) return val.text;
        if (val.result !== undefined) return String(val.result);
        return '';
    }
    return String(val).trim();
}

function normalizeCode(str) {
    if (!str) return '';
    return str.toString().replace(/[^a-zA-Z0-9_\-\/]/g, '').trim().toUpperCase();
}

function normalizeEmail(str) {
    if (!str) return null;
    const clean = str.toString().trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) ? clean : null;
}

function normalizeMobile(str) {
    if (!str) return null;
    const clean = str.toString().replace(/[^\d+]/g, '').trim();
    return (clean.length >= 10 && clean.length <= 15) ? clean : null;
}

function normalizeName(str) {
    if (!str) return '';
    return str.toString()
        .replace(/\s+/g, ' ')
        .replace(/[^a-zA-Z0-9\s.,()&'\-\/]/g, '')
        .trim();
}

function normalizeDate(str) {
    if (!str) return null;
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        return d.toISOString().substring(0, 10);
    }
    // Attempt parse DD-MM-YYYY or DD/MM/YYYY
    const parts = str.split(/[-/]/);
    if (parts.length === 3) {
        let day = parseInt(parts[0]);
        let month = parseInt(parts[1]) - 1;
        let year = parseInt(parts[2]);
        if (year < 100) year += 2000; // rough guess
        const customDate = new Date(year, month, day);
        if (!isNaN(customDate.getTime())) {
            return customDate.toISOString().substring(0, 10);
        }
    }
    return null;
}

function cleanHeaderKey(raw) {
    return (raw || '').toString().toLowerCase()
        .replace(/[:\*\.\(\)\[\]#!?]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .trim();
}

// Helper to look up or insert master record dynamically (Zero Validation Mode benefit)
async function getOrInsertMaster(conn, table, nameValue, currentUserId) {
    if (!nameValue || !nameValue.trim()) return null;
    const cleanName = normalizeName(nameValue);
    if (!cleanName) return null;

    // Check if exists
    const [[exist]] = await conn.execute(
        `SELECT id FROM ${table} WHERE LOWER(TRIM(name)) = LOWER(?)`, [cleanName]
    );
    if (exist) return exist.id;

    // Zero Validation: Auto-create missing master record
    let insertSql = `INSERT INTO ${table} (name) VALUES (?)`;
    let params = [cleanName];

    if (table === 'master_institutes') {
        const generatedCode = 'AUTO_' + Math.random().toString(36).substring(2, 7).toUpperCase();
        insertSql = `INSERT INTO ${table} (name, college_code, abbreviation, is_active) VALUES (?, ?, ?, 1)`;
        params = [cleanName, generatedCode, generatedCode];
    } else if (table === 'master_designations' || table === 'master_departments' || table === 'master_districts' || table === 'master_centre_types') {
        insertSql = `INSERT INTO ${table} (name, is_active) VALUES (?, 1)`;
    }

    try {
        const [res] = await conn.execute(insertSql, params);
        return res.insertId;
    } catch (e) {
        console.error(`Auto-create master entry in ${table} failed:`, e.message);
        return null;
    }
}

// â”€â”€ Endpoint: GET /api/imports/fields/:destination â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/fields/:destination', verifyToken, isAdmin, (req, res) => {
    const config = DESTINATIONS[req.params.destination];
    if (!config) return res.status(404).json({ success: false, message: 'Invalid destination' });
    res.json({ success: true, fields: config.fields, label: config.label });
});

// â”€â”€ Endpoint: GET /api/imports/history â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/history', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM excel_import_history ORDER BY upload_date DESC LIMIT 50');
        res.json({ success: true, history: rows });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// â”€â”€ Endpoint: GET /api/imports/template/:destination â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/template/:destination', verifyToken, isAdmin, async (req, res) => {
    const config = DESTINATIONS[req.params.destination];
    if (!config) return res.status(404).json({ success: false, message: 'Invalid destination' });

    try {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Periyar University ERP';
        const ws = wb.addWorksheet(`${config.label} Import Template`);

        // Build Excel columns based on fields config
        ws.columns = config.fields.map(f => ({
            header: f.label,
            key: f.key,
            width: f.key.includes('name') ? 35 : f.key.includes('email') ? 30 : 20
        }));

        // Sample Row Data based on destination
        const sampleData = {};
        config.fields.forEach(f => {
            if (f.key.includes('email')) sampleData[f.key] = 'sample@domain.com';
            else if (f.key.includes('mobile') || f.key.includes('phone')) sampleData[f.key] = '9487058000';
            else if (f.type === 'date') sampleData[f.key] = '1985-05-15';
            else if (f.key.includes('code')) sampleData[f.key] = 'CO_101';
            else if (f.key.includes('ref_no')) sampleData[f.key] = 'PU/REF/2026/04';
            else if (f.key.includes('gender')) sampleData[f.key] = 'Male';
            else sampleData[f.key] = `Sample ${f.label.replace('*', '').trim()}`;
        });
        ws.addRow(sampleData);

        if (req.query.format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${req.params.destination}_template.csv"`);
            await wb.csv.write(res);
            res.end();
            return;
        }

        // Header Styling (Only for Excel)
        ws.getRow(1).eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a5f' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        ws.getRow(1).height = 28;

        ws.getRow(2).eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFe8f4fd' } };
        });

        // Instructions note (Only for Excel)
        ws.addRow([]);
        ws.addRow(['Note: Columns marked with * are key fields. Zero Validation Mode allows blank fields and invalid formats.']);
        ws.mergeCells(`A4:${String.fromCharCode(65 + config.fields.length - 1)}4`);
        ws.getCell('A4').font = { italic: true, color: { argb: 'FFCC5500' }, size: 10 };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${req.params.destination}_template.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (e) {
        console.error('Template generator error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// â”€â”€ Endpoint: POST /api/imports/preview/:destination â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/preview/:destination', verifyToken, isAdmin, upload.single('file'), postUploadCheckMemory(['.csv']), async (req, res) => {
    const config = DESTINATIONS[req.params.destination];
    if (!config) return res.status(404).json({ success: false, message: 'Invalid destination' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    try {
        const wb = new ExcelJS.Workbook();
        let ws;
        if (req.file.originalname?.toLowerCase().endsWith('.csv') || req.file.mimetype === 'text/csv') {
            const { Readable } = require('stream');
            const stream = Readable.from(req.file.buffer);
            await wb.csv.read(stream);
            ws = wb.worksheets[0] || wb.getWorksheet(1);
        } else {
            await wb.xlsx.load(req.file.buffer);
            ws = wb.worksheets[0];
        }
        if (!ws) return res.status(400).json({ success: false, message: 'Uploaded file has no worksheets or data' });

        // Parse optional custom overrides from dynamic mapping wizard
        let customMap = {};
        try { customMap = JSON.parse(req.body.column_map || '{}'); } catch { customMap = {}; }

        // Dynamic Header Detection: Scan top 30 rows
        let headerRowIdx = 1;
        let matchedFieldsCols = {}; // dbField -> Excel column index
        let allHeadersFound = []; // [{ col, raw, key }]
        const scanLimit = Math.min(ws.rowCount, 30);

        for (let r = 1; r <= scanLimit; r++) {
            const row = ws.getRow(r);
            const foundCols = {};
            let matchCount = 0;
            const headersList = [];

            row.eachCell((cell, colIdx) => {
                const raw = cellStr(cell.value);
                if (!raw) return;
                const cleanKey = cleanHeaderKey(raw);
                headersList.push({ col: colIdx, raw, key: cleanKey });

                // Scan aliases to find dynamic match
                config.fields.forEach(field => {
                    const matchedAlias = field.aliases.some(alias => cleanHeaderKey(alias) === cleanKey || cleanHeaderKey(field.label) === cleanKey);
                    if (matchedAlias && foundCols[field.key] === undefined) {
                        foundCols[field.key] = colIdx;
                        matchCount++;
                    }
                });
            });

            if (matchCount >= 1) { // Matched at least 1 column reliably
                headerRowIdx = r;
                matchedFieldsCols = foundCols;
                allHeadersFound = headersList;
                break;
            }
        }

        // Apply custom mappings overrides
        for (const [excelColKey, targetDbField] of Object.entries(customMap)) {
            const matchedHeader = allHeadersFound.find(h => h.key === excelColKey || h.raw === excelColKey);
            if (matchedHeader) {
                matchedFieldsCols[targetDbField] = matchedHeader.col;
            }
        }

        if (allHeadersFound.length === 0) {
            return res.json({
                success: true,
                needs_mapping: true,
                preview: null,
                detected_info: { header_row: null, auto_mapped: {}, excel_headers: [], missing_required: config.fields.filter(f => f.required).map(f => f.key) },
                message: 'No headers found in the uploaded file. Please map the fields manually.'
            });
        }

        // Retrieve only columns needed for duplicate matching (avoids full-table SELECT * on large datasets)
        const selectCols = config.table === 'supervisors'
            ? 'id, name, email, mobile, supervisor_no'
            : config.table === 'master_institutes'
                ? 'id, name, college_code, abbreviation, college_email'
                : 'id, name, centre_ref_no, email'; // research_centres
        const [existingRows] = await pool.execute(`SELECT ${selectCols} FROM ${config.table}`);
        const codeMap = new Map();
        const nameMap = new Map();
        const emailMap = new Map();

        existingRows.forEach(row => {
            if (row.college_code) codeMap.set(normalizeCode(row.college_code), row);
            else if (row.abbreviation) codeMap.set(normalizeCode(row.abbreviation), row);
            if (row.name) nameMap.set(normalizeName(row.name).toLowerCase(), row);
            if (row.email) emailMap.set(row.email.trim().toLowerCase(), row);
        });

        const previewData = { new: [], duplicate: [], modified: [] };
        const seenInFileCodes = new Set();
        const seenInFileEmails = new Set();
        let ignoredCount = 0;

        // Iterate data rows (skip up to headerRowIdx)
        ws.eachRow((row, rowIdx) => {
            if (rowIdx <= headerRowIdx) return;

            const val = dbFieldKey => {
                const colIdx = matchedFieldsCols[dbFieldKey];
                return colIdx ? cellStr(row.getCell(colIdx).value) : '';
            };

            // Read raw row details
            const rowExtract = {};
            config.fields.forEach(f => {
                rowExtract[f.key] = val(f.key);
            });

            // Zero Validation: Clean up and accept whatever exists
            const codeField = rowExtract.college_code || rowExtract.supervisor_no || rowExtract.centre_ref_no || '';
            const nameField = rowExtract.college_name || rowExtract.name || '';
            const emailField = rowExtract.college_email || rowExtract.email || '';

            const cleanCode = normalizeCode(codeField);
            const cleanName = normalizeName(nameField);
            const cleanEmail = normalizeEmail(emailField);

            if (!codeField && !nameField && !emailField) {
                ignoredCount++; // empty or footer row
                return;
            }

            const cleanRow = {
                row_number: rowIdx,
                ...rowExtract
            };

            // Track seen codes/emails but do NOT skip â€” insert all including file-level duplicates
            if (cleanCode) seenInFileCodes.add(cleanCode);
            if (cleanEmail) seenInFileEmails.add(cleanEmail);

            // Cross reference with DB to classify
            let matchedDbRow = null;
            if (cleanCode && codeMap.has(cleanCode)) matchedDbRow = codeMap.get(cleanCode);
            else if (cleanName && nameMap.has(cleanName.toLowerCase())) matchedDbRow = nameMap.get(cleanName.toLowerCase());
            else if (cleanEmail && emailMap.has(cleanEmail)) matchedDbRow = emailMap.get(cleanEmail);

            if (matchedDbRow) {
                // Modified / Diff checks
                const changes = [];
                config.fields.forEach(f => {
                    const dbCol = f.key === 'college_name' ? 'name' : f.key;
                    // Mapped or skipped lookups
                    if (['designation_name', 'department_name', 'serving_institute_name', 'district_name'].includes(f.key)) {
                        // Skip lookups in simple preview diff comparison
                        return;
                    }
                    const rawVal = rowExtract[f.key];
                    const existingVal = matchedDbRow[dbCol] || '';

                    let normRaw = rawVal;
                    let normExist = existingVal;

                    if (f.type === 'date') {
                        normRaw = normalizeDate(rawVal) || '';
                        normExist = normalizeDate(existingVal) || '';
                    } else if (f.key.includes('email')) {
                        normRaw = normalizeEmail(rawVal) || '';
                        normExist = normalizeEmail(existingVal) || '';
                    }

                    if (normRaw && String(normRaw).trim() !== String(normExist).trim()) {
                        changes.push({ field: f.key, label: f.label, old_value: existingVal, new_value: rawVal });
                    }
                });

                if (changes.length > 0) {
                    previewData.modified.push({ ...cleanRow, existing_id: matchedDbRow.id, changes, action: 'update' });
                } else {
                    // Identical DB record â€” still insert (user wants all rows inserted)
                    previewData.new.push(cleanRow);
                }
            } else {
                previewData.new.push(cleanRow);
            }
        });

        res.json({
            success: true,
            preview: previewData,
            summary: {
                filename: req.file.originalname,
                total: previewData.new.length + previewData.modified.length + previewData.duplicate.length + ignoredCount,
                new: previewData.new.length,
                modified: previewData.modified.length,
                duplicate: previewData.duplicate.length,
                ignored: ignoredCount
            },
            detected_info: {
                header_row: headerRowIdx,
                auto_mapped: matchedFieldsCols,
                excel_headers: allHeadersFound,
                missing_required: config.fields.filter(f => f.required && !matchedFieldsCols[f.key]).map(f => f.key)
            }
        });
    } catch (e) {
        console.error('Import preview error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// â”€â”€ Endpoint: POST /api/imports/confirm/:destination â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/confirm/:destination', verifyToken, isAdmin, async (req, res) => {
    const config = DESTINATIONS[req.params.destination];
    if (!config) return res.status(404).json({ success: false, message: 'Invalid destination' });

    const { new_rows = [], modified_rows = [], import_mode = 'insert_all', filename = '' } = req.body;
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    const results = { inserted: 0, updated: 0, skipped: 0, ignored: 0, warnings: [] };

    try {
        const executeInsert = async (row) => {
            const dataToInsert = {};

            // Look up or insert missing master fields (Zero Validation auto-resolvers)
            for (const f of config.fields) {
                let value = row[f.key];
                if (f.type === 'master_lookup' && value && value.trim()) {
                    const resolvedId = await getOrInsertMaster(conn, f.lookupTable, value, req.user.id);
                    // Map to corresponding foreign key column in table
                    const fkCol = f.key === 'designation_name' ? 'designation_id' :
                            f.key === 'department_name' ? 'department_id' :
                                f.key === 'serving_institute_name' ? 'serving_institute_id' :
                                    f.key === 'district_name' ? 'district_id' : f.key;
                    dataToInsert[fkCol] = resolvedId;
                } else if (f.type === 'date') {
                    dataToInsert[f.key] = normalizeDate(value);
                } else if (f.key === 'college_name') {
                    dataToInsert['name'] = normalizeName(value);
                } else if (f.key === 'college_code') {
                    dataToInsert['college_code'] = normalizeCode(value);
                    dataToInsert['abbreviation'] = normalizeCode(value);
                } else {
                    if (['designation_name', 'department_name', 'serving_institute_name', 'district_name'].includes(f.key)) {
                        continue;
                    }
                    dataToInsert[f.key] = value !== undefined && value !== '' ? value : null;
                }
            }

            // Database insertion execution
            const doInsert = async (data) => {
                const c = Object.keys(data);
                const ph = c.map(() => '?').join(', ');
                const v = c.map(k => data[k]);
                const [r] = await conn.execute(
                    `INSERT IGNORE INTO ${config.table} (${c.join(', ')}) VALUES (${ph})`, v
                );
                return r.affectedRows;
            };

            let affected = await doInsert(dataToInsert);

            if (affected === 0 && dataToInsert.supervisor_no != null) {
                // supervisor_no unique conflict â€” retry with supervisor_no = null
                // MySQL allows multiple NULLs in a UNIQUE column
                dataToInsert.supervisor_no = null;
                affected = await doInsert(dataToInsert);
            }

            if (affected > 0) results.inserted++;
            else results.skipped++;
        };

        const executeUpdate = async (row) => {
            const dataToUpdate = {};

            for (const f of config.fields) {
                let value = row[f.key];
                if (f.type === 'master_lookup' && value && value.trim()) {
                    const resolvedId = await getOrInsertMaster(conn, f.lookupTable, value, req.user.id);
                    const fkCol = f.key === 'designation_name' ? 'designation_id' :
                            f.key === 'department_name' ? 'department_id' :
                                f.key === 'serving_institute_name' ? 'serving_institute_id' :
                                    f.key === 'district_name' ? 'district_id' : f.key;
                    dataToUpdate[fkCol] = resolvedId;
                } else if (f.type === 'date') {
                    dataToUpdate[f.key] = normalizeDate(value);
                } else if (f.key === 'college_name') {
                    dataToUpdate['name'] = normalizeName(value);
                } else if (f.key === 'college_code') {
                    dataToUpdate['college_code'] = normalizeCode(value);
                    dataToUpdate['abbreviation'] = normalizeCode(value);
                } else {
                    if (['designation_name', 'department_name', 'serving_institute_name', 'district_name'].includes(f.key)) {
                        continue;
                    }
                    dataToUpdate[f.key] = value !== undefined && value !== '' ? value : null;
                }
            }

            const sets = Object.keys(dataToUpdate).map(c => `${c} = ?`).join(', ');
            const vals = [...Object.values(dataToUpdate), row.existing_id];

            await conn.execute(
                `UPDATE ${config.table} SET ${sets} WHERE id = ?`,
                vals
            );
            results.updated++;
        };

        // â”€â”€ 1. Process New Rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        for (const row of new_rows) {
            try {
                if (import_mode === 'skip_existing' || import_mode === 'insert_new') {
                    // Mapped duplication check
                    const codeVal = normalizeCode(row.college_code || row.supervisor_no || row.centre_ref_no || '');
                    const emailVal = normalizeEmail(row.college_email || row.email || '');

                    let exists = false;
                    if (codeVal) {
                        const colKey = config.table === 'master_institutes' ? 'college_code' : (config.table === 'supervisors' ? 'supervisor_no' : 'centre_ref_no');
                        const [[dup]] = await conn.execute(`SELECT id FROM ${config.table} WHERE ${colKey} = ?`, [codeVal]);
                        if (dup) exists = true;
                    }
                    if (!exists && emailVal && config.table === 'supervisors') {
                        const [[dup]] = await conn.execute(`SELECT id FROM supervisors WHERE email = ?`, [emailVal]);
                        if (dup) exists = true;
                    }

                    if (exists) {
                        results.skipped++;
                        continue;
                    }
                }

                await executeInsert(row);
            } catch (e) {
                results.warnings.push({ row: row.row_number || '?', note: `Insert failed: ${e.message}` });
                results.skipped++;
            }
        }

        // â”€â”€ 2. Process Modified Rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        for (const row of modified_rows) {
            const action = row.action || 'update'; // default from mapping preview
            if (action === 'ignore') {
                results.ignored++;
                continue;
            }

            if (import_mode === 'insert_new' || import_mode === 'skip_existing') {
                results.skipped++;
                continue;
            }

            try {
                if (action === 'update' && (import_mode === 'update_existing' || import_mode === 'insert_all')) {
                    await executeUpdate(row);
                } else {
                    results.skipped++;
                }
            } catch (e) {
                results.warnings.push({ row: row.row_number || '?', note: `Update failed: ${e.message}` });
                results.skipped++;
            }
        }

        await conn.commit();

        // â”€â”€ 3. Write Detailed Excel Import Log (Auditing) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        await conn.execute(
            `INSERT INTO excel_import_history 
             (uploaded_by, file_name, record_count, success_count, failed_count, import_destination, import_mode, details)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user?.email || 'admin',
                filename || 'excel_upload.xlsx',
                new_rows.length + modified_rows.length,
                results.inserted + results.updated,
                results.skipped,
                config.label,
                import_mode.toUpperCase(),
                JSON.stringify({ results, summary: req.body.summary || {} })
            ]
        );

        res.json({ success: true, results });
    } catch (e) {
        await conn.rollback();
        console.error('Import confirmation error:', e);
        res.status(500).json({ success: false, message: e.message });
    } finally {
        conn.release();
    }
});

// â”€â”€ Endpoint: POST /api/imports/export/:destination â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/export/:destination', verifyToken, isAdmin, async (req, res) => {
    const config = DESTINATIONS[req.params.destination];
    if (!config) return res.status(404).json({ success: false, message: 'Invalid destination' });

    const { ids = [], search = '', status = '' } = req.body;

    try {
        let rows = [];
        let querySql = '';
        let params = [];

        // Build dynamically depending on selected destination and filters
        if (config.table === 'supervisors') {
            const conds = [];
            if (ids.length > 0) {
                conds.push(`s.id IN (${ids.map(() => '?').join(',')})`);
                params.push(...ids);
            } else {
                if (status) { conds.push('s.status = ?'); params.push(status); }
                if (search) {
                    conds.push('(s.name LIKE ? OR s.email LIKE ? OR s.mobile LIKE ? OR s.supervisor_no LIKE ?)');
                    const like = `%${search}%`;
                    params.push(like, like, like, like);
                }
            }
            const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
            querySql = `
                SELECT s.*, 
                       d.name AS designation_name, 
                       dept.name AS department_name, 
                       inst.name AS serving_institute_name,
                       dist.name AS district_name
                FROM supervisors s
                LEFT JOIN master_designations d ON s.designation_id = d.id
                LEFT JOIN master_departments dept ON s.department_id = dept.id
                LEFT JOIN master_institutes inst ON s.serving_institute_id = inst.id
                LEFT JOIN master_districts dist ON s.district_id = dist.id
                ${where} ORDER BY s.name ASC`;
        } else {
            const conds = [];
            if (ids.length > 0) {
                conds.push(`id IN (${ids.map(() => '?').join(',')})`);
                params.push(...ids);
            } else {
                if (search) {
                    conds.push(config.table === 'master_institutes'
                        ? '(name LIKE ? OR college_code LIKE ?)'
                        : '(name LIKE ? OR centre_ref_no LIKE ?)');
                    const like = `%${search}%`;
                    params.push(like, like);
                }
            }
            const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
            querySql = `SELECT * FROM ${config.table} ${where} ORDER BY id ASC`;
        }

        const [dbRows] = await pool.execute(querySql, params);
        rows = dbRows;

        const wb = new ExcelJS.Workbook();
        wb.creator = 'Periyar University ERP';
        const ws = wb.addWorksheet(config.label);

        // Define columns
        ws.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            ...config.fields.map(f => ({
                header: f.label.replace('*', '').trim(),
                key: f.key,
                width: 25
            }))
        ];

        // Format headers
        ws.getRow(1).eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a5f' } };
            cell.alignment = { horizontal: 'center' };
        });
        ws.getRow(1).height = 26;

        // Add records
        rows.forEach((row, i) => {
            const extract = { sno: i + 1 };
            config.fields.forEach(f => {
                let dbCol = f.key;
                if (f.key === 'college_name') dbCol = 'name';
                else if (f.key === 'college_code') dbCol = 'college_code';

                // Lookups mapping
                if (['designation_name', 'department_name', 'serving_institute_name', 'district_name'].includes(f.key)) {
                    extract[f.key] = row[f.key] || 'â€”';
                } else if (f.type === 'date' && row[dbCol]) {
                    extract[f.key] = normalizeDate(row[dbCol]) || 'â€”';
                } else {
                    extract[f.key] = row[dbCol] !== null && row[dbCol] !== undefined ? row[dbCol] : 'â€”';
                }
            });

            const sheetRow = ws.addRow(extract);
            if (i % 2 === 0) {
                sheetRow.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf0f4f8' } };
                });
            }
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${req.params.destination}_export_${Date.now()}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (e) {
        console.error('Export error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
