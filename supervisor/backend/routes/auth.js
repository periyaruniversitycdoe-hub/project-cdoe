const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const credSvc   = require('../../../shared/credential/credentialNotificationService');
const accountLock = require('../../../shared/security/accountLock');
const { logEvent, EVENT_TYPES, SEVERITY } = require('../../../shared/security/auditLogger');
const { issueTokenPair, refreshHandler } = require('../../../shared/security/tokenManager');
const { hashPassword, verifyAndMigrate } = require('../../../shared/security/passwordHash');
const { validatePasswordComplexity, validateLoginInput } = require('../../../shared/security/passwordValidator');
const { loginSchema, signupSchema, validateBody } = require('../../../shared/security/inputSchemas');

// POST /api/auth/signup
router.post('/signup', validateBody(signupSchema), async (req, res) => {
    const { name, email, password, mobile } = req.body;
    if (!name || !email || !password)
        return res.status(400).json({ message: 'Name, email and password are required' });

    const pwCheck = validatePasswordComplexity(password);
    if (!pwCheck.valid) return res.status(400).json({ message: pwCheck.message });

    try {
        const [existing] = await pool.query('SELECT id FROM supervisor_users WHERE email = ?', [email]);
        if (existing.length > 0)
            return res.status(409).json({ message: 'Email already registered' });

        const [supervisorRows] = await pool.query(
            'SELECT id FROM supervisors WHERE email = ? AND status = "Approved" LIMIT 1',
            [email]
        );
        const supervisorId = supervisorRows.length > 0 ? supervisorRows[0].id : null;

        const hashed = await hashPassword(password);
        const [result] = await pool.query(
            'INSERT INTO supervisor_users (supervisor_id, name, email, password, mobile, status) VALUES (?, ?, ?, ?, ?, "active")',
            [supervisorId, name, email, hashed, mobile || null]
        );

        const { accessToken: token } = await issueTokenPair(
            pool, { id: result.insertId, email, name, role: 'supervisor' }, 'supervisor',
            process.env.SUPERVISOR_JWT_SECRET
        );
        res.status(201).json({
            message: 'Account created successfully',
            token,
            user: { id: result.insertId, name, email, supervisorId, role: 'supervisor' }
        });

        const loginUrl = process.env.SUPERVISOR_PORTAL_URL || 'http://localhost:5175';
        credSvc.notify({ db: pool, name, email, password, portalType: 'Supervisor', loginUrl }).catch(() => {});

        // Admin notification feed — supervisor self-registered (non-blocking)
        const { notifyAdminDB } = require('../../../shared/notification/notifyAdminDB');
        notifyAdminDB(pool, {
            event_key:   'supervisor.register',
            title:       `New Supervisor Registered: ${name}`,
            message:     `Email: ${email}${supervisorId ? ` — linked to supervisor #${supervisorId}` : ' — pending manual link'}`,
            type:        'info',
            source_type: 'supervisor',
            source_id:   supervisorId ? String(supervisorId) : String(result.insertId),
            link:        '/supervisors',
        });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/auth/login
router.post('/login', validateBody(loginSchema), async (req, res) => {
    const { email, password } = req.body;
    const inputCheck = validateLoginInput(email, password);
    if (!inputCheck.valid) return res.status(400).json({ message: inputCheck.message });

    try {
        // Check lockout
        const lock = await accountLock.checkLock(pool, email, 'supervisor');
        if (lock.locked) {
            const mins = Math.ceil(lock.secondsRemaining / 60);
            return res.status(423).json({
                message: `Account locked. Try again in ${mins} minute(s).`,
                lockedUntil: lock.lockUntil,
            });
        }

        const [rows] = await pool.query('SELECT * FROM supervisor_users WHERE email = ?', [email]);
        if (rows.length === 0) {
            await accountLock.recordFailure(pool, email, 'supervisor');
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user = rows[0];
        if (user.status === 'suspended')
            return res.status(403).json({ message: 'Account suspended. Contact admin.' });

        const valid = await verifyAndMigrate(pool, password, user.password, user.id, 'supervisor_users');
        if (!valid) {
            const lockResult = await accountLock.recordFailure(pool, email, 'supervisor');
            if (lockResult.locked) {
                const mins = Math.ceil((lockResult.lockUntil - Date.now()) / 60000);
                return res.status(423).json({
                    message: `Too many failed attempts. Account locked for ${mins} minute(s).`,
                    lockedUntil: lockResult.lockUntil,
                });
            }
            return res.status(401).json({
                message: `Invalid email or password. ${lockResult.attemptsRemaining} attempt(s) remaining before lockout.`,
            });
        }

        await accountLock.clearFailures(pool, email, 'supervisor');

        await logEvent(pool, {
            eventType: EVENT_TYPES.LOGIN_SUCCESS, portal: 'supervisor', severity: SEVERITY.LOW,
            userId: user.id, email, req, message: 'Supervisor login successful',
        });

        const { accessToken, refreshToken } = await issueTokenPair(
            pool,
            { id: user.id, email: user.email, name: user.name, role: 'supervisor', supervisor_id: user.supervisor_id },
            'supervisor',
            process.env.SUPERVISOR_JWT_SECRET,
            { ip: req.headers['x-real-ip'] || req.ip || 'unknown' }
        );

        res.json({
            message:      'Login successful',
            token:        accessToken,
            accessToken,
            refreshToken,
            user: { id: user.id, name: user.name, email: user.email, supervisorId: user.supervisor_id, role: 'supervisor' }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/auth/refresh
router.post('/refresh', refreshHandler(pool, 'supervisor', process.env.SUPERVISOR_JWT_SECRET));

module.exports = router;
