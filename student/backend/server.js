const dns = require('dns');
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const express = require('express');
const mysqlPromise = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { rateLimit } = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const emailService = require('./services/emailService');
const { verifyConnection: verifyMailConnection } = require('./config/mailConfig');
const { getPageAccess } = require('./services/workflowEngine');
const CommunityFeeCalculationService = require('./services/CommunityFeeCalculationService');

const app = express();
app.set('trust proxy', 1); // Trust reverse proxy (Render/Netlify) for accurate rate limiting

// Capture raw body for payment webhook signature verification (MUST be before express.json)
app.use('/api/payment/webhook', (req, _res, next) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => { req.rawBody = raw; next(); });
});

app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false, // Disable Helmet CSP so iframe/media previews from backend load in cross-origin frontend
    frameguard: false,            // Disable X-Frame-Options: SAMEORIGIN to allow secure iframe document previewing
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(express.json());
app.use(express.urlencoded({ extended: false })); // Paytm callback is a form POST

// ── CORS must be registered BEFORE rate limiters so that 429 responses
//    still carry Access-Control-Allow-Origin and the browser can read them.
app.use(cors({
    origin: (origin, callback) => {
        const productionOrigins = [
            process.env.STUDENT_FRONTEND_URL,
            process.env.PAYMENT_RETURN_URL ? new URL(process.env.PAYMENT_RETURN_URL).origin : null,
        ].filter(Boolean);

        const allowed =
            !origin ||
            origin.startsWith('http://localhost') ||
            origin.startsWith('http://127.0.0.1') ||
            origin.endsWith('netlify.app') ||
            productionOrigins.includes(origin);

        if (allowed) callback(null, true);
        else callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

// ── Rate Limiting (registered AFTER cors() so 429 responses carry CORS headers)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,           // 50 login attempts per 15 min per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts. Please try again later.' },
});
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,          // 500 requests per 15 min per IP — generous for dev/prod
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again later.' },
    // Skip rate limiting for high-frequency read-only public endpoints
    skip: (req) => {
        const p = req.path;
        const o = req.originalUrl || '';
        return p === '/settings' || o === '/api/settings' ||
               p === '/portals/active' || o === '/api/portals/active' ||
               p === '/portal-home/settings' || o === '/api/portal-home/settings' ||
               p === '/portal-notifications' || o === '/api/portal-notifications' ||
               p === '/active-session' || o === '/api/active-session' ||
               p.startsWith('/dropdowns') || o.startsWith('/api/dropdowns') ||
               p.startsWith('/states') || o.startsWith('/api/states') ||
               p.startsWith('/districts') || o.startsWith('/api/districts');
    },
});
app.use('/api/auth', authLimiter);
app.use('/api/', apiLimiter);

// Allow cross-origin access to uploaded files (logos, documents, photos)
app.use('/uploads', (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(path.join(__dirname, '../../uploads')));

// MySQL Connection Pool (Production Standard)
const db = mysqlPromise.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});

// JWT Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access denied. Token missing.', 
            errorCode: 'AUTH_TOKEN_MISSING' 
        });
    }

    jwt.verify(token, process.env.STUDENT_JWT_SECRET, (err, user) => {
        if (err) {
            const errorCode = err.name === 'TokenExpiredError' ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_TOKEN_INVALID';
            return res.status(401).json({ 
                success: false, 
                message: 'Session expired. Please log in again.', 
                errorCode 
            });
        }
        req.user = user;
        next();
    });
};

// Database initialization
const initDB = async () => {
    try {
        await db.query("SET NAMES utf8mb4");
        console.log('Database charset set to utf8mb4');
        
        // Ensure applicant_initial column exists in applications table
        try {
            await db.query(`
                ALTER TABLE applications 
                ADD COLUMN applicant_initial VARCHAR(50) DEFAULT NULL AFTER applicant_name;
            `);
            console.log("applicant_initial column added to applications table successfully.");
        } catch (err) {
            if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
                console.error('Error adding applicant_initial column:', err);
            }
        }

        // Add part time subcategory columns
        const ptCols = [
            { name: 'part_time_category', type: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'part_time_designation', type: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'part_time_area', type: 'VARCHAR(255) DEFAULT NULL' }
        ];

        for (const col of ptCols) {
            try {
                await db.query(`ALTER TABLE applications ADD COLUMN ${col.name} ${col.type};`);
                console.log(`${col.name} column added successfully.`);
            } catch (err) {
                if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
                    console.error(`Error adding ${col.name} column:`, err);
                }
            }
        }

        // --- Enterprise Part-Time Configuration Schema ---
        await db.query(`
            CREATE TABLE IF NOT EXISTS part_time_categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                category_name VARCHAR(255) NOT NULL UNIQUE,
                status TINYINT NOT NULL DEFAULT 1
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS part_time_roles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                category_id INT NOT NULL,
                role_name VARCHAR(255) NOT NULL,
                status TINYINT NOT NULL DEFAULT 1,
                FOREIGN KEY (category_id) REFERENCES part_time_categories(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS part_time_eligible_areas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                role_id INT NOT NULL,
                eligible_area_name VARCHAR(255) NOT NULL,
                status TINYINT NOT NULL DEFAULT 1,
                FOREIGN KEY (role_id) REFERENCES part_time_roles(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Safely add category_hint column to part_time_categories if it doesn't exist
        try {
            await db.query(`
                ALTER TABLE part_time_categories
                ADD COLUMN category_hint TEXT DEFAULT NULL AFTER category_name;
            `);
            console.log("✅ category_hint column verified in part_time_categories.");
        } catch (err) {
            if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
                console.error('Error adding category_hint column:', err.message);
            }
        }

        // Safely add category_reference_code to part_time_categories
        try {
            await db.query(`ALTER TABLE part_time_categories ADD COLUMN category_reference_code VARCHAR(20) DEFAULT NULL AFTER category_hint`);
            console.log("✅ category_reference_code column verified in part_time_categories.");
        } catch (err) {
            if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
                console.error('Error adding category_reference_code column:', err.message);
            }
        }

        // Safely add role_hint to part_time_roles
        try {
            await db.query(`ALTER TABLE part_time_roles ADD COLUMN role_hint TEXT DEFAULT NULL AFTER role_name`);
            console.log("✅ role_hint column verified in part_time_roles.");
        } catch (err) {
            if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
                console.error('Error adding role_hint column:', err.message);
            }
        }

        // Eligibility-driven course name for PG and M.Phil sections
        try {
            await db.query(`ALTER TABLE higher_education ADD COLUMN degree_name VARCHAR(255) DEFAULT NULL`);
            console.log("✅ degree_name column verified in higher_education.");
        } catch (err) {
            if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
                console.error('Error adding degree_name column:', err.message);
            }
        }

        // Seed predefined university hints + reference codes into existing categories (idempotent name & hint corrections)
        const categoryHintSeeds = [
            {
                ref: '2.2.2.1',
                name: 'College Teacher',
                hint: 'A faculty member working in a University Department or in an affiliated college of this University or any institution located within the Periyar University jurisdiction affiliated to any technical institution/university.'
            },
            {
                ref: '2.2.2.2',
                name: 'School Teacher',
                hint: 'A teacher working in a Higher Secondary School or High School located within Tamil Nadu with a minimum two years of continuous service.'
            },
            {
                ref: '2.2.2.3',
                name: 'Non Teacher',
                hint: 'A candidate (other than a teacher) in a regular job, within Tamil Nadu with a minimum two years of continuous service after the qualifying degree.'
            },
            {
                ref: '2.2.2.4',
                name: 'Research assistant',
                hint: 'Research assistant, Technical assistant and non-teaching staff working in the Periyar University office/departments with a minimum two years of continuous service.'
            },
            {
                ref: '2.2.2.5',
                name: 'polytechnics Teacher',
                hint: 'Any teacher possessing the minimum qualifications prescribed by the UGC and working as a teacher in polytechnics (only teachers of Arts, Science, and allied multidisciplinary subjects) within Tamil Nadu, which are recognized or approved by the Government, shall be permitted to register as a Part-Time scholar to pursue research under a recognized supervisor in a University Department or an affiliated college or a Research Centre approved by the University.'
            }
        ];

        for (const seed of categoryHintSeeds) {
            // First try to find by reference code
            const [exists] = await db.query('SELECT id FROM part_time_categories WHERE category_reference_code = ?', [seed.ref]);
            if (exists.length > 0) {
                await db.query(
                    `UPDATE part_time_categories SET category_name = ?, category_hint = ? WHERE category_reference_code = ?`,
                    [seed.name, seed.hint, seed.ref]
                );
            } else {
                // Try matching old name if reference code is not set yet
                const oldMatchNames = {
                    '2.2.2.1': 'Teaching → College',
                    '2.2.2.2': 'High School/Higher Secondary School',
                    '2.2.2.3': 'Non Teaching',
                    '2.2.2.4': 'Others',
                    '2.2.2.5': 'Polytechnic Teacher'
                };
                await db.query(
                    `UPDATE part_time_categories SET category_name = ?, category_hint = ?, category_reference_code = ? WHERE category_name = ?`,
                    [seed.name, seed.hint, seed.ref, oldMatchNames[seed.ref]]
                );
            }
        }
        console.log("✅ Part-Time category hints and reference codes verified.");

        // Safely create global_part_time_guidance registry table
        await db.query(`
            CREATE TABLE IF NOT EXISTS global_part_time_guidance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                file_path VARCHAR(255) NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                document_type VARCHAR(50) NOT NULL,
                uploaded_by INT NOT NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("✅ global_part_time_guidance schema verified.");

        // State → District sub-table for working areas
        await db.query(`
            CREATE TABLE IF NOT EXISTS part_time_area_districts (
                id            INT AUTO_INCREMENT PRIMARY KEY,
                area_id       INT          NOT NULL,
                district_name VARCHAR(255) NOT NULL,
                status        TINYINT      NOT NULL DEFAULT 1,
                created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (area_id) REFERENCES part_time_eligible_areas(id) ON DELETE CASCADE,
                INDEX idx_pad_area (area_id),
                UNIQUE KEY uniq_area_district (area_id, district_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("✅ part_time_area_districts schema verified.");

        // District + area_id columns on applications (backward-compatible)
        const ptExtCols = [
            { name: 'part_time_area_id', type: 'INT DEFAULT NULL' },
            { name: 'part_time_district', type: 'VARCHAR(255) DEFAULT NULL' },
        ];
        for (const col of ptExtCols) {
            try {
                await db.query(`ALTER TABLE applications ADD COLUMN ${col.name} ${col.type}`);
                console.log(`✅ ${col.name} column added to applications.`);
            } catch (err) {
                if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
                    console.error(`Error adding applications.${col.name}:`, err.message);
                }
            }
        }

        // Seed Master Data (Official University Structure) — only on first-time empty tables.
        // NEVER truncate on startup to preserve admin-managed configurations.
        const [[{ catCount }]] = await db.query("SELECT COUNT(*) AS catCount FROM part_time_categories");
        if (catCount === 0) {
            const masterSeeds = [
                {
                    cat: "Teaching → College",
                    roles: ["Professor", "Associate Professor", "Assistant Professor"],
                    areas: ["Salem", "Namakkal", "Krishnagiri", "Dharmapuri"]
                },
                {
                    cat: "High School/Higher Secondary School",
                    roles: ["PG Assistant", "BT Assistant", "Teacher"],
                    areas: ["Tamil Nadu"]
                },
                {
                    cat: "Polytechnic Teacher",
                    roles: ["Teacher"],
                    areas: ["Tamil Nadu"]
                },
                {
                    cat: "Non Teaching",
                    roles: ["Manager", "Assistant Librarian"],
                    areas: ["Tamil Nadu"]
                },
                {
                    cat: "Others",
                    roles: ["Research Assistant", "Technical Assistant"],
                    areas: ["Periyar University"]
                }
            ];

            for (const s of masterSeeds) {
                const [cRes] = await db.query("INSERT INTO part_time_categories (category_name) VALUES (?)", [s.cat]);
                const catId = cRes.insertId;
                for (const r of s.roles) {
                    const [rRes] = await db.query("INSERT INTO part_time_roles (category_id, role_name) VALUES (?, ?)", [catId, r]);
                    const roleId = rRes.insertId;
                    for (const a of s.areas) {
                        await db.query("INSERT INTO part_time_eligible_areas (role_id, eligible_area_name) VALUES (?, ?)", [roleId, a]);
                    }
                }
            }
            console.log("✅ Master Part-Time Configuration seeded (first-time only).");
        } else {
            console.log("✅ Part-Time Configuration already present — skipping seed.");
        }

        // Payment time-window columns (Section 1 enterprise workflow)
        const settingsCols = [
            { name: 'payment_enabled',   type: 'TINYINT(1) NOT NULL DEFAULT 0' },
            { name: 'payment_open',      type: 'VARCHAR(32) NULL' },
            { name: 'payment_close',     type: 'VARCHAR(32) NULL' },
            { name: 'payment_due_days',  type: 'INT NOT NULL DEFAULT 7' },
        ];
        for (const col of settingsCols) {
            try {
                await db.query(`ALTER TABLE university_settings ADD COLUMN ${col.name} ${col.type}`);
            } catch (err) {
                if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
                    console.error(`Error adding university_settings.${col.name}:`, err.message);
                }
            }
        }

        // Deferred payment workflow columns
        const deferredPayCols = [
            { name: 'payment_decision',          type: "ENUM('pay_now','pay_later') DEFAULT NULL" },
            { name: 'payment_due_date',          type: 'DATETIME DEFAULT NULL' },
            { name: 'payment_expired_at',        type: 'DATETIME DEFAULT NULL' },
            { name: 'payment_resume_count',      type: 'INT NOT NULL DEFAULT 0' },
            { name: 'payment_first_attempt_at',  type: 'DATETIME DEFAULT NULL' },
            { name: 'payment_latest_attempt_at', type: 'DATETIME DEFAULT NULL' },
            { name: 'payment_session_id',        type: 'VARCHAR(64) DEFAULT NULL' },
        ];
        for (const col of deferredPayCols) {
            try {
                await db.query(`ALTER TABLE applications ADD COLUMN ${col.name} ${col.type}`);
            } catch (err) {
                if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
                    console.error(`Error adding applications.${col.name}:`, err.message);
                }
            }
        }
        console.log('✅ Deferred payment columns verified.');

        // Department column in attendance_upload_logs (for venue tracking)
        try {
            await db.query(`ALTER TABLE attendance_upload_logs ADD COLUMN department VARCHAR(255) NULL AFTER session_id`);
        } catch (err) {
            if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
                console.error('Error adding attendance_upload_logs.department:', err.message);
            }
        }

        // OTP and password-reset columns (added by email_migration.sql; guard here for auto-init)
        const emailCols = [
            { name: 'otp_code',            type: "VARCHAR(6) NULL" },
            { name: 'otp_expires_at',      type: "DATETIME NULL" },
            { name: 'otp_attempts',        type: "INT NOT NULL DEFAULT 0" },
            { name: 'otp_purpose',         type: "VARCHAR(20) NULL" },
            { name: 'reset_token',         type: "VARCHAR(128) NULL" },
            { name: 'reset_token_expires', type: "DATETIME NULL" },
        ];
        for (const col of emailCols) {
            try {
                await db.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
            } catch (err) {
                if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
                    console.error(`Error adding users.${col.name}:`, err.message);
                }
            }
        }
        // Email Queue Worker Table
        await db.query(`
            CREATE TABLE IF NOT EXISTS email_queue (
                id INT AUTO_INCREMENT PRIMARY KEY,
                to_email VARCHAR(255) NOT NULL,
                subject VARCHAR(255) NOT NULL,
                html_body TEXT NOT NULL,
                text_body TEXT NULL,
                template_name VARCHAR(100) NULL,
                status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
                retries INT DEFAULT 0,
                error_log TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("email_queue table deployed successfully.");

        // Ensure password_reset_otps table exists
        await db.query(`
            CREATE TABLE IF NOT EXISTS password_reset_otps (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                email       VARCHAR(255) NOT NULL,
                portal      ENUM('student','admin','supervisor','center') NOT NULL,
                otp         VARCHAR(6) NOT NULL,
                expires_at  DATETIME NOT NULL,
                verified    TINYINT(1) DEFAULT 0,
                attempts    INT DEFAULT 0,
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_email_portal (email, portal)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("✅ password_reset_otps table verified.");

        // ── Delayed Application ID Generation schema (run-once guards) ─────────
        // Make users.application_id nullable (CETPHD format is longer than 20 chars)
        try {
            await db.query(`ALTER TABLE users MODIFY COLUMN application_id VARCHAR(30) UNIQUE NULL`);
        } catch (_) {}
        try {
            await db.query(`ALTER TABLE applications MODIFY COLUMN application_id VARCHAR(30) NULL`);
        } catch (_) {}

        // Add user_id column to all related tables for pre-submission tracking
        const relatedTableUserIdCols = [
            'school_education', 'higher_education', 'experience_details',
            'application_documents', 'student_qualifications'
        ];
        for (const tbl of relatedTableUserIdCols) {
            try {
                await db.query(`ALTER TABLE \`${tbl}\` ADD COLUMN user_id INT NULL`);
            } catch (err) {
                if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
                    console.error(`Error adding user_id to ${tbl}:`, err.message);
                }
            }
            try {
                await db.query(`ALTER TABLE \`${tbl}\` MODIFY COLUMN application_id VARCHAR(30) NULL`);
            } catch (_) {}
        }

        // application_submitted and application_id_generated_at flags on applications
        const appIdCols = [
            { name: 'application_submitted',      type: 'TINYINT(1) NOT NULL DEFAULT 0' },
            { name: 'application_id_generated_at', type: 'TIMESTAMP NULL DEFAULT NULL' },
        ];
        for (const col of appIdCols) {
            try {
                await db.query(`ALTER TABLE applications ADD COLUMN ${col.name} ${col.type}`);
            } catch (err) {
                if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
                    console.error(`Error adding applications.${col.name}:`, err.message);
                }
            }
        }

        // user_id-based unique key for student_qualifications (required for ON DUPLICATE KEY)
        try {
            await db.query(`ALTER TABLE student_qualifications ADD UNIQUE KEY uk_user_qual (user_id, qualification_id)`);
        } catch (err) {
            if (err.errno !== 1061 && err.code !== 'ER_DUP_KEYNAME') {
                console.error('Error adding uk_user_qual:', err.message);
            }
        }

        // Serial counter table for CETPHD Application ID generation
        await db.query(`
            CREATE TABLE IF NOT EXISTS application_id_serials (
                session_id  INT          NOT NULL PRIMARY KEY,
                last_serial INT UNSIGNED NOT NULL DEFAULT 0,
                updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Application ID delayed-generation schema verified.');

        // ── Eligibility Engine — new columns on applications ─────────────────
        const eligCols = [
            { name: 'department_id',        def: 'INT NULL' },
            { name: 'program_offered_id',   def: 'INT NULL' },
            { name: 'program_offered_name', def: 'VARCHAR(255) NULL' },
        ];
        for (const col of eligCols) {
            try {
                await db.query(`ALTER TABLE applications ADD COLUMN ${col.name} ${col.def}`);
            } catch (err) {
                if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME')
                    console.error(`Error adding applications.${col.name}:`, err.message);
            }
        }
        console.log('✅ Eligibility engine columns verified.');

        // ── Portal Notifications — public admission announcements ─────────────
        await db.query(`
            CREATE TABLE IF NOT EXISTS portal_notifications (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                title        VARCHAR(255) NOT NULL,
                content      TEXT         NULL,
                type         ENUM('notification','date','guideline') NOT NULL DEFAULT 'notification',
                priority     INT          NOT NULL DEFAULT 0,
                is_active    TINYINT(1)   NOT NULL DEFAULT 1,
                published_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
                created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
                updated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ portal_notifications table verified.');

    } catch (err) {
        console.error('Database init error:', err);
    }
};

