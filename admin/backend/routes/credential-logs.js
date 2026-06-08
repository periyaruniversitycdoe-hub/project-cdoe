'use strict';

const express = require('express');
const { safeError } = require('../../../shared/security/safeError');
const router  = express.Router();
const pool    = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Auto-create table on startup (with password-change tracking columns)
pool.execute(`
    CREATE TABLE IF NOT EXISTS credential_logs (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        user_name            VARCHAR(255) NOT NULL,
        email                VARCHAR(255) NOT NULL,
        plain_password       VARCHAR(255) NOT NULL,
        portal_type          ENUM('Student','Supervisor','Center','Admin') NOT NULL,
        account_status       VARCHAR(50)  NOT NULL DEFAULT 'Active',
        login_url            VARCHAR(500) DEFAULT NULL,
        email_sent           TINYINT(1)   NOT NULL DEFAULT 0,
        password_changed     TINYINT(1)   NOT NULL DEFAULT 0,
        password_changed_at  TIMESTAMP    NULL DEFAULT NULL,
        password_change_ip   VARCHAR(45)  NULL DEFAULT NULL,
        created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_clog_portal  (portal_type),
        INDEX idx_clog_email   (email),
        INDEX idx_clog_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`).catch(() => {});

// Add new columns to existing tables (idempotent)
['ALTER TABLE credential_logs ADD COLUMN password_changed TINYINT(1) NOT NULL DEFAULT 0',
 'ALTER TABLE credential_logs ADD COLUMN password_changed_at TIMESTAMP NULL DEFAULT NULL',
 'ALTER TABLE credential_logs ADD COLUMN password_change_ip VARCHAR(45) NULL DEFAULT NULL',
].forEach(sql => pool.execute(sql).catch(() => {}));

// â”€â”€ GET /api/credential-logs â€” list with search, filter, pagination â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const page      = Math.max(1, parseInt(req.query.page)  || 1);
        const isAll     = req.query.limit === 'all';
        const limit     = isAll ? null : Math.min(200, parseInt(req.query.limit) || 20);
        const offset    = isAll ? null : (page - 1) * limit;
        const portal    = req.query.portal  || '';   // 'Student'|'Supervisor'|'Center'|'Admin'
        const search    = (req.query.search || '').trim();
        const status    = req.query.status  || '';
        const { year, month, course } = req.query;

        const conditions = [];
        const params     = [];

        if (portal) { conditions.push('cl.portal_type = ?'); params.push(portal); }
        if (status) { conditions.push('cl.account_status = ?'); params.push(status); }
        if (search) {
            conditions.push('(cl.user_name LIKE ? OR cl.email LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }
        if (year) {
            conditions.push('s.year = ?');
            params.push(parseInt(year, 10));
        }
        if (month) {
            conditions.push('s.month = ?');
            params.push(month);
        }
        if (course) {
            if (course === 'Ph.D') {
                conditions.push("(a.program_offered_name LIKE 'Ph.D.%' OR (a.program_offered_name IS NOT NULL AND a.program_offered_name != ''))");
            } else if (course === 'M.Phil') {
                conditions.push("(a.has_mphil = 1 OR a.program_offered_name LIKE 'M.Phil.%')");
            } else if (course === 'Integrated Course') {
                conditions.push("a.has_integrated = 1");
            } else if (course === 'Full Time') {
                conditions.push("a.category = 'Full Time'");
            } else if (course === 'Part Time') {
                conditions.push("a.category = 'Part Time'");
            }
        }

        const WHERE = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const baseQuery = `FROM credential_logs cl
             LEFT JOIN users u ON cl.email COLLATE utf8mb4_unicode_ci = u.email AND cl.portal_type = 'Student'
             LEFT JOIN applications a ON a.user_id = u.id
             LEFT JOIN sessions s ON s.id = COALESCE(a.session_id, u.session_id)
             ${WHERE}`;

        const [[{ total }]] = await pool.execute(
            `SELECT COUNT(*) AS total ${baseQuery}`,
            params
        );

        const selectQuery = `SELECT cl.id, cl.user_name, cl.email, cl.plain_password, cl.portal_type, cl.account_status, cl.login_url,
                    cl.email_sent, cl.password_changed, cl.password_changed_at, cl.password_change_ip, cl.created_at
               ${baseQuery}
               ORDER BY cl.created_at DESC`;

        // pool.execute (prepared stmts) misfires on LIMIT/OFFSET â€” embed as integers and use pool.query
        const finalQuery = isAll
            ? selectQuery
            : `${selectQuery} LIMIT ${limit} OFFSET ${offset}`;
        const [rows] = await pool.query(finalQuery, params);

        // Portal-wise summary counts
        const [summaryRows] = await pool.execute(
            `SELECT portal_type, COUNT(*) AS cnt FROM credential_logs GROUP BY portal_type`
        );
        const summary = { Student: 0, Supervisor: 0, Center: 0, Admin: 0, total: 0 };
        summaryRows.forEach(r => {
            summary[r.portal_type] = r.cnt;
            summary.total += r.cnt;
        });

        res.json({
            success: true,
            data:    rows,
            meta:    { total, page, limit: isAll ? 'all' : limit, pages: isAll ? 1 : Math.ceil(total / limit) },
            summary,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// â”€â”€ GET /api/credential-logs/:id â€” single credential detail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, user_name, email, plain_password, portal_type, account_status, login_url,
                    email_sent, password_changed, password_changed_at, password_change_ip, created_at
               FROM credential_logs WHERE id = ?`,
            [req.params.id]
        );
        if (rows.length === 0)
            return res.status(404).json({ success: false, message: 'Credential log not found' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// â”€â”€ DELETE /api/credential-logs/:id â€” remove a single log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.execute('DELETE FROM credential_logs WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

module.exports = router;
