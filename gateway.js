/**
 * API Gateway — Layer 2 Security
 * Responsibilities:
 *   - Request ID stamping (forensic correlation)
 *   - CORS enforcement
 *   - Payload size limits
 *   - IP block check (blocked_ips table via Redis cache)
 *   - Rate limiting (global + per-path)
 *   - Security headers injection
 *   - Suspicious payload pattern detection
 *   - Proxy routing to 4 portal backends
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const crypto  = require('crypto');
const mysql   = require('mysql2/promise');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 8080;

// ── MySQL pool for blocked_ips persistence ───────────────────────────────────
const dbPool = mysql.createPool({
    host:             process.env.DB_HOST,
    port:             process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user:             process.env.DB_USER,
    password:         process.env.DB_PASSWORD,
    database:         process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit:  3,
    queueLimit:       0,
    charset:          'utf8mb4',
    connectTimeout:   60000,
    ssl: process.env.DB_HOST && !process.env.DB_HOST.includes('localhost') && !process.env.DB_HOST.includes('127.0.0.1')
        ? { rejectUnauthorized: false }
        : undefined,
});

// ── In-memory rate limit store (replace with Redis in production) ────────────
// Structure: { key -> { count, windowStart } }
const rateLimitStore  = new Map();
const blockedIPsCache = new Set(); // refreshed every 60 s from DB

async function ensureBlockedIPsTable() {
    await dbPool.query(`
        CREATE TABLE IF NOT EXISTS blocked_ips (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            ip_address VARCHAR(45)  NOT NULL UNIQUE,
            reason     VARCHAR(255) DEFAULT NULL,
            is_active  TINYINT(1)   NOT NULL DEFAULT 1,
            created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
}

async function loadBlockedIPs() {
    try {
        const [rows] = await dbPool.query('SELECT ip_address FROM blocked_ips WHERE is_active = 1');
        blockedIPsCache.clear();
        rows.forEach(r => blockedIPsCache.add(r.ip_address));
        console.log(`[Gateway] Blocked IPs refreshed: ${blockedIPsCache.size} entries`);
    } catch (err) {
        console.error('[Gateway] Failed to load blocked_ips:', err.message);
    }
}

async function blockIP(ip, reason = null) {
    blockedIPsCache.add(ip);
    try {
        await dbPool.query(
            `INSERT INTO blocked_ips (ip_address, reason, is_active) VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE is_active = 1, reason = VALUES(reason), updated_at = NOW()`,
            [ip, reason]
        );
    } catch (err) {
        console.error('[Gateway] Failed to persist blocked IP:', err.message);
    }
}

async function unblockIP(ip) {
    blockedIPsCache.delete(ip);
    try {
        await dbPool.query('UPDATE blocked_ips SET is_active = 0 WHERE ip_address = ?', [ip]);
    } catch (err) {
        console.error('[Gateway] Failed to unblock IP in DB:', err.message);
    }
}

// Bootstrap: create table + initial load + refresh every 60s
(async () => {
    try {
        await ensureBlockedIPsTable();
        await loadBlockedIPs();
        setInterval(loadBlockedIPs, 60_000);
    } catch (err) {
        console.error('[Gateway] DB bootstrap error:', err.message);
    }
})();

function getRateKey(req, scope) {
    const ip = req.headers['x-real-ip'] ||
               req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.ip || 'unknown';
    return `${scope}:${ip}`;
}

function checkRateLimit(key, limitPerWindow, windowMs) {
    const now  = Date.now();
    const entry = rateLimitStore.get(key) || { count: 0, windowStart: now };

    if (now - entry.windowStart > windowMs) {
        // Window expired — reset
        rateLimitStore.set(key, { count: 1, windowStart: now });
        return { limited: false, remaining: limitPerWindow - 1 };
    }

    entry.count++;
    rateLimitStore.set(key, entry);

    if (entry.count > limitPerWindow) {
        return { limited: true, remaining: 0 };
    }
    return { limited: false, remaining: limitPerWindow - entry.count };
}

// Purge old entries every 5 minutes
setInterval(() => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [k, v] of rateLimitStore) {
        if (v.windowStart < cutoff) rateLimitStore.delete(k);
    }
}, 5 * 60 * 1000);

// ── Allowed origins ──────────────────────────────────────────────────────────
const allowedOrigins = [
    process.env.STUDENT_FRONTEND_URL,
    process.env.ADMIN_FRONTEND_URL,
    process.env.SUPERVISOR_FRONTEND_URL,
    process.env.CENTER_FRONTEND_URL,
].filter(Boolean);

const PRODUCTION_HOSTNAME = process.env.PRODUCTION_HOSTNAME || null;

function isAllowedOrigin(origin) {
    if (!origin) return true; // server-to-server calls (health checks, internal)
    if (allowedOrigins.includes(origin)) return true;
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return true;
    return false;
}

function setCorsHeaders(res, origin) {
    if (isAllowedOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin',      origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods',     'GET,POST,PUT,DELETE,PATCH,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers',     'Content-Type,Authorization,X-Requested-With,Accept,bypass-tunnel-reminder,X-Request-ID');
    }
}

// ── Inject request ID ────────────────────────────────────────────────────────
app.use((req, res, next) => {
    const incoming = req.headers['x-request-id'];
    const id = (incoming && /^[a-z]+-\d+-[0-9a-f]{8}$/i.test(incoming))
        ? incoming
        : `gw-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    req.requestId = id;
    req.headers['x-request-id'] = id;  // forward to backend
    res.setHeader('X-Request-ID', id);
    next();
});

// ── Security headers on every response ──────────────────────────────────────
app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options',    'nosniff');
    res.setHeader('X-DNS-Prefetch-Control',    'off');
    res.setHeader('Referrer-Policy',           'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy',        'geolocation=(), microphone=(), camera=()');
    next();
});

// ── Block listed IPs ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
    const ip = req.headers['x-real-ip'] ||
               req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.ip || '';

    if (blockedIPsCache.has(ip)) {
        return res.status(403).json({
            success: false,
            message: 'Access denied.',
            requestId: req.requestId,
        });
    }
    next();
});

// ── Payload size limit (before proxy, before JSON parse) ─────────────────────
// Rejects oversized requests immediately to protect backend services.
app.use((req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB hard cap at gateway

    if (contentLength > MAX_BYTES) {
        setCorsHeaders(res, req.headers.origin);
        return res.status(413).json({
            success:   false,
            message:   'Payload too large.',
            requestId: req.requestId,
        });
    }
    next();
});

// ── Suspicious pattern detection ─────────────────────────────────────────────
// Catches obvious injection probes; backend layers do full validation.
const SQL_PATTERNS = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|EXECUTE|SCRIPT)\b|--|;--|\/\*|\*\/|xp_)/i;
const PATH_TRAVERSAL = /\.\.[/\\]/;

app.use((req, res, next) => {
    const url = decodeURIComponent(req.url || '');
    if (PATH_TRAVERSAL.test(url)) {
        setCorsHeaders(res, req.headers.origin);
        return res.status(400).json({
            success:   false,
            message:   'Invalid request.',
            requestId: req.requestId,
        });
    }
    if (SQL_PATTERNS.test(url)) {
        setCorsHeaders(res, req.headers.origin);
        return res.status(400).json({
            success:   false,
            message:   'Invalid request.',
            requestId: req.requestId,
        });
    }
    next();
});

// ── Global rate limit: 1000 req/min per IP ───────────────────────────────────
app.use((req, res, next) => {
    const { limited } = checkRateLimit(getRateKey(req, 'global'), 1000, 60_000);
    if (limited) {
        setCorsHeaders(res, req.headers.origin);
        res.setHeader('Retry-After', '60');
        return res.status(429).json({
            success:   false,
            message:   'Too many requests. Please slow down.',
            requestId: req.requestId,
        });
    }
    next();
});

// ── Auth-endpoint rate limit: 10 req/min per IP ──────────────────────────────
app.use((req, res, next) => {
    if (!req.path.includes('/auth/')) return next();
    const { limited } = checkRateLimit(getRateKey(req, 'auth'), 10, 60_000);
    if (limited) {
        setCorsHeaders(res, req.headers.origin);
        res.setHeader('Retry-After', '60');
        return res.status(429).json({
            success:   false,
            message:   'Too many authentication attempts. Try again in 1 minute.',
            requestId: req.requestId,
        });
    }
    next();
});

// ── OPTIONS preflight ─────────────────────────────────────────────────────────
app.options(/(.*)/, (req, res) => {
    setCorsHeaders(res, req.headers.origin);
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(200).end();
});

console.log('=== Starting API Gateway Router ===');

// ── Proxy routes ──────────────────────────────────────────────────────────────
const services = [
    { path: '/student',    target: `http://localhost:${process.env.STUDENT_BACKEND_PORT    || 5000}` },
    { path: '/admin',      target: `http://localhost:${process.env.ADMIN_BACKEND_PORT      || 5001}` },
    { path: '/supervisor', target: `http://localhost:${process.env.SUPERVISOR_BACKEND_PORT || 5002}` },
    { path: '/center',     target: `http://localhost:${process.env.CENTER_BACKEND_PORT     || 5003}` },
];

services.forEach(service => {
    console.log(`Routing [${service.path}] → ${service.target}`);

    app.use(service.path, createProxyMiddleware({
        target:       service.target,
        changeOrigin: true,
        on: {
            proxyRes: (proxyRes, req) => {
                // Strip backend CORS headers, inject gateway's own
                ['access-control-allow-origin',
                 'access-control-allow-credentials',
                 'access-control-allow-methods',
                 'access-control-allow-headers'].forEach(h => delete proxyRes.headers[h]);

                const origin = req.headers.origin;
                if (isAllowedOrigin(origin)) {
                    proxyRes.headers['access-control-allow-origin']      = origin || '*';
                    proxyRes.headers['access-control-allow-credentials'] = 'true';
                }
                // Forward request ID back to client
                proxyRes.headers['x-request-id'] = req.requestId;
            },

            error: (err, req, res) => {
                console.error(`Proxy error [${service.path}] req=${req.requestId}:`, err.message);
                setCorsHeaders(res, req.headers.origin);
                res.setHeader('X-Request-ID', req.requestId);
                res.status(502).json({
                    success:   false,
                    message:   'Service temporarily unavailable.',
                    requestId: req.requestId,
                });
            },

            proxyReq: (proxyReq, req) => {
                proxyReq.setHeader('x-forwarded-host', req.headers.host);
                proxyReq.setHeader('x-request-id',     req.requestId);
                // Forward real IP to backends for audit logging
                const realIp = req.headers['x-real-ip'] ||
                               req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                               req.ip || '';
                if (realIp) proxyReq.setHeader('x-real-ip', realIp);
            },
        },
    }));
});

// ── Health / root ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
    res.json({ status: 'OK', message: 'API Gateway active.', blockedIPs: blockedIPsCache.size })
);
app.get('/', (_req, res) =>
    res.send('Periyar University PhD Admissions API Gateway is running.')
);

app.listen(PORT, () =>
    console.log(`API Gateway listening on port ${PORT}`)
);

/**
 * Exported for use by admin portal to add/remove blocked IPs at runtime.
 */
module.exports = { blockedIPsCache, blockIP, unblockIP };
