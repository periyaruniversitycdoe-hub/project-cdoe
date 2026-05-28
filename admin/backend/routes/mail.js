const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../../shared/middleware/auth');
const pool = require('../config/db');
const { enqueueEmail } = require('../../../shared/utils/notification');
const { validateMailPayload } = require('../../../nodemailer/backend/src/validators/mail.validator');

/**
 * @route   POST /api/mail/send
 * @desc    Admin manually sends an email to a user
 */
router.post('/send', authenticateToken, async (req, res, next) => {
    try {
        const { to, subject, title, message } = req.body;

        // Validation (Reusing the common validator logic)
        if (!to || !subject || !message) {
            return res.status(400).json({ success: false, message: 'Recipient, subject, and message are required' });
        }

        // Action queue entry
        await enqueueEmail(pool, {
            to_email: to,
            subject,
            title: title || subject,
            message
        });

        res.json({
            success: true,
            message: 'Email enqueued for delivery'
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   GET /api/mail/stats
 * @desc    Get stats of sent/pending emails
 */
router.get('/stats', authenticateToken, async (req, res, next) => {
    try {
        const [[stats]] = await pool.execute(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'completed' OR status = 'sent' THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM email_queue
        `);
        res.json({ success: true, data: stats });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
