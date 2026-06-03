/**
 * Input Sanitizer — Layer 3 Security
 * Strips XSS payloads, null bytes, and oversized strings from
 * all incoming JSON/form bodies before they reach route handlers.
 *
 * Does NOT replace parameterized queries — this is a defence-in-depth
 * layer that catches obvious probe payloads early.
 */

// Patterns that indicate an XSS/injection probe
const XSS_PATTERNS = [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /javascript\s*:/gi,
    /on\w+\s*=\s*["'`]?[^"'`>]*/gi,        // onerror=, onclick=, etc.
    /<iframe[\s\S]*?>/gi,
    /<object[\s\S]*?>/gi,
    /<embed[\s\S]*?>/gi,
    /data:\s*text\/html/gi,
    /vbscript\s*:/gi,
];

// HTML entities to strip (angular brackets, null byte)
const STRIP_CHARS = /[\x00<>]/g;

const MAX_STRING_LENGTH = 10_000; // reject fields longer than 10 KB

/**
 * Recursively sanitize a value.
 * Strings: trim, strip null bytes + angular brackets, reject XSS patterns.
 * Objects/arrays: recurse.
 * Numbers/booleans: pass through.
 */
function sanitizeValue(val, fieldName = '') {
    if (val === null || val === undefined) return val;

    if (typeof val === 'string') {
        if (val.length > MAX_STRING_LENGTH) {
            throw new SanitizeError(`Field '${fieldName}' exceeds maximum length`);
        }
        for (const pattern of XSS_PATTERNS) {
            pattern.lastIndex = 0;
            if (pattern.test(val)) {
                throw new SanitizeError(`Field '${fieldName}' contains disallowed content`);
            }
        }
        // Remove null bytes and lone angle brackets
        return val.replace(STRIP_CHARS, '');
    }

    if (Array.isArray(val)) {
        return val.map((item, i) => sanitizeValue(item, `${fieldName}[${i}]`));
    }

    if (typeof val === 'object') {
        const out = {};
        for (const key of Object.keys(val)) {
            // Reject prototype-pollution keys
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                continue;
            }
            out[key] = sanitizeValue(val[key], key);
        }
        return out;
    }

    return val; // number, boolean, etc.
}

class SanitizeError extends Error {
    constructor(msg) { super(msg); this.name = 'SanitizeError'; }
}

/**
 * Express middleware — sanitize req.body in place.
 * Returns 400 if any field contains an XSS payload or is too long.
 */
function sanitizeBody(req, res, next) {
    if (!req.body || typeof req.body !== 'object') return next();
    try {
        req.body = sanitizeValue(req.body, 'body');
        next();
    } catch (err) {
        if (err instanceof SanitizeError) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next(err);
    }
}

/**
 * Express middleware — sanitize req.query in place.
 * Same rules as body sanitizer.
 */
function sanitizeQuery(req, res, next) {
    if (!req.query) return next();
    try {
        req.query = sanitizeValue(req.query, 'query');
        next();
    } catch (err) {
        if (err instanceof SanitizeError) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next(err);
    }
}

/**
 * Combined middleware — sanitizes both body and query.
 */
function sanitize(req, res, next) {
    try {
        if (req.body  && typeof req.body  === 'object') req.body  = sanitizeValue(req.body,  'body');
        if (req.query && typeof req.query === 'object') req.query = sanitizeValue(req.query, 'query');
        next();
    } catch (err) {
        if (err instanceof SanitizeError) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next(err);
    }
}

module.exports = { sanitize, sanitizeBody, sanitizeQuery };
