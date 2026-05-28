const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/:table', async (req, res) => {
    const { table } = req.params;
    const allowed = [
        'master_designations', 'master_departments', 'master_institutes',
        'master_districts', 'master_disciplines', 'research_centres',
        'master_special_designations'
    ];

    if (!allowed.includes(table)) return res.status(400).json({ message: 'Invalid table' });

    // Tables that have an is_active column — only return active rows for dropdowns
    const hasActiveFlag = [
        'master_designations', 'master_departments', 'master_institutes',
        'master_districts', 'master_disciplines', 'master_special_designations'
    ];

    try {
        const where = hasActiveFlag.includes(table) ? 'WHERE is_active = 1' : '';
        // For institutes also return college_code so the form can display it
        const select = table === 'master_institutes'
            ? 'id, name, college_code, abbreviation'
            : 'id, name';
        const [rows] = await pool.query(`SELECT ${select} FROM ${table} ${where} ORDER BY name`);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
