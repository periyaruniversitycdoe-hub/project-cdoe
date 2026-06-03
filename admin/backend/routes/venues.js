
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { getActiveSessionId }   = require('../services/sessionCache');

// Migration: make scheduling columns nullable so exam details live in generation, not venue master
;(async () => {
  try {
    const conn = await pool.getConnection();
    try {
      await conn.query('ALTER TABLE venues MODIFY COLUMN exam_date DATE NULL');
      await conn.query('ALTER TABLE venues MODIFY COLUMN from_time TIME NULL');
      await conn.query('ALTER TABLE venues MODIFY COLUMN to_time   TIME NULL');
    } catch (_) { /* columns already nullable or table not yet created — safe */ }
    finally { conn.release(); }
  } catch (_) {}
})();

// ── GET /api/venues?session_id=active|all|<id>&department= ─────────────────────
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { session_id, department } = req.query;

    let resolvedSessionId = session_id;
    if (!resolvedSessionId || resolvedSessionId === 'active') {
      resolvedSessionId = await getActiveSessionId();
    } else if (resolvedSessionId === 'all') {
      resolvedSessionId = null;
    }

    const conditions = [];
    const params     = [];

    if (resolvedSessionId) { conditions.push('v.session_id = ?'); params.push(resolvedSessionId); }
    if (department)        { conditions.push('v.department = ?'); params.push(department); }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.execute(`
      SELECT v.*,
             CONCAT(s.month, ' ', s.year) AS session_name,
             TIME_FORMAT(v.from_time, '%h:%i %p') AS from_time_fmt,
             TIME_FORMAT(v.to_time,   '%h:%i %p') AS to_time_fmt,
             COALESCE((
               SELECT COUNT(*) FROM hall_tickets ht WHERE ht.venue_id = v.id
             ), 0) AS allocated_count,
             v.capacity - COALESCE((
               SELECT COUNT(*) FROM hall_tickets ht WHERE ht.venue_id = v.id
             ), 0) AS remaining_seats
      FROM venues v
      JOIN sessions s ON v.session_id = s.id
      ${whereClause}
      ORDER BY v.department, v.hall_name
    `, params);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/venues/:id ────────────────────────────────────────────────────────
router.get('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT v.*,
             CONCAT(s.month, ' ', s.year) AS session_name,
             TIME_FORMAT(v.from_time, '%h:%i %p') AS from_time_fmt,
             TIME_FORMAT(v.to_time,   '%h:%i %p') AS to_time_fmt,
             COALESCE((
               SELECT COUNT(*) FROM hall_tickets ht WHERE ht.venue_id = v.id
             ), 0) AS allocated_count
      FROM venues v
      JOIN sessions s ON v.session_id = s.id
      WHERE v.id = ?
    `, [req.params.id]);

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'Venue not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/venues ───────────────────────────────────────────────────────────
// Venue master: Session, Department, Hall Name, Capacity only.
// Exam scheduling (date/time) is captured at hall ticket generation time.
router.post('/', verifyToken, isAdmin, async (req, res) => {
  const { session_id, department, hall_name, capacity } = req.body;

  if (!session_id || !department || !hall_name || !capacity) {
    return res.status(400).json({ success: false, message: 'Session, Department, Hall Name and Capacity are required' });
  }
  const cap = parseInt(capacity, 10);
  if (isNaN(cap) || cap < 1) {
    return res.status(400).json({ success: false, message: 'Capacity must be a positive number' });
  }

  try {
    const [result] = await pool.execute(
      'INSERT INTO venues (session_id, department, hall_name, capacity) VALUES (?, ?, ?, ?)',
      [session_id, department, hall_name, cap]
    );
    res.json({ success: true, message: 'Venue created successfully', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/venues/:id ────────────────────────────────────────────────────────
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  const { session_id, department, hall_name, capacity } = req.body;
  const { id } = req.params;

  if (!session_id || !department || !hall_name || !capacity) {
    return res.status(400).json({ success: false, message: 'Session, Department, Hall Name and Capacity are required' });
  }
  const cap = parseInt(capacity, 10);
  if (isNaN(cap) || cap < 1) {
    return res.status(400).json({ success: false, message: 'Capacity must be a positive number' });
  }

  try {
    // Capacity must not go below already-allocated count
    const [[{ allocated }]] = await pool.execute(
      'SELECT COUNT(*) as allocated FROM hall_tickets WHERE venue_id = ?', [id]
    );
    if (cap < allocated) {
      return res.status(400).json({
        success: false,
        message: `Cannot reduce capacity below ${allocated} (students already allocated to this venue).`
      });
    }

    await pool.execute(
      `UPDATE venues SET session_id=?, department=?, hall_name=?, capacity=?, updated_at=NOW()
       WHERE id=?`,
      [session_id, department, hall_name, cap, id]
    );

    // Enterprise sync: cascade department change to dependent hall_tickets
    await pool.execute(
      `UPDATE hall_tickets SET department=? WHERE venue_id=?`,
      [department, id]
    );

    res.json({ success: true, message: 'Venue updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/venues/:id ─────────────────────────────────────────────────────
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const [[{ allocated }]] = await pool.execute(
      'SELECT COUNT(*) as allocated FROM hall_tickets WHERE venue_id = ?', [req.params.id]
    );
    if (allocated > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${allocated} hall ticket(s) are already allocated to this venue. Revoke them first.`
      });
    }
    await pool.execute('DELETE FROM venues WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Venue deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
