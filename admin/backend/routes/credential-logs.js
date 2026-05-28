'use strict';

const express = require('express');
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

// ── GET /api/credential-logs — list with search, filter, pagination ───────────
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const page      = Math.max(1, parseInt(req.query.page)  || 1);
        const limit     = Math.min(100, parseInt(req.query.limit) || 20);
        const offset    = (page - 1) * limit;
        const portal    = req.query.portal  || '';   // 'Student'|'Supervisor'|'Center'|'Admin'
        const search    = (req.query.search || '').trim();
        const status    = req.query.status  || '';

        const conditions = [];
        const params     = [];

        if (portal) { conditions.push('portal_type = ?'); params.push(portal); }
        if (status) { conditions.push('account_status = ?'); params.push(status); }
        if (search) {
            conditions.push('(user_name LIKE ? OR email LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        const WHERE = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const [[{ total }]] = await pool.execute(
            `SELECT COUNT(*) AS total FROM credential_logs ${WHERE}`,
            params
        );

        const [rows] = await pool.execute(
            `SELECT id, user_name, email, plain_password, portal_type, account_status, login_url,
                    email_sent, password_changed, password_changed_at, password_change_ip, created_at
               FROM credential_logs
              ${WHERE}
              ORDER BY created_at DESC
              LIMIT ${limit} OFFSET ${offset}`,
            params
        );

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
            meta:    { total, page, limit, pages: Math.ceil(total / limit) },
            summary,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/credential-logs/:id — single credential detail ──────────────────
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
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── DELETE /api/credential-logs/:id — remove a single log ────────────────────
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.execute('DELETE FROM credential_logs WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
