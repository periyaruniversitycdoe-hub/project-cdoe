const { safeError } = require('../../../shared/security/safeError');
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// â”€â”€â”€ STATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/states', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, state_name, created_at FROM states ORDER BY state_name ASC');
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

router.post('/states', verifyToken, isAdmin, async (req, res) => {
    const { state_name } = req.body;
    if (!state_name?.trim()) return res.status(400).json({ success: false, message: 'State name is required' });
    try {
        const [result] = await pool.execute('INSERT INTO states (state_name) VALUES (?)', [state_name.trim()]);
        res.json({ success: true, message: 'State added', id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'State already exists' });
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

router.put('/states/:id', verifyToken, isAdmin, async (req, res) => {
    const { state_name } = req.body;
    if (!state_name?.trim()) return res.status(400).json({ success: false, message: 'State name is required' });
    try {
        await pool.execute('UPDATE states SET state_name = ? WHERE id = ?', [state_name.trim(), req.params.id]);
        res.json({ success: true, message: 'State updated' });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

router.delete('/states/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [districts] = await pool.execute('SELECT COUNT(*) AS cnt FROM districts WHERE state_id = ?', [req.params.id]);
        if (districts[0].cnt > 0) {
            return res.status(409).json({ success: false, message: `Cannot delete: ${districts[0].cnt} district(s) belong to this state. Delete districts first.` });
        }
        await pool.execute('DELETE FROM states WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'State deleted' });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// â”€â”€â”€ DISTRICTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/districts', async (req, res) => {
    const { state_id } = req.query;
    try {
        let rows;
        if (state_id) {
            [rows] = await pool.execute(
                `SELECT d.id, d.district_name, d.state_id, s.state_name, d.created_at
                 FROM districts d JOIN states s ON d.state_id = s.id
                 WHERE d.state_id = ? ORDER BY d.district_name ASC`,
                [state_id]
            );
        } else {
            [rows] = await pool.execute(
                `SELECT d.id, d.district_name, d.state_id, s.state_name, d.created_at
                 FROM districts d JOIN states s ON d.state_id = s.id
                 ORDER BY s.state_name ASC, d.district_name ASC`
            );
        }
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

router.post('/districts', verifyToken, isAdmin, async (req, res) => {
    const { state_id, district_name } = req.body;
    if (!state_id || !district_name?.trim()) {
        return res.status(400).json({ success: false, message: 'State and district name are required' });
    }
    try {
        const [result] = await pool.execute(
            'INSERT INTO districts (state_id, district_name) VALUES (?, ?)',
            [state_id, district_name.trim()]
        );
        res.json({ success: true, message: 'District added', id: result.insertId });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

router.put('/districts/:id', verifyToken, isAdmin, async (req, res) => {
    const { district_name, state_id } = req.body;
    if (!district_name?.trim()) return res.status(400).json({ success: false, message: 'District name is required' });
    try {
        await pool.execute(
            'UPDATE districts SET district_name = ?, state_id = ? WHERE id = ?',
            [district_name.trim(), state_id, req.params.id]
        );
        res.json({ success: true, message: 'District updated' });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

router.delete('/districts/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.execute('DELETE FROM districts WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'District deleted' });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

module.exports = router;
