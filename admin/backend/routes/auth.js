
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const path    = require('path');

const accountLock   = require('../../../shared/security/accountLock');
const { logEvent, EVENT_TYPES, SEVERITY } = require('../../../shared/security/auditLogger');

const { issueTokenPair, revokeAllTokens, refreshHandler } = require('../../../shared/security/tokenManager');
const { verifyAndMigrate } = require('../../../shared/security/passwordHash');
const { validateLoginInput } = require('../../../shared/security/passwordValidator');
const { loginSchema, validateBody } = require('../../../shared/security/inputSchemas');

// ── Helper: build access JWT + refresh token pair ────────────────────────────
async function issueAdminJWT(db, user) {
    const payload = { id: user.id, email: user.email, role: user.role };
    const { accessToken, refreshToken } = await issueTokenPair(
        db, payload, 'admin', process.env.ADMIN_JWT_SECRET
    );
    return { accessToken, refreshToken };
}

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', validateBody(loginSchema), async (req, res) => {
    const { email, password } = req.body;

    const inputCheck = validateLoginInput(email, password);
    if (!inputCheck.valid) {
        return res.status(400).json({ success: false, message: inputCheck.message });
    }

    try {
        // 1. Check account lock first (no DB user query needed yet)
        const lock = await accountLock.checkLock(pool, email, 'admin');
        if (lock.locked) {
            const mins = Math.ceil(lock.secondsRemaining / 60);
            await logEvent(pool, {
                eventType: EVENT_TYPES.LOGIN_BLOCKED, portal: 'admin', severity: SEVERITY.HIGH,
                email, req, message: `Account locked. ${mins}m remaining.`,
            });
            return res.status(423).json({
                success: false,
                message: `Account is locked due to too many failed attempts. Try again in ${mins} minute(s).`,
                lockedUntil: lock.lockUntil,
            });
        }

        // 2. Lookup user
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE email = ? AND role = "admin"', [email]
        );
        if (users.length === 0) {
            // Record failure even for unknown emails (prevent timing oracle)
            await accountLock.recordFailure(pool, email, 'admin');
            await logEvent(pool, {
                eventType: EVENT_TYPES.LOGIN_FAILURE, portal: 'admin', severity: SEVERITY.MEDIUM,
                email, req, message: 'Login failed — user not found or not admin',
            });
            return res.status(401).json({ success: false, message: 'Invalid credentials or not an admin' });
        }

        const user = users[0];

        // 3. Password check (verifyAndMigrate upgrades bcrypt → argon2id on success)
        const isMatch = await verifyAndMigrate(pool, password, user.password, user.id, 'users');
        if (!isMatch) {
            const lockResult = await accountLock.recordFailure(pool, email, 'admin');
            await logEvent(pool, {
                eventType: EVENT_TYPES.LOGIN_FAILURE, portal: 'admin', severity: SEVERITY.MEDIUM,
                userId: user.id, email, req,
                message: `Login failed — wrong password. ${lockResult.attemptsRemaining} attempts left.`,
            });

            if (lockResult.locked) {
                const mins = Math.ceil((lockResult.lockUntil - Date.now()) / 60000);
                await logEvent(pool, {
                    eventType: EVENT_TYPES.ACCOUNT_LOCKED, portal: 'admin', severity: SEVERITY.HIGH,
                    userId: user.id, email, req, message: `Account locked for ${mins} minutes`,
                });
                return res.status(423).json({
                    success: false,
                    message: `Too many failed attempts. Account locked for ${mins} minute(s).`,
                    lockedUntil: lockResult.lockUntil,
                });
            }

            const remaining = lockResult.attemptsRemaining;
            return res.status(401).json({
                success: false,
                message: `Invalid credentials. ${remaining} attempt(s) remaining before lockout.`,
            });
        }

        // 4. Clear failed attempts on successful password
        await accountLock.clearFailures(pool, email, 'admin');

        // 5. Issue full JWT
        const { accessToken, refreshToken } = await issueAdminJWT(pool, user);
        await logEvent(pool, {
            eventType: EVENT_TYPES.LOGIN_SUCCESS, portal: 'admin', severity: SEVERITY.LOW,
            userId: user.id, email, req, message: 'Admin login successful',
        });

        res.json({
            success:      true,
            message:      'Login successful',
            token:        accessToken,      // legacy field — keep for backward compat
            accessToken,
            refreshToken,
            user: {
                id:        user.id,
                full_name: user.full_name,
                email:     user.email,
                role:      user.role,
            },
        });
    } catch (err) {
        console.error('[Admin Auth] login error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token      = authHeader?.split(' ')[1];
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
            await revokeAllTokens(pool, decoded.id, 'admin');
            await logEvent(pool, {
                eventType: EVENT_TYPES.LOGOUT, portal: 'admin', severity: SEVERITY.LOW,
                userId: decoded.id, req, message: 'Admin logout — tokens revoked',
            });
        } catch (_) {}
    }
    res.json({ success: true, message: 'Logged out' });
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post('/refresh', refreshHandler(pool, 'admin', process.env.ADMIN_JWT_SECRET));

module.exports = router;
