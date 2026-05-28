const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/:table', async (req, res) => {
    const { table } = req.params;
    const allowed = [
        'master_districts', 'master_centre_types', 'master_institutes'
    ];
    
    if (!allowed.includes(table)) return res.status(400).json({ message: 'Invalid table' });
    
    try {
        let query;
        if (table === 'master_institutes') {
            // Return explicit college_code + college_name pairs — no serial numbers exposed.
            // Both dropdowns (College Code, College Name) use these semantic identifiers directly.
            // Sorted by college_code ASC so the Code dropdown shows codes in ascending order.
            // Only include institutes that have a college_code (NULL/empty ones cannot be selected).
            query = `
                SELECT
                    id,
                    college_code,
                    name          AS college_name,
                    abbreviation
                FROM master_institutes
                WHERE is_active = 1
                  AND college_code IS NOT NULL
                  AND college_code != ''
                ORDER BY college_code ASC
            `;
        } else {
            query = `SELECT id, name FROM ${table} WHERE is_active = 1 ORDER BY name`;
        }
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
