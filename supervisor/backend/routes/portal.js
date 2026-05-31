const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const SupervisorCapacityEngine = require('../services/SupervisorCapacityEngine');
const credSvc = require('../../../shared/credential/credentialNotificationService');

// GET /api/portal/capacity/:designationId — public real-time designation capacity lookup
router.get('/capacity/:designationId', async (req, res) => {
    try {
        const details = await SupervisorCapacityEngine.calculateCapacityDetails(req.params.designationId);
        res.json({ success: true, data: details });
    } catch (err) {
        console.error('Capacity lookup error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/me', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT su.id, su.name, su.email, su.mobile, su.status, su.supervisor_id, su.created_at,
                    s.supervisor_no, s.recognition_ref_no, s.gender, s.dob, s.address_1, s.address_2,
                    s.address_3, s.pincode, s.aadhaar_no, s.date_of_joining, s.date_of_superannuation,
                    s.max_candidates, s.current_vacancy, s.max_part_time, s.max_full_time,
                    s.profile_image, s.status AS supervisor_status, s.area_of_specialization,
                    s.home_address_1, s.home_address_2, s.home_address_3, s.home_pincode, s.home_district_id,
                    d.name AS designation_name,
                    dept.name AS department_name,
                    dist.name AS district_name,
                    inst.name AS institute_name
             FROM supervisor_users su
             LEFT JOIN supervisors s ON su.supervisor_id = s.id
             LEFT JOIN master_designations d ON s.designation_id = d.id
             LEFT JOIN master_departments dept ON s.department_id = dept.id
             LEFT JOIN master_districts dist ON s.district_id = dist.id
             LEFT JOIN master_institutes inst ON s.serving_institute_id = inst.id
             WHERE su.id = ?`,
            [req.user.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/portal/dashboard — stats
router.get('/dashboard', verifyToken, async (req, res) => {
    try {
        const [userRows] = await pool.query(
            'SELECT supervisor_id FROM supervisor_users WHERE id = ?',
            [req.user.id]
        );
        const supervisorId = userRows[0]?.supervisor_id;

        let stats = {
            maxCandidates: 0, currentVacancy: 0,
            maxFullTime: 0, maxPartTime: 0,
            totalDisciplines: 0, isLinked: false
        };

        if (supervisorId) {
            const [sv] = await pool.query(
                'SELECT max_candidates, current_vacancy, max_full_time, max_part_time FROM supervisors WHERE id = ?',
                [supervisorId]
            );
            if (sv.length > 0) {
                stats = {
                    maxCandidates: sv[0].max_candidates,
                    currentVacancy: sv[0].current_vacancy,
                    maxFullTime: sv[0].max_full_time,
                    maxPartTime: sv[0].max_part_time,
                    isLinked: true
                };
            }

            const [disciplines] = await pool.query(
                'SELECT COUNT(*) AS cnt FROM supervisor_disciplines WHERE supervisor_id = ?',
                [supervisorId]
            );
            stats.totalDisciplines = disciplines[0].cnt;
        }

        // Recent applications count if linked
        let recentApplications = [];
        if (supervisorId) {
            const [apps] = await pool.query(
                `SELECT a.application_id, u.full_name, a.created_at
                 FROM applications a
                 JOIN users u ON a.user_id = u.id
                 WHERE a.supervisor_id = ? AND a.status IN ('Submitted', 'SUBMITTED')
                 ORDER BY a.created_at DESC LIMIT 5`,
                [supervisorId]
            ).catch(() => [[]]);
            recentApplications = apps;
        }

        res.json({ stats, recentApplications });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/portal/disciplines — supervisor's assigned disciplines (all fields for form reload)
router.get('/disciplines', verifyToken, async (req, res) => {
    try {
        const [userRows] = await pool.query(
            'SELECT supervisor_id FROM supervisor_users WHERE id = ?',
            [req.user.id]
        );
        const supervisorId = userRows[0]?.supervisor_id;
        if (!supervisorId) return res.json([]);

        const [rows] = await pool.query(
            `SELECT sd.id,
                    sd.discipline_id,
                    sd.centre_id  AS center_id,
                    sd.type,
                    sd.recognition_date,
                    sd.sort_order,
                    md.name AS discipline_name,
                    rc.name AS centre_name
             FROM supervisor_disciplines sd
             LEFT JOIN master_disciplines md ON sd.discipline_id = md.id
             LEFT JOIN research_centres   rc ON sd.centre_id     = rc.id
             WHERE sd.supervisor_id = ?
             ORDER BY sd.sort_order ASC, sd.id ASC`,
            [supervisorId]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/portal/profile — update own profile (name, mobile)
router.put('/profile', verifyToken, async (req, res) => {
    const { name, mobile } = req.body;
    try {
        await pool.query(
            'UPDATE supervisor_users SET name = ?, mobile = ? WHERE id = ?',
            [name, mobile, req.user.id]
        );
        res.json({ message: 'Profile updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/portal/change-password
router.put('/change-password', verifyToken, async (req, res) => {
    const bcrypt = require('bcryptjs');
    const { currentPassword, newPassword } = req.body;
    try {
        const [rows] = await pool.query('SELECT password FROM supervisor_users WHERE id = ?', [req.user.id]);
        const valid = await bcrypt.compare(currentPassword, rows[0].password);
        if (!valid) return res.status(400).json({ message: 'Current password is incorrect' });
        const hashed = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE supervisor_users SET password = ? WHERE id = ?', [hashed, req.user.id]);
        res.json({ message: 'Password changed successfully' });
        credSvc.notifyPasswordChange({ db: pool, email: req.user.email, newPassword, portalType: 'Supervisor', ipAddress: req.ip }).catch(() => {});
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// Upload to the shared admin uploads directory so admin can serve them at /uploads/supervisors/
const UPLOAD_DIR = path.join(__dirname, '../../../admin/backend/uploads/supervisors');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename:    (_req, file, cb) => {
        const unique = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    },
});
const upload = multer({
    storage,
    fileFilter: (_req, file, cb) => {
        const ok = /jpeg|jpg|png|pdf|doc|docx/i.test(path.extname(file.originalname));
        cb(ok ? null : new Error(`File type not allowed: ${file.originalname}`), ok);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
});

const capacityEngine = require('../services/SupervisorCapacityEngine');

// POST /api/portal/application — save or update supervisor application
router.post('/application', verifyToken, upload.fields([
    { name: 'profile_image',           maxCount: 1 },
    { name: 'dob_evidence',            maxCount: 1 },
    { name: 'recognition_certificate', maxCount: 1 },
]), async (req, res) => {
    const data  = req.body;
    const files = req.files || {};

    try {
        const parseId = (val) => {
            if (val === undefined || val === null) return null;
            const cleaned = String(val).trim();
            if (cleaned === '' || cleaned.toLowerCase() === 'null') return null;
            const parsed = parseInt(cleaned, 10);
            return isNaN(parsed) ? null : parsed;
        };

        const designationIdParsed = parseId(data.designation_id);

        // ENTERPRISE CAPACITY VALIDATION — only enforce on final submit (Pending/Active), not on Draft saves
        const isFinalSubmit = data.status && data.status !== 'Draft';
        if (designationIdParsed && isFinalSubmit) {
            const ft = parseInt(data.max_full_time) || 0;
            const pt = parseInt(data.max_part_time) || 0;
            const validation = await capacityEngine.validateAllocation(designationIdParsed, ft, pt);
            if (!validation.isValid) {
                return res.status(400).json({ success: false, message: validation.message });
            }
        }

        // Get linked supervisor record
        const [userRows] = await pool.query(
            'SELECT supervisor_id FROM supervisor_users WHERE id = ?', [req.user.id]
        );
        let supervisorId = userRows[0]?.supervisor_id;

        // Use max_candidates from form (set by capacity engine in the frontend)
        const maxCandidates = parseInt(data.max_candidates) || 0;

        // Vacancy = max_candidates - current_scholars_count
        // current_scholars_count = 0 until Scholar Allocation Engine is implemented
        const currentScholarsCount     = 0;
        const currentPtScholarsCount   = 0;
        const currentVacancy           = Math.max(0, maxCandidates - currentScholarsCount);
        const maxPartTime              = Math.floor(maxCandidates / 2);
        const maxFullTime              = maxCandidates;

        const svData = {
            name:                    data.name,
            designation_id:          designationIdParsed,
            special_designation_id:  parseId(data.special_designation_id),
            recognition_ref_no:      data.recognition_ref_no || null,
            department_id:           parseId(data.department_id),
            gender:                  data.gender || 'Male',
            serving_institute_id:    parseId(data.serving_institute_id),
            address_1:               data.address_1 || null,
            address_2:               data.address_2 || null,
            address_3:               data.address_3 || null,
            district_id:             parseId(data.district_id),
            pincode:                 data.pincode || null,
            home_address_1:          data.home_address_1 || null,
            home_address_2:          data.home_address_2 || null,
            home_address_3:          data.home_address_3 || null,
            home_district_id:        parseId(data.home_district_id),
            home_pincode:            data.home_pincode || null,
            aadhaar_no:              data.aadhaar_no || null,
            mobile:                  data.mobile || null,
            email:                   data.email || null,
            dob:                     data.dob || null,
            date_of_joining:         data.date_of_joining || null,
            date_of_superannuation:  data.date_of_superannuation || null,
            max_candidates:          maxCandidates,
            current_vacancy:         currentVacancy,
            current_scholars_count:          currentScholarsCount,
            current_part_time_scholars_count: currentPtScholarsCount,
            max_part_time:           parseInt(data.max_part_time) || maxPartTime,
            max_full_time:           parseInt(data.max_full_time) || maxFullTime,
            bank_holder_name: data.bank_holder_name ? String(data.bank_holder_name).toUpperCase() : null,
            bank_name:        data.bank_name ? String(data.bank_name).toUpperCase() : null,
            account_number:   data.account_number || null,
            ifsc_code:        data.ifsc_code ? String(data.ifsc_code).toUpperCase() : null,
            area_of_specialization: data.area_of_specialization || null,
            status:           data.status || 'Draft',
        };

        // File uploads — store as /uploads/supervisors/<filename> (served by admin backend)
        if (files['profile_image'])
            svData.profile_image = `/uploads/supervisors/${files['profile_image'][0].filename}`;
        if (files['dob_evidence'])
            svData.dob_evidence = `/uploads/supervisors/${files['dob_evidence'][0].filename}`;
        if (files['recognition_certificate'])
            svData.recognition_certificate = `/uploads/supervisors/${files['recognition_certificate'][0].filename}`;

        if (supervisorId) {
            await pool.query('UPDATE supervisors SET ? WHERE id = ?', [svData, supervisorId]);
        } else {
            const [result] = await pool.query('INSERT INTO supervisors SET ?', [svData]);
            supervisorId = result.insertId;
            await pool.query(
                'UPDATE supervisor_users SET supervisor_id = ? WHERE id = ?',
                [supervisorId, req.user.id]
            );
        }

        // Disciplines — correct column mapping
        if (data.disciplines !== undefined) {
            const disciplines = JSON.parse(data.disciplines);
            await pool.query('DELETE FROM supervisor_disciplines WHERE supervisor_id = ?', [supervisorId]);
            for (let i = 0; i < disciplines.length; i++) {
                const d = disciplines[i];
                if (!d.discipline_id) continue;
                await pool.query(
                    `INSERT INTO supervisor_disciplines
                        (supervisor_id, type, discipline_id, centre_id, recognition_date, sort_order)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        supervisorId,
                        d.type || 'Primary',
                        d.discipline_id || null,
                        d.center_id || null,
                        d.recognition_date || null,
                        i,
                    ]
                );
            }
        }

        res.json({ success: true, message: 'Application saved successfully', supervisor_id: supervisorId });
    } catch (err) {
        console.error('Portal application save error:', err);
        res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
});

module.exports = router;
