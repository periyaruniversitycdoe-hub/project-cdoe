
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const { rateLimit } = require('express-rate-limit');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const PORT = process.env.ADMIN_BACKEND_PORT || 5001;

// Security headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow static file serving
    contentSecurityPolicy: false, // Disable Helmet CSP so iframe/media files from backend load in cross-origin frontend
    frameguard: false,            // Disable X-Frame-Options: SAMEORIGIN to allow secure iframe document previewing
}));

// CORS — restrict to known origins only
const allowedAdminOrigins = [
    process.env.ADMIN_FRONTEND_URL   || 'http://localhost:5174',
    process.env.STUDENT_FRONTEND_URL || 'http://localhost:5177',
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedAdminOrigins.includes(origin) || origin.startsWith('http://localhost')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate Limiting — auth routes get strict limits; general API is generous but protected
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: { success: false, message: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    message: { success: false, message: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/auth', authLimiter);
app.use('/api/', limiter);

// Serve Static Files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const applicationRoutes = require('./routes/applications');
const dropdownRoutes = require('./routes/dropdowns');
const uploadRoutes = require('./routes/uploads');
const hallTicketRoutes = require('./routes/hall-tickets');
const sessionRoutes      = require('./routes/sessions');
const locationRoutes     = require('./routes/locations');
const counsellingRoutes  = require('./routes/counselling');
const venueRoutes              = require('./routes/venues');
const qualificationRoutes      = require('./routes/qualifications');
const qualificationRulesRoutes = require('./routes/qualification-rules');
const studentRoutes            = require('./routes/students');
const partTimeRoutes           = require('./routes/part-time');
const resultsRoutes            = require('./routes/results');
const attendanceRoutes         = require('./routes/attendance');
const mastersRoutes            = require('../../supervisor/backend/routes/masters');
const supervisorsRoutes        = require('../../supervisor/backend/routes/supervisors');
const centresRoutes            = require('../../center/backend/routes/centres');

const db = require('./config/db');
const sharedAuthRoutes = require('../../shared/auth/routes/authRoutes');
const bcrypt = require('bcrypt');
app.use('/api/auth', sharedAuthRoutes(express, db, 'admin', bcrypt));
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/dropdowns', dropdownRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/hall-tickets', hallTicketRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/counselling', counsellingRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/qualifications', qualificationRoutes);
app.use('/api/qualification-rules', qualificationRulesRoutes);
app.use('/api/students',      studentRoutes);
app.use('/api/part-time-configurations', partTimeRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/masters', mastersRoutes);
app.use('/api/supervisors', supervisorsRoutes);
app.use('/api/centres', centresRoutes);
const instituteRoutes = require('./routes/institutes');
app.use('/api/institutes', instituteRoutes);
const eligibilityRoutes = require('./routes/eligibility');
app.use('/api/eligibility', eligibilityRoutes);
const credentialLogRoutes = require('./routes/credential-logs');
app.use('/api/credential-logs', credentialLogRoutes);
const mailRoutes = require('./routes/mail');
const dynamicEmailRoutes = require('./src/modules/email/routes/email.routes');
const emailServiceRoutes = require('./src/modules/email-services/routes/emailService.routes');
const emailTemplateRoutes = require('./src/modules/email-builder/routes/emailTemplate.routes');

app.use('/api/mail', mailRoutes);
app.use('/api/dynamic-emails', dynamicEmailRoutes);
app.use('/api/email-services', emailServiceRoutes);
app.use('/api/email-templates', emailTemplateRoutes);

// Enterprise Payment Management (Admin Portal)
const paymentManagementRoutes = require('./routes/payment-management');
app.use('/api/payment-management', paymentManagementRoutes);

// Enterprise Reports & Analytics Engine
const reportsRoutes = require('./routes/reports');
app.use('/api/reports', reportsRoutes);

// Portal Management Engine
const portalsRoutes = require('./routes/portals');
app.use('/api/portals', portalsRoutes);

// Portal Notifications (Admission Announcements)
const notificationsRoutes = require('./routes/notifications');
app.use('/api/notifications', notificationsRoutes);

// Portal Home Management (Student home page content — real-time admin control)
const portalHomeRoutes = require('./routes/portal-home');
app.use('/api/portal-home', portalHomeRoutes);

// ── Institute Master auto-migration ──────────────────────────────────────────
(async () => {
    // 1. Extend master_institutes with enterprise columns
    const instCols = [
        { col: 'college_code',     def: 'VARCHAR(20) DEFAULT NULL' },
        { col: 'principal_name',   def: 'VARCHAR(300) DEFAULT NULL' },
        { col: 'principal_mobile', def: 'VARCHAR(20) DEFAULT NULL' },
        { col: 'college_email',    def: 'VARCHAR(255) DEFAULT NULL' },
        { col: 'college_phone',    def: 'VARCHAR(50) DEFAULT NULL' },
        { col: 'created_by',       def: 'INT DEFAULT NULL' },
        { col: 'updated_by',       def: 'INT DEFAULT NULL' },
    ];
    for (const { col, def } of instCols) {
        try { await db.execute(`ALTER TABLE master_institutes ADD COLUMN ${col} ${def}`); }
        catch (e) { if (e.errno !== 1060 && e.code !== 'ER_DUP_FIELDNAME') console.error(`Institute col ${col}:`, e.message); }
    }
    // 2. Migrate abbreviation → college_code for existing rows
    try {
        await db.execute(`UPDATE master_institutes SET college_code = abbreviation WHERE college_code IS NULL AND abbreviation IS NOT NULL`);
    } catch (e) { console.error('Institute migration (abbrev→code):', e.message); }
    // 3. Unique indexes (safe — ignore if already exists)
    const instIdx = [
        `CREATE UNIQUE INDEX uq_inst_college_code ON master_institutes(college_code)`,
    ];
    for (const sql of instIdx) {
        try { await db.execute(sql); } catch (e) { /* ignore duplicate index */ }
    }
    // 4. Institute audit log table
    try {
        await db.execute(`CREATE TABLE IF NOT EXISTS institute_audit_log (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            action       VARCHAR(50) NOT NULL,
            institute_id INT DEFAULT NULL,
            admin_id     INT DEFAULT NULL,
            ip_address   VARCHAR(45) DEFAULT NULL,
            old_value    LONGTEXT DEFAULT NULL,
            new_value    LONGTEXT DEFAULT NULL,
            extra_info   LONGTEXT DEFAULT NULL,
            created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    } catch (e) { console.error('Institute audit log table:', e.message); }
    console.log('✅ Institute Master schema verified.');
})();

// ── Eligibility Engine auto-migration ────────────────────────────────────────
(async () => {
    const tables = [
        `CREATE TABLE IF NOT EXISTS departments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_dept_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS programs_offered (
            id INT AUTO_INCREMENT PRIMARY KEY,
            department_id INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
            UNIQUE KEY uq_prog_dept_name (department_id, name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS program_pg_eligibility (
            id INT AUTO_INCREMENT PRIMARY KEY,
            program_id INT NOT NULL,
            course_name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (program_id) REFERENCES programs_offered(id) ON DELETE CASCADE,
            UNIQUE KEY uq_pg_elig (program_id, course_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS program_mphil_eligibility (
            id INT AUTO_INCREMENT PRIMARY KEY,
            program_id INT NOT NULL,
            course_name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (program_id) REFERENCES programs_offered(id) ON DELETE CASCADE,
            UNIQUE KEY uq_mphil_elig (program_id, course_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS mphil_courses_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            course_name VARCHAR(255) NOT NULL UNIQUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS eligibility_audit_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            admin_id INT NULL,
            action VARCHAR(50) NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            entity_id INT NULL,
            old_value TEXT NULL,
            new_value TEXT NULL,
            ip_address VARCHAR(45) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    ];
    for (const sql of tables) {
        try { await db.execute(sql); } catch (e) { console.error('Eligibility migration error:', e.message); }
    }

    // Seed central M.Phil master courses if empty
    try {
        const [rows] = await db.execute('SELECT COUNT(*) as count FROM mphil_courses_master');
        if (rows[0].count === 0) {
            const mphilCourses = [
                "M.Phil Biochemistry",
                "M.Phil Biotechnology",
                "M.Phil Botany",
                "M.Phil Chemistry",
                "M.Phil Clinical Nutrition and Dietetics",
                "M.Phil Commerce",
                "M.Phil Computer Science",
                "M.Phil Economics",
                "M.Phil Education",
                "M.Phil Energy Science",
                "M.Phil English",
                "M.Phil Environmental Science",
                "M.Phil Food Science and Nutrition",
                "M.Phil Geology",
                "M.Phil History",
                "M.Phil Journalism and Mass Communication",
                "M.Phil Library and Information Science",
                "M.Phil Management",
                "M.Phil Mathematics",
                "M.Phil Microbiology",
                "M.Phil Physics",
                "M.Phil Psychology",
                "M.Phil Sociology",
                "M.Phil Statistics",
                "M.Phil Tamil",
                "M.Phil Textiles and Apparel Design",
                "M.Phil Zoology",
                "M.Phil Sericulture",
                "M.Phil Political Science",
                "M.Phil Data Science",
                "M.Phil Artificial Intelligence",
                "M.Phil Cyber Security",
                "M.Phil Software Engineering",
                "M.Phil Information Technology",
                "M.Phil Bioinformatics",
                "M.Phil Nanoscience",
                "M.Phil Nanotechnology",
                "M.Phil Molecular Biology",
                "M.Phil Life Sciences",
                "M.Phil Applied Psychology",
                "M.Phil Clinical Psychology",
                "M.Phil Counselling Psychology",
                "M.Phil Applied Economics",
                "M.Phil Business Economics",
                "M.Phil Analytical Chemistry",
                "M.Phil Organic Chemistry",
                "M.Phil Physical Chemistry",
                "M.Phil Industrial Biotechnology",
                "M.Phil Environmental Biotechnology",
                "M.Phil Food Technology",
                "M.Phil Biotechnology and Bioinformatics",
                "M.Phil Computer Applications",
                "M.Phil Information Science",
                "M.Phil Human Resource Management",
                "M.Phil Finance",
                "M.Phil Marketing Management"
            ];
            for (const course of mphilCourses) {
                await db.execute('INSERT INTO mphil_courses_master (course_name) VALUES (?)', [course]);
            }
            console.log('✅ central M.Phil course list successfully seeded.');
        }
    } catch (e) {
        console.error('Error seeding M.Phil courses:', e.message);
    }
    // Add department_id, program_offered_id, program_offered_name to applications
    const appCols = [
        { name: 'department_id',       def: 'INT NULL' },
        { name: 'program_offered_id',  def: 'INT NULL' },
        { name: 'program_offered_name',def: 'VARCHAR(255) NULL' },
    ];
    for (const col of appCols) {
        try {
            await db.execute(`ALTER TABLE applications ADD COLUMN ${col.name} ${col.def}`);
        } catch (e) {
            if (e.errno !== 1060 && e.code !== 'ER_DUP_FIELDNAME')
                console.error(`Error adding applications.${col.name}:`, e.message);
        }
    }
    console.log('✅ Eligibility engine schema verified.');

    // Part-Time engine — add new columns if not present
    const ptAlterCols = [
        { table: 'part_time_categories', col: 'category_reference_code', def: 'VARCHAR(20) DEFAULT NULL' },
        { table: 'part_time_roles',       col: 'role_hint',               def: 'TEXT DEFAULT NULL' },
        { table: 'higher_education',      col: 'degree_name',             def: 'VARCHAR(255) DEFAULT NULL' },
    ];
    for (const { table, col, def } of ptAlterCols) {
        try { await db.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch (e) {
            if (e.errno !== 1060 && e.code !== 'ER_DUP_FIELDNAME') console.error(`Error adding ${table}.${col}:`, e.message);
        }
    }
    console.log('✅ Part-Time engine schema verified.');
})();

// Error Handling
app.use((err, _req, res, _next) => {
    console.error('SERVER ERROR:', err);
    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : (err.message || 'Internal Server Error'),
    });
});

app.listen(PORT, () => {
    console.log(`Admin Backend Server running on port ${PORT}`);
});
