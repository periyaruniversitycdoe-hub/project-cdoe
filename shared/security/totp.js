/**
 * TOTP (Time-based One-Time Password) for Admin MFA
 * Uses the `otplib` package — RFC 6238 compliant (same as Google Authenticator).
 *
 * Workflow:
 *   1. Admin user calls POST /api/auth/mfa/setup  → gets QR code + secret
 *   2. Admin scans QR code in authenticator app
 *   3. Admin calls POST /api/auth/mfa/verify-setup with a TOTP code → enables MFA
 *   4. On next login: POST /api/auth/login → returns { mfaRequired: true, mfaToken }
 *   5. Admin calls POST /api/auth/mfa/validate with { mfaToken, totpCode } → gets JWT
 */
const crypto = require('crypto');

// Encryption key for storing secrets at rest — must be set in .env
if (!process.env.MFA_ENCRYPTION_KEY) {
    throw new Error('[SECURITY] MFA_ENCRYPTION_KEY env var is not set. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}
const SECRET_KEY = Buffer.from(process.env.MFA_ENCRYPTION_KEY, 'hex');
if (SECRET_KEY.length !== 32) {
    throw new Error('[SECURITY] MFA_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes / 256 bits)');
}

function encryptSecret(plaintext) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', SECRET_KEY, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${enc.toString('hex')}`;
}

function decryptSecret(ciphertext) {
    const [ivHex, encHex] = ciphertext.split(':');
    const iv      = Buffer.from(ivHex, 'hex');
    const enc     = Buffer.from(encHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', SECRET_KEY, iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// Lazy-load otplib to avoid crash if package not installed yet
let authenticator;
function getAuthenticator() {
    if (!authenticator) {
        try {
            const otplib = require('otplib');
            authenticator = otplib.authenticator;
            authenticator.options = { window: 1 }; // allow ±1 step (30-second window)
        } catch (_) {
            throw new Error('otplib package not installed. Run: npm install otplib');
        }
    }
    return authenticator;
}

/**
 * Generate a new TOTP secret and return the key URI for QR code generation.
 * @param {string} userEmail
 * @param {string} issuer - e.g. 'Periyar University PhD Portal'
 * @returns {{ secret, keyUri, encryptedSecret }}
 */
function generateSecret(userEmail, issuer = 'Periyar University PhD Portal') {
    const auth    = getAuthenticator();
    const secret  = auth.generateSecret(20);
    const keyUri  = auth.keyuri(userEmail, issuer, secret);
    const encryptedSecret = encryptSecret(secret);
    return { secret, keyUri, encryptedSecret };
}

/**
 * Verify a TOTP code against a stored encrypted secret.
 * @param {string} totpCode       - 6-digit code from authenticator app
 * @param {string} encryptedSecret
 * @returns {boolean}
 */
function verifyCode(totpCode, encryptedSecret) {
    try {
        const auth   = getAuthenticator();
        const secret = decryptSecret(encryptedSecret);
        return auth.verify({ token: totpCode, secret });
    } catch (_) {
        return false;
    }
}

/**
 * Issue a short-lived MFA challenge token (signed JWT, 5 min TTL).
 * Returned after successful password check; used to gate TOTP verification.
 */
function issueMfaToken(userId, email, jwtSecret) {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
        { mfaChallengeFor: userId, email, purpose: 'mfa_challenge' },
        jwtSecret,
        { expiresIn: '5m' }
    );
}

/**
 * Verify an MFA challenge token.
 * @returns {{ valid: boolean, userId: number|null }}
 */
function verifyMfaToken(mfaToken, jwtSecret) {
    try {
        const jwt     = require('jsonwebtoken');
        const decoded = jwt.verify(mfaToken, jwtSecret);
        if (decoded.purpose !== 'mfa_challenge') return { valid: false, userId: null };
        return { valid: true, userId: decoded.mfaChallengeFor, email: decoded.email };
    } catch (_) {
        return { valid: false, userId: null };
    }
}

/**
 * Generic MFA route factory — works for admin, supervisor, and center portals.
 *
 * options.portal       — 'admin' | 'supervisor' | 'center'
 * options.usersTable   — DB table for the portal users (default: 'users')
 * options.nameField    — column holding display name (default: 'full_name')
 * options.mfaTable     — 'admin_mfa' for admin; 'portal_mfa' for supervisor/center
 * options.usePortalFilter — true when using portal_mfa (adds WHERE portal=? clause)
 *
 * Routes mounted at /api/auth/mfa/:
 *   POST /setup          — generate TOTP secret + QR URI
 *   POST /verify-setup   — confirm first TOTP code, enable MFA
 *   POST /validate       — validate TOTP after password step
 *   POST /disable        — disable MFA (requires current TOTP)
 */
function makeRoutes(db, jwtSecret, issueJWT, options = {}) {
    const {
        portal          = 'admin',
        usersTable      = 'users',
        nameField       = 'full_name',
        mfaTable        = 'admin_mfa',
        usePortalFilter = false,
    } = options;

    const router = require('express').Router();
    const { EVENT_TYPES, SEVERITY, logEvent } = require('./auditLogger');

    // Helper: build WHERE clause for mfa table queries
    function mfaWhere(extra = '') {
        const base = usePortalFilter ? 'portal = ? AND user_id = ?' : 'user_id = ?';
        return extra ? `${base} AND ${extra}` : base;
    }
    function mfaParams(userId, ...rest) {
        return usePortalFilter ? [portal, userId, ...rest] : [userId, ...rest];
    }

    // POST /setup — generate secret + QR URI
    router.post('/setup', async (req, res) => {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
        try {
            const [[user]] = await db.query(`SELECT email FROM \`${usersTable}\` WHERE id = ?`, [userId]);
            if (!user) return res.status(404).json({ success: false, message: 'User not found' });
            const { secret, keyUri, encryptedSecret } = generateSecret(user.email);

            if (usePortalFilter) {
                await db.query(
                    `INSERT INTO portal_mfa (portal, user_id, secret, is_enabled)
                     VALUES (?, ?, ?, 0)
                     ON DUPLICATE KEY UPDATE secret = VALUES(secret), is_enabled = 0`,
                    [portal, userId, encryptedSecret]
                );
            } else {
                await db.query(
                    `INSERT INTO admin_mfa (user_id, secret, is_enabled)
                     VALUES (?, ?, 0)
                     ON DUPLICATE KEY UPDATE secret = VALUES(secret), is_enabled = 0`,
                    [userId, encryptedSecret]
                );
            }
            res.json({ success: true, keyUri, secret });
        } catch (err) {
            res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    // POST /verify-setup — confirm first TOTP code, enable MFA
    router.post('/verify-setup', async (req, res) => {
        const userId = req.user?.id;
        const { totpCode } = req.body;
        if (!userId || !totpCode) return res.status(400).json({ success: false, message: 'Missing required fields' });
        try {
            const [[row]] = await db.query(
                `SELECT secret FROM \`${mfaTable}\` WHERE ${mfaWhere()}`,
                mfaParams(userId)
            );
            if (!row) return res.status(400).json({ success: false, message: 'MFA not initialized. Run /setup first.' });

            if (!verifyCode(totpCode, row.secret)) {
                await logEvent(db, { eventType: EVENT_TYPES.MFA_FAILURE, portal, severity: SEVERITY.MEDIUM,
                    userId, message: `${portal} MFA setup verification failed — wrong TOTP code` });
                return res.status(400).json({ success: false, message: 'Invalid TOTP code' });
            }

            await db.query(
                `UPDATE \`${mfaTable}\` SET is_enabled = 1, setup_at = NOW() WHERE ${mfaWhere()}`,
                mfaParams(userId)
            );
            await logEvent(db, { eventType: EVENT_TYPES.MFA_SETUP, portal, severity: SEVERITY.LOW,
                userId, message: `${portal} MFA enabled` });
            res.json({ success: true, message: 'MFA enabled successfully' });
        } catch (err) {
            res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    // POST /validate — validate TOTP after password step (login step 2)
    router.post('/validate', async (req, res) => {
        const { mfaToken, totpCode } = req.body;
        if (!mfaToken || !totpCode) {
            return res.status(400).json({ success: false, message: 'mfaToken and totpCode required' });
        }
        const { valid, userId, email } = verifyMfaToken(mfaToken, jwtSecret);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'MFA session expired. Please log in again.' });
        }
        try {
            const [[mfa]] = await db.query(
                `SELECT secret FROM \`${mfaTable}\` WHERE ${mfaWhere('is_enabled = 1')}`,
                mfaParams(userId)
            );
            if (!mfa) return res.status(400).json({ success: false, message: 'MFA not configured' });

            if (!verifyCode(totpCode, mfa.secret)) {
                await logEvent(db, { eventType: EVENT_TYPES.MFA_FAILURE, portal, severity: SEVERITY.HIGH,
                    userId, email, message: `${portal} MFA validation failed — wrong TOTP code` });
                return res.status(401).json({ success: false, message: 'Invalid TOTP code' });
            }

            await db.query(
                `UPDATE \`${mfaTable}\` SET last_used_at = NOW() WHERE ${mfaWhere()}`,
                mfaParams(userId)
            );

            const [[user]] = await db.query(
                `SELECT id, \`${nameField}\` AS display_name, email, role FROM \`${usersTable}\` WHERE id = ?`,
                [userId]
            );
            const token = await issueJWT(db, user);

            await logEvent(db, { eventType: EVENT_TYPES.MFA_SUCCESS, portal, severity: SEVERITY.LOW,
                userId, email, message: `${portal} MFA login successful` });

            res.json({ success: true, token, user: { id: user.id, name: user.display_name, email: user.email, role: user.role } });
        } catch (err) {
            res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    // POST /disable — disable MFA (requires current TOTP)
    router.post('/disable', async (req, res) => {
        const userId = req.user?.id;
        const { totpCode } = req.body;
        if (!userId || !totpCode) return res.status(400).json({ success: false, message: 'Missing fields' });
        try {
            const [[row]] = await db.query(
                `SELECT secret FROM \`${mfaTable}\` WHERE ${mfaWhere('is_enabled = 1')}`,
                mfaParams(userId)
            );
            if (!row) return res.status(400).json({ success: false, message: 'MFA is not enabled' });
            if (!verifyCode(totpCode, row.secret)) {
                return res.status(401).json({ success: false, message: 'Invalid TOTP code' });
            }
            await db.query(
                `UPDATE \`${mfaTable}\` SET is_enabled = 0 WHERE ${mfaWhere()}`,
                mfaParams(userId)
            );
            await logEvent(db, { eventType: EVENT_TYPES.ADMIN_ACTION, portal, severity: SEVERITY.MEDIUM,
                userId, message: `${portal} MFA disabled` });
            res.json({ success: true, message: 'MFA disabled' });
        } catch (err) {
            res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    return router;
}

module.exports = { generateSecret, verifyCode, issueMfaToken, verifyMfaToken, makeRoutes };
