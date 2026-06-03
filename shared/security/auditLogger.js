/**
 * Security Audit Logger
 * Records all security-relevant events to the security_events table.
 * Every layer calls this to build a forensic trail with request correlation.
 */
const crypto = require('crypto');

const EVENT_TYPES = {
    LOGIN_SUCCESS:          'LOGIN_SUCCESS',
    LOGIN_FAILURE:          'LOGIN_FAILURE',
    LOGIN_BLOCKED:          'LOGIN_BLOCKED',
    LOGOUT:                 'LOGOUT',
    TOKEN_REFRESHED:        'TOKEN_REFRESHED',
    TOKEN_REVOKED:          'TOKEN_REVOKED',
    TOKEN_INVALID:          'TOKEN_INVALID',
    ACCOUNT_LOCKED:         'ACCOUNT_LOCKED',
    ACCOUNT_UNLOCKED:       'ACCOUNT_UNLOCKED',
    PASSWORD_CHANGED:       'PASSWORD_CHANGED',
    PASSWORD_RESET:         'PASSWORD_RESET',
    OTP_SENT:               'OTP_SENT',
    OTP_VERIFIED:           'OTP_VERIFIED',
    OTP_FAILED:             'OTP_FAILED',
    MFA_SETUP:              'MFA_SETUP',
    MFA_SUCCESS:            'MFA_SUCCESS',
    MFA_FAILURE:            'MFA_FAILURE',
    FILE_UPLOAD:            'FILE_UPLOAD',
    FILE_UPLOAD_REJECTED:   'FILE_UPLOAD_REJECTED',
    FILE_DOWNLOAD:          'FILE_DOWNLOAD',
    FILE_MALWARE_DETECTED:  'FILE_MALWARE_DETECTED',
    ACCESS_DENIED:          'ACCESS_DENIED',
    IDOR_ATTEMPT:           'IDOR_ATTEMPT',
    RATE_LIMIT_EXCEEDED:    'RATE_LIMIT_EXCEEDED',
    SUSPICIOUS_PAYLOAD:     'SUSPICIOUS_PAYLOAD',
    IP_BLOCKED:             'IP_BLOCKED',
    REGISTRATION:           'REGISTRATION',
    DATA_EXPORT:            'DATA_EXPORT',
    ADMIN_ACTION:           'ADMIN_ACTION',
};

const SEVERITY = {
    LOW:      'low',
    MEDIUM:   'medium',
    HIGH:     'high',
    CRITICAL: 'critical',
};

function getClientIP(req) {
    return (
        req.headers['x-real-ip'] ||
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.ip ||
        req.socket?.remoteAddress ||
        'unknown'
    );
}

function getDeviceFingerprint(req) {
    const ua = req.headers['user-agent'] || '';
    const lang = req.headers['accept-language'] || '';
    return crypto
        .createHash('sha256')
        .update(`${ua}:${lang}`)
        .digest('hex')
        .substring(0, 16);
}

/**
 * Log a security event.
 * @param {object} db        - mysql2 pool
 * @param {object} opts
 * @param {string} opts.eventType  - EVENT_TYPES.*
 * @param {string} opts.portal     - 'student'|'admin'|'supervisor'|'center'|'gateway'
 * @param {string} opts.severity   - SEVERITY.*
 * @param {object} [opts.req]      - Express request object
 * @param {number} [opts.userId]   - Authenticated user ID
 * @param {string} [opts.email]    - User email
 * @param {string} [opts.message]  - Human-readable summary
 * @param {object} [opts.meta]     - Additional JSON metadata
 */
async function logEvent(db, opts) {
    const {
        eventType,
        portal    = 'unknown',
        severity  = SEVERITY.LOW,
        req       = null,
        userId    = null,
        email     = null,
        message   = '',
        meta      = {},
    } = opts;

    const ip              = req ? getClientIP(req) : (meta.ip || 'unknown');
    const deviceHash      = req ? getDeviceFingerprint(req) : null;
    const requestId       = req?.requestId || meta.requestId || null;
    const userAgent       = req?.headers?.['user-agent']?.substring(0, 255) || null;

    try {
        await db.query(
            `INSERT INTO security_events
                (event_type, portal, severity, user_id, email, ip_address,
                 device_fingerprint, request_id, user_agent, message, meta)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                eventType,
                portal,
                severity,
                userId   || null,
                email    || null,
                ip,
                deviceHash,
                requestId,
                userAgent,
                message.substring(0, 500),
                JSON.stringify(meta),
            ]
        );
    } catch (err) {
        // Never crash the app due to audit failure — log to console only
        console.error('[AuditLogger] Failed to write security event:', err.message, { eventType, portal });
    }
}

/**
 * Express middleware that injects logEvent helper onto req.
 * Usage: app.use(auditLogger.middleware(db, 'student'))
 */
function middleware(db, portal) {
    return (req, _res, next) => {
        req.audit = (eventType, opts = {}) =>
            logEvent(db, { eventType, portal, req, ...opts });
        next();
    };
}

module.exports = { logEvent, middleware, EVENT_TYPES, SEVERITY };
