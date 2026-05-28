const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS for all portals
app.use(cors());

console.log('=== Starting API Gateway Router ===');

const services = [
  { path: '/student', target: `http://localhost:${process.env.STUDENT_BACKEND_PORT || 5000}` },
  { path: '/admin', target: `http://localhost:${process.env.ADMIN_BACKEND_PORT || 5001}` },
  { path: '/supervisor', target: `http://localhost:${process.env.SUPERVISOR_BACKEND_PORT || 5002}` },
  { path: '/center', target: `http://localhost:${process.env.CENTER_BACKEND_PORT || 5003}` }
];

services.forEach(service => {
  console.log(`Routing path [${service.path}] ➡️ target [${service.target}]`);
  
  app.use(service.path, createProxyMiddleware({
    target: service.target,
    changeOrigin: true,
    pathRewrite: (p, req) => {
      // Rewrite /student/api/auth -> /api/auth
      const rewritten = p.replace(service.path, '');
      return rewritten;
    },
    onError: (err, req, res) => {
      console.error(`Proxy error for ${service.path}:`, err.message);
      res.status(502).json({ success: false, message: 'Bad Gateway - Service is starting up or unreachable.' });
    },
    onProxyReq: (proxyReq, req, res) => {
      // Forward standard headers
      proxyReq.setHeader('x-forwarded-host', req.headers.host);
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
