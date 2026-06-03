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

// Encryption key for storing secrets at rest
const SECRET_KEY = Buffer.from(
    process.env.MFA_ENCRYPTION_KEY || '00000000000000000000000000000000',
    'hex'
);

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
 * Express route handlers — mount these in admin backend
 *
 * POST /api/auth/mfa/setup
 *   Requires: authenticateToken
 *   Response: { keyUri, secret (plaintext, show once) }
 *
 * POST /api/auth/mfa/verify-setup
 *   Requires: authenticateToken, body: { totpCode }
 *   Enables MFA if code is correct
 *
 * POST /api/auth/mfa/validate
 *   Public (uses mfaToken from login step 1)
 *   Body: { mfaToken, totpCode }
 *   Response: { token (JWT), user }
 *
 * POST /api/auth/mfa/disable
 *   Requires: authenticateToken + TOTP verification
 */
function makeRoutes(db, jwtSecret, issueJWT) {
    const router = require('express').Router();
    const { EVENT_TYPES, SEVERITY, logEvent } = require('./auditLogger');

    // Setup: generate secret + QR URI
    router.post('/setup', async (req, res) => {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
        try {
            const [[user]] = await db.query('SELECT email FROM users WHERE id = ?', [userId]);
            const { secret, keyUri, encryptedSecret } = generateSecret(user.email);

            // Store (unconfirmed) — is_enabled stays 0 until verify-setup
            await db.query(
                `INSERT INTO admin_mfa (user_id, secret, is_enabled)
                 VALUES (?, ?, 0)
                 ON DUPLICATE KEY UPDATE secret = VALUES(secret), is_enabled = 0`,
                [userId, encryptedSecret]
            );

            res.json({ success: true, keyUri, secret });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // Confirm setup: verify first TOTP code
    router.post('/verify-setup', async (req, res) => {
        const userId   = req.user?.id;
        const { totpCode } = req.body;
        if (!userId || !totpCode) return res.status(400).json({ success: false, message: 'Missing required fields' });
        try {
            const [[row]] = await db.query('SELECT secret FROM admin_mfa WHERE user_id = ?', [userId]);
            if (!row) return res.status(400).json({ success: false, message: 'MFA not initialized. Run /setup first.' });

            if (!verifyCode(totpCode, row.secret)) {
                await logEvent(db, { eventType: EVENT_TYPES.MFA_FAILURE, portal: 'admin', severity: SEVERITY.MEDIUM,
                    userId, message: 'MFA setup verification failed — wrong TOTP code' });
                return res.status(400).json({ success: false, message: 'Invalid TOTP code' });
            }

            await db.query(
                `UPDATE admin_mfa SET is_enabled = 1, setup_at = NOW() WHERE user_id = ?`,
                [userId]
            );
            await logEvent(db, { eventType: EVENT_TYPES.MFA_SETUP, portal: 'admin', severity: SEVERITY.LOW,
                userId, message: 'Admin MFA enabled' });
            res.json({ success: true, message: 'MFA enabled successfully' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // Validate TOTP after password step (login step 2)
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
                `SELECT secret FROM admin_mfa WHERE user_id = ? AND is_enabled = 1`,
                [userId]
            );
            if (!mfa) return res.status(400).json({ success: false, message: 'MFA not configured' });

            if (!verifyCode(totpCode, mfa.secret)) {
                await logEvent(db, { eventType: EVENT_TYPES.MFA_FAILURE, portal: 'admin', severity: SEVERITY.HIGH,
                    userId, email, message: 'MFA validation failed — wrong TOTP code' });
                return res.status(401).json({ success: false, message: 'Invalid TOTP code' });
            }

            await db.query(`UPDATE admin_mfa SET last_used_at = NOW() WHERE user_id = ?`, [userId]);

            const [[user]] = await db.query('SELECT id, full_name, email, role FROM users WHERE id = ?', [userId]);
            const token = await issueJWT(db, user);

            await logEvent(db, { eventType: EVENT_TYPES.MFA_SUCCESS, portal: 'admin', severity: SEVERITY.LOW,
                userId, email, message: 'Admin MFA login successful' });

            res.json({ success: true, token, user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role } });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // Disable MFA (requires current TOTP)
    router.post('/disable', async (req, res) => {
        const userId = req.user?.id;
        const { totpCode } = req.body;
        if (!userId || !totpCode) return res.status(400).json({ success: false, message: 'Missing fields' });
        try {
            const [[row]] = await db.query('SELECT secret FROM admin_mfa WHERE user_id = ? AND is_enabled = 1', [userId]);
            if (!row) return res.status(400).json({ success: false, message: 'MFA is not enabled' });
            if (!verifyCode(totpCode, row.secret)) {
                return res.status(401).json({ success: false, message: 'Invalid TOTP code' });
            }
            await db.query(`UPDATE admin_mfa SET is_enabled = 0 WHERE user_id = ?`, [userId]);
            await logEvent(db, { eventType: EVENT_TYPES.ADMIN_ACTION, portal: 'admin', severity: SEVERITY.MEDIUM,
                userId, message: 'Admin MFA disabled' });
            res.json({ success: true, message: 'MFA disabled' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    return router;
}

module.exports = { generateSecret, verifyCode, issueMfaToken, verifyMfaToken, makeRoutes };
