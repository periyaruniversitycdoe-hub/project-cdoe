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
        const [existing] = await pool.query('SELECT id FROM supervisor_users WHERE email = ?', [email]);
        if (existing.length > 0)
            return res.status(409).json({ message: 'Email already registered' });

        // Auto-link to supervisors table if email matches
        const [supervisorRows] = await pool.query(
            'SELECT id FROM supervisors WHERE email = ? AND status = "Approved" LIMIT 1',
            [email]
        );
        const supervisorId = supervisorRows.length > 0 ? supervisorRows[0].id : null;

        const hashed = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            'INSERT INTO supervisor_users (supervisor_id, name, email, password, mobile, status) VALUES (?, ?, ?, ?, ?, "active")',
            [supervisorId, name, email, hashed, mobile || null]
        );

        const token = signToken({ id: result.insertId, email, name, role: 'supervisor' });
        res.status(201).json({
            message: 'Account created successfully',
            token,
            user: { id: result.insertId, name, email, supervisorId, role: 'supervisor' }
        });

        // Credential notification (non-blocking)
        const loginUrl = process.env.SUPERVISOR_PORTAL_URL || 'http://localhost:5175';
        credSvc.notify({ db: pool, name, email, password, portalType: 'Supervisor', loginUrl }).catch(() => {});
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
        const [rows] = await pool.query(
            'SELECT * FROM supervisor_users WHERE email = ?',
            [email]
        );
        if (rows.length === 0)
            return res.status(401).json({ message: 'Invalid email or password' });

        const user = rows[0];
        if (user.status === 'suspended')
            return res.status(403).json({ message: 'Account suspended. Contact admin.' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid)
            return res.status(401).json({ message: 'Invalid email or password' });

        const token = signToken({ id: user.id, email: user.email, name: user.name, role: 'supervisor' });
        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, name: user.name, email: user.email, supervisorId: user.supervisor_id, role: 'supervisor' }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
