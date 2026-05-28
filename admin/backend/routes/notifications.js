'use strict';

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Auto-create table on load (idempotent)
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS portal_notifications (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                title        VARCHAR(255) NOT NULL,
                content      TEXT         NULL,
                type         ENUM('notification','date','guideline') NOT NULL DEFAULT 'notification',
                priority     INT          NOT NULL DEFAULT 0,
                is_active    TINYINT(1)   NOT NULL DEFAULT 1,
                published_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
                created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
                updated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
    } catch (err) {
        console.error('[notifications] Schema error:', err.message);
    }
})();

// GET /api/notifications — list all (admin)
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM portal_notifications ORDER BY priority DESC, published_at DESC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/notifications — create
router.post('/', verifyToken, isAdmin, async (req, res) => {
    const { title, content, type = 'notification', priority = 0, is_active = 1, published_at } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });
    try {
        const [result] = await pool.query(
            `INSERT INTO portal_notifications (title, content, type, priority, is_active, published_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [title, content || null, type, priority, is_active, published_at || new Date()]
        );
        res.status(201).json({ success: true, message: 'Notification created', id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/notifications/:id — update
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    const { title, content, type, priority, is_active, published_at } = req.body;
    try {
        await pool.query(
            `UPDATE portal_notifications
             SET title=?, content=?, type=?, priority=?, is_active=?, published_at=?, updated_at=NOW()
             WHERE id=?`,
            [title, content || null, type, priority, is_active, published_at, req.params.id]
        );
        res.json({ success: true, message: 'Notification updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/notifications/:id — delete
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM portal_notifications WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Notification deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PATCH /api/notifications/:id/toggle — toggle active
router.patch('/:id/toggle', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.query(
            'UPDATE portal_notifications SET is_active = NOT is_active WHERE id = ?',
            [req.params.id]
        );
        res.json({ success: true, message: 'Status toggled' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
