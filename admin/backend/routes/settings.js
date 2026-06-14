const { safeError } = require('../../../shared/security/safeError');
const { auditWrite } = require('../../../shared/security/writeAudit');
const cache = require('../../../shared/security/appCache');

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { postUploadCheck } = require('../../../shared/security/fileValidator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ─── Real-time settings broadcast ─────────────────────────────────────────────
// SSE clients connected to the admin /api/settings/events endpoint
const sseClients = new Set();

function broadcastSettingsUpdate() {
    const msg = `event: settings-updated\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`;
    for (const client of sseClients) {
        try { client.write(msg); } catch (_) { sseClients.delete(client); }
    }
}

// Fire-and-forget: POST /internal/settings-invalidate on each portal backend
function notifyPortal(port) {
    try {
        const req = http.request({
            hostname: '127.0.0.1', port,
            path: '/internal/settings-invalidate',
            method: 'POST',
            headers: { 'Content-Length': '0', 'Content-Type': 'application/json' }
        });
        req.on('error', () => {});
        req.end();
    } catch (_) {}
}

// Call after every settings write: invalidates cache + pushes SSE to all portals
function broadcastAll() {
    broadcastSettingsUpdate();
    [5000, 5002, 5003].forEach(notifyPortal);
}

// Strip path separators and dangerous characters from uploaded filenames
const sanitizeFilename = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');

// Multer for images
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(__dirname, '../../../uploads/settings');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${sanitizeFilename(file.originalname)}`)
});

// Multer for PDFs + images
const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(__dirname, '../../../uploads/settings');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${sanitizeFilename(file.originalname)}`)
});

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_FILE_MIMES  = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];

const uploadImage = multer({
    storage: imageStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_IMAGE_MIMES.includes(file.mimetype)) return cb(null, true);
        cb(new Error('Only JPEG, PNG, or WebP images are allowed'));
    }
});

const uploadFile = multer({
    storage: fileStorage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_FILE_MIMES.includes(file.mimetype)) return cb(null, true);
        cb(new Error('Only JPEG, PNG, WebP images or PDF documents are allowed'));
    }
});

// â”€â”€â”€ SSE: real-time settings change notifications (admin frontend) ─────────
router.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(':keepalive\n\n');
    sseClients.add(res);
    const hb = setInterval(() => {
        try { res.write(':keepalive\n\n'); }
        catch (_) { clearInterval(hb); sseClients.delete(res); }
    }, 25000);
    req.on('close', () => { clearInterval(hb); sseClients.delete(res); });
});

// â”€â”€â”€ GET SETTINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/', async (req, res) => {
    try {
        const data = await cache.getOrFetch('university_settings', 300, async () => {
            const [rows] = await pool.execute('SELECT * FROM university_settings LIMIT 1');
            if (!rows[0]) return {};
            return {
                ...rows[0],
                university_name_english: rows[0].university_name_english || rows[0].university_name_en || rows[0].header_line1,
                university_name_tamil: rows[0].university_name_ta || '',
                logo: rows[0].logo_url,
                logo2: rows[0].logo2,
            };
        });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// â”€â”€â”€ ENTRANCE SETTINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/entrance-settings', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM entrance_settings LIMIT 1');
        res.json({ success: true, data: rows[0] || { passing_mark: 50, total_mark: 100 } });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});



