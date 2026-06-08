const { safeError } = require('../../../shared/security/safeError');
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../../shared/middleware/auth');
const pool = require('../config/db');
const { enqueueEmail } = require('../../../shared/utils/notification');
const { validateMailPayload } = require('../../../nodemailer/backend/src/validators/mail.validator');

/**
 * @route   POST /api/mail/send
 * @desc    Admin manually sends an email to a user (enqueues via outbox)
 */
router.post('/send', authenticateToken, async (req, res, next) => {
    try {
        const { to, subject, title, message } = req.body;

        if (!to || !subject || !message) {
            return res.status(400).json({ success: false, message: 'Recipient, subject, and message are required' });
        }

        await enqueueEmail(pool, {
            to_email: to,
            subject,
            title: title || subject,
            message
        });

        res.json({ success: true, message: 'Email enqueued for delivery' });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   GET /api/mail/stats
 * @desc    Queue-level stats (pending / sent / failed counts)
 */
router.get('/stats', authenticateToken, async (req, res, next) => {
    try {
        const [[stats]] = await pool.execute(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'pending'               THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status IN ('completed','sent')   THEN 1 ELSE 0 END) AS sent,
                SUM(CASE WHEN status = 'failed'                THEN 1 ELSE 0 END) AS failed,
                SUM(CASE WHEN status = 'processing'            THEN 1 ELSE 0 END) AS processing
            FROM email_queue
        `);
        res.json({ success: true, data: stats });
    } catch (err) {
        next(err);
    }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ENTERPRISE EMAIL DELIVERY LOG  (Failover visibility â€” Admin only)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * @route   GET /api/mail/delivery-stats
 * @desc    Aggregate provider performance metrics for the delivery log dashboard
 */
router.get('/delivery-stats', authenticateToken, async (req, res, next) => {
    try {
        // Ensure table exists before querying (guard for cold starts)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS email_delivery_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ref_id VARCHAR(50) NOT NULL UNIQUE,
                to_email VARCHAR(255) NOT NULL,
                subject VARCHAR(500) NOT NULL,
                template_name VARCHAR(100) NULL,
                primary_provider VARCHAR(50) NOT NULL DEFAULT 'nodemailer',
                fallback_provider VARCHAR(50) NOT NULL DEFAULT 'brevo',
                delivered_by VARCHAR(50) NULL,
                delivery_status ENUM('delivered_primary','delivered_fallback','failed_both','in_progress') NOT NULL DEFAULT 'in_progress',
                primary_attempted TINYINT(1) NOT NULL DEFAULT 0,
                fallback_triggered TINYINT(1) NOT NULL DEFAULT 0,
                primary_error TEXT NULL,
                fallback_error TEXT NULL,
                primary_message_id VARCHAR(255) NULL,
                fallback_message_id VARCHAR(255) NULL,
                processing_duration_ms INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                sent_at DATETIME NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        const [[overall]] = await pool.query(`
            SELECT
                COUNT(*)                                                          AS total,
                SUM(delivery_status = 'delivered_primary')                        AS delivered_primary,
                SUM(delivery_status = 'delivered_fallback')                       AS delivered_fallback,
                SUM(delivery_status = 'failed_both')                              AS failed_both,
                SUM(delivery_status = 'in_progress')                              AS in_progress,
                SUM(fallback_triggered = 1)                                        AS fallback_events,
                SUM(delivered_by = 'nodemailer')                                  AS sent_via_nodemailer,
                SUM(delivered_by = 'brevo')                                       AS sent_via_brevo,
                ROUND(AVG(CASE WHEN processing_duration_ms IS NOT NULL THEN processing_duration_ms END), 0) AS avg_duration_ms,
                ROUND(SUM(delivery_status IN ('delivered_primary','delivered_fallback')) * 100.0 / NULLIF(COUNT(*),0), 2) AS delivery_rate_pct
            FROM email_delivery_log
        `);

        const [[today]] = await pool.query(`
            SELECT
                COUNT(*) AS total,
                SUM(delivery_status = 'delivered_primary')  AS delivered_primary,
                SUM(delivery_status = 'delivered_fallback') AS delivered_fallback,
                SUM(delivery_status = 'failed_both')        AS failed_both,
                SUM(fallback_triggered = 1)                  AS fallback_events
            FROM email_delivery_log
            WHERE DATE(created_at) = CURDATE()
        `);

        // Last 7-day trend
        const [trend] = await pool.query(`
            SELECT
                DATE(created_at)                            AS day,
                COUNT(*)                                    AS total,
                SUM(delivery_status = 'delivered_primary')  AS primary_ok,
                SUM(delivery_status = 'delivered_fallback') AS fallback_ok,
                SUM(delivery_status = 'failed_both')        AS failed,
                SUM(fallback_triggered = 1)                  AS fallbacks
            FROM email_delivery_log
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(created_at)
            ORDER BY day ASC
        `);

        res.json({
            success: true,
            data: {
                overall,
                today,
                trend,
                providers: {
                    primary:  'Nodemailer (SMTP)',
                    fallback: 'Brevo (HTTP API)'
                }
            }
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   GET /api/mail/delivery-log
 * @desc    Paginated list of email delivery attempts with failover details
 * @query   page, limit, status, provider, fallback_only, from_date, to_date, search
 */
router.get('/delivery-log', authenticateToken, async (req, res, next) => {
    try {
        const page          = Math.max(1, parseInt(req.query.page  || '1',  10));
        const limit         = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
        const offset        = (page - 1) * limit;
        const status        = req.query.status        || null; // delivered_primary | delivered_fallback | failed_both | in_progress
        const provider      = req.query.provider      || null; // nodemailer | brevo
        const fallbackOnly  = req.query.fallback_only === '1';
        const fromDate      = req.query.from_date     || null; // YYYY-MM-DD
        const toDate        = req.query.to_date       || null; // YYYY-MM-DD
        const search        = req.query.search        || null; // email / subject keyword

        const wheres = [];
        const params = [];

        if (status)       { wheres.push('delivery_status = ?');     params.push(status); }
        if (provider)     { wheres.push('delivered_by = ?');        params.push(provider); }
        if (fallbackOnly) { wheres.push('fallback_triggered = 1'); }
        if (fromDate)     { wheres.push('DATE(created_at) >= ?');   params.push(fromDate); }
        if (toDate)       { wheres.push('DATE(created_at) <= ?');   params.push(toDate); }
        if (search)       { wheres.push('(to_email LIKE ? OR subject LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

        const where = wheres.length > 0 ? `WHERE ${wheres.join(' AND ')}` : '';

        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total FROM email_delivery_log ${where}`,
            params
        );

        const [rows] = await pool.query(
            `SELECT
                id, ref_id, to_email, subject, template_name,
                primary_provider, fallback_provider, delivered_by,
                delivery_status, primary_attempted, fallback_triggered,
                primary_error, fallback_error,
                primary_message_id, fallback_message_id,
                processing_duration_ms, created_at, sent_at
             FROM email_delivery_log
             ${where}
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json({
            success: true,
            data: {
                rows,
                pagination: {
                    total: parseInt(total),
                    page,
                    limit,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   GET /api/mail/delivery-log/:ref_id
 * @desc    Full detail for a single delivery attempt (for modal/drill-down)
 */
router.get('/delivery-log/:ref_id', authenticateToken, async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM email_delivery_log WHERE ref_id = ? LIMIT 1',
            [req.params.ref_id]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Log entry not found' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
