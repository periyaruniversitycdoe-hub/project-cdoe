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
const PORT = process.env.CENTER_BACKEND_PORT || 5003;

app.use(helmet());

const allowedOrigins = [
    process.env.CENTER_FRONTEND_URL || 'http://localhost:5176',
    process.env.ADMIN_FRONTEND_URL  || 'http://localhost:5174',
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

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const apiLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth', authLimiter);
app.use('/api/', apiLimiter);

const db = require('./config/db');
const sharedAuthRoutes = require('../../shared/auth/routes/authRoutes');
const bcrypt = require('bcryptjs');
app.use('/api/auth', sharedAuthRoutes(express, db, 'center', bcrypt));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/portal', require('./routes/portal'));
app.use('/api/dropdowns', require('./routes/dropdowns'));
app.use('/api/notifications', require('./routes/notifications'));

// News & Announcements board — audience = all | centre
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
               AND (audience = 'all' OR audience = 'centre')
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

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'center-portal', port: PORT }));

app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : (err.message || 'Internal Server Error'),
    });
});

app.listen(PORT, () => {
    console.log(`✅ Center Portal Backend running on http://localhost:${PORT}`);
});
