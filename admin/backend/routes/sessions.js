
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { invalidate: invalidateSessionCache } = require('../services/sessionCache');

/**
 * GET /api/sessions/active  (public — student frontend calls this)
 * Returns the single active session; 404 if none
 */
router.get('/active', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM sessions WHERE is_active = 1 LIMIT 1'
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'No active session found' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/sessions/filters
 * Distinct years & months present in the sessions table — used by application list filters
 */
router.get('/filters', verifyToken, isAdmin, async (req, res) => {
    try {
        const [years] = await pool.execute(
            'SELECT DISTINCT year FROM sessions ORDER BY year DESC'
        );
        const [months] = await pool.execute(`
            SELECT DISTINCT month FROM sessions
            ORDER BY FIELD(month,
                'January','February','March','April','May','June',
                'July','August','September','October','November','December')
        `);
        res.json({
            success: true,
            data: {
                years: years.map(r => r.year),
                months: months.map(r => r.month),
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/sessions
 * All sessions with registered user count
 */
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT
                s.*,
                CONCAT(s.month, ' ', s.year) AS session_label,
                (SELECT COUNT(*) FROM users u WHERE u.session_id = s.id) AS registered_users
            FROM sessions s
            ORDER BY s.year DESC,
                     FIELD(s.month,'January','February','March','April','May','June',
                           'July','August','September','October','November','December') DESC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/sessions
 * Create a new session
 */
router.post('/', verifyToken, isAdmin, async (req, res) => {
    const { year, month, is_active, registration_open, application_open, session_type_id } = req.body;

    if (!year || !month) {
        return res.status(400).json({ success: false, message: 'Year and Month are required.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Enforce: only one active session at a time
        if (is_active) {
            await connection.execute('UPDATE sessions SET is_active = 0');
        }

        const typeId = session_type_id || 1;
        const [result] = await connection.execute(
            `INSERT INTO sessions (year, month, is_active, registration_open, application_open, session_type_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [year, month, is_active ? 1 : 0, registration_open ? 1 : 0, application_open ? 1 : 0, typeId]
        );

        await connection.commit();
        invalidateSessionCache();
        res.status(201).json({ success: true, message: 'Session created successfully.', id: result.insertId });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ success: false, message: err.message });
    } finally {
        connection.release();
    }
});

/**
 * PUT /api/sessions/:id
 * Full update of a session
 */
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    const { year, month, is_active, registration_open, application_open, session_type_id } = req.body;

    if (!year || !month) {
        return res.status(400).json({ success: false, message: 'Year and Month are required.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        if (is_active) {
            await connection.execute('UPDATE sessions SET is_active = 0');
        }

        const updateParams = [year, month, is_active ? 1 : 0, registration_open ? 1 : 0, application_open ? 1 : 0];
        let query = `UPDATE sessions SET year = ?, month = ?, is_active = ?, registration_open = ?, application_open = ?`;
        if (session_type_id !== undefined) {
            query += `, session_type_id = ?`;
            updateParams.push(session_type_id);
        }
        query += `, updated_at = NOW() WHERE id = ?`;
        updateParams.push(req.params.id);

        await connection.execute(query, updateParams);

        await connection.commit();
        invalidateSessionCache();
        res.json({ success: true, message: 'Session updated successfully.' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ success: false, message: err.message });
    } finally {
        connection.release();
    }
});

/**
 * PUT /api/sessions/:id/activate
 * Activate one session, automatically deactivate all others
 */
router.put('/:id/activate', verifyToken, isAdmin, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.execute('UPDATE sessions SET is_active = 0');
        await connection.execute(
            'UPDATE sessions SET is_active = 1, updated_at = NOW() WHERE id = ?',
            [req.params.id]
        );
        await connection.commit();
        invalidateSessionCache();
        res.json({ success: true, message: 'Session activated. All other sessions deactivated.' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ success: false, message: err.message });
    } finally {
        connection.release();
    }
});

/**
 * PUT /api/sessions/:id/toggle-registration
 */
router.put('/:id/toggle-registration', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT registration_open FROM sessions WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Session not found.' });

        const newVal = rows[0].registration_open ? 0 : 1;
        await pool.execute(
            'UPDATE sessions SET registration_open = ?, updated_at = NOW() WHERE id = ?',
            [newVal, req.params.id]
        );
        invalidateSessionCache();
        res.json({
            success: true,
            message: `Registration ${newVal ? 'opened' : 'closed'}.`,
            registration_open: !!newVal,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * PUT /api/sessions/:id/toggle-application
 */
router.put('/:id/toggle-application', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT application_open FROM sessions WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Session not found.' });

        const newVal = rows[0].application_open ? 0 : 1;
        await pool.execute(
            'UPDATE sessions SET application_open = ?, updated_at = NOW() WHERE id = ?',
            [newVal, req.params.id]
        );
        invalidateSessionCache();
        res.json({
            success: true,
            message: `Application submissions ${newVal ? 'opened' : 'closed'}.`,
            application_open: !!newVal,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * PUT /api/sessions/:id/toggle-result
 * Publish or unpublish entrance exam results for a session.
 * Publishing automatically closes application submissions (application_open = 0).
 */
router.put('/:id/toggle-result', verifyToken, isAdmin, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const [[session]] = await connection.execute(
            'SELECT result_published, application_open FROM sessions WHERE id = ?',
            [req.params.id]
        );
        if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });

        const newVal = session.result_published ? 0 : 1;

        // Publishing results forces application_open = 0 (no more submissions)
        const updateQuery = newVal
            ? 'UPDATE sessions SET result_published = 1, application_open = 0, updated_at = NOW() WHERE id = ?'
            : 'UPDATE sessions SET result_published = 0, updated_at = NOW() WHERE id = ?';

        await connection.execute(updateQuery, [req.params.id]);
        invalidateSessionCache();
        res.json({
            success: true,
            message: newVal
                ? 'Results published. Application submissions closed automatically.'
                : 'Results unpublished.',
            result_published: !!newVal,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    } finally {
        connection.release();
    }
});

/**
 * DELETE /api/sessions/:id
 * Refuses deletion if users are assigned to this session
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[{ count }]] = await pool.execute(
            'SELECT COUNT(*) AS count FROM users WHERE session_id = ?',
            [req.params.id]
        );
        if (count > 0) {
            return res.status(409).json({
                success: false,
                message: `Cannot delete: ${count} registered user(s) belong to this session.`,
            });
        }
        await pool.execute('DELETE FROM sessions WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Session deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
