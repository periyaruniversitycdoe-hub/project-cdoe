const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { postUploadCheck } = require('../../../shared/security/fileValidator');
const multer = require('multer');
const credSvc = require('../../../shared/credential/credentialNotificationService');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../../admin/backend/uploads/centres');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    },
});

const fileFilter = (_req, file, cb) => {
    const allowed = /pdf/i;
    if (allowed.test(path.extname(file.originalname))) return cb(null, true);
    cb(new Error('Only PDF files are allowed.'));
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const centerUpload = upload.fields([
    { name: 'recognition_certificate', maxCount: 1 }
]);

// GET /api/portal/me
router.get('/me', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT cu.id, cu.name, cu.email, cu.mobile, cu.status, cu.center_id, cu.role, cu.created_at,
                    rc.centre_ref_no, rc.name AS centre_name,
                    rc.institute_id,
                    rc.centre_type_id,
                    rc.district_id,
                    rc.address_1, rc.address_2, rc.address_3, rc.pincode,
                    rc.contact_number, rc.email AS centre_email, rc.hod_email,
                    rc.recognition_date, rc.status AS centre_status, rc.recognition_certificate,
                    -- Institute Details — sourced directly from the registration form
                    rc.college_code,   rc.college_name,
                    rc.principal_name, rc.principal_mobile, rc.college_phone,
                    ct.name  AS centre_type_name,
                    d.name   AS district_name
             FROM center_users cu
             LEFT JOIN research_centres rc ON cu.center_id = rc.id
             LEFT JOIN master_centre_types ct ON rc.centre_type_id = ct.id
             LEFT JOIN master_districts d    ON rc.district_id    = d.id
             WHERE cu.id = ?`,
            [req.user.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/portal/dashboard
router.get('/dashboard', verifyToken, async (req, res) => {
    try {
        const [userRows] = await pool.query('SELECT center_id FROM center_users WHERE id = ?', [req.user.id]);
        const centerId = userRows[0]?.center_id;

        let stats = { totalSupervisors: 0, activeSupervisors: 0, isLinked: false };
        let recentSupervisors = [];

        if (centerId) {
            // Get centre's institute_id
            const [centreRows] = await pool.query('SELECT institute_id FROM research_centres WHERE id = ?', [centerId]);
            const instituteId = centreRows[0]?.institute_id;

            if (instituteId) {
                const [svCount] = await pool.query(
                    'SELECT COUNT(*) AS total FROM supervisors WHERE serving_institute_id = ?',
                    [instituteId]
                );
                const [svActive] = await pool.query(
                    'SELECT COUNT(*) AS total FROM supervisors WHERE serving_institute_id = ? AND status = "Active"',
                    [instituteId]
                );
                const [svList] = await pool.query(
                    `SELECT s.id, s.name, s.supervisor_no, s.status, s.max_candidates, s.current_vacancy,
                            d.name AS designation_name, dept.name AS department_name
                     FROM supervisors s
                     LEFT JOIN master_designations d ON s.designation_id = d.id
                     LEFT JOIN master_departments dept ON s.department_id = dept.id
                     WHERE s.serving_institute_id = ?
                     ORDER BY s.name LIMIT 10`,
                    [instituteId]
                );
                stats = {
                    totalSupervisors: svCount[0].total,
                    activeSupervisors: svActive[0].total,
                    isLinked: true
                };
                recentSupervisors = svList;
            } else {
                stats.isLinked = true;
            }
        }

        res.json({ stats, recentSupervisors });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/portal/supervisors — all supervisors under this center's institute
router.get('/supervisors', verifyToken, async (req, res) => {
    try {
        const [userRows] = await pool.query('SELECT center_id FROM center_users WHERE id = ?', [req.user.id]);
        const centerId = userRows[0]?.center_id;
        if (!centerId) return res.json([]);

        const [centreRows] = await pool.query('SELECT institute_id FROM research_centres WHERE id = ?', [centerId]);
        const instituteId = centreRows[0]?.institute_id;
        if (!instituteId) return res.json([]);

        const [rows] = await pool.query(
            `SELECT s.id, s.name, s.supervisor_no, s.email, s.mobile, s.status,
                    s.max_candidates, s.current_vacancy, s.max_full_time, s.max_part_time,
                    d.name AS designation_name, dept.name AS department_name
             FROM supervisors s
             LEFT JOIN master_designations d ON s.designation_id = d.id
             LEFT JOIN master_departments dept ON s.department_id = dept.id
             WHERE s.serving_institute_id = ?
             ORDER BY s.name`,
            [instituteId]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/portal/profile
router.put('/profile', verifyToken, async (req, res) => {
    const { name, mobile } = req.body;
    try {
        await pool.query('UPDATE center_users SET name = ?, mobile = ? WHERE id = ?', [name, mobile, req.user.id]);
        res.json({ message: 'Profile updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/portal/change-password
router.put('/change-password', verifyToken, async (req, res) => {
    const { validatePasswordComplexity } = require('../../../shared/security/passwordValidator');
    const { verifyAndMigrate, hashPassword } = require('../../../shared/security/passwordHash');
    const { currentPassword, newPassword } = req.body;
    const pwCheck = validatePasswordComplexity(newPassword);
    if (!pwCheck.valid) return res.status(400).json({ message: pwCheck.message });
    try {
        const [rows] = await pool.query('SELECT password FROM center_users WHERE id = ?', [req.user.id]);
        const valid = await verifyAndMigrate(pool, currentPassword, rows[0].password, req.user.id, 'center_users');
        if (!valid) return res.status(400).json({ message: 'Current password is incorrect' });
        const hashed = await hashPassword(newPassword);
        await pool.query('UPDATE center_users SET password = ? WHERE id = ?', [hashed, req.user.id]);
        res.json({ message: 'Password changed successfully' });
        credSvc.notifyPasswordChange({ db: pool, email: req.user.email, newPassword, portalType: 'Center', ipAddress: req.ip }).catch(() => {});
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/portal/application — save or update center application
router.post('/application', verifyToken, centerUpload, postUploadCheck(), async (req, res) => {
    const data = req.body;

    try {
        const [userRows] = await pool.query('SELECT center_id FROM center_users WHERE id = ?', [req.user.id]);
        let centerId = userRows[0]?.center_id;

        const parseId = (val) => {
            if (val === undefined || val === null) return null;
            const cleaned = String(val).trim();
            if (cleaned === '' || cleaned.toLowerCase() === 'null') return null;
            const parsed = parseInt(cleaned, 10);
            return isNaN(parsed) ? null : parsed;
        };

        // ── Institute resolution ──────────────────────────────────────────────
        // The form now sends college_code + college_name (no DB id exposed to UI).
        // Resolve the master_institutes FK here so the DB FK stays intact.
        // Backward-compat: if no college_code is sent but institute_id is, use it.
        const submittedCode = (data.college_code || '').toString().trim();
        let resolvedInstituteId = parseId(data.institute_id); // legacy / fallback

        if (submittedCode) {
            const [instRows] = await pool.query(
                'SELECT id FROM master_institutes WHERE college_code = ? AND is_active = 1 LIMIT 1',
                [submittedCode]
            );
            if (instRows.length > 0) resolvedInstituteId = instRows[0].id;
        }

        const str = v => (v != null ? String(v).trim() : null) || null;

        const centerData = {
            name:             str(data.name),
            // Step 1 — Institute Details: stored directly so Institute Master can
            // be auto-synced on approval without any separate data entry.
            college_code:     str(data.college_code)     || submittedCode || null,
            college_name:     str(data.college_name)     || null,
            principal_name:   str(data.principal_name)   || null,
            principal_mobile: str(data.principal_mobile) || null,
            hod_email:        str(data.hod_email)        || null,
            college_phone:    str(data.college_phone)    || null,
            // abbreviation kept for backward-compat display
            abbreviation:     str(data.college_code) || submittedCode || str(data.abbreviation) || null,
            institute_id:     resolvedInstituteId,
            centre_type_id:   parseId(data.centre_type_id),
            // Step 2 — Address & Contact
            address_1:        str(data.address_1),
            address_2:        str(data.address_2),
            address_3:        str(data.address_3),
            district_id:      parseId(data.district_id),
            pincode:          str(data.pincode),
            contact_number:   str(data.contact_number),
            email:            str(data.email),
            // Step 0
            recognition_date: data.recognition_date || null,
            centre_ref_no:    str(data.centre_ref_no),
            status:           data.status || 'Pending',
        };

        if (req.files && req.files['recognition_certificate']) {
            centerData.recognition_certificate = '/uploads/centres/' + req.files['recognition_certificate'][0].filename;
        }

        if (centerId) {
            await pool.query('UPDATE research_centres SET ? WHERE id = ?', [centerData, centerId]);
        } else {
            const [result] = await pool.query('INSERT INTO research_centres SET ?', [centerData]);
            centerId = result.insertId;
            await pool.query('UPDATE center_users SET center_id = ? WHERE id = ?', [centerId, req.user.id]);
        }

        res.json({ message: 'Application saved successfully', center_id: centerId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