initDB().then(() => {
    // Start asynchronous enterprise queue processor
    const emailWorker = require('./services/emailWorker');
    emailWorker.start();
});

verifyMailConnection();

// --- AUTH ROUTES ---
const authRouter = express.Router();

authRouter.post('/register', async (req, res) => {
    const { email, password, full_name } = req.body;
    try {
        const [existing] = await db.query('SELECT email FROM users WHERE email = ?', [email]);
        if (existing.length > 0) return res.status(400).json({ message: 'User already exists' });

        // Fetch active session — registration blocked if none exists
        const [sessionRows] = await db.query(
            `SELECT s.id FROM sessions s WHERE s.is_active = 1 AND s.registration_open = 1 LIMIT 1`
        );
        if (sessionRows.length === 0) {
            return res.status(403).json({
                message: 'Registrations are currently closed. No active admission session is open for registration. Please contact the university.'
            });
        }
        const activeSessionId = sessionRows[0].id;

        const hashedPassword = await bcrypt.hash(password, 10);

        // application_id is NOT generated here — it is assigned only after the
        // registration form is fully submitted (CETPHD/J26/XXXX format).
        // Students are tracked by email / user_id until then.
        await db.query(
            'INSERT INTO users (full_name, email, password, session_id) VALUES (?, ?, ?, ?)',
            [full_name, email, hashedPassword, activeSessionId]
        );

        // Auto-create Draft application record — application_id remains NULL
        const [userResult] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        const userId = userResult[0].id;
        await db.query(
            'INSERT INTO applications (user_id, session_id, status) VALUES (?, ?, "Draft")',
            [userId, activeSessionId]
        );

        res.status(201).json({ message: 'User registered successfully' });

        const loginUrl = process.env.STUDENT_PORTAL_URL || 'http://localhost:5173';

        // Send welcome email (non-blocking)
        emailService.sendWelcomeEmail({
            to: email,
            studentName: full_name,
            applicationId: null,
            loginUrl,
        }).catch(() => {});

        // Credential notification + admin log (non-blocking)
        const credSvc = require('../../shared/credential/credentialNotificationService');
        credSvc.notify({ db, name: full_name, email, password, portalType: 'Student', loginUrl }).catch(() => {});
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

authRouter.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [results] = await db.query('SELECT * FROM users WHERE email = ?', [username]);
        if (results.length === 0) return res.status(401).json({ message: 'Invalid credentials' });
        
        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
        
        // Track login activity (first_login_at set only on first insert)
        try {
            await db.query(
                `INSERT INTO student_logins (user_id, first_login_at, last_login_at, login_count, last_ip)
                 VALUES (?, NOW(), NOW(), 1, ?)
                 ON DUPLICATE KEY UPDATE
                   last_login_at = NOW(),
                   login_count   = login_count + 1,
                   last_ip       = VALUES(last_ip)`,
                [user.id, req.ip || null]
            );
        } catch (_) { /* non-critical — never block login */ }

        const token = jwt.sign({ id: user.id, application_id: user.application_id, role: user.role }, process.env.STUDENT_JWT_SECRET, { expiresIn: '7d' });
        res.json({ message: 'Login successful', data: { token, user: { id: user.id, full_name: user.full_name, application_id: user.application_id, email: user.email, role: user.role } } });
    } catch (error) {
        res.status(500).json({ message: 'Server error during login' });
    }
});

