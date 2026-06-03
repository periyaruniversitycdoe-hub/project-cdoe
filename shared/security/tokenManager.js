/**
 * Token Manager
 * Issues short-lived JWT access tokens (15 min) and long-lived refresh tokens (7 days).
 * Refresh tokens are stored in DB (hashed) and rotated on every use.
 *
 * Migration strategy:
 *   - Old clients using the legacy 7-day `token` field still work.
 *   - New clients use `accessToken` + `refreshToken` and call /api/auth/refresh.
 */
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_EXPIRY  = '15m';
const REFRESH_EXPIRY = 7 * 24 * 60 * 60; // seconds (7 days)

function hashToken(raw) {
    return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Issue a new access + refresh token pair.
 * Stores the refresh token hash in the DB.
 *
 * @param {object} db
 * @param {object} payload    - { id, email, role, application_id? }
 * @param {string} portal     - 'student'|'admin'|'supervisor'|'center'
 * @param {string} jwtSecret
 * @param {object} [reqMeta]  - { ip, deviceHash } for tracking
 * @returns {{ accessToken, refreshToken, expiresIn }}
 */
async function issueTokenPair(db, payload, portal, jwtSecret, reqMeta = {}) {
    const accessToken = jwt.sign(payload, jwtSecret, { expiresIn: ACCESS_EXPIRY });

    const rawRefresh   = crypto.randomBytes(40).toString('hex');
    const refreshHash  = hashToken(rawRefresh);
    const expiresAt    = new Date(Date.now() + REFRESH_EXPIRY * 1000);

    // Revoke any existing refresh tokens for this user+portal before inserting new one
    await db.query(
        `UPDATE refresh_tokens SET revoked = 1, revoked_at = NOW()
          WHERE user_id = ? AND portal = ? AND revoked = 0`,
        [payload.id, portal]
    );

    await db.query(
        `INSERT INTO refresh_tokens (user_id, portal, token_hash, device_hash, ip_address, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [payload.id, portal, refreshHash, reqMeta.deviceHash || null, reqMeta.ip || null, expiresAt]
    );

    return {
        accessToken,
        refreshToken: rawRefresh,
        expiresIn:    15 * 60, // seconds
    };
}

/**
 * Rotate a refresh token: validate, revoke old, issue new pair.
 * @returns {{ accessToken, refreshToken, expiresIn, payload }}
 */
async function rotateRefreshToken(db, rawRefresh, portal, jwtSecret, reqMeta = {}) {
    const hash = hashToken(rawRefresh);

    const [[row]] = await db.query(
        `SELECT rt.*, u.id AS uid, u.email, u.role, u.application_id
           FROM refresh_tokens rt
           JOIN users u ON u.id = rt.user_id
          WHERE rt.token_hash = ? AND rt.portal = ? AND rt.revoked = 0`,
        [hash, portal]
    );

    if (!row) throw new Error('REFRESH_TOKEN_INVALID');
    if (new Date(row.expires_at) < new Date()) {
        await db.query(`UPDATE refresh_tokens SET revoked = 1, revoked_at = NOW() WHERE token_hash = ?`, [hash]);
        throw new Error('REFRESH_TOKEN_EXPIRED');
    }

    const payload = { id: row.user_id, email: row.email, role: row.role };
    if (row.application_id) payload.application_id = row.application_id;

    const tokens = await issueTokenPair(db, payload, portal, jwtSecret, reqMeta);
    return { ...tokens, payload };
}

/**
 * Revoke all refresh tokens for a user (logout).
 */
async function revokeAllTokens(db, userId, portal) {
    await db.query(
        `UPDATE refresh_tokens SET revoked = 1, revoked_at = NOW()
          WHERE user_id = ? AND portal = ? AND revoked = 0`,
        [userId, portal]
    );
}

/**
 * Express route handler: POST /api/auth/refresh
 * Expects { refreshToken } in body, returns new { accessToken, refreshToken }.
 */
function refreshHandler(db, portal, jwtSecret) {
    return async (req, res) => {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ success: false, message: 'Refresh token required' });
        }
        try {
            const reqMeta = {
                ip:          req.headers['x-real-ip'] || req.ip || 'unknown',
                deviceHash:  crypto.createHash('sha256')
                                  .update(`${req.headers['user-agent'] || ''}:${req.headers['accept-language'] || ''}`)
                                  .digest('hex').substring(0, 16),
            };
            const result = await rotateRefreshToken(db, refreshToken, portal, jwtSecret, reqMeta);
            return res.json({
                success:      true,
                accessToken:  result.accessToken,
                refreshToken: result.refreshToken,
                expiresIn:    result.expiresIn,
            });
        } catch (err) {
            const msg = err.message === 'REFRESH_TOKEN_EXPIRED'
                ? 'Session expired. Please log in again.'
                : 'Invalid refresh token. Please log in again.';
            return res.status(401).json({ success: false, message: msg, errorCode: err.message });
        }
    };
}

module.exports = { issueTokenPair, rotateRefreshToken, revokeAllTokens, refreshHandler, hashToken };
