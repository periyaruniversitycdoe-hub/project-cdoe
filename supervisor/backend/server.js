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

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const apiLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: true, legacyHeaders: false });
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
