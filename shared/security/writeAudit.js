'use strict';

/**
 * Write-operation audit logger — records before/after values for PUT/DELETE/POST
 * on sensitive admin tables. Called explicitly in route handlers.
 *
 * Usage:
 *   const { auditWrite } = require('../../../shared/security/writeAudit');
 *   await auditWrite(db, { req, action: 'UPDATE', table: 'university_settings',
 *       recordId: id, before: oldRow, after: newData });
 */

const SENSITIVE_FIELDS = ['password', 'secret', 'token', 'key', 'hash'];

function redactSensitive(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        out[k] = SENSITIVE_FIELDS.some(f => k.toLowerCase().includes(f)) ? '[REDACTED]' : v;
    }
    return out;
}

/**
 * @param {object} db        - mysql2 pool
 * @param {object} opts
 * @param {object} opts.req  - Express request (for user + IP)
 * @param {string} opts.action  - 'CREATE' | 'UPDATE' | 'DELETE'
 * @param {string} opts.table   - DB table name
 * @param {*}      opts.recordId - Primary key of the affected record
 * @param {object} [opts.before] - Row state before change (for UPDATE/DELETE)
 * @param {object} [opts.after]  - Row state after change (for CREATE/UPDATE)
 */
async function auditWrite(db, opts) {
    const {
        req,
        action,
        table,
        recordId = null,
        before   = null,
        after    = null,
    } = opts;

    const userId    = req?.user?.id    || null;
    const userEmail = req?.user?.email || null;
    const ip        = req?.headers?.['x-real-ip'] ||
                      req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
                      req?.ip || 'unknown';
    const requestId = req?.requestId || null;

    const meta = JSON.stringify({
        table,
        recordId,
        before: before ? redactSensitive(before) : undefined,
        after:  after  ? redactSensitive(after)  : undefined,
    });

    try {
        await db.query(
            `INSERT INTO admin_write_audit
                (action, table_name, record_id, user_id, user_email,
                 ip_address, request_id, meta, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [action, table, recordId ? String(recordId) : null,
             userId, userEmail, ip, requestId, meta]
        );
    } catch (_) {
        // Never crash the app due to audit failure
    }
}

module.exports = { auditWrite };
