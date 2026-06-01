const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 8080;

// ── Allowed origins ────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.STUDENT_FRONTEND_URL,
  process.env.ADMIN_FRONTEND_URL,
  process.env.SUPERVISOR_FRONTEND_URL,
  process.env.CENTER_FRONTEND_URL,
  'https://phd-cdoe.netlify.app',
].filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true; // curl / server-to-server — always allow
  return (
    allowedOrigins.includes(origin) ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1') ||
    origin.endsWith('.netlify.app')
  );
}

// ── CORS helper — writes the four CORS response headers ───────────────────────
function setCorsHeaders(res, origin) {
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin',      origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods',     'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers',     'Content-Type,Authorization,X-Requested-With,Accept');
  }
}

// ── Handle OPTIONS preflight BEFORE any proxy ─────────────────────────────────
// Use RegExp — path-to-regexp v8 (Node 26) no longer accepts bare '*' string
app.options(/(.*)/, (req, res) => {
  setCorsHeaders(res, req.headers.origin);
  res.setHeader('Access-Control-Max-Age', '86400'); // cache preflight 24 h
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
  console.log(`Routing [${service.path}] ➡️  ${service.target}`);

  app.use(service.path, createProxyMiddleware({
    target: service.target,
    changeOrigin: true,
    on: {
      // Strip sub-backend CORS headers, inject gateway's own ─────────────────
      proxyRes: (proxyRes, req) => {
        delete proxyRes.headers['access-control-allow-origin'];
        delete proxyRes.headers['access-control-allow-credentials'];
        delete proxyRes.headers['access-control-allow-methods'];
        delete proxyRes.headers['access-control-allow-headers'];

        const origin = req.headers.origin;
        if (isAllowedOrigin(origin)) {
          proxyRes.headers['access-control-allow-origin']      = origin || '*';
          proxyRes.headers['access-control-allow-credentials'] = 'true';
        }
      },

      // Also set CORS on error responses so browser can read the 502 body ────
      error: (err, req, res) => {
        console.error(`Proxy error [${service.path}]:`, err.message);
        setCorsHeaders(res, req.headers.origin);
        res.status(502).json({
          success: false,
          message: 'Bad Gateway — service is starting up or unreachable.',
        });
      },

      proxyReq: (proxyReq, req) => {
        proxyReq.setHeader('x-forwarded-host', req.headers.host);
      },
    },
  }));
});

// ── Health / root ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'OK', message: 'API Gateway is active.' })
);
app.get('/', (_req, res) =>
  res.send('Periyar University PhD Admissions API Gateway is running.')
);

app.listen(PORT, () =>
  console.log(`🚀 API Gateway listening on port ${PORT}`)
);
