const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/:table', async (req, res) => {
    const { table } = req.params;
    const allowed = [
        'master_designations', 'departments', 'master_institutes',
        'master_districts', 'master_disciplines', 'research_centres'
    ];

    if (!allowed.includes(table)) return res.status(400).json({ message: 'Invalid table' });

    const dbTable = table;

    // Tables that have an is_active column — only return active rows for dropdowns
    const hasActiveFlag = [
        'master_designations', 'departments', 'master_institutes',
        'master_districts', 'master_disciplines'
    ];

    try {
        const where = hasActiveFlag.includes(table) ? 'WHERE is_active = 1' : '';
        // For institutes also return college_code so the form can display it
        let select = 'id, name';
        if (table === 'master_institutes') {
            select = 'id, name, college_code, abbreviation';
        } else if (table === 'master_designations') {
            select = 'id, name, max_capacity, full_time_max_capacity, part_time_max_capacity, full_time_required, part_time_required, is_active';
        }
        const [rows] = await pool.query(`SELECT ${select} FROM ${dbTable} ${where} ORDER BY name`);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
