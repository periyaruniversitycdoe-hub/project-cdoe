const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const path = require('path');
const pool = require('../config/db');
const { signToken } = require('../middleware/auth');
const credSvc = require('../../../shared/credential/credentialNotificationService');

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
    const { name, email, password, mobile } = req.body;
    if (!name || !email || !password)
        return res.status(400).json({ message: 'Name, email and password are required' });

    try {
        const [existing] = await pool.query('SELECT id FROM center_users WHERE email = ?', [email]);
        if (existing.length > 0)
            return res.status(409).json({ message: 'Email already registered' });

        // Auto-link to research_centres if email matches hod_email or email
        const [centreRows] = await pool.query(
            'SELECT id FROM research_centres WHERE (email = ? OR hod_email = ?) AND status = "Approved" LIMIT 1',
            [email, email]
        );
        const centerId = centreRows.length > 0 ? centreRows[0].id : null;

        const hashed = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            'INSERT INTO center_users (center_id, name, email, password, mobile, status) VALUES (?, ?, ?, ?, ?, "active")',
            [centerId, name, email, hashed, mobile || null]
        );

        const token = signToken({ id: result.insertId, email, name, role: 'center' });
        res.status(201).json({
            message: 'Account created successfully',
            token,
            user: { id: result.insertId, name, email, centerId, role: 'center' }
        });

        // Credential notification (non-blocking)
        const loginUrl = process.env.CENTER_PORTAL_URL || 'http://localhost:5176';
        credSvc.notify({ db: pool, name, email, password, portalType: 'Center', loginUrl }).catch(() => {});
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ message: 'Email and password are required' });

    try {
        const [rows] = await pool.query('SELECT * FROM center_users WHERE email = ?', [email]);
        if (rows.length === 0)
            return res.status(401).json({ message: 'Invalid email or password' });

        const user = rows[0];
        if (user.status === 'suspended')
            return res.status(403).json({ message: 'Account suspended. Contact admin.' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid)
            return res.status(401).json({ message: 'Invalid email or password' });

        const token = signToken({ id: user.id, email: user.email, name: user.name, role: 'center' });
        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, name: user.name, email: user.email, centerId: user.center_id, role: 'center' }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
