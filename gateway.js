const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// Configure CORS options for all portals to securely support credentials (withCredentials: true)
const allowedOrigins = [
  process.env.STUDENT_FRONTEND_URL,
  process.env.ADMIN_FRONTEND_URL,
  process.env.SUPERVISOR_FRONTEND_URL,
  process.env.CENTER_FRONTEND_URL,
  'https://phd-cdoe.netlify.app'
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or tools)
    if (!origin) return callback(null, true);

    const isAllowed =
      allowedOrigins.includes(origin) ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1') ||
      origin.endsWith('netlify.app');

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200
};

// Apply CORS middleware globally — handles all preflight OPTIONS automatically
app.use(cors(corsOptions));

// Explicitly handle OPTIONS preflight for ALL routes BEFORE proxy middleware
app.options('*', cors(corsOptions));

console.log('=== Starting API Gateway Router ===');

const services = [
  { path: '/student',    target: `http://localhost:${process.env.STUDENT_BACKEND_PORT    || 5000}` },
  { path: '/admin',      target: `http://localhost:${process.env.ADMIN_BACKEND_PORT      || 5001}` },
  { path: '/supervisor', target: `http://localhost:${process.env.SUPERVISOR_BACKEND_PORT || 5002}` },
  { path: '/center',     target: `http://localhost:${process.env.CENTER_BACKEND_PORT     || 5003}` }
];

services.forEach(service => {
  console.log(`Routing path [${service.path}] ➡️ target [${service.target}]`);
  
  app.use(service.path, createProxyMiddleware({
    target: service.target,
    changeOrigin: true,
    // Remove the CORS headers set by sub-backends so the gateway's headers win
    on: {
      proxyRes: (proxyRes, req, res) => {
        delete proxyRes.headers['access-control-allow-origin'];
        delete proxyRes.headers['access-control-allow-credentials'];
        delete proxyRes.headers['access-control-allow-methods'];
        delete proxyRes.headers['access-control-allow-headers'];
      },
      error: (err, req, res) => {
        console.error(`Proxy error for ${service.path}:`, err.message);
        res.status(502).json({ success: false, message: 'Bad Gateway - Service is starting up or unreachable.' });
      },
      proxyReq: (proxyReq, req) => {
        proxyReq.setHeader('x-forwarded-host', req.headers.host);
      }
    }
  }));
});

// Root ping endpoint to verify the gateway itself is alive
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'API Gateway is active.' });
});

// For Render root landing (optional fallback)
app.get('/', (req, res) => {
  res.send('Periyar University PhD Admissions API Gateway is running.');
});

app.listen(PORT, () => {
  console.log(`🚀 API Gateway listening on port ${PORT}`);
});