router.put('/entrance-settings', verifyToken, isAdmin, async (req, res) => {
    try {
        const { passing_mark, total_mark } = req.body;
        const [rows] = await pool.execute('SELECT id FROM entrance_settings LIMIT 1');
        if (rows.length === 0) {
            await pool.execute('INSERT INTO entrance_settings (passing_mark, total_mark) VALUES (?, ?)', [passing_mark, total_mark]);
        } else {
            await pool.execute('UPDATE entrance_settings SET passing_mark=?, total_mark=?, updated_at=NOW() WHERE id=?', [passing_mark, total_mark, rows[0].id]);
        }
        broadcastAll();
        res.json({ success: true, message: 'Updated entrance settings.' });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// â”€â”€â”€ UPDATE SETTINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.put('/update', verifyToken, isAdmin, async (req, res) => {
    const raw = req.body;
    
    // Always enforce that English & Tamil names are populated
    let uniEn = raw.university_name_english || raw.university_name_en;
    let uniTa = raw.university_name_tamil || raw.university_name_ta;
    if (!uniEn || !uniEn.toString().trim()) uniEn = 'PERIYAR UNIVERSITY';
    if (!uniTa || !uniTa.toString().trim()) uniTa = 'பெரியார் பல்கலைக்கழகம்';

    const SETTINGS_COLUMNS = new Set([
        'university_name_en', 'university_name_ta', 'subtitle', 'naac_details', 
        'address', 'phone', 'email', 'website', 'logo_url', 'founder_image_url', 
        'founder_name', 'payment_button_text', 'payment_gateway_name', 'payment_gateway_key', 
        'smtp_host', 'smtp_port', 'smtp_email', 'smtp_password', 'footer_text',
        'copyright_text', 'interview_result_publish', 'entrance_result_publish',
        'header_line1', 'header_line2', 'header_line3', 'header_title', 
        'info_text1', 'info_text2', 'logo2', 'prospectus', 'instruction_file', 
        'syllabus_file', 'apply_now_enabled', 'apply_now_open', 'apply_now_close', 
        'applicant_login_enabled', 'applicant_login_open', 'applicant_login_close', 
        'hall_ticket_enabled', 'hall_ticket_open', 'hall_ticket_close', 
        'payment_enabled', 'payment_open', 'payment_close',
        'result_publish_enabled', 'result_publish_open', 'result_publish_close',
        'last_payment_date', 'exam_date', 'exam_time', 'interview_date', 
        'interview_time', 'certificate_validity', 'certificate_date', 
        'entrance_max_mark', 'entrance_calculated_to', 'entrance_min_mark', 
        'interview_max_mark', 'interview_calculated_to', 'home_page_pdf', 
        'home_page_content', 'home_page_type',
        'about_us_title', 'about_us_link', 'about_us_open_mode', 'about_us_enabled', 'about_us_order',
        'policies_title', 'policies_link', 'policies_open_mode', 'policies_enabled', 'policies_order',
        'contact_title', 'contact_link', 'contact_open_mode', 'contact_enabled', 'contact_order',
        'application_registration_url', 'supervisor_registration_url', 'research_centre_registration_url'
    ]);

    const DATE_FIELDS = [
        'apply_now_open', 'apply_now_close',
        'applicant_login_open', 'applicant_login_close',
        'hall_ticket_open', 'hall_ticket_close',
        'payment_open', 'payment_close',
        'result_publish_open', 'result_publish_close',
        'last_payment_date', 'exam_date',
        'interview_date', 'certificate_date'
    ];

    const dbData = {};
    for (const [k, v] of Object.entries(raw)) {
        let key = k;
        if (k === 'university_name_english') key = 'university_name_en';
        if (k === 'university_name_tamil') key = 'university_name_ta';
        if (k === 'logo') key = 'logo_url';

        if (SETTINGS_COLUMNS.has(key)) {
            let val = (v === '' || v === 'null' || v === 'undefined') ? null : v;
            if (val === 'true') val = 1;
            if (val === 'false') val = 0;
            if (DATE_FIELDS.includes(key) && val) {
                val = String(val).slice(0, 10);
            }
            dbData[key] = val;
        }
    }

    dbData.university_name_en = uniEn;
    dbData.university_name_ta = uniTa;
    dbData.header_line1 = uniEn;

    try {
        const [oldSettings] = await pool.execute('SELECT * FROM university_settings LIMIT 1');

        if (oldSettings.length === 0) {
            const fields = Object.keys(dbData);
            const placeholders = fields.map(() => '?').join(', ');
            await pool.execute(
                `INSERT INTO university_settings (${fields.map(f => `\`${f}\``).join(', ')}) VALUES (${placeholders})`,
                Object.values(dbData)
            );
            await auditWrite(pool, { req, action: 'CREATE', table: 'university_settings', recordId: 1, after: dbData });
        } else {
            const fields = Object.keys(dbData);
            const setClause = fields.map(f => `\`${f}\` = ?`).join(', ');
            const values = Object.values(dbData);
            await pool.query(
                `UPDATE university_settings SET ${setClause} WHERE id = ?`,
                [...values, oldSettings[0].id]
            );
            await auditWrite(pool, { req, action: 'UPDATE', table: 'university_settings',
                recordId: oldSettings[0].id, before: oldSettings[0], after: dbData });
        }

        // Legacy audit log
        try {
            await pool.execute(
                'INSERT INTO settings_audit_logs (admin_id, action, ip_address, user_agent) VALUES (?, ?, ?, ?)',
                [req.user.id || null, 'Updated University Settings', req.ip || null, req.headers['user-agent'] || null]
            );
        } catch (_) {}

        cache.del('university_settings');
        broadcastAll();
        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (err) {
        console.error('SETTINGS UPDATE ERROR:', err);
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// â”€â”€â”€ UPLOAD LOGO / FOUNDER / FILE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/upload-image', verifyToken, isAdmin, uploadImage.single('image'), postUploadCheck(), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const { field } = req.body;
    const allowedFields = ['logo', 'logo2', 'founder_image'];
    if (!allowedFields.includes(field)) return res.status(400).json({ success: false, message: 'Invalid field' });
    const filePath = `/uploads/settings/${req.file.filename}`;
    try {
        const [rows] = await pool.execute('SELECT id FROM university_settings LIMIT 1');
        
        let dbField = field;
        if (field === 'logo') dbField = 'logo_url';
        if (field === 'founder_image') dbField = 'founder_image_url';

        if (rows.length === 0) {
            await pool.execute(`INSERT INTO university_settings (${dbField}) VALUES (?)`, [filePath]);
        } else {
            await pool.execute(`UPDATE university_settings SET ${dbField} = ? WHERE id = ?`, [filePath, rows[0].id]);
        }
        cache.del('university_settings');
        broadcastAll();
        res.json({ success: true, path: filePath });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

router.post('/upload-file', verifyToken, isAdmin, uploadFile.single('file'), postUploadCheck(), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const { field } = req.body;
    const allowedFields = ['prospectus', 'instruction_file', 'syllabus_file', 'home_page_pdf'];
    if (!allowedFields.includes(field)) return res.status(400).json({ success: false, message: 'Invalid field' });
    const filePath = `/uploads/settings/${req.file.filename}`;
    try {
        const [rows] = await pool.execute('SELECT id FROM university_settings LIMIT 1');
        if (rows.length === 0) {
            await pool.execute(`INSERT INTO university_settings (${field}) VALUES (?)`, [filePath]);
        } else {
            await pool.execute(`UPDATE university_settings SET ${field} = ? WHERE id = ?`, [filePath, rows[0].id]);
        }
        cache.del('university_settings');
        broadcastAll();
        res.json({ success: true, path: filePath });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// â”€â”€â”€ COMMUNITY FEES CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/community-fees', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM community_fees ORDER BY id ASC');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

router.post('/community-fees', verifyToken, isAdmin, async (req, res) => {
    const { community_name, pg_min_mark, general_fee, differently_abled_fee, roster_percentage, status, sort_order } = req.body;
    try {
        const [result] = await pool.execute(
            'INSERT INTO community_fees (community_name, pg_min_mark, general_fee, differently_abled_fee, roster_percentage, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [community_name, pg_min_mark || null, general_fee || null, differently_abled_fee || null, roster_percentage || 0.00, status || 'active', sort_order || 0]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

router.put('/community-fees/:id', verifyToken, isAdmin, async (req, res) => {
    const { community_name, pg_min_mark, general_fee, differently_abled_fee, roster_percentage, status, sort_order } = req.body;
    try {
        await pool.execute(
            'UPDATE community_fees SET community_name=?, pg_min_mark=?, general_fee=?, differently_abled_fee=?, roster_percentage=?, status=?, sort_order=? WHERE id=?',
            [community_name, pg_min_mark || null, general_fee || null, differently_abled_fee || null, roster_percentage || 0.00, status || 'active', sort_order || 0, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

router.delete('/community-fees/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.execute('DELETE FROM community_fees WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// â”€â”€â”€ MASTER DROPDOWN CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const VALID_DROPDOWN_TABLES = ['dropdown_subjects', 'dropdown_exam_centers', 'dropdown_districts', 'dropdown_categories', 'dropdown_genders', 'dropdown_departments'];

router.get('/master-data/:table', async (req, res) => {
    const { table } = req.params;
    if (!VALID_DROPDOWN_TABLES.includes(table)) return res.status(400).json({ success: false, message: 'Invalid table' });
    try {
        const [rows] = await pool.execute(`SELECT * FROM ${table} ORDER BY name ASC`);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

router.post('/master-data/:table', verifyToken, isAdmin, async (req, res) => {
    const { table } = req.params;
    const { name } = req.body;
    if (!VALID_DROPDOWN_TABLES.includes(table)) return res.status(400).json({ success: false, message: 'Invalid table' });
    try {
        const [result] = await pool.execute(`INSERT INTO ${table} (name) VALUES (?)`, [name]);
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

router.put('/master-data/:table/:id', verifyToken, isAdmin, async (req, res) => {
    const { table, id } = req.params;
    const { name } = req.body;
    if (!VALID_DROPDOWN_TABLES.includes(table)) return res.status(400).json({ success: false, message: 'Invalid table' });
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
    try {
        await pool.execute(`UPDATE ${table} SET name = ? WHERE id = ?`, [name.trim(), id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

router.delete('/master-data/:table/:id', verifyToken, isAdmin, async (req, res) => {
    const { table, id } = req.params;
    if (!VALID_DROPDOWN_TABLES.includes(table)) return res.status(400).json({ success: false, message: 'Invalid table' });
    try {
        await pool.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});


// â”€â”€â”€ EXAM CENTRE CONFIGURATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET exam centre config (public â€” read by student portal)
router.get('/exam-centre-config', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT id, max_preferences, status, description, updated_at FROM exam_centre_config LIMIT 1'
        );
        res.json({ success: true, data: rows[0] || { max_preferences: 2, status: 'active', description: '' } });
    } catch (err) {
        // Table may not exist yet â€” return safe default
        res.json({ success: true, data: { max_preferences: 2, status: 'active', description: '' } });
    }
});

// PUT exam centre config (admin only)
router.put('/exam-centre-config', verifyToken, isAdmin, async (req, res) => {
    const { max_preferences, status, description } = req.body;

    const maxPref = parseInt(max_preferences);
    if (isNaN(maxPref) || maxPref < 1 || maxPref > 10) {
        return res.status(400).json({ success: false, message: 'max_preferences must be a number between 1 and 10' });
    }

    const safeStatus = ['active', 'inactive'].includes(status) ? status : 'active';
    const safeDesc   = description ? String(description).substring(0, 500) : null;

    try {
        // Ensure table exists
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS exam_centre_config (
                id INT AUTO_INCREMENT PRIMARY KEY,
                max_preferences INT NOT NULL DEFAULT 2,
                status ENUM('active','inactive') NOT NULL DEFAULT 'active',
                description TEXT DEFAULT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                updated_by INT DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        const [rows] = await pool.execute('SELECT id FROM exam_centre_config LIMIT 1');
        if (rows.length === 0) {
            await pool.execute(
                'INSERT INTO exam_centre_config (max_preferences, status, description, updated_by) VALUES (?, ?, ?, ?)',
                [maxPref, safeStatus, safeDesc, req.user.id || null]
            );
        } else {
            await pool.execute(
                'UPDATE exam_centre_config SET max_preferences=?, status=?, description=?, updated_by=?, updated_at=NOW() WHERE id=?',
                [maxPref, safeStatus, safeDesc, req.user.id || null, rows[0].id]
            );
        }

        // Audit log (non-critical)
        try {
            await pool.execute(
                'INSERT INTO settings_audit_logs (admin_id, action, ip_address, user_agent) VALUES (?, ?, ?, ?)',
                [req.user.id || null, `Updated Exam Centre Config: max_preferences=${maxPref}`, req.ip || null, req.headers['user-agent'] || null]
            );
        } catch (_) {}

        broadcastAll();
        res.json({ success: true, message: 'Exam centre configuration saved successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// â”€â”€â”€ PORTAL HEADER LINK MANAGEMENT APIs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// 1. Get Portal Header Links
router.get('/header-links', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const [rows] = await pool.execute(
            `SELECT 
                about_us_title, about_us_link, about_us_open_mode, about_us_enabled, about_us_order,
                policies_title, policies_link, policies_open_mode, policies_enabled, policies_order,
                contact_title, contact_link, contact_open_mode, contact_enabled, contact_order
             FROM university_settings LIMIT 1`
        );
        res.json({ success: true, data: rows[0] || {} });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// Helper for validating URL format
const isValidUrl = (url) => {
    if (!url) return true; // allowed empty
    // allow internal relative paths like /contact or /pdf/...
    if (url.startsWith('/')) return true;
    try {
        new URL(url);
        return true;
    } catch (_) {
        return false;
    }
};

// Helper for saving a specific link section
async function updateLinkSection(section, req, res) {
    const { title, link, open_mode, enabled, order } = req.body;

    if (link && !isValidUrl(link)) {
        return res.status(400).json({ success: false, message: 'Invalid URL/link format' });
    }

    try {
        const [rows] = await pool.execute('SELECT id FROM university_settings LIMIT 1');
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'University settings not initialized' });
        }

        const isEnabled = enabled ? 1 : 0;
        const openMode = ['_blank', '_self'].includes(open_mode) ? open_mode : '_blank';
        const displayOrder = parseInt(order) || 0;

        await pool.execute(
            `UPDATE university_settings 
             SET ${section}_title = ?, ${section}_link = ?, ${section}_open_mode = ?, ${section}_enabled = ?, ${section}_order = ?
             WHERE id = ?`,
            [title || null, link || null, openMode, isEnabled, displayOrder, rows[0].id]
        );

        // Audit Log
        try {
            await pool.execute(
                'INSERT INTO settings_audit_logs (admin_id, action, ip_address, user_agent) VALUES (?, ?, ?, ?)',
                [req.user.id || null, `Updated ${section} Link`, req.ip || null, req.headers['user-agent'] || null]
            );
        } catch (_) {}

        broadcastAll();
        res.json({ success: true, message: `${section} link settings updated successfully` });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
}

// 2. Update About Us Link
router.put('/header-links/about-us', verifyToken, isAdmin, async (req, res) => {
    await updateLinkSection('about_us', req, res);
});

// 3. Update Policies Link
router.put('/header-links/policies', verifyToken, isAdmin, async (req, res) => {
    await updateLinkSection('policies', req, res);
});

// 4. Update Contact Link
router.put('/header-links/contact', verifyToken, isAdmin, async (req, res) => {
    await updateLinkSection('contact', req, res);
});

// 5. Enable/Disable Header Links
router.patch('/header-links/toggle', verifyToken, isAdmin, async (req, res) => {
    const { field, enabled } = req.body;
    const allowedFields = ['about_us', 'policies', 'contact'];
    
    if (!allowedFields.includes(field)) {
        return res.status(400).json({ success: false, message: 'Invalid settings field' });
    }

    try {
        const [rows] = await pool.execute('SELECT id FROM university_settings LIMIT 1');
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Settings not initialized' });
        }

        const isEnabled = enabled ? 1 : 0;
        await pool.execute(
            `UPDATE university_settings SET ${field}_enabled = ? WHERE id = ?`,
            [isEnabled, rows[0].id]
        );

        // Audit Log
        try {
            await pool.execute(
                'INSERT INTO settings_audit_logs (admin_id, action, ip_address, user_agent) VALUES (?, ?, ?, ?)',
                [req.user.id || null, `Toggled ${field} link visibility`, req.ip || null, req.headers['user-agent'] || null]
            );
        } catch (_) {}

        broadcastAll();
        res.json({ success: true, message: `Toggled ${field} link visibility successfully` });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ─── ACADEMIC TIMELINE ENGINE ─────────────────────────────────────────────────

// Self-initializing: creates tables + seeds defaults if not yet migrated.
async function ensureTimelineTables() {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS academic_timeline_rules (
            id             INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            transition_key VARCHAR(30)  NOT NULL UNIQUE,
            transition_label VARCHAR(60) NOT NULL,
            from_stage     VARCHAR(20)  NOT NULL,
            to_stage       VARCHAR(20)  NOT NULL,
            min_gap_years  INT          NOT NULL DEFAULT 0,
            max_gap_years  INT          NOT NULL DEFAULT 15,
            status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
            updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            updated_by     VARCHAR(100) DEFAULT NULL
        )
    `);
    await pool.execute(`
        INSERT IGNORE INTO academic_timeline_rules
            (transition_key, transition_label, from_stage, to_stage, min_gap_years, max_gap_years)
        VALUES
            ('sslc_hsc',  '10th → +2',     'sslc',  'hsc',   2,  5),
            ('hsc_ug',    '+2 → UG',        'hsc',   'ug',    0, 10),
            ('ug_pg',     'UG → PG',        'ug',    'pg',    0, 10),
            ('pg_mphil',  'PG → M.Phil',    'pg',    'mphil', 0, 15),
            ('mphil_phd', 'M.Phil → Ph.D',  'mphil', 'phd',   0, 15)
    `);
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS course_duration_rules (
            id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            course_key   VARCHAR(20)  NOT NULL UNIQUE,
            course_label VARCHAR(50)  NOT NULL,
            min_duration INT          NOT NULL DEFAULT 1,
            max_duration INT          NOT NULL DEFAULT 5,
            status       ENUM('active','inactive') NOT NULL DEFAULT 'active',
            updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            updated_by   VARCHAR(100) DEFAULT NULL
        )
    `);
    await pool.execute(`
        INSERT IGNORE INTO course_duration_rules
            (course_key, course_label, min_duration, max_duration)
        VALUES
            ('ug',         'UG',         3, 4),
            ('pg',         'PG',         2, 2),
            ('mphil',      'M.Phil',     1, 1),
            ('integrated', 'Integrated', 5, 5)
    `);
}

// GET /api/settings/timeline-rules  — public read, no auth required
router.get('/timeline-rules', async (_req, res) => {
    try {
        await ensureTimelineTables();
        const [transitions] = await pool.execute(
            'SELECT * FROM academic_timeline_rules ORDER BY id ASC'
        );
        const [durations] = await pool.execute(
            'SELECT * FROM course_duration_rules ORDER BY id ASC'
        );
        res.json({ success: true, data: { transitions, durations } });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// PUT /api/settings/timeline-rules  — admin only
router.put('/timeline-rules', verifyToken, isAdmin, async (req, res) => {
    const { transitions = [], durations = [] } = req.body;
    const updatedBy = req.user?.email || req.user?.id || 'admin';
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        for (const t of transitions) {
            const min = parseInt(t.min_gap_years, 10);
            const max = parseInt(t.max_gap_years, 10);
            if (isNaN(min) || isNaN(max) || min < 0 || max < min) {
                await conn.rollback();
                conn.release();
                return res.status(400).json({
                    success: false,
                    message: `Invalid gap values for "${t.transition_label}": min must be ≥ 0 and max ≥ min`
                });
            }
            await conn.execute(
                `UPDATE academic_timeline_rules
                 SET min_gap_years=?, max_gap_years=?, status=?, updated_by=?
                 WHERE id=?`,
                [min, max, t.status || 'active', updatedBy, t.id]
            );
        }

        for (const d of durations) {
            const min = parseInt(d.min_duration, 10);
            const max = parseInt(d.max_duration, 10);
            if (isNaN(min) || isNaN(max) || min < 1 || max < min) {
                await conn.rollback();
                conn.release();
                return res.status(400).json({
                    success: false,
                    message: `Invalid duration values for "${d.course_label}": min must be ≥ 1 and max ≥ min`
                });
            }
            await conn.execute(
                `UPDATE course_duration_rules
                 SET min_duration=?, max_duration=?, status=?, updated_by=?
                 WHERE id=?`,
                [min, max, d.status || 'active', updatedBy, d.id]
            );
        }

        await conn.commit();
        conn.release();

        try {
            await pool.execute(
                'INSERT INTO settings_audit_logs (admin_id, action, ip_address, user_agent) VALUES (?, ?, ?, ?)',
                [req.user?.id || null, 'Updated Academic Timeline Rules', req.ip || null, req.headers['user-agent'] || null]
            );
        } catch (_) {}

        broadcastAll();
        res.json({ success: true, message: 'Academic Timeline Rules saved successfully' });
    } catch (err) {
        try { await conn.rollback(); } catch (_) {}
        conn.release();
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

module.exports = router;

