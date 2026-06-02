const dns = require('dns');
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { rateLimit } = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
app.set('trust proxy', 1); // Trust reverse proxy (Render/Netlify) for accurate rate limiting
const PORT = process.env.SUPERVISOR_BACKEND_PORT || 5002;

app.use(helmet());

const allowedOrigins = [
    process.env.SUPERVISOR_FRONTEND_URL || 'http://localhost:5175',
    process.env.ADMIN_FRONTEND_URL      || 'http://localhost:5174',
].filter(Boolean);

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.endsWith('netlify.app')) cb(null, true);
        else cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const isProd = process.env.NODE_ENV === 'production';
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isProd ? 20 : 1000000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        if (process.env.NODE_ENV !== 'production') return true;
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        return ip.includes('127.0.0.1') || ip === '::1' || ip.includes('localhost');
    }
});
const apiLimiter  = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isProd ? 200 : 1000000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        if (process.env.NODE_ENV !== 'production') return true;
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        return ip.includes('127.0.0.1') || ip === '::1' || ip.includes('localhost');
    }
});
app.use('/api/auth', authLimiter);
app.use('/api/', apiLimiter);

// Routes
const db = require('./config/db');
const sharedAuthRoutes = require('../../shared/auth/routes/authRoutes');
const bcrypt = require('bcryptjs');
app.use('/api/auth', sharedAuthRoutes(express, db, 'supervisor', bcrypt));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/portal', require('./routes/portal'));
app.use('/api/dropdowns', require('./routes/dropdowns'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api', require('./routes/bank'));

// News & Announcements board — audience = all | supervisor
app.get('/api/news-announcements', async (_req, res) => {
    try {
        const now = new Date();
        const [rows] = await db.query(
            `SELECT id, title, description, category, priority, audience,
                    attachment_path, attachment_name, redirect_url,
                    publish_date, expiry_date, is_pinned, created_at
             FROM news_announcements
             WHERE is_deleted = 0
               AND status = 'published'
               AND publish_date <= ?
               AND expiry_date  >= ?
               AND (audience = 'all' OR audience = 'supervisor')
             ORDER BY is_pinned DESC,
               FIELD(priority,'urgent','high','medium','low'),
               publish_date DESC`,
            [now, now]
        );
        res.json({ success: true, data: rows });
    } catch (_err) {
        res.json({ success: true, data: [] });
    }
});

// News & Announcements active categories
app.get('/api/news-announcements/categories', async (_req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM news_announcement_categories WHERE is_active = 1 ORDER BY label ASC');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.json({ success: true, data: [] });
    }
});

// File upload settings (public — supervisor frontend reads this)
app.get('/api/file-upload-settings', async (_req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM file_upload_settings');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Auto-migration: eligibility_dept_id and program_offered_id in supervisors
(async () => {
    try {
        const cols = [
            { name: 'eligibility_dept_id', query: 'ALTER TABLE supervisors ADD COLUMN eligibility_dept_id INT DEFAULT NULL' },
            { name: 'program_offered_id',  query: 'ALTER TABLE supervisors ADD COLUMN program_offered_id INT DEFAULT NULL' },
        ];
        for (const col of cols) {
            try { await db.query(col.query); } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }
        }
        console.log('Eligibility mapping columns verified in supervisors.');
    } catch (err) {
        console.error('[Eligibility Migration]', err.message);
    }
})();

// GET /api/eligibility-departments — public, reads from Eligibility Management departments table
app.get('/api/eligibility-departments', async (_req, res) => {
    try {
        const [rows] = await db.query('SELECT id, name FROM departments WHERE is_active = 1 ORDER BY name ASC');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/eligibility-programs?department_id= — public, reads from Eligibility Management programs_offered
app.get('/api/eligibility-programs', async (req, res) => {
    try {
        const { department_id } = req.query;
        if (!department_id) return res.json({ success: true, data: [] });
        const [rows] = await db.query(
            'SELECT id, name FROM programs_offered WHERE is_active = 1 AND department_id = ? ORDER BY name ASC',
            [department_id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'supervisor-portal', port: PORT }));

app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : (err.message || 'Internal Server Error'),
    });
});

app.listen(PORT, () => {
    console.log(`✅ Supervisor Portal Backend running on http://localhost:${PORT}`);
});
