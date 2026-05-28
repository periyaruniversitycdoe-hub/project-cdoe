const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');

// Get center notifications
router.get('/', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT * FROM notifications 
             WHERE user_id = ? AND target_type = 'center' 
             ORDER BY created_at DESC LIMIT 50`,
            [req.user.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
    }
});

// Mark as read
router.put('/:id/read', verifyToken, async (req, res) => {
    try {
        await pool.execute(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ? AND target_type = "center"',
            [req.params.id, req.user.id]
        );
        res.json({ success: true, message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update' });
    }
});

module.exports = router;
