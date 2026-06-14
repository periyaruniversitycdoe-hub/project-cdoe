const dns = require('dns');
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const express = require('express');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
app.set('trust proxy', 1); // Trust reverse proxy (Render/Netlify) for accurate rate limiting
const PORT = process.env.CENTER_BACKEND_PORT || 5003;

app.use(compression({ level: 6, threshold: 1024 }));

app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc:  ["'self'"],
            scriptSrc:   ["'self'", "'unsafe-inline'"],
            styleSrc:    ["'self'", "'unsafe-inline'"],
            imgSrc:      ["'self'", 'data:', 'blob:'],
            fontSrc:     ["'self'", 'data:'],
            connectSrc:  ["'self'"],
            frameSrc:    ["'self'"],
            objectSrc:   ["'none'"],
            baseUri:     ["'self'"],
            formAction:  ["'self'"],
        },
    },
    frameguard: { action: 'sameorigin' },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

const allowedOrigins = [
    process.env.CENTER_FRONTEND_URL || 'http://localhost:5176',
    process.env.ADMIN_FRONTEND_URL  || 'http://localhost:5174',
].filter(Boolean);

app.use(cors({
    origin: (origin, cb) => {
        const isDev = process.env.NODE_ENV !== 'production';
        const allowed = !origin ||
            allowedOrigins.includes(origin) ||
            (isDev && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')));
        if (allowed) cb(null, true);
        else cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));
const hpp = require('hpp');
app.use(hpp());
const { sanitize } = require('../../shared/security/inputSanitizer');
app.use(sanitize);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const { makeAuthLimiter, makeApiLimiter } = require('../../shared/security/redisRateLimiter');
app.use('/api/auth', makeAuthLimiter());
app.use('/api/', makeApiLimiter());

const db = require('./config/db');

// ── Security middleware ──────────────────────────────────────────────────────
const requestId = require('../../shared/security/requestId');
const auditMw   = require('../../shared/security/auditLogger');
app.use(requestId('center'));
app.use(auditMw.middleware(db, 'center'));

const sharedAuthRoutes = require('../../shared/auth/routes/authRoutes');
const bcrypt = require('bcryptjs');
app.use('/api/auth', sharedAuthRoutes(express, db, 'center', bcrypt));
app.use('/api/auth', require('./routes/auth'));

// Center MFA routes
const { makeRoutes: makeMfaRoutes } = require('../../shared/security/totp');
const { verifyToken: verifyCenterToken } = require('./middleware/auth');
const { issueTokenPair: issuePair } = require('../../shared/security/tokenManager');
async function issueCenterJWT(db, user) {
    const { accessToken } = await issuePair(db, { id: user.id, email: user.email, role: 'center' }, 'center', process.env.CENTER_JWT_SECRET);
    return accessToken;
}
app.use('/api/auth/mfa', verifyCenterToken, makeMfaRoutes(db, process.env.CENTER_JWT_SECRET, issueCenterJWT, {
    portal: 'center', usersTable: 'center_users', nameField: 'name',
    mfaTable: 'portal_mfa', usePortalFilter: true,
}));

app.use('/api/portal', require('./routes/portal'));
app.use('/api/dropdowns', require('./routes/dropdowns'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/permission-applications', require('./routes/permission-applications'));

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

// Chatbot public APIs
const chatbotPublicRoutes = require('../../shared/chatbot/chatbotPublicRoutes');
app.use('/api/chatbot', chatbotPublicRoutes({ portalKey: 'center', jwtSecret: process.env.CENTER_JWT_SECRET, db }));

// ── University Settings (real-time, read-only) ───────────────────────────────
const centerSettingsCache = require('../../shared/security/appCache');
const centerSseClients = new Set();

function broadcastCenterSettings() {
    const msg = `event: settings-updated\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`;
    for (const c of centerSseClients) {
        try { c.write(msg); } catch (_) { centerSseClients.delete(c); }
    }
}

app.get('/api/settings', async (_req, res) => {
    try {
        const data = await centerSettingsCache.getOrFetch('center_university_settings', 30, async () => {
            const [rows] = await db.query('SELECT * FROM university_settings LIMIT 1');
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
    } catch (_err) {
        res.status(500).json({ success: false, message: 'Failed to load settings' });
    }
});

app.get('/api/settings/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(':keepalive\n\n');
    centerSseClients.add(res);
    const hb = setInterval(() => {
        try { res.write(':keepalive\n\n'); }
        catch (_) { clearInterval(hb); centerSseClients.delete(res); }
    }, 25000);
    req.on('close', () => { clearInterval(hb); centerSseClients.delete(res); });
});

app.post('/internal/settings-invalidate', (_req, res) => {
    centerSettingsCache.del('center_university_settings');
    broadcastCenterSettings();
    res.json({ ok: true });
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