// ── POST /api/auth/send-otp ────────────────────────────────────────────────────
authRouter.post('/send-otp', async (req, res) => {
    const { email, purpose = 'verification' } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    try {
        const [rows] = await db.query('SELECT id, full_name FROM users WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(404).json({ message: 'No account found with that email' });

        const user = rows[0];
        const otp = crypto.randomInt(100000, 999999).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await db.query(
            'UPDATE users SET otp_code = ?, otp_expires_at = ?, otp_attempts = 0, otp_purpose = ? WHERE id = ?',
            [otp, expiresAt, purpose, user.id]
        );

        await emailService.sendOTPEmail({
            to: email,
            studentName: user.full_name,
            otp,
            purpose,
            expiresInMinutes: 10,
        });

        res.json({ message: 'OTP sent to your email address' });
    } catch (err) {
        console.error('[OTP] send-otp error:', err.message);
        res.status(500).json({ message: 'Failed to send OTP' });
    }
});

// ── POST /api/auth/verify-otp ──────────────────────────────────────────────────
authRouter.post('/verify-otp', async (req, res) => {
    const { email, otp, purpose = 'verification' } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });
    try {
        const [rows] = await db.query(
            'SELECT id, otp_code, otp_expires_at, otp_attempts, otp_purpose FROM users WHERE email = ?',
            [email]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Account not found' });

        const user = rows[0];

        if (user.otp_attempts >= 5)
            return res.status(429).json({ message: 'Too many failed attempts. Please request a new OTP.' });
        if (!user.otp_code || !user.otp_expires_at)
            return res.status(400).json({ message: 'No OTP was requested. Please request a new one.' });
        if (new Date() > new Date(user.otp_expires_at))
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        if (user.otp_purpose !== purpose)
            return res.status(400).json({ message: 'OTP purpose mismatch' });

        if (user.otp_code !== String(otp)) {
            await db.query('UPDATE users SET otp_attempts = otp_attempts + 1 WHERE id = ?', [user.id]);
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // Clear OTP after successful verification
        await db.query(
            'UPDATE users SET otp_code = NULL, otp_expires_at = NULL, otp_attempts = 0, otp_purpose = NULL WHERE id = ?',
            [user.id]
        );

        res.json({ message: 'OTP verified successfully', verified: true });
    } catch (err) {
        console.error('[OTP] verify-otp error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
authRouter.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    try {
        const [rows] = await db.query('SELECT id, full_name FROM users WHERE email = ?', [email]);
        // Always respond 200 to avoid user enumeration
        if (rows.length === 0) return res.json({ message: 'If an account exists, a reset link has been sent.' });

        const user = rows[0];
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await db.query(
            'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
            [token, expiresAt, user.id]
        );

        const baseUrl = process.env.STUDENT_PORTAL_URL || 'http://localhost:5173';
        const resetUrl = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

        await emailService.sendPasswordResetEmail({
            to: email,
            studentName: user.full_name,
            resetUrl,
            expiresInHours: 1,
        });

        res.json({ message: 'If an account exists, a reset link has been sent.' });
    } catch (err) {
        console.error('[Auth] forgot-password error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
authRouter.post('/reset-password', async (req, res) => {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword)
        return res.status(400).json({ message: 'Email, token, and new password are required' });
    if (newPassword.length < 8)
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
    try {
        const [rows] = await db.query(
            'SELECT id, reset_token, reset_token_expires FROM users WHERE email = ? AND reset_token = ?',
            [email, token]
        );
        if (rows.length === 0)
            return res.status(400).json({ message: 'Invalid or expired reset link' });

        const user = rows[0];
        if (!user.reset_token_expires || new Date() > new Date(user.reset_token_expires))
            return res.status(400).json({ message: 'Reset link has expired. Please request a new one.' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query(
            'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
            [hashedPassword, user.id]
        );

        res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
    } catch (err) {
        console.error('[Auth] reset-password error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

const sharedAuthRoutes = require('../../shared/auth/routes/authRoutes');
app.use('/api/auth', sharedAuthRoutes(express, db, 'student', bcrypt));
app.use('/api/auth', authRouter);

// ── PUT /api/auth/change-password — logged-in student password change ─────────
app.put('/api/auth/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
        return res.status(400).json({ message: 'Current and new password are required' });
    if (newPassword.length < 8)
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
    try {
        const [rows] = await db.query('SELECT password, email FROM users WHERE id = ?', [req.user.id]);
        if (!rows.length) return res.status(404).json({ message: 'User not found' });
        const valid = await bcrypt.compare(currentPassword, rows[0].password);
        if (!valid) return res.status(400).json({ message: 'Current password is incorrect' });
        const hashed = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
        res.json({ message: 'Password changed successfully' });
        const credSvc = require('../../shared/credential/credentialNotificationService');
        credSvc.notifyPasswordChange({ db, email: rows[0].email, newPassword, portalType: 'Student', ipAddress: req.ip }).catch(() => {});
    } catch (err) {
        console.error('[Auth] change-password error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- SETTINGS (read-only) & DROPDOWNS ---

// Read-only public settings endpoint for the student portal (display-only)
app.get('/api/settings', async (_req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const [results] = await db.query('SELECT * FROM university_settings LIMIT 1');
        if (!results[0]) return res.json({ success: true, data: {} });
        const mapped = {
            ...results[0],
            university_name_english: results[0].university_name_english || results[0].university_name_en || results[0].header_line1,
            university_name_tamil: results[0].university_name_ta,
            logo: results[0].logo_url,
            logo2: results[0].logo2,
        };
        res.json({ success: true, data: mapped });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to load settings' });
    }
});

// Public portal-home settings (prospectus path, custom title, custom status text)
app.get('/api/portal-home/settings', async (_req, res) => {
    try {
        const [[row]] = await db.query('SELECT * FROM portal_home_settings WHERE id = 1');
        res.json({ success: true, data: row || {} });
    } catch (_err) {
        // Table may not exist yet on first boot — return empty object gracefully
        res.json({ success: true, data: {} });
    }
});

// Proxy prospectus download — streams file from admin uploads through student backend
app.get('/api/portal-home/prospectus/download', async (_req, res) => {
    try {
        const [[row]] = await db.query(
            'SELECT prospectus_path, prospectus_file_name FROM portal_home_settings WHERE id = 1'
        );
        if (!row?.prospectus_path) return res.status(404).json({ success: false, message: 'No prospectus uploaded' });

        const fs   = require('fs');
        const full = path.resolve(__dirname, '../../admin/backend/', row.prospectus_path);
        if (!fs.existsSync(full)) return res.status(404).json({ success: false, message: 'File not found' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${row.prospectus_file_name || 'prospectus.pdf'}"`);
        fs.createReadStream(full).pipe(res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Public admission notifications for the student home page
app.get('/api/portal-notifications', async (_req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, title, content, type, priority, published_at
             FROM portal_notifications
             WHERE is_active = 1
             ORDER BY priority DESC, published_at DESC
             LIMIT 50`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to load notifications' });
    }
});

// Public admission announcements/moving marquee for the student home page
app.get('/api/portal-home/announcements', async (_req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, announcement_text, session_text, text_color, background_color, animation_speed, is_scrolling_enabled, display_order, is_active
             FROM portal_announcements
             WHERE is_active = 1
             ORDER BY display_order ASC, created_at DESC`
        );
        res.json({ success: true, data: rows });
    } catch (_err) {
        // Table or columns may not exist yet or has schema lag — return empty array gracefully
        res.json({ success: true, data: [] });
    }
});


// Read-only public active portals endpoint for the landing page (display-only)
app.get('/api/portals/active', async (_req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM portal_management WHERE is_active = 1 ORDER BY display_order ASC');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to load active portals' });
    }
});

// Settings write/upload endpoints belong exclusively to the Admin Portal (port 5001).
// They are intentionally absent from the Student Portal to prevent privilege escalation.

const dropdownConfig = {
    exam_centers: { table: 'dropdown_exam_centers', name: 'name' },
    subjects: { table: 'dropdown_subjects', name: 'name' },
    categories: { table: 'dropdown_categories', name: 'name' },
    districts: { table: 'dropdown_districts', name: 'name' },
    genders: { table: 'dropdown_genders', name: 'name' },
    education_boards: { table: 'education_boards', name: 'board_name' },
    degree_types: { table: 'degree_types', name: 'degree_name', extra: ', level' },
    university_types: { table: 'university_types', name: 'type_name' },
    specializations: { table: 'specializations', name: 'spec_name' },
    employment_types: { table: 'employment_types', name: 'type_name' },
    mphil_courses: { table: 'mphil_courses_master', name: 'course_name' }
};

Object.keys(dropdownConfig).forEach(key => {
    app.get(`/api/dropdowns/${key}`, async (req, res) => {
        const conf = dropdownConfig[key];
        try {
            // Legacy tables don't have is_active, so we only filter if it's one of the new master tables
            const hasActive = ['education_boards', 'degree_types', 'university_types', 'specializations', 'employment_types'].includes(conf.table);
            const where = hasActive ? ' WHERE is_active = 1' : '';
            const [results] = await db.query(`SELECT id, ${conf.name} as name ${conf.extra || ''} FROM ${conf.table}${where}`);
            res.json(results);
        } catch (err) { res.status(500).json(err); }
    });
});

// Custom endpoint for communities to load from community_fees master as single source of truth
app.get('/api/dropdowns/communities', async (req, res) => {
    try {
        const [results] = await db.query(
            `SELECT id, community_name AS name, pg_min_mark, general_fee, differently_abled_fee, status 
             FROM community_fees 
             WHERE status = 'active' 
             ORDER BY community_name ASC`
        );
        res.json(results);
    } catch (err) {
        res.status(500).json(err);
    }
});

// ── Eligibility Engine — public read-only routes ──────────────────────────────
// GET /api/eligibility/departments
app.get('/api/eligibility/departments', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, name FROM departments WHERE is_active = 1 ORDER BY name ASC`
        );
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/eligibility/programs?department_id=
app.get('/api/eligibility/programs', async (req, res) => {
    const { department_id } = req.query;
    try {
        let sql = `SELECT p.id, p.department_id, p.name, d.name AS department_name
                   FROM programs_offered p JOIN departments d ON d.id = p.department_id
                   WHERE p.is_active = 1`;
        const params = [];
        if (department_id) { sql += ' AND p.department_id = ?'; params.push(department_id); }
        sql += ' ORDER BY p.name ASC';
        const [rows] = await db.query(sql, params);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/eligibility/programs/:id/hints
app.get('/api/eligibility/programs/:id/hints', async (req, res) => {
    const programId = req.params.id;
    try {
        const [[prog]] = await db.query(
            `SELECT p.id, p.name, p.department_id, d.name AS department_name
             FROM programs_offered p JOIN departments d ON d.id = p.department_id
             WHERE p.id = ? LIMIT 1`, [programId]
        );
        if (!prog) return res.status(404).json({ success: false, message: 'Programme not found' });

        const [pg]    = await db.query(
            `SELECT course_name FROM program_pg_eligibility    WHERE program_id = ? ORDER BY course_name ASC`, [programId]
        );
        const [mphil] = await db.query(
            `SELECT course_name FROM program_mphil_eligibility WHERE program_id = ? ORDER BY course_name ASC`, [programId]
        );
        res.json({
            success: true,
            data: {
                program: prog,
                pg:    pg.map(r => r.course_name),
                mphil: mphil.map(r => r.course_name),
            }
        });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// --- APPLICATION ROUTES (PROTECTED) ---
// Strip path separators and dangerous characters from uploaded filenames
const sanitizeFilename = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    // Use user_id from JWT (always available) as the file prefix; this is safe
    // before application_id is generated and continues to work after submission.
    filename: (req, file, cb) => cb(null, `uid${req.user?.id || 'unknown'}_${Date.now()}_${sanitizeFilename(file.originalname)}`)
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB Limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) return cb(null, true);
        cb(new Error('Only Images and PDFs allowed'));
    }
});

// GET /api/applications/my — fetch the logged-in student's application by user_id.
// Used before form submission when application_id is not yet assigned.
// Also used after submission (backwards compatible).
app.get('/api/applications/my', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        let [appResults] = await db.query('SELECT * FROM applications WHERE user_id = ?', [userId]);

        // Self-heal: if the draft record is missing (e.g. pre-migration user), auto-create it
        if (appResults.length === 0) {
            const [[userRow]] = await db.query('SELECT session_id FROM users WHERE id = ? LIMIT 1', [userId]);
            const sessionId = userRow?.session_id || null;
            await db.query(
                'INSERT INTO applications (user_id, session_id, status) VALUES (?, ?, "Draft")',
                [userId, sessionId]
            );
            [appResults] = await db.query('SELECT * FROM applications WHERE user_id = ?', [userId]);
        }
        if (appResults.length === 0) return res.status(404).json({ message: 'Application not found' });

        const application = appResults[0];
        await _attachSubDocs(application, userId);
        res.json(application);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching application' });
    }
});

// Shared helper — attach school/higher/experience/quals/docs to an application object.
// Always uses user_id (always available from JWT). application_id is only used
// for document/qualification lookups on old records that pre-date the migration.
async function _attachSubDocs(application, userId) {
    const [school] = await db.query(
        'SELECT * FROM school_education WHERE user_id = ?', [userId]
    );
    application.school_education = school;

    const [higher] = await db.query(
        'SELECT * FROM higher_education WHERE user_id = ?', [userId]
    );
    application.higher_education = higher.filter(h => h.level === 'UG' || h.level === 'PG');
    application.diploma = higher.find(h => h.level === 'Diploma') || null;
    application.mphil = higher.find(h => h.level === 'M.Phil') || null;
    application.integrated = higher.find(h => h.level === 'Integrated') || null;

    const [experience] = await db.query(
        `SELECT ed.*, s.state_name, d.district_name
         FROM experience_details ed
         LEFT JOIN states    s ON ed.state_id    = s.id
         LEFT JOIN districts d ON ed.district_id = d.id
         WHERE ed.user_id = ?`,
        [userId]
    );
    application.experience_details = experience;

    const [studentQuals] = await db.query(
        `SELECT sq.id, sq.qualification_id, sq.certificate_path, sq.status,
                qt.qualification_name, qt.is_exemption
         FROM student_qualifications sq
         JOIN qualification_types qt ON sq.qualification_id = qt.id
         WHERE sq.user_id = ? AND sq.status = 'Active'
         ORDER BY qt.display_order ASC`,
        [userId]
    );
    application.student_qualifications = studentQuals;

    const [docResults] = await db.query(
        'SELECT * FROM application_documents WHERE user_id = ?', [userId]
    );
    application.documents = docResults;
}

app.get('/api/applications/:application_id', authenticateToken, async (req, res) => {
    try {
        const appId = req.params.application_id;
        const userId = req.user.id;

        // Ownership-scoped lookup — always AND user_id to prevent IDOR
        let appResults;
        [appResults] = await db.query(
            'SELECT * FROM applications WHERE application_id = ? AND user_id = ?',
            [appId, userId]
        );

        // Fallback: if not found by application_id, try user_id alone (pre-submission case)
        if (appResults.length === 0) {
            [appResults] = await db.query('SELECT * FROM applications WHERE user_id = ?', [userId]);
        }
        if (appResults.length === 0) return res.status(404).json({ message: 'Application not found' });

        const application = appResults[0];
        await _attachSubDocs(application, userId);
        res.json(application);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching application' });
    }
});

// Columns that may be written by the student save form
const APP_ALLOWED_COLUMNS = new Set([
    'user_id','applicant_name','applicant_initial','applicant_name_tamil',
    'exam_center_1','exam_center_2','subject','subject_2','category','working_district',
    // eligibility engine columns
    'department_id','program_offered_id','program_offered_name',
    'dob','nationality','is_nri','religion','gender','community','parent_name',
    'address_1','address_2','address_3','district','state','pincode',
    'mobile','email','phone',
    'id_type','id_number',
    'is_physically_challenged','pc_percentage','pc_type',
    'pg_degree','pg_subject','score_type','score_value','year_of_passing','pg_university',
    'mark_statement_type','is_awaiting_final_sem','qualified_exams',
    'status',
    'part_time_category','part_time_designation','part_time_area','part_time_area_id','part_time_district',
    'perm_same_as_comm','perm_address_1','perm_address_2','perm_address_3',
    'perm_state','perm_district','perm_city','perm_pincode',
    'has_sslc', 'has_hsc', 'has_ug', 'has_pg', 'has_diploma', 'has_mphil', 'has_integrated'
]);

const COLUMNS = {
    school: ['level', 'institution_name', 'board_id', 'other_board_name', 'passing_month', 'passing_year', 'percentage', 'marksheet_path'],
    higher: ['level', 'degree_id', 'degree_name', 'specialization_id', 'institution_name', 'university_name', 'university_type_id', 'passing_month', 'passing_year', 'score_type', 'score_value', 'marksheet_path', 'consolidated_marksheet_path', 'registration_number', 'upload_mode'],
    exp:    ['designation', 'organization_name', 'employment_type_id', 'from_month', 'from_year', 'to_month', 'to_year', 'total_years', 'total_months', 'state_id', 'district_id']
};

app.post('/api/applications/save', authenticateToken, upload.any(), async (req, res) => {
    try {
        const raw   = { ...req.body };
        const files = req.files || [];
        // Primary tracking key — always available from JWT, never null.
        // application_id from the request body is ignored before submission to
        // avoid depending on the old APP2026-XXXXXX format.
        const userId = req.user.id;

        // Prevent any edits after final submission
        const [lockCheck] = await db.query(
            'SELECT final_submitted, is_locked FROM applications WHERE user_id = ?', [userId]
        );
        if (lockCheck.length > 0 && (lockCheck[0].final_submitted || lockCheck[0].is_locked)) {
            return res.status(403).json({ success: false, message: 'Application is locked. Editing is not allowed.' });
        }

        // Keep qualified_exams as a valid JSON string for the MySQL JSON column.
        if (raw.qualified_exams && typeof raw.qualified_exams !== 'string') {
            raw.qualified_exams = JSON.stringify(raw.qualified_exams);
        }

        // 1. Save Main Application Data
        const data = {};
        for (const [k, v] of Object.entries(raw)) {
            if (APP_ALLOWED_COLUMNS.has(k) && v !== undefined) {
                let val = (v === '' || v === 'null' || v === 'undefined') ? null : v;
                if (val === 'true') val = 1;
                if (val === 'false') val = 0;
                data[k] = val;
            }
        }

        // Self-healing email synchronization
        if (!data.email) {
            const [userEmailRow] = await db.query('SELECT email FROM users WHERE id = ?', [userId]);
            if (userEmailRow.length > 0 && userEmailRow[0].email) {
                data.email = userEmailRow[0].email;
            }
        }

        // Block final submission when admin has closed application submissions for this session
        if (data.status === 'Submitted') {
            const [sessionCheck] = await db.query(
                `SELECT s.application_open FROM users u
                 JOIN sessions s ON u.session_id = s.id
                 WHERE u.id = ?`,
                [userId]
            );
            if (!sessionCheck.length || !sessionCheck[0].application_open) {
                return res.status(403).json({
                    success: false,
                    message: 'Application submissions are currently closed by the university. You may continue saving your draft.'
                });
            }

            // ENTERPRISE ACADEMIC VALIDATION ENGINE
            const schoolData  = typeof raw.school_education === 'string' ? JSON.parse(raw.school_education) : raw.school_education;
            const higherData  = typeof raw.higher_education === 'string' ? JSON.parse(raw.higher_education) : raw.higher_education;
            const diplomaData = typeof raw.diploma   === 'string' ? JSON.parse(raw.diploma)   : raw.diploma;
            const mphilData   = typeof raw.mphil     === 'string' ? JSON.parse(raw.mphil)     : raw.mphil;
            const integratedData = typeof raw.integrated === 'string' ? JSON.parse(raw.integrated) : raw.integrated;

            const hasSslc = (raw.has_sslc === undefined || raw.has_sslc === 'true' || raw.has_sslc === '1' || raw.has_sslc === 1);
            const hasHsc  = (raw.has_hsc === undefined  || raw.has_hsc === 'true'  || raw.has_hsc === '1'  || raw.has_hsc === 1);
            const hasUg   = (raw.has_ug === undefined   || raw.has_ug === 'true'   || raw.has_ug === '1'   || raw.has_ug === 1);
            const hasPg   = (raw.has_pg === undefined   || raw.has_pg === 'true'   || raw.has_pg === '1'   || raw.has_pg === 1);
            const hasDiploma = (raw.has_diploma === 'true' || raw.has_diploma === '1' || raw.has_diploma === 1);
            const hasMphil   = (raw.has_mphil   === 'true' || raw.has_mphil   === '1' || raw.has_mphil   === 1);
            const hasIntegrated = (raw.has_integrated === 'true' || raw.has_integrated === '1' || raw.has_integrated === 1);

            const errs = [];

            if (hasSslc) {
                const item = schoolData?.[0];
                if (!item || !item.institution_name?.trim() || !item.board_id || !item.passing_year || !item.percentage) {
                    errs.push('SSLC Section');
                }
            }

            if (hasHsc) {
                const item = schoolData?.[1];
                if (!item || !item.institution_name?.trim() || !item.board_id || !item.passing_year || !item.percentage) {
                    errs.push('HSC Section');
                }
            }

            if (hasUg) {
                const item = higherData?.[0];
                if (!item || !item.institution_name?.trim() || !item.degree_id || !item.passing_year || !item.score_value) {
                    errs.push('UG Section');
                }
            }

            if (hasPg) {
                const item = higherData?.[1];
                if (!item || !item.institution_name?.trim() || (!item.degree_id && !item.degree_name) || !item.passing_year || !item.score_value) {
                    errs.push('PG Section');
                }
            }

            if (hasDiploma) {
                const item = diplomaData;
                if (!item || !item.institution_name?.trim() || !item.degree_id || !item.passing_year || !item.score_value) {
                    errs.push('Diploma Section');
                }
            }

            if (hasMphil) {
                const item = mphilData;
                if (!item || !item.institution_name?.trim() || (!item.degree_id && !item.degree_name) || !item.passing_year || !item.score_value) {
                    errs.push('M.Phil Section');
                }
            }

            if (hasIntegrated) {
                const item = integratedData;
                if (!item || !item.institution_name?.trim() || !item.university_name?.trim() || !item.registration_number?.trim() || !item.passing_year || !item.score_value) {
                    errs.push('5-Year Integrated Course Section');
                }
            }

            // Work experience is mandatory for Part Time candidates only.
            // We validate server-side to prevent bypass via browser dev-tools.
            if (raw.category === 'Part Time') {
                const expRaw  = typeof raw.experience_details === 'string'
                    ? JSON.parse(raw.experience_details)
                    : raw.experience_details;
                const validExp = Array.isArray(expRaw)
                    ? expRaw.filter(e => e.organization_name?.trim() || e.designation?.trim())
                    : [];
                if (validExp.length === 0) {
                    errs.push('Work Experience (required for Part Time applicants)');
                }
            }

            // ── Server-side eligibility enforcement ──────────────────────────────
            // Validates that selected PG/M.Phil course is in the admin-mapped list
            // for the chosen programme. This cannot be bypassed via frontend.
            const programId = raw.program_offered_id || data.program_offered_id;
            if (programId) {
                if (hasPg) {
                    const pgItem = higherData?.[1];
                    if (pgItem?.degree_name) {
                        const [eligiblePg] = await db.query(
                            'SELECT course_name FROM program_pg_eligibility WHERE program_id = ?',
                            [programId]
                        );
                        const eligible = eligiblePg.map(r => r.course_name);
                        if (eligible.length > 0 && !eligible.includes(pgItem.degree_name)) {
                            errs.push(`PG course "${pgItem.degree_name}" is not eligible for the chosen programme`);
                        }
                    }
                }
                if (hasMphil) {
                    const mphilItem = mphilData;
                    if (mphilItem?.degree_name) {
                        const [exists] = await db.query(
                            'SELECT id FROM mphil_courses_master WHERE course_name = ? LIMIT 1',
                            [mphilItem.degree_name]
                        );
                        if (exists.length === 0) {
                            errs.push(`Invalid M.Phil course: "${mphilItem.degree_name}"`);
                        }
                    }
                }
            }

            // ── Server-side PG Minimum Mark Eligibility Enforcement ──
            const selectedCommunityName = raw.community || data.community;
            if (selectedCommunityName && (hasPg || hasIntegrated)) {
                const [commRows] = await db.query(
                    'SELECT pg_min_mark FROM community_fees WHERE community_name = ?',
                    [selectedCommunityName]
                );
                if (commRows.length > 0 && commRows[0].pg_min_mark !== null) {
                    const minMark = parseFloat(commRows[0].pg_min_mark);
                    if (hasPg) {
                        const pgItem = higherData?.[1];
                        const pgScore = pgItem ? parseFloat(pgItem.score_value) : NaN;
                        if (!isNaN(pgScore) && pgScore < minMark) {
                            errs.push(`Minimum required PG percentage for your selected community is ${minMark}% (Your score: ${pgScore}%)`);
                        }
                    }
                    if (hasIntegrated) {
                        const integratedItem = integratedData;
                        const integratedScore = integratedItem ? parseFloat(integratedItem.score_value) : NaN;
                        if (!isNaN(integratedScore) && integratedScore < minMark) {
                            errs.push(`Minimum required PG percentage for your selected community is ${minMark}% (Your score: ${integratedScore}%)`);
                        }
                    }
                }
            }

            if (errs.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Validation failed. Please complete: ${errs.join(', ')}`
                });
            }
        }

        // Use user_id as the primary key for applications lookup/update
        const [results] = await db.query('SELECT id, application_id FROM applications WHERE user_id = ?', [userId]);
        if (results.length > 0) {
            if (Object.keys(data).length > 0) {
                if (data.qualified_exams !== undefined) {
                    const keys = Object.keys(data).filter(k => k !== 'qualified_exams');
                    const sets = [...keys.map(k => `\`${k}\` = ?`), '`qualified_exams` = ?'].join(', ');
                    const vals = [...keys.map(k => data[k]), data.qualified_exams, userId];
                    await db.query(`UPDATE applications SET ${sets} WHERE user_id = ?`, vals);
                } else {
                    await db.query('UPDATE applications SET ? WHERE user_id = ?', [data, userId]);
                }
            }
        } else {
            // Draft record should always exist (created at registration), but handle gracefully
            data.user_id = userId;
            if (data.qualified_exams !== undefined) {
                const cols = Object.keys(data);
                await db.query(
                    `INSERT INTO applications (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
                    Object.values(data)
                );
            } else {
                await db.query('INSERT INTO applications SET ?', data);
            }
        }

        // Synchronize parent user's full name with applicant_name + applicant_initial
        if (data.applicant_name !== undefined) {
            const initial = data.applicant_initial || '';
            const fullNameConcatenated = `${data.applicant_name}${initial ? ' ' + initial : ''}`.trim().toUpperCase();
            await db.query('UPDATE users SET full_name = ? WHERE id = ?', [fullNameConcatenated, userId]);
        }

        // 2. Handle School Education — keyed by user_id
        if (raw.school_education) {
            const schoolData = typeof raw.school_education === 'string' ? JSON.parse(raw.school_education) : raw.school_education;
            let idx = 0;
            for (const item of schoolData) {
                const { id, ...rawFields } = item;
                const fields = {};
                COLUMNS.school.forEach(c => { if (rawFields[c] !== undefined) fields[c] = (rawFields[c] === '' || rawFields[c] === 'null' || rawFields[c] === 'undefined') ? null : rawFields[c]; });

                if (!fields.level) fields.level = idx === 0 ? 'SSLC' : 'HSC';

                let existingId = id;
                if (!existingId && fields.level) {
                    const [ex] = await db.query('SELECT id FROM school_education WHERE user_id = ? AND level = ?', [userId, fields.level]);
                    if (ex.length > 0) existingId = ex[0].id;
                }

                if (existingId) await db.query('UPDATE school_education SET ? WHERE id = ?', [fields, existingId]);
                else await db.query('INSERT INTO school_education SET ?', { ...fields, user_id: userId });
                idx++;
            }
        }

        // 3. Handle Higher Education — keyed by user_id
        if (raw.higher_education) {
            const higherData = typeof raw.higher_education === 'string' ? JSON.parse(raw.higher_education) : raw.higher_education;
            let idx = 0;
            for (const item of higherData) {
                const { id, ...rawFields } = item;
                const fields = {};
                COLUMNS.higher.forEach(c => { if (rawFields[c] !== undefined) fields[c] = (rawFields[c] === '' || rawFields[c] === 'null' || rawFields[c] === 'undefined') ? null : rawFields[c]; });

                if (!fields.level) fields.level = idx === 0 ? 'UG' : 'PG';

                let existingId = id;
                if (!existingId && fields.level) {
                    const [ex] = await db.query('SELECT id FROM higher_education WHERE user_id = ? AND level = ?', [userId, fields.level]);
                    if (ex.length > 0) existingId = ex[0].id;
                }

                if (existingId) await db.query('UPDATE higher_education SET ? WHERE id = ?', [fields, existingId]);
                else await db.query('INSERT INTO higher_education SET ?', { ...fields, user_id: userId });
                idx++;
            }
        }

        // 3.1 Handle Diploma (level = 'Diploma')
        if (raw.diploma) {
            const diploma = typeof raw.diploma === 'string' ? JSON.parse(raw.diploma) : raw.diploma;
            const fields = {};
            COLUMNS.higher.forEach(c => { if (diploma[c] !== undefined) fields[c] = (diploma[c] === '' || diploma[c] === 'null' || diploma[c] === 'undefined') ? null : diploma[c]; });
            if (!fields.level) fields.level = 'Diploma';
            const [ex] = await db.query('SELECT id FROM higher_education WHERE user_id = ? AND level = "Diploma"', [userId]);
            if (ex.length > 0) await db.query('UPDATE higher_education SET ? WHERE id = ?', [fields, ex[0].id]);
            else await db.query('INSERT INTO higher_education SET ?', { ...fields, user_id: userId });
        }

        // 3.2 Handle M.Phil (level = 'M.Phil')
        if (raw.mphil) {
            const mphil = typeof raw.mphil === 'string' ? JSON.parse(raw.mphil) : raw.mphil;
            const fields = {};
            COLUMNS.higher.forEach(c => { if (mphil[c] !== undefined) fields[c] = (mphil[c] === '' || mphil[c] === 'null' || mphil[c] === 'undefined') ? null : mphil[c]; });
            if (!fields.level) fields.level = 'M.Phil';
            const [ex] = await db.query('SELECT id FROM higher_education WHERE user_id = ? AND level = "M.Phil"', [userId]);
            if (ex.length > 0) await db.query('UPDATE higher_education SET ? WHERE id = ?', [fields, ex[0].id]);
            else await db.query('INSERT INTO higher_education SET ?', { ...fields, user_id: userId });
        }

        // 3.3 Handle 5-Year Integrated Course (level = 'Integrated')
        if (raw.integrated) {
            const integrated = typeof raw.integrated === 'string' ? JSON.parse(raw.integrated) : raw.integrated;
            const fields = {};
            COLUMNS.higher.forEach(c => { if (integrated[c] !== undefined) fields[c] = (integrated[c] === '' || integrated[c] === 'null' || integrated[c] === 'undefined') ? null : integrated[c]; });
            if (!fields.level) fields.level = 'Integrated';
            const [ex] = await db.query('SELECT id FROM higher_education WHERE user_id = ? AND level = "Integrated"', [userId]);
            if (ex.length > 0) await db.query('UPDATE higher_education SET ? WHERE id = ?', [fields, ex[0].id]);
            else await db.query('INSERT INTO higher_education SET ?', { ...fields, user_id: userId });
        }

        // 4. Handle Experience — keyed by user_id
        if (raw.experience_details) {
            const expData = typeof raw.experience_details === 'string' ? JSON.parse(raw.experience_details) : raw.experience_details;
            for (const item of expData) {
                const { id, ...rawFields } = item;
                const fields = {};
                COLUMNS.exp.forEach(c => { if (rawFields[c] !== undefined) fields[c] = (rawFields[c] === '' || rawFields[c] === 'null') ? null : rawFields[c]; });

                if (id) await db.query('UPDATE experience_details SET ? WHERE id = ? AND user_id = ?', [fields, id, userId]);
                else await db.query('INSERT INTO experience_details SET ?', { ...fields, user_id: userId });
            }
        }

        // 5. Handle Documents/Files — keyed by user_id
        if (files.length > 0) {
            for (const file of files) {
                const filePath = file.path.replace(/\\/g, '/');

                // ── Qualification certificate (qual_cert_{qualificationId}) ──
                if (file.fieldname.startsWith('qual_cert_')) {
                    const qualId = parseInt(file.fieldname.replace('qual_cert_', ''), 10);
                    if (qualId) {
                        await db.query(
                            `INSERT INTO student_qualifications (user_id, qualification_id, certificate_path, status)
                             VALUES (?, ?, ?, 'Active')
                             ON DUPLICATE KEY UPDATE certificate_path = ?, status = 'Active', updated_at = NOW()`,
                            [userId, qualId, filePath, filePath]
                        );
                    }
                    continue;
                }

                // ── Experience certificate (exp_cert_{index}) ──
                if (file.fieldname.startsWith('exp_cert_')) {
                    const expIdx = parseInt(file.fieldname.replace('exp_cert_', ''), 10);
                    const [expRows] = await db.query(
                        'SELECT id FROM experience_details WHERE user_id = ? ORDER BY id ASC LIMIT 1 OFFSET ?',
                        [userId, expIdx]
                    );
                    if (expRows.length > 0) {
                        await db.query(
                            'UPDATE experience_details SET experience_certificate_path = ? WHERE id = ?',
                            [filePath, expRows[0].id]
                        );
                    }
                    await db.query('DELETE FROM application_documents WHERE user_id = ? AND document_type = ?', [userId, file.fieldname]);
                    await db.query('INSERT INTO application_documents (user_id, document_type, file_path) VALUES (?, ?, ?)', [userId, file.fieldname, filePath]);
                    continue;
                }

                // ── Standard document ──
                await db.query('DELETE FROM application_documents WHERE user_id = ? AND document_type = ?', [userId, file.fieldname]);
                await db.query('INSERT INTO application_documents (user_id, document_type, file_path) VALUES (?, ?, ?)', [userId, file.fieldname, filePath]);

                // Sync marksheet paths to relational education tables
                if (file.fieldname === 'school_education.0_marksheet' || file.fieldname === 'sslc_marksheet') {
                    await db.query('UPDATE school_education SET marksheet_path = ? WHERE user_id = ? AND level = "SSLC"', [filePath, userId]);
                }
                if (file.fieldname === 'school_education.1_marksheet' || file.fieldname === 'hsc_marksheet') {
                    await db.query('UPDATE school_education SET marksheet_path = ? WHERE user_id = ? AND level = "HSC"', [filePath, userId]);
                }
                if (file.fieldname === 'ug_consolidated' || file.fieldname === 'ug_marksheet' || file.fieldname.startsWith('ug_sem_')) {
                    await db.query('UPDATE higher_education SET marksheet_path = ?, consolidated_marksheet_path = ? WHERE user_id = ? AND level = "UG"', [filePath, filePath, userId]);
                }
                if (file.fieldname === 'pg_consolidated' || file.fieldname === 'pg_marksheet' || file.fieldname.startsWith('pg_sem_')) {
                    await db.query('UPDATE higher_education SET marksheet_path = ?, consolidated_marksheet_path = ? WHERE user_id = ? AND level = "PG"', [filePath, filePath, userId]);
                }
                if (file.fieldname === 'diploma_consolidated' || file.fieldname === 'diploma_marksheet' || file.fieldname.startsWith('diploma_sem_')) {
                    await db.query('UPDATE higher_education SET marksheet_path = ?, consolidated_marksheet_path = ? WHERE user_id = ? AND level = "Diploma"', [filePath, filePath, userId]);
                }
                if (file.fieldname === 'mphil_consolidated' || file.fieldname === 'mphil_marksheet' || file.fieldname.startsWith('mphil_sem_')) {
                    await db.query('UPDATE higher_education SET marksheet_path = ?, consolidated_marksheet_path = ? WHERE user_id = ? AND level = "M.Phil"', [filePath, filePath, userId]);
                }
                if (file.fieldname === 'integrated_consolidated' || file.fieldname === 'integrated_marksheet' || file.fieldname.startsWith('integrated_sem_')) {
                    await db.query('UPDATE higher_education SET marksheet_path = ?, consolidated_marksheet_path = ? WHERE user_id = ? AND level = "Integrated"', [filePath, filePath, userId]);
                }
            }
        }

        // 6. Handle normalized student_qualifications — keyed by user_id
        if (raw.student_qualifications !== undefined) {
            let qualIds = [];
            try {
                const parsed = typeof raw.student_qualifications === 'string'
                    ? JSON.parse(raw.student_qualifications)
                    : raw.student_qualifications;
                qualIds = (Array.isArray(parsed) ? parsed : []).map(q => parseInt(q, 10)).filter(Boolean);
            } catch { qualIds = []; }

            const [existing] = await db.query(
                "SELECT qualification_id FROM student_qualifications WHERE user_id = ? AND status = 'Active'",
                [userId]
            );
            const existingSet = new Set(existing.map(r => r.qualification_id));
            const newSet      = new Set(qualIds);

            for (const existId of existingSet) {
                if (!newSet.has(existId)) {
                    await db.query(
                        "UPDATE student_qualifications SET status = 'Removed', updated_at = NOW() WHERE user_id = ? AND qualification_id = ?",
                        [userId, existId]
                    );
                }
            }

            for (const qualId of newSet) {
                await db.query(
                    `INSERT INTO student_qualifications (user_id, qualification_id, status)
                     VALUES (?, ?, 'Active')
                     ON DUPLICATE KEY UPDATE status = 'Active', updated_at = NOW()`,
                    [userId, qualId]
                );
            }

            const [exemptCheck] = await db.query(
                `SELECT sq.id FROM student_qualifications sq
                 JOIN qualification_types qt ON sq.qualification_id = qt.id
                 WHERE sq.user_id = ? AND sq.status = 'Active' AND qt.is_exemption = 1
                 LIMIT 1`,
                [userId]
            );
            const isExempted = exemptCheck.length > 0;
            const newStatus  = isExempted ? 'Exempted' : 'Required';

            const qualUpdate = isExempted
                ? ", qualification_status = 'Direct Qualified', final_result_status = 'Pending'"
                : '';
            await db.query(
                `UPDATE applications SET entrance_exam_status = ?${qualUpdate} WHERE user_id = ?`,
                [newStatus, userId]
            );
        }

        // ── 7. Mark application as fully submitted ────────────────────────────────
        // Application ID is NOT generated here. It is generated exclusively after
        // successful payment (in webhookService.lockApplicationAndGenerateReceipt).
        // All pre-payment tracking uses user_id / email.
        if (data.status === 'Submitted') {
            await db.query(
                `UPDATE applications SET final_submitted = 1, application_submitted = 1 WHERE user_id = ?`,
                [userId]
            );

            // Send form-received confirmation email (non-blocking, no application_id yet)
            try {
                const [[userData]] = await db.query('SELECT full_name, email FROM users WHERE id = ?', [userId]);
                emailService.sendApplicationSubmittedEmail?.({
                    to: userData.email,
                    studentName: userData.full_name,
                    applicationId: null,
                }).catch(() => {});
            } catch (_) {}

            return res.json({
                success: true,
                message: 'Application submitted successfully. Complete payment to receive your official Application ID.',
            });
        }

        res.json({ success: true, message: 'Application saved successfully' });
    } catch (error) {
        console.error('CRITICAL SAVE ERROR:', error);
        res.status(500).json({
            success: false,
            message: process.env.NODE_ENV === 'production' ? 'Error saving application' : (error.message || 'Error saving application'),
        });
    }
});

app.get('/api/admin/applications', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
    try {
        const [results] = await db.query(`
            SELECT a.*, u.full_name, u.email 
            FROM applications a 
            JOIN users u ON a.user_id = u.id 
            ORDER BY a.created_at DESC
        `);
        res.json(results);
    } catch (err) { res.status(500).json(err); }
});

// Complete eligibility snapshot for the logged-in student (used by Dashboard)
app.get('/api/student/eligibility', authenticateToken, async (req, res) => {
    try {
        const [appRows] = await db.query(
            `SELECT entrance_exam_status, qualification_status, entrance_mark,
                    attendance_status,
                    final_result_status, counselling_approval, payment_status, status,
                    direct_pass_status, application_id, result_published_at, pay_choice,
                    session_id,
                    payment_decision, payment_due_date, payment_expired_at, payment_resume_count
             FROM applications WHERE user_id = ? LIMIT 1`,
            [req.user.id]
        );
        const app = appRows[0];
        if (!app) return res.json({ success: false, message: 'No application found' });

        const [settingsRows] = await db.query(
            `SELECT entrance_result_publish, 
                    payment_enabled, payment_open, payment_close
             FROM university_settings LIMIT 1`
        );
        const settings = settingsRows[0] || {};

        // Payment time-window (enterprise workflow control)
        const pageAccess = getPageAccess(settings);
        const paymentWindowActive = pageAccess.payment.active;

        // Counselling window dates for student countdown + button visibility
        // session_id is read directly from applications (guaranteed to be populated)
        let counsellingEndDate   = null;
        let counsellingStartDate = null;

        // ── CounsellingAccessEngine — Production Grade ────────────────────────
        // Decoupled from application-lifecycle status (Submitted/Approved/Interview).
        // Automation Rule: Entrance PASS + Paid + Published + Window = Counselling Access.

        const isExempted   = app.entrance_exam_status === 'Exempted';
        const isDirectPass = app.direct_pass_status   === 'DirectPass';

        // GATE A: Result — PASS via entrance OR direct qualification
        const gateA_pass = (
            app.final_result_status === 'PASS' || isDirectPass || isExempted ||
            ['Qualified', 'Direct Qualified'].includes(app.qualification_status)
        );

        // GATE B: Payment — student must have paid
        const gateB_paid = app.payment_status === 'Paid';

        // GATE C: Result Publication — admin has published results globally
        const resultPublished = !!app.result_published_at || !!settings.entrance_result_publish;
        const gateC_published = resultPublished;

        // GATE D: Counselling Window — validated against Counselling Management settings
        let gateD_window = false;

        if (app.session_id) {
            const [csRows] = await db.query(
                `SELECT start_date, end_date FROM counselling_settings 
                 WHERE session_id = ? AND is_active = 1 LIMIT 1`,
                [app.session_id]
            );
            if (csRows[0]) {
                const rowStart = csRows[0].start_date;
                const rowEnd   = csRows[0].end_date;
                counsellingStartDate = rowStart instanceof Date ? rowStart.toISOString().split('T')[0] : String(rowStart).split('T')[0];
                counsellingEndDate   = rowEnd   instanceof Date ? rowEnd.toISOString().split('T')[0]   : String(rowEnd).split('T')[0];
                
                const today = new Date().toISOString().split('T')[0];
                gateD_window = !!counsellingStartDate && !!counsellingEndDate && today >= counsellingStartDate && today <= counsellingEndDate;
            }
        }

        const isEligible = gateA_pass && gateB_paid && gateC_published && gateD_window;
        const counsellingWindowActive = gateD_window;

        res.json({
            success: true,
            data: {
                entrance_exam_status:       app.entrance_exam_status,
                qualification_status:       app.qualification_status,
                entrance_mark:              app.entrance_mark,
                attendance_status:          app.attendance_status,
                final_result_status:        (isDirectPass || isExempted) ? 'PASS' : app.final_result_status,
                payment_status:             app.payment_status,
                status:                     app.status,
                pay_choice:                 app.pay_choice,
                is_exempted:                isExempted,
                is_direct_pass:             isDirectPass,
                show_entrance_result:       !isDirectPass && !isExempted && resultPublished,
                eligible_for_counselling:   isEligible,
                result_published:           resultPublished,
                counselling_start_date:     counsellingStartDate,
                counselling_end_date:       counsellingEndDate,
                counselling_window_active:  counsellingWindowActive,
                payment_window_active:      paymentWindowActive,
                payment_window_open:        pageAccess.payment.open,
                payment_window_close:       pageAccess.payment.close,
                // Deferred payment fields
                payment_decision:           app.payment_decision,
                payment_due_date:           app.payment_due_date,
                payment_expired_at:         app.payment_expired_at,
                payment_resume_count:       app.payment_resume_count || 0,
                is_payment_expired: (
                    app.payment_due_date &&
                    new Date(app.payment_due_date).getTime() < Date.now() &&
                    !['Paid','Verified','Approved'].includes(app.payment_status)
                ),
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Session info for the logged-in student (used by Dashboard)
app.get('/api/student/session', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.id, s.year, s.month, s.is_active, s.registration_open, s.application_open,
                   s.result_published, CONCAT(s.month, ' ', s.year) AS session_name
            FROM users u
            JOIN sessions s ON u.session_id = s.id
            WHERE u.id = ?
            LIMIT 1
        `, [req.user.id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'No session assigned to your account.' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Session fetch error:', err);
        res.status(500).json({ message: 'Error fetching session information.' });
    }
});

// Hall Ticket Route for Student
app.get('/api/student/hall-ticket', authenticateToken, async (req, res) => {
    try {
        // Soft-gate: return available:false (not 4xx) so the browser never logs a red error
        const [dpCheck] = await db.query(
            "SELECT direct_pass_status, status FROM applications WHERE user_id = ? LIMIT 1",
            [req.user.id]
        );
        if (dpCheck[0]?.direct_pass_status === 'DirectPass') {
            return res.json({ available: false, message: 'Direct pass candidates do not require a hall ticket.' });
        }
        if (dpCheck[0] && dpCheck[0].status !== 'Approved') {
            return res.json({ available: false, message: 'Hall ticket is only available for approved applications.' });
        }

        const [results] = await db.query(`
            SELECT ht.*,
                   CONCAT(a.applicant_name, IF(a.applicant_initial IS NOT NULL AND a.applicant_initial != '', CONCAT(' ', a.applicant_initial), '')) AS full_name, a.subject, a.application_id,
                   COALESCE(v.hall_name, ht.exam_venue)                        AS exam_venue,
                   COALESCE(
                     CONCAT(TIME_FORMAT(v.from_time,'%h:%i %p'),' - ',TIME_FORMAT(v.to_time,'%h:%i %p')),
                     ht.exam_time
                   )                                                            AS exam_time,
                   ht.seat_number,
                   (SELECT file_path FROM application_documents
                    WHERE application_id = a.application_id AND document_type IN ('Photo', 'photo') LIMIT 1) AS photo_path
            FROM hall_tickets ht
            JOIN applications a ON ht.application_id = a.application_id
            LEFT JOIN venues v  ON ht.venue_id = v.id
            WHERE a.user_id = ? AND ht.is_sent = 1
            ORDER BY ht.created_at DESC
            LIMIT 1
        `, [req.user.id]);

        if (results.length === 0) return res.json({ available: false, message: 'No hall ticket issued yet' });

        const ticket = results[0];
        const dept = ticket.subject ? ticket.subject.trim().toUpperCase() : '';
        const hall = ticket.exam_venue ? ticket.exam_venue.trim().toUpperCase() : '';
        if (dept && hall) {
            if (hall.includes(dept)) {
                ticket.exam_venue = hall;
            } else {
                ticket.exam_venue = `${dept} - ${hall}`;
            }
        } else {
            ticket.exam_venue = hall || dept || '—';
        }

        // Track first download timestamp
        if (!ticket.student_downloaded_at) {
            await db.query(
                'UPDATE hall_tickets SET student_downloaded_at = NOW() WHERE id = ?',
                [ticket.id]
            );
            await db.query(
                'UPDATE applications SET hall_ticket_downloaded_at = NOW() WHERE user_id = ? AND hall_ticket_downloaded_at IS NULL',
                [req.user.id]
            );
        }

        res.json(ticket);
    } catch (err) {
        console.error('Hall ticket fetch error:', err);
        res.status(500).json(err);
    }
});

// ─── PAYMENT FLOW — Pay Now / Pay Later ──────────────────────────────────────

// POST /api/student/payment/choice  — record pay-now or pay-later
app.post('/api/student/payment/choice', authenticateToken, async (req, res) => {
    const { choice } = req.body; // 'PayNow' | 'PayLater'
    if (!['PayNow', 'PayLater'].includes(choice)) {
        return res.status(400).json({ success: false, message: 'choice must be PayNow or PayLater' });
    }
    try {
        const [rows] = await db.query(
            'SELECT application_id, status FROM applications WHERE user_id = ? LIMIT 1',
            [req.user.id]
        );
        if (!rows[0]) return res.status(404).json({ success: false, message: 'Application not found' });
        if (rows[0].status === 'Draft') {
            return res.status(400).json({ success: false, message: 'Please complete and submit your application first' });
        }
        await db.query(
            'UPDATE applications SET pay_choice = ?, updated_at = NOW() WHERE user_id = ?',
            [choice, req.user.id]
        );
        res.json({ success: true, message: `Payment choice recorded: ${choice}`, choice });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// GET /api/student/payment/fee-details — fetch accurate dynamic fee based on community
app.get('/api/student/payment/fee-details', authenticateToken, async (req, res) => {
    try {
        const [[appRow]] = await db.query(
            'SELECT application_id, community, is_physically_challenged, payment_status FROM applications WHERE user_id = ? LIMIT 1',
            [req.user.id]
        );
        if (!appRow) return res.status(404).json({ success: false, message: 'Application not found' });
        const amount = await CommunityFeeCalculationService.calculateFee(appRow.community, appRow.is_physically_challenged, db);
        
        res.json({
            success: true,
            amount,
            community: appRow.community,
            category: [1, '1', 'Yes', 'yes'].includes(appRow.is_physically_challenged) ? 'Differently Abled' : 'General',
            fee_type: [1, '1', 'Yes', 'yes'].includes(appRow.is_physically_challenged) ? 'Differently Abled Fee' : 'General Fee',
            payment_status: appRow.payment_status
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/student/payment/confirm  — mark payment as paid (used after gateway callback / manual payment)
app.post('/api/student/payment/confirm', authenticateToken, async (req, res) => {
    const { transaction_id, payment_mode, amount } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [[appRow]] = await connection.query(
            'SELECT application_id, payment_status, community, is_physically_challenged FROM applications WHERE user_id = ? LIMIT 1',
            [req.user.id]
        );
        if (!appRow) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Application not found' }); }
        if (appRow.payment_status === 'Paid') {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Payment already completed' });
        }

        // We ensure strict enterprise validation matching using validatePaymentAmount
        const expectedFee = await CommunityFeeCalculationService.validatePaymentAmount(
            transaction_id || null,
            req.user.id,
            appRow.community,
            appRow.is_physically_challenged,
            amount,
            connection
        );

        const now = new Date();
        // Update applications
        await connection.query(
            `UPDATE applications
             SET payment_status = 'Paid', payment_date = ?, payment_transaction_id = ?,
                 pay_choice = 'PayNow', updated_at = NOW()
             WHERE user_id = ?`,
            [now, transaction_id || null, req.user.id]
        );

        // Insert into payments ledger
        await connection.query(
            `INSERT INTO payments
               (application_id, user_id, amount, gateway, transaction_id, payment_status, payment_mode, paid_at)
             VALUES (?, ?, ?, 'Online', ?, 'Success', ?, ?)`,
            [appRow.application_id, req.user.id, expectedFee, transaction_id || null, payment_mode || 'Online', now]
        );

        // Insert into payment_notifications for Admin Queue
        await connection.query(
            `INSERT INTO payment_notifications
               (application_id, user_id, amount, transaction_id, payment_method, status)
             VALUES (?, ?, ?, ?, ?, 'Pending Verification')`,
            [appRow.application_id, req.user.id, expectedFee, transaction_id || null, payment_mode || 'Online']
        );

        await connection.commit();

        // Evaluate direct-pass async (best-effort — don't block response)
        db.query(
            `SELECT a.application_id FROM applications a WHERE a.user_id = ?`, [req.user.id]
        ).then(async ([rows]) => {
            if (!rows[0]) return;
            // Simple direct-pass evaluation
            const [[a]] = await db.query(
                'SELECT qualified_exams, subject, status FROM applications WHERE application_id = ?',
                [rows[0].application_id]
            );
            if (!a || a.status === 'Draft') return;
            let qualExams = [];
            try { qualExams = a.qualified_exams ? JSON.parse(a.qualified_exams) : []; } catch (_) {}
            if (!qualExams.length) return;
            const [rules] = await db.query(
                `SELECT * FROM qualification_rules WHERE is_active = 1 AND direct_pass_enabled = 1
                 AND (valid_from IS NULL OR valid_from <= CURDATE())
                 AND (valid_to IS NULL OR valid_to >= CURDATE())`
            );
            for (const rule of rules) {
                if (!qualExams.includes(rule.qualification_type)) continue;
                if (rule.department) {
                    const depts = rule.department.split(',').map(d => d.trim().toLowerCase());
                    if (!depts.includes((a.subject || '').toLowerCase())) continue;
                }
                await db.query(
                    `UPDATE applications SET direct_pass_status = 'DirectPass',
                     qualification_status = 'Direct Qualified', final_result_status = 'PASS',
                     updated_at = NOW() WHERE application_id = ?`,
                    [rows[0].application_id]
                );
                break;
            }
        }).catch(() => {});

        res.json({ success: true, message: 'Payment confirmed successfully' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ success: false, message: err.message });
    } finally {
        connection.release();
    }
});

// GET /api/student/payment/history  — payment history for the logged-in student
app.get('/api/student/payment/history', authenticateToken, async (req, res) => {
    try {
        const [[appRow]] = await db.query(
            'SELECT application_id FROM applications WHERE user_id = ? LIMIT 1',
            [req.user.id]
        );
        if (!appRow) return res.json({ success: true, data: [] });

        const [rows] = await db.query(
            `SELECT id, amount, currency, gateway, transaction_id, payment_status,
                    payment_mode, receipt_number, paid_at, created_at
             FROM payments WHERE application_id = ?
             ORDER BY created_at DESC`,
            [appRow.application_id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/student/payment/create-order — DEPRECATED: use POST /api/payment/initiate
app.post('/api/student/payment/create-order', authenticateToken, (_req, res) => {
    res.status(410).json({
        success: false,
        message: 'This endpoint is deprecated. Use POST /api/payment/initiate with the enterprise payment system.',
        new_endpoint: '/api/payment/initiate'
    });
});

// POST /api/applications/verify-payment-submit — verify gateway payment and lock application atomically
app.post('/api/applications/verify-payment-submit', authenticateToken, async (req, res) => {
    const { 
        transaction_id, 
        payment_mode, 
        amount,
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature
    } = req.body;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    let finalTransactionId = transaction_id || razorpay_payment_id;
    let isMockPayment = true;

    // Check if we should execute real cryptographic verification
    if (razorpay_signature && razorpay_signature !== 'mock_signature' && keySecret && keyId && !keyId.startsWith('rzp_test_mockkey')) {
        isMockPayment = false;
        
        // Cryptographic check
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ 
                success: false, 
                message: 'Security Alert: Cryptographic payment signature verification failed. The transaction may have been tampered with.' 
            });
        }
        
        finalTransactionId = razorpay_payment_id;
    } else {
        if (!finalTransactionId) {
            return res.status(400).json({ success: false, message: 'Transaction ID or Payment ID is required for verification.' });
        }
    }

    const connection = await db.getConnection();
    try {
        await connection.getConnection(); // Just ensure it's healthy
        await connection.beginTransaction();

        // 1. Fetch application details with locking
        const [[appRow]] = await connection.query(
            'SELECT application_id, status, payment_status, community, is_physically_challenged, applicant_name, applicant_initial FROM applications WHERE user_id = ? FOR UPDATE',
            [req.user.id]
        );

        if (!appRow) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        // 2. If already paid, return early with existing transaction info to ensure idempotency
        if (appRow.payment_status === 'Success' || appRow.payment_status === 'Paid') {
            const [[paymentRow]] = await connection.query(
                'SELECT receipt_number, transaction_id, paid_at FROM payments WHERE application_id = ? AND payment_status = "Success" LIMIT 1',
                [appRow.application_id]
            );

            await connection.commit();

            return res.json({
                success: true,
                message: 'Payment and application submission already completed.',
                data: {
                    receipt_number: appRow.receipt_number || (paymentRow ? paymentRow.receipt_number : `RCPT-2026-${(appRow.application_id || `U${req.user.id}`).toString().replace(/[^A-Za-z0-9]/g, '')}`),
                    submission_reference: appRow.submission_reference || `REF-2026-${(appRow.application_id || `U${req.user.id}`).toString().replace(/[^A-Za-z0-9]/g, '')}`,
                    transaction_id: appRow.payment_transaction_id || (paymentRow ? paymentRow.transaction_id : finalTransactionId),
                    paid_at: appRow.payment_completed_at || (paymentRow ? paymentRow.paid_at : new Date())
                }
            });
        }

        // 3. Dynamic Fee Calculation and Validation
        const expectedFee = await CommunityFeeCalculationService.validatePaymentAmount(
            finalTransactionId || null,
            req.user.id,
            appRow.community,
            appRow.is_physically_challenged,
            amount,
            connection
        );

        const now = new Date();
        // application_id is set after form submission; use user_id as fallback for receipts
        const cleanAppId = appRow.application_id
            ? appRow.application_id.toString().replace(/[^A-Za-z0-9]/g, '')
            : `U${req.user.id}`;
        const receipt_number = `RCPT-2026-${cleanAppId}`;
        const submission_reference = `REF-2026-${cleanAppId}`;

        // 4. Update Application status and submit
        await connection.query(
            `UPDATE applications
             SET status = 'SUBMITTED', payment_status = 'Paid', payment_date = ?, payment_transaction_id = ?,
                 pay_choice = 'PayNow', final_submitted = 1, is_locked = 1, payment_completed_at = ?,
                 submitted_at = ?, receipt_number = ?, submission_reference = ?, updated_at = NOW()
             WHERE user_id = ?`,
            [now, finalTransactionId, now, now, receipt_number, submission_reference, req.user.id]
        );

        // 5. Insert into Payments ledger
        await connection.query(
            `INSERT INTO payments
               (application_id, user_id, amount, gateway, transaction_id, payment_status, payment_mode, receipt_number, paid_at, payment_verified, payment_approved)
             VALUES (?, ?, ?, 'Online', ?, 'Success', ?, ?, ?, 1, 1)`,
            [appRow.application_id, req.user.id, expectedFee, finalTransactionId, payment_mode || 'Online', receipt_number, now]
        );

        // 6. Insert into Payment Notifications
        await connection.query(
            `INSERT INTO payment_notifications
               (application_id, user_id, amount, transaction_id, payment_method, status)
             VALUES (?, ?, ?, ?, ?, 'Verified')`,
            [appRow.application_id, req.user.id, expectedFee, finalTransactionId, payment_mode || 'Online']
        );

        await connection.commit();

        // 7. Evaluate direct-pass async
        db.query(
            `SELECT a.application_id FROM applications a WHERE a.user_id = ?`, [req.user.id]
        ).then(async ([rows]) => {
            if (!rows[0]) return;
            const [[a]] = await db.query(
                'SELECT qualified_exams, subject, status FROM applications WHERE application_id = ?',
                [rows[0].application_id]
            );
            if (!a || a.status === 'Draft') return;
            let qualExams = [];
            try { qualExams = a.qualified_exams ? JSON.parse(a.qualified_exams) : []; } catch (_) {}
            if (!qualExams.length) return;
            const [rules] = await db.query(
                `SELECT * FROM qualification_rules WHERE is_active = 1 AND direct_pass_enabled = 1
                 AND (valid_from IS NULL OR valid_from <= CURDATE())
                 AND (valid_to IS NULL OR valid_to >= CURDATE())`
            );
            for (const rule of rules) {
                if (!qualExams.includes(rule.qualification_type)) continue;
                if (rule.department) {
                    const depts = rule.department.split(',').map(d => d.trim().toLowerCase());
                    if (!depts.includes((a.subject || '').toLowerCase())) continue;
                }
                await db.query(
                    `UPDATE applications SET direct_pass_status = 'DirectPass',
                     qualification_status = 'Direct Qualified', final_result_status = 'PASS',
                     updated_at = NOW() WHERE application_id = ?`,
                    [rows[0].application_id]
                );
                break;
            }
        }).catch(() => {});

        res.json({
            success: true,
            message: 'Payment and application submission completed successfully.',
            data: {
                receipt_number,
                submission_reference,
                transaction_id,
                paid_at: now
            }
        });

    } catch (err) {
        await connection.rollback();
        console.error('Verify payment error:', err);
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal transaction error' : ('Internal transaction error: ' + err.message) });
    } finally {
        connection.release();
    }
});

// GET /api/applications/download-receipt/:appId — generates premium PDF payment receipt via pdfkit
app.get('/api/applications/download-receipt/:appId', authenticateToken, async (req, res) => {
    try {
        const appId = req.params.appId;
        // Ownership check — only the owning student may download their receipt
        const [appResults] = await db.query(
            'SELECT * FROM applications WHERE application_id = ? AND user_id = ?',
            [appId, req.user.id]
        );
        const application = appResults[0];
        if (!application) return res.status(404).json({ message: 'Application not found' });

        if (application.payment_status !== 'Success' && application.payment_status !== 'Paid') {
            return res.status(403).json({ success: false, message: 'Payment receipt is only available for paid/submitted applications.' });
        }

        const [paymentResults] = await db.query(
            'SELECT * FROM payments WHERE application_id = ? AND payment_status = "Success" ORDER BY created_at DESC LIMIT 1',
            [appId]
        );
        const payment = paymentResults[0] || {};

        const [settingsResults] = await db.query('SELECT * FROM university_settings LIMIT 1');
        const settings = settingsResults[0] || {};

        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Payment_Receipt_${appId}.pdf`);
        doc.pipe(res);

        // Styling
        const PRIMARY  = '#1a3a5c';
        const TEXT_COLOR = '#333333';
        const LIGHT_GRAY = '#f4f6f8';
        const GOLD = '#c8a951';
        const GREEN = '#10b981';

        // Helper functions
        const drawLine = (y) => {
            doc.moveTo(40, y).lineTo(555, y).strokeColor('#e2e8f0').lineWidth(1).stroke();
        };

        // Header - draw logo
        const cx = 80, cy = 75, r = 25;
        doc.save().circle(cx, cy, r).fillColor(PRIMARY).fill();
        doc.circle(cx, cy, r).strokeColor(GOLD).lineWidth(1.5).stroke();
        doc.circle(cx, cy, r - 5).strokeColor(GOLD).lineWidth(0.8).stroke();
        const bw = r * 0.55, bh = r * 0.38, bx = cx - bw / 2, by = cy - bh / 2 - 3;
        doc.save()
           .moveTo(cx, by).lineTo(bx, by + bh * 0.25).lineTo(bx, by + bh)
           .lineTo(cx, by + bh * 0.75).closePath()
           .fillColor('#fff').fill();
        doc.moveTo(cx, by).lineTo(bx + bw, by + bh * 0.25).lineTo(bx + bw, by + bh)
           .lineTo(cx, by + bh * 0.75).closePath()
           .fillColor('#e0e8f0').fill();
        doc.restore();

        // Header Texts
        doc.fillColor(PRIMARY)
           .fontSize(16)
           .font('Helvetica-Bold')
           .text(settings.university_name_en || 'PERIYAR UNIVERSITY', 120, 55);

        doc.fillColor('#666666')
           .fontSize(9)
           .font('Helvetica')
           .text('Reaccredited with "A++" Grade by NAAC', 120, 75);

        doc.text('Salem - 636 011, Tamil Nadu, India', 120, 88);

        drawLine(115);

        // Receipt Title Banner
        doc.rect(40, 130, 515, 30).fillColor(PRIMARY).fill();
        doc.fillColor('#ffffff')
           .fontSize(11)
           .font('Helvetica-Bold')
           .text('ONLINE PAYMENT ACKNOWLEDGEMENT RECEIPT', 50, 139, { align: 'center', width: 495 });

        // Left block - Transaction Details
        let y = 180;
        doc.fillColor(PRIMARY).fontSize(12).font('Helvetica-Bold').text('TRANSACTION INFORMATION', 40, y);
        y += 18;

        const infoList = [
            { label: 'Receipt Number', value: application.receipt_number || payment.receipt_number || 'N/A' },
            { label: 'Submission Reference', value: application.submission_reference || 'N/A' },
            { label: 'Transaction ID', value: application.payment_transaction_id || payment.transaction_id || 'N/A' },
            { label: 'Payment Mode/Method', value: payment.payment_mode || 'Online UPI/Card' },
            { label: 'Transaction Date', value: application.payment_completed_at ? new Date(application.payment_completed_at).toLocaleString() : new Date().toLocaleString() },
            { label: 'Payment Status', value: 'SUCCESS / PAID', color: GREEN }
        ];

        infoList.forEach(item => {
            doc.fillColor('#666666').fontSize(9).font('Helvetica').text(item.label, 45, y);
            if (item.color) {
                doc.fillColor(item.color).fontSize(9).font('Helvetica-Bold').text(item.value, 180, y);
            } else {
                doc.fillColor(TEXT_COLOR).fontSize(9).font('Helvetica-Bold').text(item.value, 180, y);
            }
            y += 18;
        });

        // Right side - stamp graphic
        const stampX = 430, stampY = 190;
        doc.save();
        doc.circle(stampX, stampY, 40).strokeColor(GREEN).lineWidth(2).stroke();
        doc.circle(stampX, stampY, 36).strokeColor(GREEN).lineWidth(0.8).stroke();
        doc.fillColor(GREEN)
           .fontSize(8)
           .font('Helvetica-Bold')
           .text('ONLINE PAYMENT', stampX - 35, stampY - 14, { align: 'center', width: 70 })
           .fontSize(10)
           .text('VERIFIED', stampX - 35, stampY - 2, { align: 'center', width: 70 })
           .fontSize(7)
           .text('PERIYAR UNIVERSITY', stampX - 35, stampY + 11, { align: 'center', width: 70 });
        doc.restore();

        drawLine(310);

        // Applicant Information Section
        y = 330;
        doc.fillColor(PRIMARY).fontSize(12).font('Helvetica-Bold').text('APPLICANT & COURSE DETAILS', 40, y);
        y += 18;

        const fullName = `${application.applicant_name} ${application.applicant_initial || ''}`.trim();
        const applicantList = [
            { label: 'Application ID', value: application.application_id },
            { label: 'Applicant Name', value: fullName },
            { label: 'Subject/Discipline', value: application.subject || 'N/A' },
            { label: 'Community/Category', value: application.community || 'N/A' },
            { label: 'Email Address', value: application.email || 'N/A' },
            { label: 'Mobile Number', value: application.mobile || 'N/A' }
        ];

        applicantList.forEach(item => {
            doc.fillColor('#666666').fontSize(9).font('Helvetica').text(item.label, 45, y);
            doc.fillColor(TEXT_COLOR).fontSize(9).font('Helvetica-Bold').text(item.value, 180, y);
            y += 18;
        });

        drawLine(460);

        // Payment Summary Box Table
        y = 480;
        doc.fillColor(PRIMARY).fontSize(12).font('Helvetica-Bold').text('FEE SUMMATION', 40, y);
        y += 18;

        // Table Header
        doc.rect(40, y, 515, 20).fillColor(LIGHT_GRAY).fill();
        doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold')
           .text('Fee Description', 50, y + 6)
           .text('Amount (INR)', 470, y + 6, { align: 'right', width: 75 });
        y += 20;

        // Table Body
        doc.rect(40, y, 515, 25).fillColor('#ffffff').fill();
        doc.fillColor(TEXT_COLOR).fontSize(9).font('Helvetica')
           .text('Ph.D. Application Admission Processing Fee', 50, y + 8)
           .font('Helvetica-Bold')
           .text(`₹ ${parseFloat(payment.amount || application.amount || 1500).toFixed(2)}`, 470, y + 8, { align: 'right', width: 75 });
        y += 25;

        // Table Total
        doc.rect(40, y, 515, 25).fillColor(LIGHT_GRAY).fill();
        doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold')
           .text('Total Amount Paid', 50, y + 8)
           .text(`₹ ${parseFloat(payment.amount || application.amount || 1500).toFixed(2)}`, 470, y + 8, { align: 'right', width: 75 });
        y += 35;

        const getAmountInWords = (amt) => {
            if (amt === 1500) return 'Rupees One Thousand Five Hundred Only';
            if (amt === 1000) return 'Rupees One Thousand Only';
            if (amt === 500) return 'Rupees Five Hundred Only';
            return `Rupees ${amt} Only`;
        };
        const words = getAmountInWords(parseFloat(payment.amount || application.amount || 1500));

        doc.fillColor('#666666').fontSize(9).font('Helvetica-Oblique')
           .text(`Amount in Words: ${words}`, 45, y);

        // Information/Terms
        y += 45;
        doc.rect(40, y, 515, 60).fillColor('#f0fdf4').fill();
        doc.rect(40, y, 515, 60).strokeColor('#bbf7d0').lineWidth(0.8).stroke();

        doc.fillColor('#15803d').fontSize(9).font('Helvetica-Bold').text('Verified Payment Acknowledgement Statement:', 50, y + 8);
        doc.fillColor('#166534').fontSize(8.5).font('Helvetica')
           .text('1. This payment is completed and credited to the Periyar University admission processing registry.', 50, y + 22)
           .text('2. Please retain this receipt and your application PDF reference for all future communications.', 50, y + 34)
           .text('3. This is an official computer-generated receipt, secured and digitally certified by the portal.', 50, y + 46);

        // Footer
        const footerY = 760;
        doc.moveTo(40, footerY).lineTo(555, footerY).strokeColor(GOLD).lineWidth(1.5).stroke();
        doc.fillColor('#888888').fontSize(7.5).font('Helvetica')
           .text('Computer Generated E-Receipt — University Ph.D. Admission Desk', 45, footerY + 8)
           .text(`Generated on: ${new Date().toLocaleString()}`, 470, footerY + 8, { align: 'right', width: 80 });

        doc.end();

    } catch (err) {
        console.error('Receipt PDF generation error:', err);
        if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generating Receipt PDF' });
    }
});

// ── Notifications ──────────────────────────────────────────────────────────

// REST fallback — initial load / polling fallback
app.get('/api/student/notifications', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, title, message, type, is_read, created_at
             FROM notifications
             WHERE user_id = ? OR user_id IS NULL
             ORDER BY created_at DESC LIMIT 20`,
            [req.user.id]
        );
        const [[{ unread }]] = await db.query(
            'SELECT COUNT(*) as unread FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0',
            [req.user.id]
        );
        res.json({ success: true, data: rows, unread });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Mark single notification as read
app.put('/api/student/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        await db.query(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
            [req.params.id, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Mark all as read
app.put('/api/student/notifications/read-all', authenticateToken, async (req, res) => {
    try {
        await db.query(
            'UPDATE notifications SET is_read = 1 WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0',
            [req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// SSE real-time stream — pushes new notifications every 8 seconds
// EventSource cannot send Authorization header, so token accepted via query param
app.get('/api/student/notifications/stream', (req, res) => {
    const rawToken = (req.headers['authorization'] || '').replace('Bearer ', '') || req.query.token;
    if (!rawToken) return res.status(401).end();

    jwt.verify(rawToken, process.env.STUDENT_JWT_SECRET, async (err, user) => {
        if (err) return res.status(403).end();

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const userId = user.id;
        let lastSentIds = new Set();

        const push = async () => {
            try {
                const [rows] = await db.query(
                    `SELECT id, title, message, type, is_read, created_at
                     FROM notifications
                     WHERE user_id = ? OR user_id IS NULL
                     ORDER BY created_at DESC LIMIT 20`,
                    [userId]
                );
                const [[{ unread }]] = await db.query(
                    'SELECT COUNT(*) as unread FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0',
                    [userId]
                );

                // Detect brand-new notifications (not seen in previous push)
                const currentIds = new Set(rows.map(r => r.id));
                const newItems = rows.filter(r => !lastSentIds.has(r.id) && !r.is_read);
                lastSentIds = currentIds;

                const payload = JSON.stringify({ notifications: rows, unread, newItems });
                res.write(`data: ${payload}\n\n`);
            } catch (_) {
                // DB error — send keepalive comment so connection stays open
                res.write(': keepalive\n\n');
            }
        };

        await push(); // immediate first push
        const interval = setInterval(push, 8000);

        req.on('close', () => {
            clearInterval(interval);
        });
    });
});

// ── PDF Download ────────────────────────────────────────────────────────────

const PDFDocument = require('pdfkit');

app.get('/api/applications/download-pdf/:appId', authenticateToken, async (req, res) => {
    try {
        const appId = req.params.appId;
        // Ownership check — only the owning student may download their application PDF
        const [appResults] = await db.query(
            'SELECT * FROM applications WHERE application_id = ? AND user_id = ?',
            [appId, req.user.id]
        );
        const application   = appResults[0];
        if (!application) return res.status(404).json({ message: 'Application not found' });

        // Enforce verified payment requirement to download the PDF form
        if (application.payment_status !== 'Success' && application.payment_status !== 'Paid') {
            return res.status(403).json({ success: false, message: 'Payment verification required to download the application form PDF.' });
        }

        const [settingsResults] = await db.query('SELECT * FROM university_settings LIMIT 1');
        const settings = settingsResults[0] || {};

        const [school]     = await db.query('SELECT * FROM school_education WHERE application_id = ?', [appId]);
        const [higher]     = await db.query('SELECT * FROM higher_education WHERE application_id = ?', [appId]);
        const [experience] = await db.query('SELECT * FROM experience_details WHERE application_id = ?', [appId]);
        const [docs]       = await db.query('SELECT * FROM application_documents WHERE application_id = ?', [appId]);

        const docMap = {};
        docs.forEach(d => { docMap[d.document_type] = d.file_path; });

        // ── constants ─────────────────────────────────────────────────────
        const PRIMARY  = '#1a3a5c';
        const ACCENT   = '#1e56a0';
        const LIGHT    = '#eef2f7';
        const GOLD     = '#c8a951';
        const MARGIN   = 40;
        const PAGE_H   = 841.89; // A4 height in pts
        const FOOTER_H = 22;
        const FOOTER_Y = PAGE_H - MARGIN - FOOTER_H + 5;
        const uniName  = settings.university_name_en || 'Periyar University';

        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: MARGIN, bottom: MARGIN + FOOTER_H + 8, left: MARGIN, right: MARGIN },
            bufferPages: true,
            autoFirstPage: true,
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=PhD_Application_${appId}.pdf`);
        doc.pipe(res);

        const PW = doc.page.width - MARGIN * 2; // usable width = 515.28 pts

        // ── helpers ──────────────────────────────────────────────────────
        const val = (v) => (v == null || v === '' || v === 'null' || v === 'undefined') ? '—' : String(v);

        // ensure enough space remains; add page if needed
        const ensureSpace = (needed) => {
            if (doc.y + needed > FOOTER_Y - 10) doc.addPage();
        };

        const sectionHeader = (title) => {
            ensureSpace(30);
            doc.moveDown(0.4);
            const ry = doc.y;
            doc.rect(MARGIN, ry, PW, 20).fill(PRIMARY);
            doc.fillColor('#fff').fontSize(10).font('Helvetica-Bold')
               .text(title, MARGIN + 6, ry + 5, { width: PW - 10, lineBreak: false });
            doc.fillColor('#000').font('Helvetica');
            doc.y = ry + 26;
        };

        // Two-column field layout: pairs = [[label, value], ...]
        const twoCol = (pairs) => {
            const colW = PW / 2 - 10;
            const LX   = MARGIN + 5;
            const RX   = MARGIN + PW / 2 + 5;
            const ROW_H = 35;

            for (let i = 0; i < pairs.length; i += 2) {
                ensureSpace(ROW_H + 5);
                const ry = doc.y;

                // Draw a subtle border for the row
                doc.rect(MARGIN, ry, PW, ROW_H).strokeColor('#e5e7eb').lineWidth(0.5).stroke();

                // left cell
                const [ll, lv] = pairs[i];
                doc.fontSize(8).fillColor('#6b7280').font('Helvetica')
                   .text(ll, LX, ry + 4, { width: colW, lineBreak: false });
                doc.fontSize(10).fillColor('#111827').font('Helvetica-Bold')
                   .text(val(lv), LX, ry + 16, { width: colW });

                // right cell (if exists)
                if (i + 1 < pairs.length) {
                    const [rl, rv] = pairs[i + 1];
                    doc.fontSize(8).fillColor('#6b7280').font('Helvetica')
                       .text(rl, RX, ry + 4, { width: colW, lineBreak: false });
                    doc.fontSize(10).fillColor('#111827').font('Helvetica-Bold')
                       .text(val(rv), RX, ry + 16, { width: colW });
                }

                doc.y = ry + ROW_H;
            }
            doc.moveDown(0.5);
        };

        // Table helpers
        const tableHeader = (cols, widths) => {
            ensureSpace(22);
            const ry = doc.y;
            doc.rect(MARGIN, ry, PW, 17).fill(PRIMARY);
            let x = MARGIN + 3;
            cols.forEach((c, i) => {
                const cw = widths ? widths[i] : PW / cols.length;
                doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold')
                   .text(c, x, ry + 4, { width: cw - 4, lineBreak: false });
                x += cw;
            });
            doc.fillColor('#000').font('Helvetica');
            doc.y = ry + 18;
        };

        const tableRow = (cells, widths, rowIdx) => {
            const ROW_H = 17;
            ensureSpace(ROW_H + 2);
            const ry = doc.y;
            if (rowIdx % 2 === 0) doc.rect(MARGIN, ry, PW, ROW_H).fill(LIGHT);
            doc.rect(MARGIN, ry, PW, ROW_H).strokeColor('#d1d5db').lineWidth(0.3).stroke();
            let x = MARGIN + 3;
            cells.forEach((c, i) => {
                const cw = widths ? widths[i] : PW / cells.length;
                doc.fillColor('#111').fontSize(8).font('Helvetica')
                   .text(val(c), x, ry + 4, { width: cw - 5, lineBreak: false });
                x += cw;
            });
            doc.y = ry + ROW_H;
            doc.fillColor('#000');
        };

        // ── DRAW LOGO (pdfkit primitives — Periyar University emblem) ────
        const drawLogo = (cx, cy, r) => {
            // outer ring
            doc.save().circle(cx, cy, r).fillColor('#1a3a5c').fill();
            doc.circle(cx, cy, r).strokeColor(GOLD).lineWidth(1.5).stroke();
            // inner circle
            doc.circle(cx, cy, r - 5).strokeColor(GOLD).lineWidth(0.8).stroke();
            // white book shape (simplified open book)
            const bw = r * 0.55, bh = r * 0.38, bx = cx - bw / 2, by = cy - bh / 2 - 3;
            doc.save()
               .moveTo(cx, by).lineTo(bx, by + bh * 0.25).lineTo(bx, by + bh)
               .lineTo(cx, by + bh * 0.75).closePath()
               .fillColor('#fff').fill();
            doc.moveTo(cx, by).lineTo(bx + bw, by + bh * 0.25).lineTo(bx + bw, by + bh)
               .lineTo(cx, by + bh * 0.75).closePath()
               .fillColor('#e0e8f0').fill();
            // spine line
            doc.moveTo(cx, by).lineTo(cx, by + bh * 0.75)
               .strokeColor(GOLD).lineWidth(0.8).stroke();
            // lamp wick above book
            doc.circle(cx, by - 4, 2.5).fillColor(GOLD).fill();
            doc.moveTo(cx, by - 6.5).lineTo(cx - 1, by - 12).lineTo(cx + 1, by - 12).closePath()
               .fillColor('#ffdd88').fill();
            doc.restore();
            // "PERIYAR UNIVERSITY" arc text approximated with straight text
            doc.save();
            doc.fillColor(GOLD).fontSize(5.2).font('Helvetica-Bold')
               .text('PERIYAR  UNIVERSITY', cx - r + 4, cy - r + 3, { width: (r - 4) * 2, align: 'center', lineBreak: false });
            doc.fillColor('#fff').fontSize(4.5).font('Helvetica')
               .text('SALEM  –  636 011', cx - r + 4, cy + r - 10, { width: (r - 4) * 2, align: 'center', lineBreak: false });
            // gold ribbon banner
            const bannerY = cy + r - 17;
            doc.rect(cx - r + 2, bannerY, (r - 2) * 2, 9).fillColor(GOLD).fill();
            doc.fillColor('#1a3a5c').fontSize(4.5).font('Helvetica-Bold')
               .text('Wisdom Maketh the World', cx - r + 2, bannerY + 2, { width: (r - 2) * 2, align: 'center', lineBreak: false });
            doc.restore();
        };

        // ── PAGE 1 HEADER ─────────────────────────────────────────────────
        const HEADER_TOP = MARGIN;
        const HEADER_H   = 90;
        doc.rect(MARGIN, HEADER_TOP, PW, HEADER_H).fill('#ffffff');

        // Draw Logo Image — resolve relative to this server file for portability
        const logoPath = path.join(__dirname, 'uploads', 'settings', 'pu_logo.png');
        const fallbackLogoPath = path.join(__dirname, '..', '..', 'frontend', 'public', 'images', 'pu_logo.png');
        const resolvedLogo = fs.existsSync(logoPath) ? logoPath : (fs.existsSync(fallbackLogoPath) ? fallbackLogoPath : null);
        if (resolvedLogo) {
            doc.image(resolvedLogo, MARGIN, HEADER_TOP + 5, { height: 80 });
        }

        // applicant photo — right side
        const photoPath = docMap['Photo']
            ? path.join(__dirname, docMap['Photo'].replace(/^\//, ''))
            : null;
        const PHOTO_W = 52, PHOTO_H = 65;
        const PHOTO_X = MARGIN + PW - PHOTO_W - 4;
        const PHOTO_Y = HEADER_TOP + (HEADER_H - PHOTO_H) / 2;
        if (photoPath && fs.existsSync(photoPath)) {
            try {
                doc.save().rect(PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H).clip();
                doc.image(photoPath, PHOTO_X, PHOTO_Y, { width: PHOTO_W, height: PHOTO_H, cover: [PHOTO_W, PHOTO_H] });
                doc.restore();
            } catch {}
        }
        doc.rect(PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H).strokeColor('#aaa').lineWidth(0.8).stroke();
        if (!photoPath || !fs.existsSync(photoPath)) {
            doc.fillColor('#ccc').fontSize(7).font('Helvetica')
               .text('Affix Photo', PHOTO_X + 3, PHOTO_Y + PHOTO_H / 2 - 5, { width: PHOTO_W - 6, align: 'center' });
        }

        // center text block
        const textX = MARGIN + 90;
        const textW = PHOTO_X - textX - 10;
        
        doc.fillColor('#0f4c81').fontSize(16).font('Helvetica-Bold')
           .text('PERIYAR UNIVERSITY', textX, HEADER_TOP + 10, { width: textW, align: 'left', lineBreak: false });
           
        doc.fillColor('#111827').fontSize(8).font('Helvetica')
           .text("State University - NAAC 'A++' Grade - NIRF Rank 94", textX, HEADER_TOP + 30, { width: textW, align: 'left', lineBreak: false });
        doc.text("State Public University Rank 40 - SDG Institutions Rank Band: 11-50", textX, HEADER_TOP + 42, { width: textW, align: 'left', lineBreak: false });
        doc.text("Salem - 636 011, Tamil Nadu, India.", textX, HEADER_TOP + 54, { width: textW, align: 'left', lineBreak: false });

        // ── FORM TITLE BANNER ────────────────────────────────────────────
        const titleY = HEADER_TOP + HEADER_H + 4;
        doc.rect(MARGIN, titleY, PW, 22).fill(ACCENT);
        doc.fillColor('#fff').fontSize(12).font('Helvetica-Bold')
           .text('APPLICATION FOR Ph.D. ADMISSION', MARGIN, titleY + 5, { width: PW, align: 'center', lineBreak: false });

        // ── META ROW ─────────────────────────────────────────────────────
        const metaY = titleY + 28;
        doc.rect(MARGIN, metaY, PW, 18).fill(LIGHT);
        doc.rect(MARGIN, metaY, PW, 18).strokeColor('#cbd5e1').lineWidth(0.4).stroke();
        doc.fillColor(PRIMARY).fontSize(8.5).font('Helvetica-Bold')
           .text(`Application No: ${val(application.application_id)}`, MARGIN + 5, metaY + 4, { continued: true, width: PW / 3 });
        doc.fillColor('#333').font('Helvetica')
           .text(`  Status: ${val(application.status)}`, { continued: true, width: PW / 3 });
        doc.fillColor('#555').fontSize(7.5)
           .text(`Generated: ${new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}`, { align: 'right', width: PW / 3 - 5 });

        // reset cursor below meta row
        doc.y = metaY + 24;
        doc.fillColor('#000').font('Helvetica');

        // ── SECTION 1: EXAM DETAILS ──────────────────────────────────────
        sectionHeader('1.  EXAMINATION DETAILS');
        let qualStr = '—';
        try { const q = application.qualified_exams; qualStr = q ? (typeof q === 'string' ? JSON.parse(q) : q).join(', ') || 'None' : 'None'; } catch {}
        twoCol([
            ['Exam Centre (First Preference)',  application.exam_center_1],
            ['Exam Centre (Second Preference)', application.exam_center_2],
            ['Subject / Discipline',            application.subject],
            ['Subject (Second)',                application.subject_2 || '—'],
            ['Category',                        application.category],
            ['Working District',                application.working_district || '—'],
            ['Qualified Examinations',          qualStr],
        ]);

        // ── SECTION 2: PERSONAL DETAILS ──────────────────────────────────
        sectionHeader('2.  PERSONAL DETAILS');
        const dobStr = application.dob
            ? new Date(application.dob).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })
            : '—';
        const pcStr = (application.is_physically_challenged === '1' || application.is_physically_challenged === 1)
            ? `Yes — ${val(application.pc_percentage)}% (${val(application.pc_type)})`
            : 'No';
        twoCol([
            ['Applicant Name (English)', application.applicant_name],
            ['Applicant Name (Tamil)',   application.applicant_name_tamil],
            ['Date of Birth',            dobStr],
            ['Gender',                   application.gender],
            ['Community',                application.community],
            ['Nationality',              application.nationality],
            ['Religion',                 application.religion],
            ['NRI',                      application.is_nri ? 'Yes' : 'No'],
            ['Physically Challenged',    pcStr],
            ['Parent / Guardian Name',   application.parent_name],
            ['ID Type',                  application.id_type],
            ['ID Number',                application.id_number],
        ]);

        // ── SECTION 3: CONTACT & ADDRESS ─────────────────────────────────
        sectionHeader('3.  CONTACT & ADDRESS DETAILS');
        const commAddr = [application.address_1, application.address_2, application.address_3].filter(Boolean).join(', ');
        const permAddr = application.perm_same_as_comm
            ? 'Same as Communication Address'
            : [application.perm_address_1, application.perm_address_2, application.perm_district, application.perm_state, application.perm_pincode].filter(Boolean).join(', ');
        twoCol([
            ['Mobile Number',            application.mobile],
            ['Phone (Landline)',          application.phone || '—'],
            ['Email Address',            application.email],
            ['Communication Address',    commAddr],
            ['District',                 application.district],
            ['State',                    application.state],
            ['Pincode',                  application.pincode],
            ['Permanent Address',        permAddr],
        ]);

        // ── SECTION 4: SCHOOL EDUCATION ──────────────────────────────────
        const validSchool = school.filter(s => s.institution_name || s.level);
        if (validSchool.length > 0) {
            sectionHeader('4.  SCHOOL EDUCATION');
            const sColW = [70, 170, 100, 80, 95];
            tableHeader(['Level', 'Institution Name', 'Board', 'Month / Year', 'Percentage'], sColW);
            validSchool.forEach((s, i) => tableRow(
                [s.level, s.institution_name, s.other_board_name || s.board_id,
                 `${s.passing_month || ''} ${s.passing_year || ''}`.trim(),
                 s.percentage ? `${s.percentage}%` : '—'],
                sColW, i
            ));
            doc.moveDown(0.4);
        }

        // ── SECTION 5: HIGHER EDUCATION ──────────────────────────────────
        const validHigher = higher.filter(h => h.institution_name || h.level);
        if (validHigher.length > 0) {
            sectionHeader('5.  HIGHER EDUCATION');
            const hColW = [70, 160, 140, 80, 65];
            tableHeader(['Level', 'Institution', 'University', 'Month / Year', 'Score'], hColW);
            validHigher.forEach((h, i) => tableRow(
                [h.level, h.institution_name, h.university_name,
                 `${h.passing_month || ''} ${h.passing_year || ''}`.trim(),
                 h.score_value ? `${h.score_value}${h.score_type ? ` (${h.score_type})` : ''}` : '—'],
                hColW, i
            ));
            doc.moveDown(0.4);
        }

        // ── SECTION 6: WORK EXPERIENCE ────────────────────────────────────
        const validExp = experience.filter(e => e.organization_name || e.designation);
        if (validExp.length > 0) {
            sectionHeader('6.  WORK EXPERIENCE');
            const eColW = [130, 150, 70, 70, 95];
            tableHeader(['Designation', 'Organisation', 'From', 'To', 'Duration'], eColW);
            validExp.forEach((e, i) => tableRow(
                [e.designation, e.organization_name,
                 `${e.from_month || ''} ${e.from_year || ''}`.trim(),
                 `${e.to_month || ''} ${e.to_year || ''}`.trim(),
                 `${e.total_years || 0}Y ${e.total_months || 0}M`],
                eColW, i
            ));
            doc.moveDown(0.4);
        }

        // ── SECTION 7: DECLARATION ────────────────────────────────────────
        sectionHeader('7.  DECLARATION');
        ensureSpace(60);
        const declY = doc.y;
        doc.rect(MARGIN, declY, PW, 1).fill('#d1d5db');
        doc.y = declY + 5;
        doc.fontSize(8.5).fillColor('#1a202c').font('Helvetica')
           .text(
               'I hereby solemnly declare that all information furnished in this application is true, complete and correct to the best of my knowledge and belief. I have not suppressed any material fact. I satisfy all the eligibility criteria prescribed for admission to the Ph.D. Programme. I understand that if any information is found to be false or incorrect at any stage, my candidature shall be liable to be cancelled. I have read and understood all instructions and conditions governing this application and agree to abide by the rules and regulations of Periyar University.',
               MARGIN + 5, doc.y, { width: PW - 10, align: 'justify' }
           );
        doc.moveDown(0.5);

        // ── SIGNATURE ROW ─────────────────────────────────────────────────
        ensureSpace(70);
        doc.moveDown(0.8);
        const sigY = doc.y;

        // Place & Date (left)
        doc.fontSize(8.5).fillColor('#333').font('Helvetica')
           .text('Place: _________________________', MARGIN, sigY)
           .text('Date:   _________________________', MARGIN, sigY + 20);

        // Signature (center-right)
        const sigPath = docMap['Signature']
            ? path.join(__dirname, docMap['Signature'].replace(/^\//, ''))
            : null;
        const sigX = MARGIN + PW / 2 - 20;
        if (sigPath && fs.existsSync(sigPath)) {
            try { doc.image(sigPath, sigX, sigY - 5, { width: 120, height: 35 }); } catch {}
        }
        doc.moveTo(sigX, sigY + 32).lineTo(sigX + 140, sigY + 32)
           .strokeColor('#555').lineWidth(0.6).stroke();
        doc.fillColor('#333').fontSize(8).font('Helvetica')
           .text('Signature of the Applicant', sigX, sigY + 35, { width: 140, align: 'center' });

        // Office seal (right)
        const sealX = MARGIN + PW - 90;
        doc.rect(sealX, sigY - 2, 85, 45).strokeColor('#aaa').lineWidth(0.5).stroke();
        doc.fillColor('#bbb').fontSize(7).font('Helvetica')
           .text('For Office Use Only', sealX + 5, sigY + 16, { width: 75, align: 'center' });

        // ── FOOTERS on every buffered page ────────────────────────────────
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
            doc.switchToPage(range.start + i);
            // thin top line of footer
            doc.rect(MARGIN, FOOTER_Y, PW, 1).fill('#3b6194');
            doc.rect(MARGIN, FOOTER_Y + 1, PW, FOOTER_H - 2).fill(PRIMARY);
            doc.fillColor('#fff').fontSize(7.5).font('Helvetica')
               .text(
                   `${uniName}  |  Ph.D. Admission Application  |  ${appId}  |  Page ${i + 1} of ${range.count}`,
                   MARGIN + 4, FOOTER_Y + 7, { width: PW - 8, align: 'center', lineBreak: false }
               );
        }

        doc.end();
    } catch (err) {
        console.error('PDF generation error:', err);
        if (!res.headersSent) res.status(500).json({ message: 'Error generating PDF' });
    }
});

// ─── DROPDOWNS & SETTINGS ──────────────────────────────────────────────
app.get('/api/dropdowns/settings', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM university_settings LIMIT 1');
        res.json(rows[0] || {});
    } catch (err) { res.status(500).json(err); }
});

app.get('/api/dropdowns/:table', async (req, res) => {
    const { table } = req.params;
    const valid = ['exam_centers', 'subjects', 'categories', 'districts', 'genders', 'communities', 'id_types', 'score_types', 'mark_statement_types'];
    if (!valid.includes(table)) return res.status(400).json({ message: 'Invalid table' });
    try {
        const [rows] = await db.query(`SELECT * FROM dropdown_${table} ORDER BY name ASC`);
        res.json(rows);
    } catch (err) { res.status(500).json(err); }
});

// ─── STATES & DISTRICTS (public — used by student application form) ─────────
app.get('/api/states', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, state_name FROM states ORDER BY state_name ASC');
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.get('/api/districts', async (req, res) => {
    const { state_id, state_name } = req.query;
    try {
        let rows;
        if (state_id) {
            [rows] = await db.query(
                'SELECT id, district_name FROM districts WHERE state_id = ? ORDER BY district_name ASC',
                [state_id]
            );
        } else if (state_name) {
            [rows] = await db.query(
                `SELECT d.id, d.district_name FROM districts d
                 JOIN states s ON d.state_id = s.id
                 WHERE s.state_name = ? ORDER BY d.district_name ASC`,
                [state_name]
            );
        } else {
            [rows] = await db.query('SELECT id, district_name FROM districts ORDER BY district_name ASC');
        }
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─── FILE UPLOAD SETTINGS (public — for frontend validation) ────────────────
app.get('/api/file-upload-settings', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM file_upload_settings');
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─── ADMIN MASTER DATA MANAGEMENT ──────────────────────────────────────────
const masterTables = ['education_boards', 'degree_types', 'university_types', 'specializations', 'employment_types'];

masterTables.forEach(table => {
    // Get all (including inactive for admin)
    app.get(`/api/admin/master/${table}`, authenticateToken, async (req, res) => {
        if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
        try {
            const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY id DESC`);
            res.json(rows);
        } catch (err) { res.status(500).json(err); }
    });

    // Create
    app.post(`/api/admin/master/${table}`, authenticateToken, async (req, res) => {
        if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
        try {
            const [result] = await db.query(`INSERT INTO ${table} SET ?`, req.body);
            res.json({ id: result.insertId, ...req.body });
        } catch (err) { res.status(500).json(err); }
    });

    // Update
    app.put(`/api/admin/master/${table}/:id`, authenticateToken, async (req, res) => {
        if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
        try {
            await db.query(`UPDATE ${table} SET ? WHERE id = ?`, [req.body, req.params.id]);
            res.json({ message: 'Updated successfully' });
        } catch (err) { res.status(500).json(err); }
    });

    // Delete
    app.delete(`/api/admin/master/${table}/:id`, authenticateToken, async (req, res) => {
        if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
        try {
            await db.query(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
            res.json({ message: 'Deleted successfully' });
        } catch (err) { res.status(500).json(err); }
    });
});

// ─── QUALIFICATION TYPES (public — used by student application form) ─────────
app.get('/api/qualifications', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, qualification_name, is_exemption, display_order
             FROM qualification_types
             WHERE is_active = 1
             ORDER BY display_order ASC, qualification_name ASC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── ACTIVE SESSION (public) ─────────────────────────────────────────────────
app.get('/api/active-session', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, year, month, is_active, registration_open, application_open, result_published,
                    CONCAT(month, ' ', year) AS session_name
             FROM sessions WHERE is_active = 1 LIMIT 1`
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'No active session' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── COUNSELLING — Student Routes ────────────────────────────────────────────

// ─── CounsellingAccessEngine — Centralized counselling eligibility + date access control ───
async function checkCounsellingEligibility(userId) {
    // 1. Fetch settings and application state
    const [settingsRows] = await db.query(
        'SELECT entrance_result_publish FROM university_settings LIMIT 1'
    );
    const settings = settingsRows[0] || {};

    const [appRows] = await db.query(
        `SELECT final_result_status, qualification_status, counselling_approval,
                entrance_exam_status, payment_status, status, direct_pass_status,
                session_id, result_published_at
         FROM applications WHERE user_id = ? LIMIT 1`,
        [userId]
    );
    const app = appRows[0];
    if (!app) return { eligible: false, status: 404, message: 'No application found.' };

    const isExempted   = app.entrance_exam_status === 'Exempted';
    const isDirectPass = app.direct_pass_status   === 'DirectPass';

    // [GATE 1] Result — PASS via entrance OR direct qualification
    const gateA_pass = (
        app.final_result_status === 'PASS' || isDirectPass || isExempted ||
        ['Qualified', 'Direct Qualified'].includes(app.qualification_status)
    );
    if (!gateA_pass) {
        const msg = app.final_result_status === 'FAIL' 
            ? 'You are not eligible for counselling (Result: FAIL).' 
            : 'Your entrance examination marks are still being processed.';
        return { eligible: false, status: 403, message: msg };
    }

    // [GATE 2] Payment — Must be Paid
    if (app.payment_status !== 'Paid') {
        return { eligible: false, status: 403, message: 'Your admission fee payment has not been verified yet.' };
    }

    // [GATE 3] Publication — Results must be published
    const resultPublished = !!app.result_published_at || !!settings.entrance_result_publish;
    if (!resultPublished) {
        return { eligible: false, status: 403, message: 'Entrance exam results have not been published yet.' };
    }

    // [GATE 4] Date Window
    if (!app.session_id) return { eligible: false, status: 404, message: 'No session assigned to your application.' };
    
    const [csRows] = await db.query(
        `SELECT start_date, end_date FROM counselling_settings 
         WHERE session_id = ? AND is_active = 1 LIMIT 1`,
        [app.session_id]
    );
    
    if (!csRows[0]) {
        return { eligible: false, status: 404, message: 'Counselling window is not configured for your session.' };
    }

    const rowStart = csRows[0].start_date;
    const rowEnd   = csRows[0].end_date;
    const startStr = rowStart instanceof Date ? rowStart.toISOString().split('T')[0] : String(rowStart).split('T')[0];
    const endStr   = rowEnd instanceof Date   ? rowEnd.toISOString().split('T')[0]   : String(rowEnd).split('T')[0];
    const today    = new Date().toISOString().split('T')[0];

    if (today < startStr) {
        return { eligible: false, status: 403, message: `Counselling starts on ${startStr}. Please check back then.` };
    }
    if (today > endStr) {
        return { eligible: false, status: 403, message: `Counselling closed on ${endStr}.` };
    }

    return { eligible: true };
}

// GET /api/counselling/settings — active counselling settings for current session
app.get('/api/counselling/settings', authenticateToken, async (req, res) => {
    try {
        const eligibility = await checkCounsellingEligibility(req.user.id);
        if (!eligibility.eligible) {
            return res.status(eligibility.status).json({
                success: false,
                message: eligibility.message,
                qualification_status: eligibility.interview_status || 'Pending'
            });
        }

        const [userRows] = await db.query('SELECT session_id FROM users WHERE id = ?', [req.user.id]);
        const sessionId = userRows[0]?.session_id;
        if (!sessionId) return res.status(404).json({ success: false, message: 'No session assigned' });

        const [rows] = await db.query(
            'SELECT * FROM counselling_settings WHERE session_id = ? AND is_active = 1 LIMIT 1',
            [sessionId]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Counselling not configured for your session' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/counselling/research-centers — active centers (public)
app.get('/api/counselling/research-centers', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, center_name FROM research_centers WHERE is_active = 1 ORDER BY center_name'
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/counselling/research-supervisors?center_id= — active supervisors for center
app.get('/api/counselling/research-supervisors', async (req, res) => {
    const { center_id } = req.query;
    if (!center_id) return res.status(400).json({ success: false, message: 'center_id required' });
    try {
        const [rows] = await db.query(
            `SELECT id, supervisor_name, designation, department
             FROM research_supervisors
             WHERE research_center_id = ? AND is_active = 1
             ORDER BY supervisor_name`,
            [center_id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/counselling/my-application — get student's counselling application
app.get('/api/counselling/my-application', authenticateToken, async (req, res) => {
    try {
        const eligibility = await checkCounsellingEligibility(req.user.id);
        if (!eligibility.eligible) {
            return res.status(eligibility.status).json({
                success: false,
                message: eligibility.message
            });
        }

        const [userRows] = await db.query('SELECT session_id FROM users WHERE id = ?', [req.user.id]);
        const sessionId = userRows[0]?.session_id;

        const [rows] = await db.query(
            'SELECT * FROM counselling_applications WHERE user_id = ? AND session_id = ? LIMIT 1',
            [req.user.id, sessionId]
        );
        if (rows.length === 0) return res.json({ success: true, data: null });

        const app = rows[0];
        const [choices] = await db.query(
            `SELECT crc.*, rc.center_name, rs.supervisor_name, rs.designation
             FROM counselling_research_choices crc
             JOIN research_centers rc ON crc.research_center_id = rc.id
             JOIN research_supervisors rs ON crc.supervisor_id = rs.id
             WHERE crc.counselling_application_id = ?
             ORDER BY crc.preference_order`,
            [app.id]
        );
        app.choices = choices;
        res.json({ success: true, data: app });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/counselling/save — save/update counselling draft
app.post('/api/counselling/save', authenticateToken, async (req, res) => {
    const { choices } = req.body;
    if (!Array.isArray(choices) || choices.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one research preference required' });
    }

    try {
        const eligibility = await checkCounsellingEligibility(req.user.id);
        if (!eligibility.eligible) {
            return res.status(eligibility.status).json({
                success: false,
                message: eligibility.message
            });
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }

    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
        const [userRows] = await conn.query('SELECT session_id FROM users WHERE id = ?', [req.user.id]);
        const sessionId = userRows[0]?.session_id;
        if (!sessionId) throw new Error('No session assigned to user');

        // Check counselling settings
        const [settingsRows] = await conn.query(
            'SELECT * FROM counselling_settings WHERE session_id = ? AND is_active = 1 LIMIT 1',
            [sessionId]
        );
        if (settingsRows.length === 0) throw new Error('Counselling is not open for your session');

        const settings = settingsRows[0];
        const today = new Date().toISOString().split('T')[0];
        if (today < settings.start_date) throw new Error('Counselling application has not started yet');
        if (today > settings.end_date)   throw new Error('Counselling application is closed');
        if (choices.length > settings.max_research_choices)
            throw new Error(`Maximum ${settings.max_research_choices} research preferences allowed`);

        // Duplicate check
        const supervisorIds = choices.map(c => c.supervisor_id);
        if (new Set(supervisorIds).size !== supervisorIds.length)
            throw new Error('Duplicate supervisor selections are not allowed');

        // Upsert counselling application
        let caId;
        const [existing] = await conn.query(
            'SELECT id FROM counselling_applications WHERE user_id = ? AND session_id = ?',
            [req.user.id, sessionId]
        );
        if (existing.length > 0) {
            caId = existing[0].id;
            await conn.query(
                'UPDATE counselling_applications SET counselling_setting_id = ?, updated_at = NOW() WHERE id = ?',
                [settings.id, caId]
            );
        } else {
            const [result] = await conn.query(
                'INSERT INTO counselling_applications (user_id, session_id, counselling_setting_id, status) VALUES (?, ?, ?, "Draft")',
                [req.user.id, sessionId, settings.id]
            );
            caId = result.insertId;
        }

        // Replace choices
        await conn.query('DELETE FROM counselling_research_choices WHERE counselling_application_id = ?', [caId]);
        for (let i = 0; i < choices.length; i++) {
            await conn.query(
                'INSERT INTO counselling_research_choices (counselling_application_id, research_center_id, supervisor_id, preference_order) VALUES (?, ?, ?, ?)',
                [caId, choices[i].research_center_id, choices[i].supervisor_id, i + 1]
            );
        }

        await conn.commit();
        res.json({ success: true, message: 'Counselling application saved', id: caId });
    } catch (err) {
        await conn.rollback();
        res.status(400).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// POST /api/counselling/submit — final submit
app.post('/api/counselling/submit', authenticateToken, async (req, res) => {
    try {
        const eligibility = await checkCounsellingEligibility(req.user.id);
        if (!eligibility.eligible) {
            return res.status(eligibility.status).json({
                success: false,
                message: eligibility.message
            });
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }

    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
        const [userRows] = await conn.query('SELECT session_id FROM users WHERE id = ?', [req.user.id]);
        const sessionId = userRows[0]?.session_id;

        const [rows] = await conn.query(
            'SELECT * FROM counselling_applications WHERE user_id = ? AND session_id = ?',
            [req.user.id, sessionId]
        );
        if (rows.length === 0) throw new Error('No counselling application found. Please save first.');
        if (rows[0].status === 'Submitted') throw new Error('Already submitted');

        // Validate at least one choice
        const [choices] = await conn.query(
            'SELECT id FROM counselling_research_choices WHERE counselling_application_id = ?',
            [rows[0].id]
        );
        if (choices.length === 0) throw new Error('Add at least one research preference before submitting');

        await conn.query(
            'UPDATE counselling_applications SET status = "Submitted", submitted_at = NOW(), updated_at = NOW() WHERE id = ?',
            [rows[0].id]
        );
        await conn.commit();
        res.json({ success: true, message: 'Counselling application submitted successfully' });
    } catch (err) {
        await conn.rollback();
        res.status(400).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// GET /api/counselling/my-allotment — student's allotment result
app.get('/api/counselling/my-allotment', authenticateToken, async (req, res) => {
    try {
        const [userRows] = await db.query('SELECT session_id FROM users WHERE id = ?', [req.user.id]);
        const sessionId = userRows[0]?.session_id;
        if (!sessionId) return res.status(404).json({ success: false, message: 'No session assigned' });

        const [rows] = await db.query(
            `SELECT ca.id, ca.status, ca.allotment_status, ca.allotted_at,
                    ca.allotment_remarks, ca.allotted_center_id, ca.allotted_supervisor_id,
                    rc.center_name AS allotted_center_name,
                    rs.supervisor_name AS allotted_supervisor_name,
                    rs.designation AS allotted_supervisor_designation
             FROM counselling_applications ca
             LEFT JOIN research_centers rc ON ca.allotted_center_id = rc.id
             LEFT JOIN research_supervisors rs ON ca.allotted_supervisor_id = rs.id
             WHERE ca.user_id = ? AND ca.session_id = ?
             LIMIT 1`,
            [req.user.id, sessionId]
        );
        if (rows.length === 0) return res.json({ success: false, message: 'No counselling application found' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── APPLICATION REVIEW & FINAL SUBMIT ──────────────────────────────────────

// GET /api/application/review — full structured review data for the logged-in student
app.get('/api/application/review', authenticateToken, async (req, res) => {
    try {
        const [userRows] = await db.query('SELECT application_id FROM users WHERE id = ?', [req.user.id]);
        if (!userRows.length) return res.status(404).json({ success: false, message: 'User not found' });
        const appId = userRows[0].application_id;

        const [apps] = await db.query('SELECT * FROM applications WHERE application_id = ?', [appId]);
        if (!apps.length) return res.status(404).json({ success: false, message: 'Application not found' });

        const application = apps[0];
        const [school]     = await db.query('SELECT * FROM school_education WHERE application_id = ?', [appId]);
        const [higher]     = await db.query('SELECT * FROM higher_education WHERE application_id = ?', [appId]);
        const [experience] = await db.query('SELECT * FROM experience_details WHERE application_id = ?', [appId]);
        const [docs]       = await db.query('SELECT * FROM application_documents WHERE application_id = ? OR user_id = ?', [appId, req.user.id]);

        // Self-healing email synchronization
        if (!application.email) {
            const [userEmailRow] = await db.query('SELECT email FROM users WHERE id = ?', [req.user.id]);
            if (userEmailRow.length > 0 && userEmailRow[0].email) {
                application.email = userEmailRow[0].email;
                await db.query('UPDATE applications SET email = ? WHERE application_id = ?', [application.email, appId]);
            }
        }

        // Self-healing: sync any existing documents to school_education or higher_education tables
        for (const doc of docs) {
            const filePath = doc.file_path;
            if ((doc.document_type === 'school_education.0_marksheet' || doc.document_type === 'sslc_marksheet') && school.length > 0) {
                const sslcRow = school.find(s => s.level === 'SSLC');
                if (sslcRow && !sslcRow.marksheet_path) {
                    sslcRow.marksheet_path = filePath;
                    await db.query('UPDATE school_education SET marksheet_path = ? WHERE application_id = ? AND level = "SSLC"', [filePath, appId]);
                }
            }
            if ((doc.document_type === 'school_education.1_marksheet' || doc.document_type === 'hsc_marksheet') && school.length > 0) {
                const hscRow = school.find(s => s.level === 'HSC');
                if (hscRow && !hscRow.marksheet_path) {
                    hscRow.marksheet_path = filePath;
                    await db.query('UPDATE school_education SET marksheet_path = ? WHERE application_id = ? AND level = "HSC"', [filePath, appId]);
                }
            }
            if ((doc.document_type === 'ug_consolidated' || doc.document_type === 'ug_marksheet' || doc.document_type.startsWith('ug_sem_')) && higher.length > 0) {
                const ugRow = higher.find(h => h.level === 'UG');
                if (ugRow && (!ugRow.marksheet_path || !ugRow.consolidated_marksheet_path)) {
                    ugRow.marksheet_path = filePath;
                    ugRow.consolidated_marksheet_path = filePath;
                    await db.query('UPDATE higher_education SET marksheet_path = ?, consolidated_marksheet_path = ? WHERE application_id = ? AND level = "UG"', [filePath, filePath, appId]);
                }
            }
            if ((doc.document_type === 'pg_consolidated' || doc.document_type === 'pg_marksheet' || doc.document_type.startsWith('pg_sem_')) && higher.length > 0) {
                const pgRow = higher.find(h => h.level === 'PG');
                if (pgRow && (!pgRow.marksheet_path || !pgRow.consolidated_marksheet_path)) {
                    pgRow.marksheet_path = filePath;
                    pgRow.consolidated_marksheet_path = filePath;
                    await db.query('UPDATE higher_education SET marksheet_path = ?, consolidated_marksheet_path = ? WHERE application_id = ? AND level = "PG"', [filePath, filePath, appId]);
                }
            }
        }

        const hasDoc = (type) => docs.some(d => d.document_type?.toLowerCase() === type.toLowerCase());

        const [uploadSettings] = await db.query('SELECT file_type, is_active FROM file_upload_settings');
        const settingsMap = {};
        uploadSettings.forEach(s => { settingsMap[s.file_type] = s.is_active !== 0; });

        const isSslcActive = settingsMap['10th Standard Marksheet'] !== false;
        const isHscActive = settingsMap['12th Standard Marksheet'] !== false;
        const isUgActive = settingsMap['UG Degree Documents'] !== false;
        const isPgActive = settingsMap['PG Degree Documents'] !== false;

        const isPhotoActive = settingsMap['Photo'] !== false;
        const isSigActive = settingsMap['Signature'] !== false;
        const isIdActive = settingsMap['ID Proof'] !== false;
        const isCcActive = settingsMap['Community Certificate'] !== false;
        const isPcActive = settingsMap['PC Certificate'] !== false;

        const hasSslcChecked = application.has_sslc !== 0;
        const hasHscChecked = application.has_hsc !== 0;
        const hasUgChecked = application.has_ug !== 0;
        const hasPgChecked = application.has_pg !== 0;

        // Check school education details
        const sslc = school.find(s => s.level === 'SSLC') || {};
        const hsc = school.find(s => s.level === 'HSC') || {};
        const isSslcOk = (!isSslcActive || !hasSslcChecked) || !!(sslc.institution_name && sslc.board_id && sslc.passing_year && sslc.percentage && sslc.marksheet_path);
        const isHscOk = (!isHscActive || !hasHscChecked) || !!(hsc.institution_name && hsc.board_id && hsc.passing_year && hsc.percentage && hsc.marksheet_path);

        // Check higher education details
        const ug = higher.find(h => h.level === 'UG') || {};
        const pg = higher.find(h => h.level === 'PG') || {};
        const isUgOk = (!isUgActive || !hasUgChecked) || !!(ug.institution_name && ug.degree_id && ug.passing_year && ug.score_value && (ug.marksheet_path || ug.consolidated_marksheet_path));
        const isPgOk = (!isPgActive || !hasPgChecked) || !!(pg.institution_name && pg.degree_id && pg.passing_year && pg.score_value && (pg.marksheet_path || pg.consolidated_marksheet_path));

        const isPcEnabled = [1, '1', 'Yes'].includes(application.is_physically_challenged);
        const checks = {
            personalInfo: !!(application.applicant_name && application.dob && application.gender && application.community),
            contactInfo:  !!(application.mobile && application.email && application.address_1 && application.state && application.district && application.pincode),
            academicInfo: !!(application.subject && application.exam_center_1 && application.exam_center_2 && isSslcOk && isHscOk && isUgOk && isPgOk),
            documents:    (!isPhotoActive || hasDoc('photo')) && 
                          (!isSigActive || hasDoc('signature')) && 
                          (!isIdActive || hasDoc('id_proof')) && 
                          (!isPcEnabled || !isPcActive || hasDoc('pc_cert')) &&
                          (application.community === 'OC' || !isCcActive || hasDoc('community_cert')),
        };

        const missingFields = {
            personalInfo: [],
            contactInfo: [],
            academicInfo: [],
            documents: []
        };

        if (!application.applicant_name) missingFields.personalInfo.push('Applicant Name');
        if (!application.dob) missingFields.personalInfo.push('Date of Birth');
        if (!application.gender) missingFields.personalInfo.push('Gender');
        if (!application.community) missingFields.personalInfo.push('Community');

        if (!application.mobile) missingFields.contactInfo.push('Mobile Number');
        if (!application.email) missingFields.contactInfo.push('Email Address');
        if (!application.address_1) missingFields.contactInfo.push('Communication Address');
        if (!application.state) missingFields.contactInfo.push('State');
        if (!application.district) missingFields.contactInfo.push('District');
        if (!application.pincode) missingFields.contactInfo.push('Pincode');

        if (!application.subject) missingFields.academicInfo.push('Subject / Discipline');
        if (!application.exam_center_1) missingFields.academicInfo.push('Exam Center Preference 1');
        if (!application.exam_center_2) missingFields.academicInfo.push('Exam Center Preference 2');
        if (!isSslcOk) missingFields.academicInfo.push('SSLC (10th) Details & Marksheet');
        if (!isHscOk) missingFields.academicInfo.push('HSC (12th) Details & Marksheet');
        if (!isUgOk) missingFields.academicInfo.push('UG Details & Marksheet');
        if (!isPgOk) missingFields.academicInfo.push('PG Details & Marksheet');

        if (!hasDoc('photo')) missingFields.documents.push('Passport Photo');
        if (!hasDoc('signature')) missingFields.documents.push('Signature');
        if (!hasDoc('id_proof')) missingFields.documents.push('ID Proof');
        if (isPcEnabled && !hasDoc('pc_cert')) missingFields.documents.push('PC Certificate');

        const totalRequired = isPcEnabled ? 21 : 20;
        const missingCount = missingFields.personalInfo.length + missingFields.contactInfo.length + missingFields.academicInfo.length + missingFields.documents.length;
        const completionPct = Math.max(0, Math.round(((totalRequired - missingCount) / totalRequired) * 100));

        res.json({
            success: true,
            data: { 
                ...application, 
                final_submitted_at: application.submitted_at || application.payment_completed_at,
                school_education: school, 
                higher_education: higher, 
                experience_details: experience, 
                documents: docs 
            },
            completion: { checks, percentage: completionPct, missingFields }
        });
    } catch (err) {
        console.error('Review fetch error:', err);
        res.status(500).json({ success: false, message: 'Error fetching review data' });
    }
});

// POST /api/application/final-submit — validate and mark AWAITING_PAYMENT (deferred payment flow)
// payment_decision: 'pay_now' | 'pay_later'  (required)
// Application is NOT locked here — only locked after payment succeeds.
app.post('/api/application/final-submit', authenticateToken, async (req, res) => {
    const { declarationAccepted, payment_decision } = req.body;
    if (!declarationAccepted) {
        return res.status(400).json({ success: false, message: 'You must accept the declaration before submitting.' });
    }
    if (!['pay_now', 'pay_later'].includes(payment_decision)) {
        return res.status(400).json({ success: false, message: 'payment_decision must be pay_now or pay_later.' });
    }

    try {
        const [userRows] = await db.query('SELECT application_id FROM users WHERE id = ?', [req.user.id]);
        if (!userRows.length) return res.status(404).json({ success: false, message: 'User not found' });
        const appId = userRows[0].application_id;

        const [apps] = await db.query('SELECT * FROM applications WHERE application_id = ?', [appId]);
        if (!apps.length) return res.status(404).json({ success: false, message: 'Application not found' });

        const application = apps[0];

        // Already fully submitted & locked after payment — cannot re-submit
        if (application.final_submitted || application.is_locked) {
            return res.status(400).json({ success: false, message: 'Application has already been submitted and locked after payment.' });
        }

        // Already awaiting payment — idempotent: just update decision if needed
        if (application.status === 'AWAITING_PAYMENT' || application.status === 'PAYMENT_PENDING') {
            if (application.payment_decision !== payment_decision) {
                await db.query(
                    `UPDATE applications SET payment_decision = ?, updated_at = NOW() WHERE application_id = ?`,
                    [payment_decision, appId]
                );
            }
            return res.json({
                success: true,
                status: application.status,
                payment_decision,
                payment_due_date: application.payment_due_date,
                message: payment_decision === 'pay_now'
                    ? 'Application ready. Redirecting to payment...'
                    : 'Payment decision saved. You can pay before the deadline.',
                application_id: appId,
            });
        }

        // Session must allow submissions
        const [sessionCheck] = await db.query(
            `SELECT s.application_open FROM users u JOIN sessions s ON u.session_id = s.id WHERE u.id = ?`,
            [req.user.id]
        );
        if (!sessionCheck.length || !sessionCheck[0].application_open) {
            return res.status(403).json({ success: false, message: 'Application submissions are currently closed. Please try again later.' });
        }

        // Mandatory field validation
        const [school] = await db.query('SELECT * FROM school_education WHERE application_id = ?', [appId]);
        const [higher] = await db.query('SELECT * FROM higher_education WHERE application_id = ?', [appId]);
        const [docs]   = await db.query('SELECT * FROM application_documents WHERE application_id = ? OR user_id = ?', [appId, req.user.id]);

        const hasDoc = (type) => docs.some(d => d.document_type?.toLowerCase() === type.toLowerCase());

        const [uploadSettings] = await db.query('SELECT file_type, is_active FROM file_upload_settings');
        const settingsMap = {};
        uploadSettings.forEach(s => { settingsMap[s.file_type] = s.is_active !== 0; });

        const isSslcActive = settingsMap['10th Standard Marksheet'] !== false;
        const isHscActive = settingsMap['12th Standard Marksheet'] !== false;
        const isUgActive = settingsMap['UG Degree Documents'] !== false;
        const isPgActive = settingsMap['PG Degree Documents'] !== false;

        const isPhotoActive = settingsMap['Photo'] !== false;
        const isSigActive = settingsMap['Signature'] !== false;
        const isIdActive = settingsMap['ID Proof'] !== false;
        const isCcActive = settingsMap['Community Certificate'] !== false;
        const isPcActive = settingsMap['PC Certificate'] !== false;

        const hasSslcChecked = application.has_sslc !== 0;
        const hasHscChecked = application.has_hsc !== 0;
        const hasUgChecked = application.has_ug !== 0;
        const hasPgChecked = application.has_pg !== 0;

        const sslc = school.find(s => s.level === 'SSLC') || {};
        const hsc  = school.find(s => s.level === 'HSC')  || {};
        const isSslcOk = (!isSslcActive || !hasSslcChecked) || !!(sslc.institution_name && sslc.board_id && sslc.passing_year && sslc.percentage && sslc.marksheet_path);
        const isHscOk  = (!isHscActive || !hasHscChecked)  || !!(hsc.institution_name  && hsc.board_id  && hsc.passing_year  && hsc.percentage  && hsc.marksheet_path);

        const ug = higher.find(h => h.level === 'UG') || {};
        const pg = higher.find(h => h.level === 'PG') || {};
        const isUgOk = (!isUgActive || !hasUgChecked) || !!(ug.institution_name && ug.degree_id && ug.passing_year && ug.score_value && (ug.marksheet_path || ug.consolidated_marksheet_path));
        const isPgOk = (!isPgActive || !hasPgChecked) || !!(pg.institution_name && pg.degree_id && pg.passing_year && pg.score_value && (pg.marksheet_path || pg.consolidated_marksheet_path));

        const missing = [];
        if (!application.applicant_name) missing.push('Applicant Name');
        if (!application.dob)            missing.push('Date of Birth');
        if (!application.gender)         missing.push('Gender');
        if (!application.community)      missing.push('Community');
        if (!application.mobile)         missing.push('Mobile Number');
        if (!application.email)          missing.push('Email Address');
        if (!application.address_1)      missing.push('Address Line 1');
        if (!application.state)          missing.push('State');
        if (!application.district)       missing.push('District');
        if (!application.pincode)        missing.push('Pincode');
        if (!application.subject)        missing.push('Subject / Discipline');
        if (!application.exam_center_1)  missing.push('Exam Center Preference 1');
        if (!application.exam_center_2)  missing.push('Exam Center Preference 2');
        if (isSslcActive && hasSslcChecked && !isSslcOk) missing.push('SSLC (10th) Details & Marksheet');
        if (isHscActive && hasHscChecked && !isHscOk)  missing.push('HSC (12th) Details & Marksheet');
        if (isUgActive && hasUgChecked && !isUgOk)   missing.push('UG Details & Marksheet');
        if (isPgActive && hasPgChecked && !isPgOk)   missing.push('PG Details & Marksheet');
        if (isPhotoActive && !hasDoc('photo'))     missing.push('Passport Photo');
        if (isSigActive && !hasDoc('signature')) missing.push('Signature');
        if (isIdActive && !hasDoc('id_proof'))  missing.push('ID Proof');
        if (application.community !== 'OC' && isCcActive && !hasDoc('community_cert')) missing.push('Community Certificate');
        if ([1, '1', 'Yes'].includes(application.is_physically_challenged) && isPcActive && !hasDoc('pc_cert')) {
            missing.push('PC Certificate');
        }

        if (missing.length > 0) {
            return res.status(400).json({ success: false, message: 'Please complete all mandatory fields before submitting.', missingFields: missing });
        }

        // Fetch payment_due_days from settings (default 7)
        const [[settingsRow]] = await db.query('SELECT payment_due_days FROM university_settings LIMIT 1');
        const dueDays = Math.max(1, parseInt(settingsRow?.payment_due_days || 7, 10));
        const paymentDueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);

        await db.query(
            `UPDATE applications
             SET declaration_accepted = 1,
                 status = 'AWAITING_PAYMENT',
                 payment_status = 'Pending',
                 payment_decision = ?,
                 payment_due_date = ?,
                 updated_at = NOW()
             WHERE application_id = ?`,
            [payment_decision, paymentDueDate, appId]
        );

        res.json({
            success: true,
            status: 'AWAITING_PAYMENT',
            payment_decision,
            payment_due_date: paymentDueDate.toISOString(),
            message: payment_decision === 'pay_now'
                ? 'Application validated. Redirecting to payment...'
                : `Application saved. You have ${dueDays} days to complete payment.`,
            application_id: appId,
        });
    } catch (err) {
        console.error('Final submit error:', err);
        res.status(500).json({ success: false, message: 'Error submitting application. Please try again.' });
    }
});

// --- Enterprise Dynamic Part-Time Configuration Engine ---
app.get('/api/part-time/categories', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT id, category_name as name, category_hint, category_reference_code FROM part_time_categories WHERE status = 1 ORDER BY category_reference_code ASC");
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.get('/api/part-time/categories/:catId/roles', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT id, role_name as name, role_hint FROM part_time_roles WHERE category_id = ? AND status = 1 ORDER BY role_name ASC", [req.params.catId]);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.get('/api/part-time/roles/:roleId/areas', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT id, eligible_area_name as name FROM part_time_eligible_areas WHERE role_id = ? AND status = 1 ORDER BY eligible_area_name ASC", [req.params.roleId]);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.get('/api/part-time/global-guidance', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT file_name, document_type, uploaded_at FROM global_part_time_guidance LIMIT 1");
        if (rows.length === 0) {
            return res.json({ success: true, data: null });
        }
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/part-time/global-guidance/preview', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query("SELECT file_path, document_type, file_name FROM global_part_time_guidance LIMIT 1");
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Guidance document not found' });
        }
        
        const doc = rows[0];
        // Resolve absolute path pointing to the admin uploads folder
        const absolutePath = path.resolve(__dirname, '../../admin/backend', doc.file_path);
        
        // Security check: path traversal prevention
        const allowedDir = path.resolve(__dirname, '../../admin/backend/uploads');
        if (!absolutePath.startsWith(allowedDir)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        // Student preview audit log
        try {
            await db.query(
                'INSERT INTO settings_audit_logs (action, field_name, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
                [
                    'Preview Global Guidance Document (Student)',
                    'global_guidance_doc',
                    `Student User ID: ${req.user.id}, File: ${doc.file_name}`,
                    req.ip || null,
                    req.headers['user-agent'] || null
                ]
            );
        } catch (_) {}

        res.setHeader('Content-Type', doc.document_type === 'pdf' ? 'application/pdf' : `image/${doc.document_type}`);
        res.setHeader('Content-Disposition', `inline; filename="${doc.file_name}"`);
        fs.createReadStream(absolutePath).pipe(res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Districts for a selected working-area/state (dynamic dependency)
app.get('/api/part-time/areas/:areaId/districts', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, district_name as name FROM part_time_area_districts WHERE area_id = ? AND status = 1 ORDER BY district_name ASC',
            [req.params.areaId]
        );
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Legacy backward compatibility (Shallow Category Fetch)
app.get('/api/part-time-configurations', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT id, category_name FROM part_time_categories WHERE status = 1 ORDER BY category_reference_code ASC");
        res.json(rows);
    } catch (err) {
        console.error('Error fetching part time configurations:', err);
        res.status(500).json({ message: 'Error fetching part time configurations' });
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('GLOBAL ERROR:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// --- NOTIFICATIONS ROUTES ---
const notificationRouter = express.Router();

// Get user notifications
notificationRouter.get('/', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT * FROM notifications 
             WHERE user_id = ? AND target_type = 'student' 
             ORDER BY created_at DESC LIMIT 50`,
            [req.user.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
    }
});

// Mark notification as read
notificationRouter.put('/:id/read', authenticateToken, async (req, res) => {
    try {
        await db.query(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ? AND target_type = "student"',
            [req.params.id, req.user.id]
        );
        res.json({ success: true, message: 'Notification marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update notification' });
    }
});

// Bulk mark as read
notificationRouter.put('/mark-all-read', authenticateToken, async (req, res) => {
    try {
        await db.query(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND target_type = "student"',
            [req.user.id]
        );
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update notifications' });
    }
});

app.use('/api/notifications', notificationRouter);

// ── Test Email Endpoint (Brevo Verification) ──────────────────────────────────
app.get('/api/test-email', async (req, res) => {
    try {
        const targetEmail = req.query.to || req.query.email;
        if (!targetEmail) {
            return res.status(400).json({ success: false, message: 'Missing target email address. Please supply "?to=email@example.com"' });
        }
        
        console.log(`[Test Email Endpoint] Initiating test to ${targetEmail}`);
        
        const { sendTransacEmail } = require('../../backend/src/services/emailService');
        const info = await sendTransacEmail({
            to: targetEmail,
            subject: 'Brevo Transactional Test Email — PhD Portal',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #2563eb;">⚡ Brevo Transactional Email Active</h2>
                    <p>Congratulations! This test email has been successfully sent via the **Brevo (Sendinblue)** Transactional API over secure HTTPS (Port 443).</p>
                    <p style="margin-top: 20px; color: #666; font-size: 13px;">This verifies that your Render deployment is completely production-ready and bypasses SMTP port blocking!</p>
                </div>
            `,
            text: 'Brevo Transactional Email Test Successful!'
        });
        
        res.json({
            success: true,
            message: `Test email sent successfully to ${targetEmail}!`,
            messageId: info.messageId
        });
    } catch (err) {
        console.error('[Test Email Endpoint] Error:', err.message);
        res.status(500).json({
            success: false,
            message: 'Failed to send test email.',
            error: err.message
        });
    }
});

// ── Payment System ────────────────────────────────────────────────────────────
const paymentRoutes = require('./routes/payment');
app.use('/api/payment', paymentRoutes);

// Global error handler — must be last middleware
app.use((err, _req, res, _next) => {
    console.error('UNHANDLED SERVER ERROR:', err);
    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : (err.message || 'Internal Server Error'),
    });
});

app.listen(process.env.STUDENT_BACKEND_PORT || 5000, () => {
    console.log(`Student Backend running on port ${process.env.STUDENT_BACKEND_PORT || 5000}`);
});
